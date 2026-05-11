// ============================================================================
// 一次性脚本：把 https://www.cnblogs.com/<user> 的所有随笔迁移到 posts/
//
// 用法：
//   node scripts/migrate-cnblogs.mjs <博客园用户名>           # 只补不存在的
//   node scripts/migrate-cnblogs.mjs <博客园用户名> --force   # 全量覆盖
//   node scripts/migrate-cnblogs.mjs gitpull --max=3         # 只跑前 3 篇（调试）
//
// 行为：
//   - 抓所有分页随笔列表
//   - 每篇文章下载 HTML，提取 #cnblogs_post_body 正文 + 标签 + 时间
//   - 用 turndown 转 Markdown
//   - 自动识别并删除文章开头的 "本文XXXX年首发自本人原独立站点……" banner
//   - 智能识别原始发布年（"本文 2019 年首发"），找不到就用博客园的 posted 日期
//   - 把文章里所有图片下载到 assets/uploads/yyyy/mm/，并替换 Markdown 链接
//   - 写到 posts/<title>-<id>.md，frontmatter 里带 origin 元信息
// ============================================================================

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Buffer } from 'node:buffer';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as turndownGfm from 'turndown-plugin-gfm';

const args = process.argv.slice(2);
const username = args.find(a => !a.startsWith('--')) || 'gitpull';
const FORCE = args.includes('--force');
const MAX = (() => {
  const m = args.find(a => a.startsWith('--max='));
  return m ? parseInt(m.split('=')[1], 10) || Infinity : Infinity;
})();

const ROOT = `https://www.cnblogs.com/${username}`;
const POSTS_DIR = 'posts';
const today = new Date();
const UPLOAD_SUBDIR = `assets/uploads/${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;

// ---------- HTTP ----------
async function getHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getBuffer(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Referer': 'https://www.cnblogs.com/',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  return { buf, contentType: ct };
}

// ---------- 抓列表 ----------
function cleanTitle(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^\[\s*置顶\s*\]\s*/, '')
    .replace(/^【\s*置顶\s*】\s*/, '')
    .trim();
}

function gatherEntryMeta($, $title) {
  // 在博客园里，一个 .day 内有若干 <div class="postTitle"> + <div class="postCon"> + <div class="postDesc"> + .clear 顺序排列
  // 取该 .postTitle 之后、下一个 .postTitle 之前的所有兄弟节点作为本条目的元数据范围
  let desc = '';
  let summary = '';
  let $node = $title.next();
  while ($node.length && !$node.is('.postTitle')) {
    if (!summary) {
      const s = $node.find('.c_b_p_desc').first();
      if (s.length) summary = s.text().replace(/^\s*摘要：?\s*/, '').replace(/\s*阅读全文\s*$/, '').trim();
    }
    if (!desc) {
      const text = $node.text() || '';
      if (/posted\s*@/i.test(text)) desc = text;
    }
    $node = $node.next();
  }
  return { desc, summary };
}

async function fetchAllListItems() {
  const items = new Map();
  for (let page = 1; page <= 50; page++) {
    const url = `${ROOT}/default.html?page=${page}`;
    let html;
    try { html = await getHtml(url); }
    catch (e) {
      console.warn(`列表第 ${page} 页失败：${e.message}`);
      break;
    }
    const $ = cheerio.load(html);
    const titles = $('.postTitle a, a.postTitle2');
    let foundOnPage = 0;
    titles.each((i, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      if (!href) return;
      const m = href.match(/\/p\/(\d+)\.html/);
      if (!m) return;
      const id = m[1];
      const title = cleanTitle($a.text());
      const $title = $a.closest('.postTitle');
      const { desc, summary } = gatherEntryMeta($, $title);
      const dm = desc.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
      const cnblogsDate = dm
        ? `${dm[1]}-${dm[2]}-${dm[3]}T${dm[4]}:${dm[5]}:00+08:00`
        : (desc.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || '';
      if (items.has(id)) return;
      items.set(id, {
        id,
        url: href.startsWith('http') ? href : `https://www.cnblogs.com${href}`,
        title,
        cnblogsDate,
        summary,
      });
      foundOnPage++;
    });
    console.log(`列表 page ${page}: 找到 ${foundOnPage} 篇`);
    if (foundOnPage === 0) break;
  }
  return [...items.values()];
}

