#!/usr/bin/env node
/**
 * 为缺少 cover 的文章生成 WebP 主题插画封面（默认 < 30KB）
 * 用法：node scripts/generate-missing-covers.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { encodeCoverWebp } from './cover-og-lib.mjs';
import { postCoverIllustrationSvg } from './cover-illustration-lib.mjs';
import { ensureThumbnail } from './thumbnail-lib.mjs';

const POSTS_DIR = 'posts';
const COVER_DIR = 'assets/uploads/2026/06/covers';
const MAX_BYTES = 30 * 1024;
const DRY = process.argv.includes('--dry');

function splitFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return null;
  return { yaml: m[1], body: raw.slice(m[0].length), prefix: m[0] };
}

function readCover(yaml) {
  const m = yaml.match(/^cover:\s*(.+)$/m);
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

function parseTitle(yaml) {
  const m = yaml.match(/^title:\s*(.+)$/m);
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function setCover(yaml, cover) {
  const value = `cover: ${cover}`;
  if (/^cover:\s*.+$/m.test(yaml)) {
    return yaml.replace(/^cover:\s*.+$/m, value);
  }
  if (/^summary:.*$/m.test(yaml)) {
    return yaml.replace(/^(summary:.*)$/m, `$1\n${value}`);
  }
  if (/^author:.*$/m.test(yaml)) {
    return yaml.replace(/^(author:.*)$/m, `$1\n${value}`);
  }
  return `${yaml.trimEnd()}\n${value}`;
}

function coverRelPath(slug) {
  return `../${COVER_DIR}/${slug}.webp`;
}

async function main() {
  mkdirSync(COVER_DIR, { recursive: true });
  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  let generated = 0;
  let skipped = 0;
  const log = [];

  for (const file of files) {
    const path = join(POSTS_DIR, file);
    const raw = readFileSync(path, 'utf8');
    const fm = splitFrontmatter(raw);
    if (!fm) continue;

    const slug = file.replace(/\.md$/, '');
    const existing = readCover(fm.yaml);
    if (existing) {
      skipped++;
      continue;
    }

    const post = {
      slug,
      title: parseTitle(fm.yaml),
      tags: parseTags(fm.yaml),
      summary: (() => {
        const m = fm.yaml.match(/^summary:\s*(.+)$/m);
        return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
      })(),
    };
    const outPath = join(COVER_DIR, `${slug}.webp`);
    const relCover = coverRelPath(slug);

    if (existsSync(outPath) && !DRY) {
      const yaml = setCover(fm.yaml, relCover);
      const next = `---\n${yaml}\n---\n${fm.body.startsWith('\n') ? '' : '\n'}${fm.body}`;
      writeFileSync(path, next, 'utf8');
      await ensureThumbnail(outPath.replace(/^\.\.\//, ''), { force: false });
      log.push(`[${slug}] 已有封面文件，仅补 frontmatter`);
      generated++;
      continue;
    }

    const svg = postCoverIllustrationSvg(post);
    const { buf, quality, bytes } = await encodeCoverWebp(svg, { maxBytes: MAX_BYTES });

    if (!DRY) {
      writeFileSync(outPath, buf);
      await ensureThumbnail(outPath, { force: true });
      const yaml = setCover(fm.yaml, relCover);
      const next = `---\n${yaml}\n---\n${fm.body.startsWith('\n') ? '' : '\n'}${fm.body}`;
      writeFileSync(path, next, 'utf8');
    }

    generated++;
    log.push(`[${slug}] ${(bytes / 1024).toFixed(1)} KB (q≈${quality}) → ${relCover}`);
  }

  console.log(log.join('\n'));
  console.log(`\n完成：生成/更新 ${generated} 篇，已有 cover 跳过 ${skipped} 篇`);
  if (DRY) console.log('(DRY-RUN：未写入)');
  else console.log('请运行 npm run build 更新 posts.json 与首页缩略图');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
