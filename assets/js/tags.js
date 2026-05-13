// ============================================================================
// 标签聚合页：所有标签 + 按标签筛选文章
// 选中标签时通过 URL hash (#标签名) 持久化
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic } from './api.js';
import { initSite, escapeHtml, fmtDate, tagHtml, tagStyle, postPath } from './site.js';
import { setMeta } from './seo.js';

const $ = sel => document.querySelector(sel);

function getTags(posts) {
  const counts = new Map();
  for (const p of posts) {
    for (const t of (p.tags || [])) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'));
}

function renderCloud(tags, active) {
  const cloud = $('#tagCloud');
  if (!tags.length) {
    cloud.innerHTML = '<span style="color:var(--text-tertiary);font-size:13px;">还没有任何标签</span>';
    return;
  }
  cloud.innerHTML = tags.map(([t, n]) =>
    tagHtml(t, { href: `#${encodeURIComponent(t)}`, active: active === t, count: n })
  ).join('');
}

function renderFiltered(posts, tag) {
  const list = $('#postList');
  const grouped = $('#groupList');
  if (!tag) {
    list.innerHTML = '';
    // 按标签分组展示
    const tags = getTags(posts);
    grouped.innerHTML = tags.map(([t, n]) => {
      const tagPosts = posts.filter(p => (p.tags || []).includes(t)).slice(0, 5);
      return `
        <div class="group-block">
          <h3 class="group-title">
            <a class="group-tag-title" style="${tagStyle(t)}" href="#${encodeURIComponent(t)}">#${escapeHtml(t)}</a>
            <span class="count">${n} 篇</span>
          </h3>
          <ul class="post-list">
            ${tagPosts.map(p => postCard(p)).join('')}
          </ul>
        </div>
      `;
    }).join('');
    $('#tagDesc').textContent = `共 ${tags.length} 个标签，${posts.length} 篇文章。点击标签查看完整列表。`;
    return;
  }
  grouped.innerHTML = '';
  const filtered = posts.filter(p => (p.tags || []).includes(tag));
  $('#tagDesc').innerHTML = `已筛选 <strong>#${escapeHtml(tag)}</strong>，共 ${filtered.length} 篇 · <a href="#" id="clearFilter" style="color:var(--primary)">清除筛选</a>`;
  list.innerHTML = filtered.map(p => postCard(p)).join('');
  const clear = $('#clearFilter');
  if (clear) clear.addEventListener('click', e => {
    e.preventDefault();
    history.replaceState(null, '', window.location.pathname);
    update();
  });
}

function postCard(p) {
  return `
    <li class="post-item">
      <a class="post-content" href="${postPath(p.slug)}">
        <h3 class="post-title">${escapeHtml(p.title || '无标题')}</h3>
        <p class="post-summary">${escapeHtml(p.summary || '')}</p>
        <div class="post-meta">
          <span>${fmtDate(p.date)}</span>
          ${(p.tags || []).map(t => tagHtml(t)).join('')}
        </div>
      </a>
    </li>
  `;
}

let allPosts = [];

function update() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  const tags = getTags(allPosts);
  renderCloud(tags, hash);
  renderFiltered(allPosts, hash);
}

(async function init() {
  initSite({ active: 'tags.html' });
  setMeta({ title: '标签', description: '按标签浏览所有文章' });

  try {
    const data = await fetchIndexPublic();
    allPosts = (data.posts || []).filter(p => !p.draft && p.type !== 'note');
    allPosts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  } catch (e) {
    $('#tagDesc').innerHTML = `<span style="color:#d9534f">加载失败：${escapeHtml(e.message)}</span>`;
    return;
  }

  update();
  window.addEventListener('hashchange', update);
})();
