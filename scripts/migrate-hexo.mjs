// ============================================================================
// 一次性脚本：把 Hexo 博客（旧站点）的文章迁移到 posts/
//
// 用法：
//   node scripts/migrate-hexo.mjs <站点根 URL> [--force] [--dry] [--max=N] \
//          [--exclude-cat=资源,水文]
//
// 默认排除分类：资源, 水文（覆盖时通过 --exclude-cat 覆盖）
// 自动跳过：标题与已有 posts/*.md 高度重复的（清洗后逐字相同）
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as turndownGfm from 'turndown-plugin-gfm';

const args = process.argv.slice(2);
const SITE = (args.find(a => a.startsWith('http')) || 'https://flymysql.github.io').replace(/\/$/, '');
const FORCE = args.includes('--force');
const DRY = args.includes('--dry');
const MAX = (() => {
  const m = args.find(a => a.startsWith('--max='));
  return m ? parseInt(m.split('=')[1], 10) || Infinity : Infinity;
})();
const EXCLUDE_CATS = (() => {
  const m = args.find(a => a.startsWith('--exclude-cat='));
  const list = m ? m.split('=')[1] : '资源,水文';
  return list.split(/[,，]/).map(s => s.trim()).filter(Boolean);
})();

const POSTS_DIR = 'posts';
const today = new Date();
const UPLOAD_SUBDIR = `assets/uploads/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;

console.log(`迁移源：${SITE}`);
console.log(`排除分类：${EXCLUDE_CATS.join(', ') || '（无）'}`);
console.log(`图片：${UPLOAD_SUBDIR}`);
console.log(`模式：${DRY ? 'DRY-RUN（不写文件）' : (FORCE ? 'FORCE（覆盖已有）' : '增量')}`);
console.log('');

// ---------- HTTP ----------
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function getHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': SITE + '/' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType: res.headers.get('content-type') || '' };
}

// ---------- 抓所有文章链接 ----------
async function fetchAllPostUrls() {
  const all = new Set();
  for (let p = 1; p <= 50; p++) {
    const url = p === 1 ? `${SITE}/archives/` : `${SITE}/archives/page/${p}/`;
    let html;
    try { html = await getHtml(url); }
    catch (e) {
      console.log(`第 ${p} 页 ${e.message}`);
      break;
    }
    const links = [...new Set([...html.matchAll(/href="(\/post\/[a-z0-9]+\.html)"/g)].map(m => m[1]))];
    if (!links.length) break;
    console.log(`列表 page ${p}: ${links.length} 篇`);
    links.forEach(l => all.add(l));
  }
  return [...all];
}

// ---------- 抓单篇 ----------
async function fetchArticle(pathOnSite) {
  const url = SITE + pathOnSite;
  const html = await getHtml(url);
  const $ = cheerio.load(html);

  const title = $('meta[property="og:title"]').attr('content') || $('h1.post-title').first().text().trim();
  const time = $('time[itemprop=datePublished]').attr('datetime') || $('time').first().attr('datetime') || '';
  const updated = $('time[itemprop=dateModified]').attr('datetime') || time;

  const catText = $('.post-meta-categories, .post-category').text();
  const cats = [...catText.matchAll(/分类于\s*([^\s|·,，]+)/g)].map(m => m[1]);

  const rawTags = $('.post-meta-tags a, .post-tags a, [rel=tag]').toArray()
    .map(a => $(a).text().replace(/^[📜\s]+/, '').trim())
    .filter(Boolean);
  const tags = [...new Set(rawTags)];

  const body = $('#article-container, .post-content, .article-entry, .post-body').first();

  // 让本地 Hexo 图床/相对路径转绝对
  body.find('img').each((i, el) => {
    let src = $(el).attr('data-src') || $(el).attr('src');
    if (!src) return;
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = SITE + src;
    $(el).attr('src', src);
    $(el).removeAttr('data-src');
  });
  body.find('a').each((i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (href.startsWith('//')) $(el).attr('href', 'https:' + href);
    else if (href.startsWith('/')) $(el).attr('href', SITE + href);
  });

  return {
    url,
    pathOnSite,
    title: cleanTitle(title),
    time, updated,
    cats, tags,
    bodyHtml: body.html() || '',
  };
}

function cleanTitle(raw) {
  return String(raw || '').replace(/\s+/g, ' ').replace(/^\[\s*置顶\s*\]\s*/, '').trim();
}

// ---------- HTML → Markdown ----------
const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});
td.use(turndownGfm.gfm);
td.addRule('hexoCodeTable', {
  filter: node => {
    if (node.nodeName !== 'TABLE') return false;
    const gutter = node.querySelector && node.querySelector('td.gutter');
    const code = node.querySelector && node.querySelector('td.code');
    return Boolean(gutter && code);
  },
  replacement: (content, node) => {
    const codeCell = node.querySelector('td.code');
    const lines = [...codeCell.querySelectorAll('.line')].map(el => el.textContent || '');
    const text = (lines.length ? lines.join('\n') : (codeCell.textContent || ''))
      .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n+$/g, '');
    return '\n\n```\n' + text + '\n```\n\n';
  },
});
td.addRule('preferLanguage', {
  filter: node => node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE',
  replacement: (content, node) => {
    const code = node.firstChild;
    const cls = (code.getAttribute('class') || '');
    let lang = '';
    const m = cls.match(/(?:language-|brush:\s*|hljs-)([a-zA-Z0-9_+-]+)/);
    if (m) lang = m[1];
    const text = code.textContent.replace(/\n+$/, '');
    return '\n\n```' + lang + '\n' + text + '\n```\n\n';
  },
});

// 清掉 hexo 主题里常见的脚注/扩展容器（如果有 .post-copyright、.post-comments 之类，已经被 #article-container 限制掉了）

// ---------- 图片下载 ----------
function extOf(url, contentType = '') {
  const m = url.match(/\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:\?|#|$)/i);
  if (m) return '.' + m[1].toLowerCase().replace('jpeg', 'jpg');
  if (/png/i.test(contentType)) return '.png';
  if (/gif/i.test(contentType)) return '.gif';
  if (/webp/i.test(contentType)) return '.webp';
  if (/svg/i.test(contentType)) return '.svg';
  if (/jpeg|jpg/i.test(contentType)) return '.jpg';
  return '.bin';
}

async function downloadImage(srcUrl, slug, idx) {
  if (!srcUrl || srcUrl.startsWith('data:')) return null;
  let abs = srcUrl;
  if (abs.startsWith('//')) abs = 'https:' + abs;
  try {
    const { buf, contentType } = await getBuffer(abs);
    const ext = extOf(abs, contentType);
    const fname = `${slug}-${String(idx).padStart(2, '0')}${ext}`;
    if (!existsSync(UPLOAD_SUBDIR)) mkdirSync(UPLOAD_SUBDIR, { recursive: true });
    const local = `${UPLOAD_SUBDIR}/${fname}`;
    writeFileSync(local, buf);
    return local;
  } catch (e) {
    console.warn(`  ⚠ 图 ${abs.slice(0, 80)}…：${e.message}`);
    return null;
  }
}

async function rewriteImages(md, slug) {
  const matches = [...md.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)];
  if (!matches.length) return md;
  let out = md;
  let i = 0;
  for (const m of matches) {
    const url = m[2];
    if (!/^https?:\/\//.test(url) && !url.startsWith('//')) continue;
    i++;
    process.stdout.write(`  · 图 ${i}/${matches.length}：${url.slice(0, 60)}…\n`);
    const local = await downloadImage(url, slug, i);
    if (local) out = out.split(m[0]).join(`![${m[1]}](${local})`);
    else out = out.split(m[0]).join(`![${m[1]}](${url})`); // 失败保留外链
  }
  return out;
}

// ---------- slug ----------
function slugify(title, hash) {
  const cleaned = String(title || '')
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[\/\\?#%*:：|"<>!！@（）()\[\]【】《》。，,、；;？?「」『』·~`^$+={}'’“”]/g, '')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned ? `${cleaned}-${hash}` : `hexo-${hash}`;
}

