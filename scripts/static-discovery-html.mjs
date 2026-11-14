// Crawlable discovery links using the same markup and ordering as the reader UI.
import { escapeHtml } from './markdown-render.mjs';

function dateParts(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? { year: match[1], day: `${match[2]}-${match[3]}` } : null;
}

export function buildArchiveHtml(posts, postHref) {
  const groups = new Map();
  for (const post of [...posts].sort((a, b) => new Date(b.date) - new Date(a.date))) {
    const date = dateParts(post.date);
    if (!date) continue;
    if (!groups.has(date.year)) groups.set(date.year, []);
    groups.get(date.year).push({ post, date });
  }
  const html = [...groups].sort(([a], [b]) => Number(b) - Number(a)).map(([year, items]) => `
    <section class="year-group">
      <div class="year-title">${year} <span style="font-size:13px;color:var(--text-tertiary);font-weight:400">· ${items.length} 篇</span></div>
      <ul class="archive-list">
        ${items.map(({ post, date }) => `<li class="archive-item">
          <span class="date">${date.day}</span>
          <a class="title" href="${escapeHtml(postHref(post))}">${escapeHtml(post.title || '无标题')}</a>
          <span class="tags">${(post.tags || []).slice(0, 3).map(tag => '#' + escapeHtml(tag)).join(' ')}</span>
        </li>`).join('\n')}
      </ul>
    </section>`).join('\n');
  return { html, description: `共 ${posts.length} 篇文章，跨 ${groups.size} 年` };
}

export function buildPostDiscoveryHtml(posts, currentPost, postHref) {
  const byDate = [...posts].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const index = byDate.findIndex(post => post.slug === currentPost.slug);
  if (index < 0) return '';
  const prev = byDate[index - 1];
  const next = byDate[index + 1];
  const neighbor = (post, direction, label) => post
    ? `<a class="post-neighbor ${direction}" href="${escapeHtml(postHref(post))}"><span class="label">${label}</span><span class="title">${escapeHtml(post.title || '无标题')}</span></a>`
    : '<span></span>';
  const neighbors = prev || next ? `<nav class="post-neighbors" aria-label="相邻文章" data-discovery-prerendered>
    ${neighbor(prev, 'prev', '← 上一篇')}
    ${neighbor(next, 'next', '下一篇 →')}
  </nav>` : '';
  const tags = new Set(currentPost.tags || []);
  const related = posts.filter(post => post.slug !== currentPost.slug)
    .map(post => ({ post, overlap: (post.tags || []).filter(tag => tags.has(tag)).length }))
    .filter(item => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || new Date(b.post.date || 0) - new Date(a.post.date || 0))
    .slice(0, 4);
  const relatedHtml = related.length ? `<section class="post-related" data-discovery-prerendered>
    <div class="post-related-title">相关文章</div>
    <ul class="post-related-list">${related.map(({ post }) => `<li><a href="${escapeHtml(postHref(post))}">
      <span class="t">${escapeHtml(post.title || '无标题')}</span>
      <span class="meta">${escapeHtml(String(post.date || '').slice(0, 10))} · ${(post.tags || []).slice(0, 3).map(tag => '#' + escapeHtml(tag)).join(' ')}</span>
    </a></li>`).join('\n')}</ul>
  </section>` : '';
  return neighbors + relatedHtml;
}
