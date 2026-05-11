// ============================================================================
// 站点公共：渲染顶部导航 / 搜索浮层 / 底部 / 主题切换
// 在每个面向读者的页面里调用 initSite()
// ============================================================================

import { CONFIG } from './config.js';
import { initTheme, bindThemeToggle, themeToggleHtml } from './theme.js';
import { fetchIndexPublic } from './api.js';

const $ = (sel, root = document) => root.querySelector(sel);

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
  return fmtDate(iso);
}

const SOCIAL_ICONS = {
  github: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0012 .3"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  email: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  rss: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
};

function logoSvg() {
  if (CONFIG.site.logo) {
    return `<img class="nav-logo-img" src="${escapeHtml(CONFIG.site.logo)}" alt="${escapeHtml(CONFIG.site.title || 'logo')}">`;
  }
  return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.27l7 3.5v7.46l-7-3.5V9.27zm9 10.96v-7.46l7-3.5v7.46l-7 3.5z"/></svg>`;
}

function applyFavicon() {
  if (!CONFIG.site.favicon && !CONFIG.site.logo && !CONFIG.site.avatar) return;
  let link = document.head.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = CONFIG.site.favicon || CONFIG.site.logo || CONFIG.site.avatar;
}

function navHtml(active) {
  const links = (CONFIG.site.nav || []).map(n => {
    const isActive = active && (n.href === active || (active === 'home' && (n.href === './' || n.href === 'index.html')));
    return `<a class="nav-link${isActive ? ' active' : ''}" href="${escapeHtml(n.href)}">${escapeHtml(n.name)}</a>`;
  }).join('');
  return `
    <nav class="nav">
      <div class="nav-inner">
        <a class="nav-logo" href="./">
          ${logoSvg()}
          <span>${escapeHtml(CONFIG.site.title)}</span>
        </a>
        <div class="nav-links">${links}</div>
        <div class="nav-spacer"></div>
        <button id="searchBtn" class="icon-btn" title="搜索" aria-label="搜索">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        ${themeToggleHtml()}
        <a class="btn-write" href="admin/editor.html">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          写文章
        </a>
      </div>
    </nav>
  `;
}

function footerHtml() {
  const social = CONFIG.site.social || {};
  const links = Object.entries(social)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const icon = SOCIAL_ICONS[k] || '';
      const href = k === 'email' ? `mailto:${v}` : v;
      return `<a class="social-link" href="${escapeHtml(href)}" target="_blank" rel="noopener" title="${escapeHtml(k)}">${icon}</a>`;
    }).join('');
  return `
    <footer class="footer">
      ${links ? `<div class="footer-social">${links}</div>` : ''}
      <p>© <span id="year"></span> <span>${escapeHtml(CONFIG.site.title)}</span> · 由 <a href="https://pages.github.com/" target="_blank">GitHub Pages</a> 托管 · <a href="admin/">写文章</a></p>
    </footer>
  `;
}

function searchOverlayHtml() {
  return `
    <div id="searchOverlay" class="search-overlay is-hidden" hidden aria-hidden="true">
      <div class="search-modal" role="dialog" aria-label="站内搜索">
        <div class="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input id="searchModalInput" placeholder="搜索文章标题、摘要、标签…" autocomplete="off">
          <kbd>ESC</kbd>
          <button id="searchCloseBtn" class="search-close" type="button" aria-label="关闭搜索">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div id="searchResults" class="search-results"></div>
      </div>
    </div>
  `;
}

let allPostsCache = null;
async function getAllPosts() {
  if (allPostsCache) return allPostsCache;
  const data = await fetchIndexPublic();
  allPostsCache = (data.posts || []).filter(p => !p.draft);
  return allPostsCache;
}

function highlight(text, q) {
  if (!q) return escapeHtml(text || '');
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  return escapeHtml(text || '').replace(re, '<mark>$1</mark>');
}

function renderResults(results, q) {
  const box = $('#searchResults');
  if (!q) {
    box.innerHTML = '<div class="search-empty">输入关键词开始搜索</div>';
    return;
  }
  if (!results.length) {
    box.innerHTML = '<div class="search-empty">没有匹配的文章</div>';
    return;
  }
  box.innerHTML = results.slice(0, 30).map(p => `
    <a class="search-item" href="post.html?slug=${encodeURIComponent(p.slug)}">
      <div class="search-title">${highlight(p.title || '无标题', q)}</div>
      <div class="search-summary">${highlight(p.summary || '', q)}</div>
      <div class="search-meta">${fmtDate(p.date)} · ${(p.tags || []).map(t => '#' + escapeHtml(t)).join(' ')}</div>
    </a>
  `).join('');
}

function searchPosts(posts, q) {
  if (!q) return [];
  const lq = q.toLowerCase();
  return posts.filter(p =>
    String(p.title || '').toLowerCase().includes(lq) ||
    String(p.summary || '').toLowerCase().includes(lq) ||
    (p.tags || []).some(t => String(t).toLowerCase().includes(lq))
  );
}

function bindSearchOverlay() {
  const overlay = $('#searchOverlay');
  const input = $('#searchModalInput');
  const isOpen = () => !overlay.classList.contains('is-hidden');
  const open = () => {
    overlay.classList.remove('is-hidden');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 50);
    renderResults([], '');
    getAllPosts();
  };
  const close = () => {
    overlay.classList.add('is-hidden');
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    input.value = '';
    renderResults([], '');
  };

  $('#searchBtn').addEventListener('click', open);
  $('#searchCloseBtn').addEventListener('click', close);

  overlay.addEventListener('mousedown', e => {
    // 点遮罩区域关闭；点 modal 内部任何元素都不关
    if (e.target === overlay) close();
  });

  // 输入框上的 ESC（避免 IME / 输入法层干扰）
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      isOpen() ? close() : open();
    }
    if (e.key === '/' && document.activeElement === document.body && !isOpen()) {
      e.preventDefault();
      open();
    }
  });

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      const posts = await getAllPosts();
      renderResults(searchPosts(posts, q), q);
    }, 80);
  });
}

export function initSite({ active = '' } = {}) {
  initTheme();
  applyFavicon();
  // 渲染骨架
  const navHost = $('#site-nav');
  if (navHost) navHost.innerHTML = navHtml(active);
  const footerHost = $('#site-footer');
  if (footerHost) footerHost.innerHTML = footerHtml();
  const overlayHost = $('#site-overlays');
  if (overlayHost) overlayHost.innerHTML = searchOverlayHtml();

  bindThemeToggle();
  if ($('#searchBtn')) bindSearchOverlay();
  if ($('#year')) $('#year').textContent = new Date().getFullYear();
}