// ---------- 抓单篇 ----------
async function fetchArticle(item) {
  const html = await getHtml(item.url);
  const $ = cheerio.load(html);

  const body = $('#cnblogs_post_body');
  const titleNode = $('#cb_post_title_url').text().trim();
  const tags = [];
  const keywords = $('meta[name=keywords]').attr('content') || '';
  keywords.split(/[,，]/).map(t => t.trim()).filter(Boolean).forEach(t => tags.push(t));
  $('#BlogPostCategory a, #EntryTag a, #post_next_prev a, #blog_post_info a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!text) return;
    if (/\/category\//.test(href) || /\/tag\//.test(href)) {
      tags.push(text);
    }
  });

  // post-date 在右下角元数据里
  let postDate = '';
  const postDateEl = $('#post-date');
  if (postDateEl.length) postDate = postDateEl.attr('data-utc') || postDateEl.text().trim();

  // 取不到就从列表带过来的
  const date = postDate || item.cnblogsDate || '';

  return {
    id: item.id,
    url: item.url,
    title: cleanTitle(titleNode || item.title),
    cnblogsDate: date,
    bodyHtml: body.html() || '',
    tags: [...new Set(tags)],
    summary: item.summary,
  };
}

// ---------- HTML → Markdown ----------
const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});
td.use(turndownGfm.gfm);
td.addRule('preferLanguage', {
  filter: node => node.nodeName === 'PRE' && node.firstChild && node.firstChild.nodeName === 'CODE',
  replacement: (content, node) => {
    const code = node.firstChild;
    const cls = (code.getAttribute('class') || '');
    let lang = '';
    const m = cls.match(/(?:language-|brush:\s*|cnb-)([a-zA-Z0-9_+-]+)/);
    if (m) lang = m[1];
    const text = code.textContent.replace(/\n+$/, '');
    return '\n\n```' + lang + '\n' + text + '\n```\n\n';
  },
});

// ---------- 处理 banner ----------
const BANNER_RE_LIST = [
  /^[\*_\s>]*本文\s*\d{4}\s*年首发自本人原独立站点[^\n]*?博客园[。.\s]*\n+/,
  /^[\*_\s>]*本文\s*\d{4}\s*年首发[^\n]*独立站点[^\n]*\n+/,
];

function stripBanner(md) {
  for (const re of BANNER_RE_LIST) {
    if (re.test(md)) return md.replace(re, '');
  }
  return md;
}

