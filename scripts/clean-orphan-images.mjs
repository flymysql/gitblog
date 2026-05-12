// ============================================================================
// 本地孤儿图清理：直接在工作目录扫 posts/*.md + data/posts.json 的全部引用，
// 把 assets/uploads/** 里没人引用的图片删除。
//
// 用法：
//   node scripts/clean-orphan-images.mjs            # dry-run，仅列出会被删的文件
//   node scripts/clean-orphan-images.mjs --yes      # 真正删除（git working tree）
//
// 删完之后用 git status 看一眼，再 git add -A && git commit 提交即可
// ============================================================================
import { readFileSync, readdirSync, statSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const POSTS_DIR = 'posts';
const UPLOADS_DIR = 'assets/uploads';
const POSTS_INDEX = 'data/posts.json';
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

const args = process.argv.slice(2);
const dryRun = !(args.includes('--yes') || args.includes('-y'));

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function toPosix(p) { return p.split(sep).join('/'); }

// 与 admin-tools.js 的 normalizeUrl 行为对齐：
//   ../assets/uploads/x.png  → assets/uploads/x.png
//   /gitblog/assets/x.png    → assets/x.png（剥掉站点前缀）
//   外链 / data: / mailto: → null
function normalizeUrl(url, sitePrefix = '') {
  if (!url) return null;
  url = String(url).trim();
  if (!url) return null;
  if (/^(#|mailto:|tel:|data:)/i.test(url)) return null;
  if (/^https?:\/\//i.test(url)) return null;
  let p = url;
  if (p.startsWith('/')) {
    p = p.replace(/^\/+/, '');
    if (sitePrefix && p.startsWith(sitePrefix + '/')) p = p.slice(sitePrefix.length + 1);
  } else {
    p = p.replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '');
  }
  p = p.split('?')[0].split('#')[0];
  try { p = decodeURIComponent(p); } catch {}
  return p || null;
}

function extractRefs(md) {
  const urls = new Set();
  const collect = (re) => {
    let m;
    while ((m = re.exec(md))) urls.add(m[1]);
  };
  collect(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]+)?\)/g);
  collect(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]+)?\)/g);
  collect(/<img\s+[^>]*src\s*=\s*["']([^"']+)["']/gi);
  collect(/<a\s+[^>]*href\s*=\s*["']([^"']+)["']/gi);
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    const c = fm[1].match(/^cover\s*:\s*(.+)$/m);
    if (c) urls.add(c[1].trim().replace(/^['"]|['"]$/g, ''));
  }
  return [...urls];
}

function fmtSize(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const allImages = walk(UPLOADS_DIR).filter(p => IMAGE_EXT.test(p)).map(toPosix);
const mdFiles = walk(POSTS_DIR).filter(p => p.endsWith('.md'));

const used = new Set();
for (const f of mdFiles) {
  const md = readFileSync(f, 'utf8');
  for (const u of extractRefs(md)) {
    const n = normalizeUrl(u);
    if (n) used.add(n);
  }
}

if (existsSync(POSTS_INDEX)) {
  try {
    const idx = JSON.parse(readFileSync(POSTS_INDEX, 'utf8'));
    for (const p of (idx.posts || [])) {
      if (p.cover) {
        const n = normalizeUrl(p.cover);
        if (n) used.add(n);
      }
    }
  } catch (e) {
    console.warn('[warn] failed to parse', POSTS_INDEX, e.message);
  }
}

const orphans = allImages.filter(p => !used.has(p));
let totalBytes = 0;
for (const p of orphans) {
  try { totalBytes += statSync(p).size; } catch {}
}

console.log(`scanned: ${allImages.length} images under ${UPLOADS_DIR}`);
console.log(`         ${mdFiles.length} markdown files under ${POSTS_DIR}`);
console.log(`used:    ${used.size} unique paths referenced`);
console.log(`orphans: ${orphans.length}  (~${fmtSize(totalBytes)})`);

if (!orphans.length) {
  console.log('no orphan images. exiting.');
  process.exit(0);
}

console.log('\norphan list:');
for (const p of orphans) {
  let size = 0;
  try { size = statSync(p).size; } catch {}
  console.log(`  ${fmtSize(size).padStart(10)}  ${p}`);
}

if (dryRun) {
  console.log('\n[dry-run] no files were deleted. re-run with --yes to actually delete.');
  process.exit(0);
}

let removed = 0;
const failed = [];
for (const p of orphans) {
  try { unlinkSync(p); removed++; }
  catch (e) { failed.push({ path: p, error: e.message }); }
}

// 顺手清理删空的目录（uploads/yyyy/mm/）
const dirSet = new Set();
for (const p of orphans) {
  const parts = p.split('/');
  for (let i = parts.length - 1; i > 0; i--) {
    dirSet.add(parts.slice(0, i).join('/'));
  }
}
const sortedDirs = [...dirSet].sort((a, b) => b.length - a.length);
for (const d of sortedDirs) {
  if (!d.startsWith(UPLOADS_DIR)) continue;
  if (!existsSync(d)) continue;
  try {
    if (readdirSync(d).length === 0) rmdirSync(d);
  } catch {}
}

console.log(`\nremoved ${removed} files${failed.length ? `, failed ${failed.length}` : ''}.`);
if (failed.length) {
  for (const f of failed) console.log('  FAILED:', f.path, f.error);
}
console.log('next: git status / git add -A / git commit -m "cleanup: remove orphan images"');
