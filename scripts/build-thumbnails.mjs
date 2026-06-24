// ============================================================================
// 批量生成移动端缩略图（.thumb.webp）
//   - 扫描 posts 正文 / cover 引用的图片
//   - 扫描 assets/uploads 下全部图片
//   - npm run build 会自动调用；也可单独 npm run build:thumbs
// ============================================================================
import { readFileSync } from 'node:fs';
import { buildAllThumbnails } from './thumbnail-lib.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const verbose = args.includes('--verbose') || args.includes('-v');

let posts = [];
try {
  const idx = JSON.parse(readFileSync('data/posts.json', 'utf8'));
  posts = idx.posts || [];
} catch {}

// posts.json 不含正文，单独扫 markdown 补全引用
import { readdirSync, readFileSync as read, existsSync } from 'node:fs';
import { collectImagesFromMarkdown, normalizeLocalImagePath } from './thumbnail-lib.mjs';

const POSTS_DIR = 'posts';
if (existsSync(POSTS_DIR)) {
  for (const f of readdirSync(POSTS_DIR).filter(x => x.endsWith('.md'))) {
    const content = read(`${POSTS_DIR}/${f}`, 'utf8');
    const slug = f.replace(/\.md$/, '');
    const imgs = collectImagesFromMarkdown(content).map(normalizeLocalImagePath).filter(Boolean);
    if (imgs.length) {
      const stub = posts.find(p => p.slug === slug) || { slug, content: '' };
      stub.content = content;
      if (!posts.find(p => p.slug === slug)) posts.push(stub);
    }
  }
}

await buildAllThumbnails({ posts, force, verbose });
