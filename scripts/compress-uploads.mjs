// ============================================================================
// 批量压缩 assets/uploads 中的 PNG / JPEG → WebP
//   - 默认只处理 ≥60KB 的文件（与 build-thumbnails 阈值一致）
//   - 参数与 assets/js/config.js 的 upload 策略对齐
//   - 转换成功后更新 posts / config / html 等引用，并删除原文件
//
// 用法:
//   node scripts/compress-uploads.mjs              # 仅 ≥60KB
//   node scripts/compress-uploads.mjs --all        # 全部 PNG/JPEG
//   node scripts/compress-uploads.mjs --dry-run    # 预览，不写文件
//   node scripts/compress-uploads.mjs --include-gif  # 含 GIF（转 animated WebP）
// ============================================================================
import sharp from 'sharp';
import {
  readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync,
} from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';

const UPLOADS_DIR = 'assets/uploads';
const CONFIG_PATH = 'assets/js/config.js';
const MIN_BYTES_DEFAULT = 60 * 1024;
const REF_GLOBS = [
  'posts',
  'data',
  'assets/js',
  'index.html',
  'post',
  'admin',
  'tools',
  'scripts',
];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force') || args.includes('-f');
const allSizes = args.includes('--all');
const includeGif = args.includes('--include-gif');

function readUploadConfig() {
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  const preferWebp = !/preferWebp:\s*false/.test(raw);
  const qualityMatch = raw.match(/webpQuality:\s*([\d.]+)/);
  const maxWidthMatch = raw.match(/maxWidth:\s*(\d+)/);
  return {
    preferWebp,
    quality: Math.round((Number(qualityMatch?.[1]) || 0.85) * 100),
    maxWidth: Number(maxWidthMatch?.[1]) || 1920,
  };
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function isRasterTarget(file, ext) {
  if (['.png', '.jpg', '.jpeg'].includes(ext)) return true;
  if (includeGif && ext === '.gif') return true;
  return false;
}

function webpPathFor(file) {
  return file.slice(0, -extname(file).length) + '.webp';
}

async function convertToWebp(src, cfg) {
  const isGif = extname(src).toLowerCase() === '.gif';
  const inputOpts = { animated: includeGif && isGif };
  if (isGif) inputOpts.limitInputPixels = false;
  const meta = await sharp(src, inputOpts).metadata();
  const pipeline = sharp(src, { ...inputOpts, animated: includeGif && meta.pages > 1 });
  if (meta.width && meta.width > cfg.maxWidth) {
    pipeline.resize({ width: cfg.maxWidth, withoutEnlargement: true });
  }
  return pipeline.webp({ quality: cfg.quality }).toBuffer();
}

function collectTextFiles() {
  const files = new Set();
  for (const root of REF_GLOBS) {
    if (!existsSync(root)) continue;
    const st = statSync(root);
    if (st.isFile()) {
      files.add(root);
      continue;
    }
    for (const f of walkFiles(root)) {
      const ext = extname(f).toLowerCase();
      if (['.md', '.json', '.js', '.html', '.mjs', '.xml'].includes(ext)) files.add(f);
    }
  }
  return [...files];
}

function replaceReferences(replacements) {
  if (!replacements.size) return 0;
  let changedFiles = 0;
  for (const file of collectTextFiles()) {
    let text = readFileSync(file, 'utf8');
    let next = text;
    for (const [from, to] of replacements) {
      if (!next.includes(from)) continue;
      next = next.split(from).join(to);
    }
    if (next !== text) {
      if (!dryRun) writeFileSync(file, next);
      changedFiles++;
    }
  }
  return changedFiles;
}

function relPosix(file) {
  return relative('.', file).split('\\').join('/');
}

const cfg = readUploadConfig();
if (!cfg.preferWebp) {
  console.warn('config.upload.preferWebp is false — continuing anyway for batch compression');
}

const minBytes = allSizes ? 0 : MIN_BYTES_DEFAULT;
const uploads = existsSync(UPLOADS_DIR) ? walkFiles(UPLOADS_DIR) : [];
const targets = uploads.filter(f => {
  const ext = extname(f).toLowerCase();
  if (!isRasterTarget(f, ext)) return false;
  if (f.endsWith('.thumb.webp')) return false;
  return statSync(f).size >= minBytes;
});

let processed = 0;
let skipped = 0;
const failed = [];
const replacements = new Map();
let savedFrom = 0;
let savedTo = 0;

console.log(
  `compress-uploads: targets=${targets.length}, minBytes=${minBytes}, ` +
  `quality=${cfg.quality}, maxWidth=${cfg.maxWidth}, dryRun=${dryRun}`
);

for (const src of targets.sort()) {
  const ext = extname(src).toLowerCase();
  const out = webpPathFor(src);
  const srcSize = statSync(src).size;
  const rel = relPosix(src);
  const relOut = relPosix(out);

  if (existsSync(out) && !force) {
    const outSize = statSync(out).size;
    if (outSize < srcSize) {
      replacements.set(rel, relOut);
      if (!dryRun) unlinkSync(src);
      skipped++;
      savedFrom += srcSize;
      savedTo += outSize;
      console.log(`  skip (webp exists): ${rel} → keep ${relOut}`);
      continue;
    }
  }

  try {
    const buf = await convertToWebp(src, cfg);
    if (!force && buf.length >= srcSize && ext !== '.gif') {
      skipped++;
      console.log(`  skip (not smaller): ${rel} ${Math.round(srcSize / 1024)} KB`);
      continue;
    }
    if (!dryRun) {
      writeFileSync(out, buf);
      unlinkSync(src);
      const oldThumb = src.slice(0, -ext.length) + '.thumb.webp';
      if (existsSync(oldThumb)) unlinkSync(oldThumb);
    }
    replacements.set(rel, relOut);
    processed++;
    savedFrom += srcSize;
    savedTo += buf.length;
    const ratio = ((buf.length / srcSize) * 100).toFixed(0);
    console.log(
      `  ${String(Math.round(srcSize / 1024)).padStart(5)} KB → ` +
      `${String(Math.round(buf.length / 1024)).padStart(4)} KB (${ratio}%) ${relOut}`
    );
  } catch (e) {
    failed.push({ path: rel, reason: e.message });
  }
}

const changedFiles = replaceReferences(replacements);
const fmtMB = n => `${(n / 1024 / 1024).toFixed(2)} MB`;

console.log(
  `\ncompress-uploads: processed=${processed}, skipped=${skipped}, failed=${failed.length}, ` +
  `refsUpdated=${changedFiles}`
);
console.log(
  `total: ${fmtMB(savedFrom)} → ${fmtMB(savedTo)} (saved ${fmtMB(savedFrom - savedTo)})`
);
if (failed.length) {
  console.log('\nfailed:');
  for (const f of failed) console.log('  -', f.path, '|', f.reason);
}
if (dryRun) console.log('\n(dry-run: no files written)');
