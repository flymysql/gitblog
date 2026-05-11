// ============================================================================
// 一次性脚本：
//   1) 合并 / 重命名标签
//   2) 给所有缺 cover 的文章自动从正文里挑一张图当封面
// 用法：node scripts/normalize-tags-and-covers.mjs [--dry]
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const POSTS_DIR = 'posts';
const DRY = process.argv.includes('--dry');

// ---------- 标签合并规则（值是 lowercase 后做匹配，去除空白）----------
const TAG_MAP = new Map([
  // → 博客建站
  ['github pages', '博客建站'],
  ['githubpages', '博客建站'],
  ['github-pages', '博客建站'],
  ['博客', '博客建站'],
  ['在线编辑', '博客建站'],
  ['wordpress', '博客建站'],

  // → 随想
  ['介绍', '随想'],
  ['日记', '随想'],

  // → 前端
  ['html', '前端'],
  ['javascript', '前端'],
  ['js', '前端'],
  ['css', '前端'],

  // → 随想
  ['水文', '随想'],

  // → 图计算
  ['nebula', '图计算'],
]);

function normalizeTag(t) {
  const key = String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return TAG_MAP.get(key) || t.trim();
}

// ---------- frontmatter 工具 ----------
function splitFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { yaml: '', body: raw, prefix: '' };
  return { yaml: m[1], body: raw.slice(m[0].length), prefix: m[0] };
}

