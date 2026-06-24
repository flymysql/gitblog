// 缩略图生成与路径解析（build / prerender / CLI 共用）
import sharp from 'sharp';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export const THUMB_MAX_WIDTH = 480;
export const THUMB_QUALITY = 80;

export function thumbPathFor(localPath) {
  const ext = extname(localPath);
  if (!ext) return `${localPath}.thumb.webp`;
  return localPath.slice(0, -ext.length) + '.thumb.webp';
}

export function normalizeLocalImagePath(src) {
  if (!src) return null;
  let rel = String(src).trim().split('?')[0].split('#')[0];
  if (!rel || /^https?:\/\//i.test(rel) || rel.startsWith('//') || rel.startsWith('data:')) return null;
  rel = rel.replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '');
  if (!rel.startsWith('assets/') && !rel.startsWith('posts/')) return null;
  if (/\.thumb\.webp$/i.test(rel)) return null;
  return rel;
}

export function isThumbCandidate(localPath) {
  const ext = extname(localPath).toLowerCase();
  if (!ext || ext === '.svg' || ext === '.ico') return false;
  if (/\.thumb\.webp$/i.test(localPath)) return false;
  return /\.(webp|jpe?g|png|gif|avif)$/i.test(localPath);
}

export function collectImagesFromMarkdown(content) {
  const urls = [];
  const text = String(content || '');
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) urls.push(m[1]);
  for (const m of text.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)) urls.push(m[1]);
  return urls;
}

export function collectAllImagePaths({ posts = [], uploadsDir = 'assets/uploads' } = {}) {
  const set = new Set();
  for (const p of posts) {
    if (p.cover) {
      const n = normalizeLocalImagePath(p.cover);
      if (n) set.add(n);
    }
    for (const u of collectImagesFromMarkdown(p.content)) {
      const n = normalizeLocalImagePath(u);
      if (n) set.add(n);
    }
  }
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (isThumbCandidate(full)) set.add(full);
    }
  }
  walk(uploadsDir);
  return [...set];
}

export async function ensureThumbnail(localPath, { force = false } = {}) {
  if (!existsSync(localPath) || !isThumbCandidate(localPath)) {
    return { status: 'skip', path: localPath };
  }
  const out = thumbPathFor(localPath);
  if (existsSync(out) && !force) return { status: 'exists', path: localPath, out };
  try {
    await sharp(localPath, { animated: false })
      .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(out);
    const before = statSync(localPath).size;
    const after = statSync(out).size;
    return { status: 'created', path: localPath, out, before, after };
  } catch (e) {
    return { status: 'failed', path: localPath, error: e.message || String(e) };
  }
}

export async function buildAllThumbnails({ posts = [], uploadsDir = 'assets/uploads', force = false, verbose = false } = {}) {
  const paths = collectAllImagePaths({ posts, uploadsDir });
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let savedFrom = 0;
  let savedTo = 0;

  for (const p of paths) {
    const r = await ensureThumbnail(p, { force });
    if (r.status === 'created') {
      processed++;
      savedFrom += r.before || 0;
      savedTo += r.after || 0;
      if (verbose) {
        console.log(
          `  ${String(Math.round((r.before || 0) / 1024)).padStart(5)} KB → ${String(Math.round((r.after || 0) / 1024)).padStart(4)} KB  ${r.out}`
        );
      }
    } else if (r.status === 'failed') {
      failed++;
      if (verbose) console.log(`  failed: ${p} | ${r.error}`);
    } else {
      skipped++;
    }
  }

  const summary = { processed, skipped, failed, total: paths.length, savedFrom, savedTo };
  console.log(
    `thumbnails: ${processed} created, ${skipped} skipped, ${failed} failed (${paths.length} candidates)`
  );
  if (processed > 0) {
    const mb = n => `${(n / 1024 / 1024).toFixed(2)} MB`;
    console.log(`thumbnails saved: ${mb(savedFrom)} → ${mb(savedTo)} (−${mb(savedFrom - savedTo)})`);
  }
  return summary;
}
