// ============================================================================
// 首页：Hero + 文章列表 + 侧栏（标签云、最近文章）
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic } from './api.js';
import { initSite, escapeHtml, fmtDate, timeAgo } from './site.js';
import { setMeta } from './seo.js';

const $ = sel => document.querySelector(sel);

function renderHero(posts) {
  const hero = $('#hero');
  if (!hero) return;
  hero.hidden = false;
  const tagCount = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => tagCount.add(t)));
  hero.innerHTML = `
    <div class="hero-avatar" style="background-image:url(${escapeHtml(CONFIG.site.avatar || '')})"></div>
    <div class="hero-info">
      <div class="hero-title">${escapeHtml(CONFIG.site.title)}</div>
      <div class="hero-subtitle">${escapeHtml(CONFIG.site.description || CONFIG.site.subtitle || '')}</div>
      <div class="hero-stats">
        <div class="stat"><strong>${posts.length}</strong>篇文章</div>
        <div class="stat"><strong>${tagCount.size}</strong>个标签</div>
        ${posts.length ? `<div class="stat">最近更新 ${timeAgo(posts[0].date)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderList(posts) {
  const ul = $('#postList');
  if (!posts.length) {
    ul.innerHTML = '<li class="empty">还没有文章。点击右上角"写文章"开始第一篇～</li>';
    return;
  }
  const author = CONFIG.site.author;
  const avatar = CONFIG.site.avatar;
  ul.innerHTML = posts.map(p => `
    <li class="post-item" data-slug="${escapeHtml(p.slug)}">
      <a class="post-content" href="post.html?slug=${encodeURIComponent(p.slug)}">
        <div class="post-author-row">
          <div class="avatar" style="background-image:url(${escapeHtml(p.avatar || avatar || '')})"></div>
          <span class="name">${escapeHtml(p.author || author || '')}</span>
          <span>·</span>
          <span>${timeAgo(p.date)}</span>
          ${p.pinned ? '<span class="post-pin">置顶</span>' : ''}
        </div>
        <h3 class="post-title">${escapeHtml(p.title || '无标题')}</h3>
        <p class="post-summary">${escapeHtml(p.summary || '')}</p>
        <div class="post-meta">
          ${(p.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </a>
      ${p.cover ? `<a href="post.html?slug=${encodeURIComponent(p.slug)}" class="post-thumbnail" style="background-image:url(${escapeHtml(p.cover)})"></a>` : ''}
    </li>
  `).join('');
}

function renderTags(posts) {
  const cloud = $('#tagCloud');
  if (!cloud) return;
  const counts = new Map();
  for (const p of posts) {
    for (const t of (p.tags || [])) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (!sorted.length) {
    cloud.innerHTML = '<span style="color:var(--text-tertiary);font-size:12px;">暂无标签</span>';
    return;
  }
  cloud.innerHTML = sorted.map(([t, n]) => `<a class="tag" href="tags.html#${encodeURIComponent(t)}">${escapeHtml(t)} · ${n}</a>`).join('');
}

function renderRecent(posts) {
  const list = $('#recentList');
  if (!list) return;
  const recent = [...posts].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);
  if (!recent.length) {
    list.innerHTML = '<li style="color:var(--text-tertiary);font-size:12px;">暂无</li>';
    return;
  }
  list.innerHTML = recent.map(p => `
    <li><a href="post.html?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.title || '无标题')}</a></li>
  `).join('');
}

function renderSidebarAuthor() {
  $('#sidebarAvatar').style.backgroundImage = `url(${CONFIG.site.avatar || ''})`;
  $('#sidebarName').textContent = CONFIG.site.author || '';
  $('#sidebarDesc').textContent = CONFIG.site.description || CONFIG.site.subtitle || '';
}

function applyFilter(posts, tab, q, tag) {
  let r = [...posts];
  if (q) {
    const lq = q.toLowerCase();
    r = r.filter(p =>
      String(p.title || '').toLowerCase().includes(lq) ||
      String(p.summary || '').toLowerCase().includes(lq) ||
      (p.tags || []).some(t => String(t).toLowerCase().includes(lq))
    );
  }
  if (tag) r = r.filter(p => (p.tags || []).includes(tag));
  if (tab === 'hot') {
    r.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (tab === 'all') {
    r.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
  } else {
    r.sort((a, b) => {
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  }
  return r;
}

(async function init() {
  initSite({ active: './' });
  setMeta({ title: '', description: CONFIG.site.description, type: 'website' });

  let allPosts = [];
  try {
    const data = await fetchIndexPublic();
    allPosts = (Array.isArray(data.posts) ? data.posts : []).filter(p => !p.draft);
  } catch (e) {
    $('#postList').innerHTML = `<li class="error">加载文章列表失败：${escapeHtml(e.message)}</li>`;
    return;
  }

  renderHero(allPosts);
  renderSidebarAuthor();
  renderTags(allPosts);
  renderRecent(allPosts);

  let tab = 'latest';
  let activeTag = '';

  function refresh() {
    renderList(applyFilter(allPosts, tab, '', activeTag));
  }

  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      tab = el.dataset.tab;
      refresh();
    });
  });

  refresh();
})();