function parseTagsBlock(yaml) {
  const m = yaml.match(/^tags:\s*\n((?:\s*-\s+.+\n?)+)/m);
  if (!m) {
    const inline = yaml.match(/^tags:\s*\[([^\]]*)]/m);
    if (inline) return inline[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    return [];
  }
  return m[1].split(/\n/).map(line => {
    const mm = line.match(/^\s*-\s+(?:["]([^"]*)["]|([^\s].*?))\s*$/);
    return mm ? (mm[1] != null ? mm[1] : mm[2]) : '';
  }).filter(Boolean);
}

function replaceTagsBlock(yaml, newTags) {
  const escapedTags = newTags.map(t => /[\s:#\-]|^\d/.test(t) ? `"${t.replace(/"/g, '\\"')}"` : t);
  const block = newTags.length
    ? 'tags:\n' + escapedTags.map(t => `  - ${t}`).join('\n')
    : '';
  // 多行
  if (/^tags:\s*\n((?:\s*-\s+.+\n?)+)/m.test(yaml)) {
    return yaml.replace(/^tags:\s*\n((?:\s*-\s+.+\n?)+)/m, block ? block + '\n' : '');
  }
  // 内联
  if (/^tags:\s*\[[^\]]*]/m.test(yaml)) {
    return yaml.replace(/^tags:\s*\[[^\]]*]/m, block);
  }
  // 没有 tags 字段：插到 author 后或 yaml 末尾
  if (!block) return yaml;
  if (/^author:.*$/m.test(yaml)) {
    return yaml.replace(/^(author:.*)$/m, `$1\n${block}`);
  }
  return yaml.trimEnd() + '\n' + block;
}

function readCover(yaml) {
  const m = yaml.match(/^cover:\s*(.+)$/m);
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function setCover(yaml, cover) {
  const value = `cover: ${cover}`;
  if (/^cover:\s*.+$/m.test(yaml)) {
    return yaml.replace(/^cover:\s*.+$/m, value);
  }
  // 没有 cover 字段：插到 summary 后或 author 后
  if (/^summary:.*$/m.test(yaml)) {
    return yaml.replace(/^(summary:.*)$/m, `$1\n${value}`);
  }
  if (/^author:.*$/m.test(yaml)) {
    return yaml.replace(/^(author:.*)$/m, `$1\n${value}`);
  }
  return yaml.trimEnd() + '\n' + value;
}

// ---------- 提取 body 里的所有图片 URL（保持顺序）----------
function extractImageUrls(body) {
  const urls = [];
  // markdown ![alt](url)
  for (const m of body.matchAll(/!\[[^\]]*]\(\s*([^)\s]+)/g)) urls.push(m[1]);
  // <img src="url">
  for (const m of body.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)) urls.push(m[1]);
  return urls;
}

// ---------- 第一遍：统计图片 URL 出现次数 + 文件内容 hash 出现次数 ----------
//   公众号迁移过来同一张 banner 在不同文章里被存成了不同文件名，
//   只看 URL 无法识别。所以同时维护一份 content-hash 计数，
//   挑 cover 时按 "内容相同的图算同一张" 来判定。
const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
const urlGlobal = new Map();
const urlHash = new Map();
const hashGlobal = new Map();

function imageHash(localPath) {
  if (urlHash.has(localPath)) return urlHash.get(localPath);
  let h = '';
  try {
    if (existsSync(localPath)) {
      const buf = readFileSync(localPath);
      h = createHash('sha1').update(buf).digest('hex');
    }
  } catch {}
  urlHash.set(localPath, h);
  return h;
}

for (const f of files) {
  const raw = readFileSync(`${POSTS_DIR}/${f}`, 'utf8');
  const { body } = splitFrontmatter(raw);
  const urls = extractImageUrls(body);
  const seenUrl = new Set();
  const seenHash = new Set();
  for (const u of urls) {
    if (!seenUrl.has(u)) {
      seenUrl.add(u);
      urlGlobal.set(u, (urlGlobal.get(u) || 0) + 1);
    }
    if (u.startsWith('assets/uploads/')) {
      const h = imageHash(u);
      if (h && !seenHash.has(h)) {
        seenHash.add(h);
        hashGlobal.set(h, (hashGlobal.get(h) || 0) + 1);
      }
    }
  }
}

// ---------- 第二遍：合并标签 + 选 cover ----------
let touchedTags = 0, touchedCover = 0;
const log = [];

for (const f of files) {
  const path = `${POSTS_DIR}/${f}`;
  const raw = readFileSync(path, 'utf8');
  const { yaml: yamlOrig, body, prefix } = splitFrontmatter(raw);
  if (!prefix) continue;

  let yaml = yamlOrig;
  let changed = false;
  const localLog = [];

  // 1) 合并标签
  const oldTags = parseTagsBlock(yaml);
  if (oldTags.length) {
    const merged = [];
    for (const t of oldTags) {
      const n = normalizeTag(t);
      if (n && !merged.includes(n)) merged.push(n);
    }
    if (merged.join('|') !== oldTags.join('|')) {
      yaml = replaceTagsBlock(yaml, merged);
      touchedTags++;
      changed = true;
      localLog.push(`tags: [${oldTags.join(', ')}] -> [${merged.join(', ')}]`);
    }
  }

  // 2) 自动 cover
  const existingCover = readCover(yaml);
  if (!existingCover) {
    const urls = extractImageUrls(body);
    const localImages = urls.filter(u => u.startsWith('assets/uploads/'));

    // 评分：(content-hash 全局出现次数, url 全局出现次数, 文件大小)
    //   - hash 出现次数越少 → 越独特 → 越可能是该文真实内容图
    //   - 文件越大越可能是大图（公众号顶尾 banner 通常较小，且都是同一图）
    function score(u) {
      const h = imageHash(u);
      const hashCount = h ? (hashGlobal.get(h) || 1) : 99;
      const urlCount = urlGlobal.get(u) || 1;
      let size = 0;
      try { size = existsSync(u) ? statSync(u).size : 0; } catch {}
      return { hashCount, urlCount, size };
    }

    // 阈值：超过 5 篇文章共用的图、或 < 8KB 的小图，视为装饰/banner，不当封面
    const HASH_LIMIT = 5;
    const MIN_BYTES = 8 * 1024;

    let pick = '';
    if (localImages.length) {
      const ranked = localImages
        .map(u => ({ u, ...score(u) }))
        .filter(x => x.hashCount <= HASH_LIMIT && x.size >= MIN_BYTES)
        .sort((a, b) => {
          if (a.hashCount !== b.hashCount) return a.hashCount - b.hashCount;
          if (a.urlCount !== b.urlCount) return a.urlCount - b.urlCount;
          return b.size - a.size;
        });
      pick = ranked[0]?.u || '';
    }

    if (pick && existsSync(pick)) {
      yaml = setCover(yaml, pick);
      touchedCover++;
      changed = true;
      const sc = score(pick);
      localLog.push(`cover -> ${pick}  (hashSeenIn=${sc.hashCount}/${files.length} files, ${(sc.size/1024).toFixed(0)} KB)`);
    }
  }

  if (changed) {
    log.push(`[${f}]\n  ` + localLog.join('\n  '));
    if (!DRY) {
      const next = `---\n${yaml}\n---\n${body.startsWith('\n') ? '' : '\n'}${body}`;
      writeFileSync(path, next, 'utf8');
    }
  }
}

console.log(log.join('\n'));
console.log(`\n=== 完成 ===`);
console.log(`合并标签的文章：${touchedTags}`);
console.log(`新增 cover 的文章：${touchedCover}`);
if (DRY) console.log('(DRY-RUN：未写入)');