// ---------- frontmatter ----------
function escapeYaml(s) {
  const v = String(s == null ? '' : s);
  if (/^[\w\-./:T+]+$/.test(v) && v.length < 60) return v;
  return JSON.stringify(v);
}

function buildFrontmatter(meta) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const it of v) lines.push(`  - ${escapeYaml(it)}`);
    } else if (typeof v === 'object') {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 == null || v2 === '') continue;
        lines.push(`  ${k2}: ${escapeYaml(v2)}`);
      }
    } else {
      lines.push(`${k}: ${escapeYaml(v)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function extractSummary(text, max = 90) {
  const plain = String(text || '').replace(/```[\s\S]+?```/g, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[[^\]]*]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return plain.length > max ? plain.slice(0, max) + '…' : plain;
}

function toIsoDate(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[\sT](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return '';
  const [, y, mo, d, hh = '00', mm = '00', ss = '00'] = m;
  return `${y}-${mo}-${d}T${hh}:${mm}:${ss}+08:00`;
}

// ---------- 已有文章索引（用于判重） ----------
function normalizeTitle(t) {
  return String(t || '').replace(/\s+/g, '').replace(/[\[\]【】《》「」『』(),，、!！?？：:；;\-—_·]/g, '').toLowerCase();
}

function loadExistingTitles() {
  const titles = new Map(); // norm-title => path
  if (!existsSync(POSTS_DIR)) return titles;
  for (const f of readdirSync(POSTS_DIR).filter(x => x.endsWith('.md'))) {
    const raw = readFileSync(`${POSTS_DIR}/${f}`, 'utf8');
    const m = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) continue;
    const tm = m[1].match(/title\s*:\s*"?([^"\n]+?)"?$/m);
    if (tm) titles.set(normalizeTitle(tm[1]), f);
  }
  return titles;
}

// ---------- 主 ----------
async function main() {
  if (!existsSync(POSTS_DIR)) mkdirSync(POSTS_DIR, { recursive: true });

  const urls = await fetchAllPostUrls();
  console.log(`\n共发现 ${urls.length} 篇文章\n`);

  const existing = loadExistingTitles();
  const results = { written: [], excluded: [], duplicate: [], skipped: [], failed: [] };

  for (let i = 0; i < urls.length && results.written.length < MAX; i++) {
    const u = urls[i];
    let art;
    try { art = await fetchArticle(u); }
    catch (e) { console.warn(`[${i + 1}/${urls.length}] 抓失败 ${u}: ${e.message}`); results.failed.push({ url: u, error: e.message }); continue; }

    if (!art.bodyHtml) { results.failed.push({ url: u, error: '正文为空' }); continue; }

    const excluded = art.cats.find(c => EXCLUDE_CATS.includes(c));
    if (excluded) {
      console.log(`[${i + 1}/${urls.length}] 排除[${excluded}]：${art.title}`);
      results.excluded.push({ url: u, title: art.title, cat: excluded });
      continue;
    }

    const dup = existing.get(normalizeTitle(art.title));
    if (dup) {
      console.log(`[${i + 1}/${urls.length}] 重复跳过（已有 ${dup}）：${art.title}`);
      results.duplicate.push({ url: u, title: art.title, existing: dup });
      continue;
    }

    const hash = (u.match(/\/post\/([a-z0-9]+)\.html/) || [])[1] || String(i);
    const slug = slugify(art.title, hash);
    const filePath = `${POSTS_DIR}/${slug}.md`;

    if (!FORCE && existsSync(filePath)) {
      console.log(`[${i + 1}/${urls.length}] 已存在跳过：${art.title}`);
      results.skipped.push(slug);
      continue;
    }

    console.log(`[${i + 1}/${urls.length}] 抓取：${art.title}`);
    let md = td.turndown(art.bodyHtml);
    md = md.replace(/\n{3,}/g, '\n\n').trim();
    if (!DRY) md = await rewriteImages(md, slug);

    const dateIso = toIsoDate(art.time) || new Date().toISOString();
    const updIso = toIsoDate(art.updated) || dateIso;
    const summary = extractSummary(md);

    const frontmatter = buildFrontmatter({
      title: art.title,
      date: dateIso,
      updated: updIso,
      author: '兰州小红鸡',
      tags: art.tags,
      summary,
      origin: { from: 'hexo', url: art.url, categories: art.cats.join(',') },
    });

    if (DRY) {
      console.log(`  [dry-run] 将写入 ${filePath}`);
      console.log(`  cats=${art.cats.join('/')}  tags=${art.tags.join(',')}`);
    } else {
      writeFileSync(filePath, frontmatter + '\n\n' + md + '\n', 'utf8');
      console.log(`  ✓ ${filePath}`);
    }
    results.written.push({ slug, title: art.title });
    // 现已写入，加入 existing 防止后面再次同标题
    existing.set(normalizeTitle(art.title), `${slug}.md`);
  }

  console.log('\n=== 迁移完成 ===');
  console.log(`写入：${results.written.length}`);
  console.log(`分类排除：${results.excluded.length}`);
  console.log(`标题重复：${results.duplicate.length}`);
  console.log(`已存在跳过：${results.skipped.length}`);
  console.log(`失败：${results.failed.length}`);
  if (results.failed.length) results.failed.forEach(f => console.log(`  - ${f.url}: ${f.error}`));
  console.log('\n下一步：node scripts/build.mjs');
}

main().catch(e => { console.error(e); process.exit(1); });
