// ============================================================================
// 归档页：按年-月分组所有文章
// ============================================================================

import { fetchIndexPublic } from './api.js';
import { initSite, escapeHtml, postPathFromPost } from './site.js';
import { setMeta } from './seo.js';

const $ = sel => document.querySelector(sel);

function groupByYearMonth(posts) {
  const map = new Map();
  for (const p of posts) {
    const d = new Date(p.date || 0);
    if (isNaN(d.getTime())) continue;
    const y = d.getFullYear();
    if (!map.has(y)) map.set(y, []);
    map.get(y).push(p);
  }
  // 每年内按日期倒序
  for (const [, arr] of map) arr.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}

function renderArchive(groups) {
  const root = $('#archiveList');
  if (!groups.length) {
    root.innerHTML = '<div class="empty">暂无文章</div>';
    return;
  }
  root.innerHTML = groups.map(([y, posts]) => `
    <section class="year-group">
      <div class="year-title">${y} <span style="font-size:13px;color:var(--text-tertiary);font-weight:400">· ${posts.length} 篇</span></div>
      <ul class="archive-list">
        ${posts.map(p => {
          const d = new Date(p.date || 0);
          const md = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          return `
            <li class="archive-item">
              <span class="date">${md}</span>
              <a class="title" href="${postPathFromPost(p)}">${escapeHtml(p.title || '无标题')}</a>
              <span class="tags">${(p.tags || []).slice(0, 3).map(t => '#' + escapeHtml(t)).join(' ')}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  `).join('');
}

(async function init() {
  initSite({ active: 'archives.html' });
  setMeta({ title: '归档', description: '所有文章按时间归档' });

  let posts = [];
  try {
    const data = await fetchIndexPublic();
    posts = (data.posts || []).filter(p => !p.draft && p.type !== 'note');
  } catch (e) {
    $('#archiveList').innerHTML = `<div class="error">加载失败：${escapeHtml(e.message)}</div>`;
    return;
  }
  const groups = groupByYearMonth(posts);
  $('#archiveDesc').textContent = `共 ${posts.length} 篇文章，跨 ${groups.length} 年`;
  renderArchive(groups);
})();
