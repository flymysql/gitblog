// ============================================================================
// 首页：拉取 data/posts.json，渲染列表
// 不需要登录，直接走 GitHub Pages 静态资源
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic } from './api.js';

const $ = sel => document.querySelector(sel);

function applyBindings() {
  document.querySelectorAll('[data-bind]').forEach(el => {
    const path = el.dataset.bind;
    const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), CONFIG);
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-bind-style]').forEach(el => {
    const path = el.dataset.bindStyle;
    const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), CONFIG);
    if (v) el.style.backgroundImage = `url(${v})`;
  });
  document.title = `${CONFIG.site.title} · ${CONFIG.site.subtitle || ''}`;
  const ye = $('#year');
  if (ye) ye.textContent = new Date().getFullYear();
}

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderList(posts) {
  const ul = $('#postList');
  if (!posts.length) {
    ul.innerHTML = '<li class="empty">还没有文章，点击右上角"写文章"开始第一篇吧～</li>';
    return;
  }
  const author = CONFIG.site.author;
  const avatar = CONFIG.site.avatar;
  ul.innerHTML = posts.map(p => `
    <li class="post-item">
      <div class="post-content">
        <a href="post.html?slug=${encodeURIComponent(p.slug)}">
          <div class="post-author-row">
            <div class="avatar" style="background-image:url(${escapeHtml(p.avatar || avatar || '')})"></div>
            <span class="name">${escapeHtml(p.author || author || '')}</span>
            <span>·</span>
            <span>${timeAgo(p.date)}</span>
          </div>
          <h3 class="post-title">${escapeHtml(p.title || '无标题')}</h3>
          <p class="post-summary">${escapeHtml(p.summary || '')}</p>
        </a>
        <div class="post-meta">
          ${(p.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          ${p.words ? `<span class="meta-item">${p.words} 字</span>` : ''}
        </div>
      </div>
      ${p.cover ? `<a href="post.html?slug=${encodeURIComponent(p.slug)}" class="post-thumbnail" style="background-image:url(${escapeHtml(p.cover)})"></a>` : ''}
    </li>
  `).join('');
}

function renderTags(posts) {
  const cloud = $('#tagCloud');
  if (!cloud) return;
  const counts = new Map();
  for (const p of posts) {
    for (const t of (p.tags || [])) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  if (!sorted.length) {
    cloud.innerHTML = '<span style="color:var(--text-tertiary);font-size:12px;">暂无标签</span>';
    return;
  }
  cloud.innerHTML = sorted.map(([t, n]) => `<span class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)} · ${n}</span>`).join('');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
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
  if (tag) {
    r = r.filter(p => (p.tags || []).includes(tag));
  }
  if (tab === 'hot') {
    r.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (tab === 'all') {
    r.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
  } else {
    r.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }
  return r;
}

(async function init() {
  applyBindings();

  let allPosts = [];
  try {
    const data = await fetchIndexPublic();
    allPosts = Array.isArray(data.posts) ? data.posts : [];
  } catch (e) {
    $('#postList').innerHTML = `<li class="error">加载文章列表失败：${escapeHtml(e.message)}</li>`;
    return;
  }

  let tab = 'latest';
  let query = '';
  let activeTag = '';

  function refresh() {
    renderList(applyFilter(allPosts, tab, query, activeTag));
  }

  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      tab = el.dataset.tab;
      refresh();
    });
  });

  $('#searchInput').addEventListener('input', e => {
    query = e.target.value.trim();
    refresh();
  });

  document.addEventListener('click', e => {
    const tagEl = e.target.closest('.tag-cloud .tag');
    if (tagEl) {
      const t = tagEl.dataset.tag;
      activeTag = activeTag === t ? '' : t;
      document.querySelectorAll('.tag-cloud .tag').forEach(x => {
        x.style.background = x.dataset.tag === activeTag ? 'var(--primary)' : '';
        x.style.color = x.dataset.tag === activeTag ? '#fff' : '';
      });
      refresh();
    }
  });

  renderTags(allPosts);
  refresh();
})();
