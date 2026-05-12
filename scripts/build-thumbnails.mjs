// ============================================================================
// 历史封面批量生成小尺寸缩略图（用于首页文章列表）
//   - 扫 data/posts.json 里所有 cover
//   - 同目录生成 <basename>.thumb.webp（width=480, quality=0.8）
//   - SVG / 已经很小（<60KB）的图跳过
//   - 已存在的不重做（除非 --force）
//
// 跑完之后再跑 `npm run build`，build 会把 thumbnail 字段写进 posts.json
// ============================================================================
import sharp from 'sharp';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname } from 'node:path';

const POSTS_INDEX = 'data/posts.json';
const THUMB_MAX_WIDTH = 480;     // 给首页 16:10 卡片用足够清晰
const THUMB_QUALITY = 80;
const SKIP_THRESHOLD = 60 * 1024; // 60KB 以下原图就不做缩略图

function normalizeCover(cover) {
  if (!cover) return null;
  return String(cover).replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '').split('?')[0].split('#')[0];
}

export function thumbPathFor(localPath) {
  const ext = extname(localPath);
  return localPath.slice(0, -ext.length) + '.thumb.webp';
}

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');

const idx = JSON.parse(readFileSync(POSTS_INDEX, 'utf8'));
const seen = new Map();
for (const p of (idx.posts || [])) {
  if (!p.cover) continue;
  const local = normalizeCover(p.cover);
  if (!local) continue;
  if (!seen.has(local)) seen.set(local, []);
  seen.get(local).push(p.slug);
}

let processed = 0, skipped = 0;
const failed = [];
let savedFromBytes = 0, savedToBytes = 0;

for (const [local, slugs] of seen) {
  if (!existsSync(local)) {
    failed.push({ path: local, reason: 'missing local file', slugs });
    continue;
  }
  const ext = extname(local).toLowerCase();
  if (ext === '.svg') { skipped++; continue; }

  const stat = statSync(local);
  const out = thumbPathFor(local);
  if (existsSync(out) && !force) { skipped++; continue; }
  if (stat.size < SKIP_THRESHOLD && !force) { skipped++; continue; }

  try {
    await sharp(local, { animated: false })
      .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(out);
    const outSize = statSync(out).size;
    processed++;
    savedFromBytes += stat.size;
    savedToBytes += outSize;
    const ratio = ((outSize / stat.size) * 100).toFixed(0);
    console.log(
      `  ${String(Math.round(stat.size / 1024)).padStart(5)} KB → ${String(Math.round(outSize / 1024)).padStart(4)} KB (${ratio}%) ${out}`
    );
  } catch (e) {
    failed.push({ path: local, reason: e.message, slugs });
  }
}

const fmtMB = n => `${(n / 1024 / 1024).toFixed(2)} MB`;
console.log(
  `\nthumbnails: processed=${processed}, skipped=${skipped}, failed=${failed.length}`
);
console.log(
  `total: ${fmtMB(savedFromBytes)} → ${fmtMB(savedToBytes)} ` +
  `(saved ${fmtMB(savedFromBytes - savedToBytes)})`
);
if (failed.length) {
  console.log('\nfailed list:');
  for (const f of failed) console.log('  -', f.path, '|', f.reason);
}
