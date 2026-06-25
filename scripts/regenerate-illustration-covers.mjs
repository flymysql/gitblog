#!/usr/bin/env node
/**
 * 将 assets/uploads/2026/06/covers/ 下的文字 OG 封面替换为主题插画封面
 * 用法：
 *   node scripts/regenerate-illustration-covers.mjs          # 全部重生成
 *   node scripts/regenerate-illustration-covers.mjs --dry    # 仅预览
 *   node scripts/regenerate-illustration-covers.mjs --slug=随笔杂谈-15995658
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { postCoverIllustrationSvg, getCoverTheme } from './cover-illustration-lib.mjs';
import { encodeCoverWebp } from './cover-og-lib.mjs';
import { ensureThumbnail } from './thumbnail-lib.mjs';

const POSTS_DIR = 'posts';
const COVER_DIR = 'assets/uploads/2026/06/covers';
const MAX_BYTES = 48 * 1024;
const DRY = process.argv.includes('--dry');
const SLUG_ARG = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1];

/** 已有定制插画、跳过重生成 */
const SKIP_COVERS = new Set([
  'qq-farm-assistant-经典农场辅助.webp',
]);

function splitFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return null;
  return { yaml: m[1], body: raw.slice(m[0].length) };
}

function parseField(yaml, key) {
  const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function parseTags(yaml) {
  const m = yaml.match(/^tags:\s*\n((?:\s*-\s+.+\n?)+)/m);
  if (!m) return [];
  return m[1].split(/\n/).map(line => {
    const mm = line.match(/^\s*-\s+(?:["]([^"]*)["]|([^\s].*?))\s*$/);
    return mm ? (mm[1] != null ? mm[1] : mm[2]) : '';
  }).filter(Boolean);
}

function parseSeries(yaml) {
  const m = yaml.match(/^series:\s*(.+)$/m);
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function loadPostMeta(slug) {
  const path = join(POSTS_DIR, `${slug}.md`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  const fm = splitFrontmatter(raw);
  if (!fm) return null;
  return {
    slug,
    title: parseField(fm.yaml, 'title'),
    summary: parseField(fm.yaml, 'summary'),
    tags: parseTags(fm.yaml),
    series: parseSeries(fm.yaml),
  };
}

async function main() {
  mkdirSync(COVER_DIR, { recursive: true });
  const files = readdirSync(COVER_DIR).filter(f => f.endsWith('.webp') && !f.includes('.thumb.'));
  let generated = 0;
  let skipped = 0;
  const log = [];

  for (const file of files) {
    if (SKIP_COVERS.has(file)) {
      skipped++;
      log.push(`[skip] ${file}（定制封面）`);
      continue;
    }

    const slug = file.replace(/\.webp$/, '');
    if (SLUG_ARG && slug !== SLUG_ARG) continue;

    const post = loadPostMeta(slug);
    if (!post) {
      skipped++;
      log.push(`[skip] ${file}（找不到 posts/${slug}.md）`);
      continue;
    }

    const { theme } = getCoverTheme(post);
    const svg = postCoverIllustrationSvg(post);
    const { buf, quality, bytes } = await encodeCoverWebp(svg, { maxBytes: MAX_BYTES });
    const outPath = join(COVER_DIR, file);

    if (!DRY) {
      writeFileSync(outPath, buf);
      await ensureThumbnail(outPath, { force: true });
    }

    generated++;
    log.push(`[${slug}] theme=${theme} ${(bytes / 1024).toFixed(1)} KB (q≈${quality})`);
  }

  console.log(log.join('\n'));
  console.log(`\n完成：插画封面 ${generated} 张，跳过 ${skipped} 张`);
  if (DRY) console.log('(DRY-RUN：未写入)');
  else console.log('请运行 npm run build 更新 posts.json 与首页缩略图');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