function stripBannerInline(text) {
  return String(text || '').replace(/本文\s*\d{4}\s*年首发自本人原独立站点[，,]?\s*后来疲于生活[^。]*?博客园[。.\s]*/g, '').trim();
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

function inferOriginalYear(htmlOrMd) {
  const m = htmlOrMd.match(/本文\s*(\d{4})\s*年首发/);
  return m ? m[1] : null;
}

// ---------- 图片下载 ----------
function extOf(url, contentType = '') {
  const m = url.match(/\.(png|jpe?g|gif|webp|svg|bmp|avif)(?:\?|#|$)/i);
  if (m) return '.' + m[1].toLowerCase().replace('jpeg', 'jpg');
  if (/png/i.test(contentType)) return '.png';
  if (/gif/i.test(contentType)) return '.gif';
  if (/webp/i.test(contentType)) return '.webp';
  if (/svg/i.test(contentType)) return '.svg';
  if (/jpeg/i.test(contentType)) return '.jpg';
  return '.bin';
}

async function downloadImage(srcUrl, slug, index) {
  if (!srcUrl || srcUrl.startsWith('data:')) return null;
  let abs = srcUrl;
  if (abs.startsWith('//')) abs = 'https:' + abs;
  try {
    const { buf, contentType } = await getBuffer(abs);
    const ext = extOf(abs, contentType);
    const fname = `${slug}-${String(index).padStart(2, '0')}${ext}`;
    if (!existsSync(UPLOAD_SUBDIR)) mkdirSync(UPLOAD_SUBDIR, { recursive: true });
    const localPath = `${UPLOAD_SUBDIR}/${fname}`;
    writeFileSync(localPath, buf);
    return localPath;
  } catch (e) {
    console.warn(`  ⚠ 图片下载失败 ${abs}：${e.message}`);
    return null;
  }
}

async function rewriteImages(md, slug) {
  const matches = [...md.matchAll(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)];
  let out = md;
  let i = 0;
  for (const match of matches) {
    const url = match[2];
    if (!/^https?:\/\//.test(url) && !url.startsWith('//')) continue;
    i++;
    process.stdout.write(`  · 下载图 ${i}/${matches.length}：${url.slice(0, 80)}…\n`);
    const local = await downloadImage(url, slug, i);
    if (local) out = out.split(match[0]).join(`![${match[1]}](${local})`);
  }
  return out;
}

// ---------- slug ----------
function slugify(title, id) {
  const cleaned = String(title || '')
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[\/\\?#%*:|"<>!@（）()\[\]【】《》。，、；！？「」『』·~`^$+={}]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return cleaned ? `${cleaned}-${id}` : `cnblogs-${id}`;
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
    if (v == null || v === '') continue;
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

function extractSummary(text, limit = 90) {
  const plain = String(text || '').replace(/```[\s\S]+?```/g, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[[^\]]*]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  return plain.length > limit ? plain.slice(0, limit) + '…' : plain;
}

// ---------- 主流程 ----------
async function main() {
  console.log(`迁移源：${ROOT}\n输出：${POSTS_DIR}\n图片：${UPLOAD_SUBDIR}\n`);

  if (!existsSync(POSTS_DIR)) mkdirSync(POSTS_DIR, { recursive: true });

  const list = await fetchAllListItems();
  console.log(`\n共发现 ${list.length} 篇文章\n`);

  const results = { written: [], skipped: [], failed: [] };

  for (let i = 0; i < list.length && i < MAX; i++) {
    const item = list[i];
    const slug = slugify(item.title, item.id);
    const filePath = `${POSTS_DIR}/${slug}.md`;
    if (!FORCE && existsSync(filePath)) {
      console.log(`[${i + 1}/${list.length}] 跳过（已存在）：${item.title}`);
      results.skipped.push(slug);
      continue;
    }
    console.log(`[${i + 1}/${list.length}] 抓取：${item.title}`);

    let art;
    try { art = await fetchArticle(item); }
    catch (e) {
      console.warn(`  ⚠ 抓取失败：${e.message}`);
      results.failed.push({ id: item.id, error: e.message });
      continue;
    }

    if (!art.bodyHtml) {
      console.warn(`  ⚠ 正文为空，跳过`);
      results.failed.push({ id: item.id, error: '正文为空' });
      continue;
    }

    let md = td.turndown(art.bodyHtml);
    const originalYear = inferOriginalYear(art.bodyHtml) || inferOriginalYear(md);
    md = stripBanner(md);
    md = md.replace(/\n{3,}/g, '\n\n').trim();

    md = await rewriteImages(md, slug);

    const cnblogsIso = toIsoDate(art.cnblogsDate);
    const dateIso = originalYear
      ? `${originalYear}-01-01T00:00:00+08:00`
      : (cnblogsIso || new Date().toISOString());

    const rawSummary = item.summary || extractSummary(md);
    const summary = extractSummary(stripBannerInline(rawSummary), 90);

    const frontmatter = buildFrontmatter({
      title: art.title,
      date: dateIso,
      updated: cnblogsIso || dateIso,
      author: '兰州小红鸡',
      tags: art.tags,
      summary,
      origin: {
        from: 'cnblogs',
        url: art.url,
        id: art.id,
        cnblogsDate: art.cnblogsDate,
        originalYear: originalYear || '',
      },
    });

    writeFileSync(filePath, frontmatter + '\n\n' + md + '\n', 'utf8');
    console.log(`  ✓ 写入 ${filePath}`);
    results.written.push(slug);
  }

  console.log('\n=== 迁移完成 ===');
  console.log(`写入：${results.written.length} 篇`);
  console.log(`跳过：${results.skipped.length} 篇（已存在，加 --force 可覆盖）`);
  console.log(`失败：${results.failed.length} 篇`);
  if (results.failed.length) {
    for (const f of results.failed) console.log(`  - ${f.id}: ${f.error}`);
  }
  console.log('\n下一步建议：');
  console.log('  1. 跑一次 `node scripts/build.mjs` 重建 posts.json / sitemap');
  console.log('  2. 检查 posts/ 里的内容，必要时手动改');
  console.log('  3. git add posts assets data sitemap.xml rss.xml && git commit && git push');
}

main().catch(e => { console.error(e); process.exit(1); });
