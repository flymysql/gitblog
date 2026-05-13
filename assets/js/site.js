// ============================================================================
// 站点公共：渲染顶部导航 / 搜索浮层 / 底部 / 主题切换
// 在每个面向读者的页面里调用 initSite()
// ============================================================================

import { CONFIG } from './config.js';
import { initTheme, bindThemeToggle, themeToggleHtml } from './theme.js';
import { fetchIndexPublic } from './api.js';
import { initPageviews, bszSiteStatsHtml } from './pageviews.js';

const $ = (sel, root = document) => root.querySelector(sel);

// ============================================================================
// 图片懒加载（IntersectionObserver）
// 与原生 loading="lazy" 相比，浏览器一进页面不会预排队下载非首屏图，
// 进入视口前 300px 才注入真实 src，对长文章 / 多图首页效果显著
// ============================================================================
export const LAZY_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%204%203%22%2F%3E';
let _lazyObs = null;
function getLazyObserver() {
  if (_lazyObs) return _lazyObs;
  if (typeof IntersectionObserver === 'undefined') return null;
  _lazyObs = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const img = e.target;
      const real = img.dataset.src;
      if (real) {
        img.src = real;
        img.removeAttribute('data-src');
      }
      img.classList.remove('lazy-pending');
      _lazyObs.unobserve(img);
    }
  }, { rootMargin: '300px 0px', threshold: 0.01 });
  return _lazyObs;
}

export function lazyImage(img, { eager = false } = {}) {
  if (!img || img.dataset.lazied) return;
  img.dataset.lazied = '1';
  img.decoding = img.decoding || 'async';
  const pendingSrc = img.dataset.src;
  if (eager) {
    img.loading = 'eager';
    if (!img.getAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'high');
    if (pendingSrc) {
      img.src = pendingSrc;
      img.removeAttribute('data-src');
    }
    return;
  }
  const realSrc = pendingSrc || img.getAttribute('src');
  if (!realSrc || (realSrc.startsWith('data:') && !pendingSrc)) {
    img.loading = 'lazy';
    return;
  }
  img.dataset.src = realSrc;
  img.setAttribute('src', LAZY_PLACEHOLDER);
  img.loading = 'lazy';
  if (!img.getAttribute('fetchpriority')) img.setAttribute('fetchpriority', 'low');
  img.classList.add('lazy-pending');
  const io = getLazyObserver();
  if (io) io.observe(img);
  else { img.src = realSrc; img.removeAttribute('data-src'); img.classList.remove('lazy-pending'); }
}

// 给 root 内所有 img 设置懒加载；前 eagerCount 张保持立即加载（首屏 LCP 友好）
export function bindLazyImages(root = document, { eagerCount = 1, selector = 'img' } = {}) {
  const imgs = [...root.querySelectorAll(selector)].filter(img => !img.dataset.lazied);
  imgs.forEach((img, i) => lazyImage(img, { eager: i < eagerCount }));
}

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

/** 从 site.url 推断的路径前缀（GitHub Pages 子路径仓库时为例如 /gitblog） */
export function siteBasePath() {
  try {
    const u = String(CONFIG.site.url || '').trim();
    if (!u) return '';
    const o = new URL(u.endsWith('/') ? u : `${u}/`);
    const p = o.pathname.replace(/\/+$/, '');
    return p === '/' || !p ? '' : p;
  } catch {
    return '';
  }
}

/** 对外文章 path：/post/YYYYMMDD/、/post/YYYYMMDD-2/，或固定 /post/welcome/、/post/about/ */
export const POST_URL_KEY_RE = /^\d{8}(-\d+)?$/;
/** 与 scripts/build.mjs 中 POST_PATH_BY_SLUG 保持一致 */
export const POST_PATH_SLUGS = new Set(['welcome', 'about']);

export function isPostPublicPathKey(seg) {
  const s = String(seg || '').trim();
  return POST_URL_KEY_RE.test(s) || POST_PATH_SLUGS.has(s);
}

export function postPath(urlKey) {
  const s = String(urlKey || '').trim();
  const bp = siteBasePath();
  if (!isPostPublicPathKey(s)) return bp ? `${bp}/post.html` : '/post.html';
  const enc = encodeURIComponent(s);
  return `${bp}/post/${enc}/`;
}

/** 列表 / 搜索：有 urlKey 用规范地址，否则退回 post.html?slug= */
export function postPathFromPost(p) {
  if (!p || !p.slug) return rootPath('post.html');
  const k = String(p.urlKey || '').trim();
  if (isPostPublicPathKey(k)) return postPath(k);
  return `${rootPath('post.html')}?slug=${encodeURIComponent(p.slug)}`;
}

/** admin 目录下打开前台文章 */
export function postPathFromAdminPost(p) {
  if (!p || !p.slug) return '../post.html';
  const k = String(p.urlKey || '').trim();
  if (isPostPublicPathKey(k)) return `..${postPath(k)}`;
  return `../post.html?slug=${encodeURIComponent(p.slug)}`;
}

/** 站点根下的路径（以 / 开头），用于从 post/{slug}/ 子目录链接到 /admin、/assets 等 */
export function rootPath(pathRel) {
  const r = String(pathRel || '').replace(/^\//, '');
  const bp = siteBasePath();
  if (bp) return `${bp}/${r}`;
  return `/${r}`;
}

// 估算阅读时间（中文按 350 字/分钟，英文按 250 词/分钟，混排取较大者）
export function readingMinutes(text) {
  const s = String(text || '');
  const cn = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (s.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  const mins = Math.max(1, Math.round(cn / 350 + en / 250));
  return mins;
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

const TAG_PALETTE = [
  { bg: '#FFE8E3', text: '#C44732', border: '#F7C5BA', darkBg: '#3A211D', darkText: '#FFB2A3', darkBorder: '#6F3B32' },
  { bg: '#E8F1FF', text: '#1E5AA8', border: '#BFD6FA', darkBg: '#152842', darkText: '#9EC8FF', darkBorder: '#31537A' },
  { bg: '#E8F8EE', text: '#1E7A43', border: '#BDE8CC', darkBg: '#153321', darkText: '#91E4AE', darkBorder: '#2F6A43' },
  { bg: '#FFF4D8', text: '#936018', border: '#F2D38A', darkBg: '#382A12', darkText: '#F4C76F', darkBorder: '#735421' },
  { bg: '#F0E9FF', text: '#6843B5', border: '#D7C6F6', darkBg: '#271E3F', darkText: '#C5B2FF', darkBorder: '#55427F' },
  { bg: '#E6FAFA', text: '#167A7F', border: '#B8E7E8', darkBg: '#123638', darkText: '#8EE2E5', darkBorder: '#2B6E72' },
  { bg: '#FCE8F3', text: '#A33B72', border: '#F2B9D8', darkBg: '#381B2C', darkText: '#F7A6CE', darkBorder: '#753858' },
  { bg: '#EEF0F3', text: '#4B5563', border: '#D5DAE1', darkBg: '#252A33', darkText: '#CBD5E1', darkBorder: '#47515F' },
];

function tagHash(tag) {
  let h = 0;
  const s = String(tag || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function tagColor(tag) {
  return TAG_PALETTE[tagHash(tag) % TAG_PALETTE.length];
}

export function tagStyle(tag) {
  const c = tagColor(tag);
  return `--tag-bg:${c.bg};--tag-text:${c.text};--tag-border:${c.border};--tag-dark-bg:${c.darkBg};--tag-dark-text:${c.darkText};--tag-dark-border:${c.darkBorder};`;
}

export function tagHtml(tag, { href = '', active = false, count = '' } = {}) {
  const body = `${escapeHtml(tag)}${count === '' ? '' : `<span class="count">${count}</span>`}`;
  const attrs = `class="tag tag-colored${active ? ' active' : ''}" style="${tagStyle(tag)}"`;
  if (href) return `<a ${attrs} href="${escapeHtml(href)}">${body}</a>`;
  return `<span ${attrs}>${body}</span>`;
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

function navResolveHref(href) {
  const h = String(href || '').trim();
  if (!h || /^https?:\/\//i.test(h) || h.startsWith('//')) return h;
  if (h.startsWith('/')) return h;
  return rootPath(h);
}

function navHtml(active) {
  const navItems = CONFIG.site.nav || [];
  const links = navItems.map(n => {
    const res = navResolveHref(n.href);
    const isActive = active && (n.href === active || res === active || (active === 'home' && (n.href === './' || n.href === 'index.html')));
    return `<a class="nav-link${isActive ? ' active' : ''}" href="${escapeHtml(res)}">${escapeHtml(n.name)}</a>`;
  }).join('');
  const drawerLinks = navItems.map(n => {
    const res = navResolveHref(n.href);
    const isActive = active && (n.href === active || res === active || (active === 'home' && (n.href === './' || n.href === 'index.html')));
    return `<a class="nav-drawer-link${isActive ? ' active' : ''}" href="${escapeHtml(res)}">${escapeHtml(n.name)}</a>`;
  }).join('');
  return `
    <nav class="nav">
      <div class="nav-inner">
        <button id="navMenuBtn" class="icon-btn nav-menu-btn" type="button" aria-label="菜单">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <a class="nav-logo" href="${escapeHtml(rootPath(''))}">
          ${logoSvg()}
          <span>${escapeHtml(CONFIG.site.title)}</span>
        </a>
        <div class="nav-links">${links}</div>
        <div class="nav-spacer"></div>
        <button id="searchBtn" class="icon-btn" title="搜索" aria-label="搜索">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        ${themeToggleHtml()}
        <a class="btn-write" href="${escapeHtml(rootPath('admin/'))}" title="进入创作后台">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          <span class="btn-write-label">创作</span>
        </a>
      </div>
    </nav>
    <div id="navDrawer" class="nav-drawer is-hidden" aria-hidden="true">
      <div class="nav-drawer-panel">
        <div class="nav-drawer-header">
          <span>导航</span>
          <button id="navDrawerClose" class="icon-btn" type="button" aria-label="关闭">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="nav-drawer-links">${drawerLinks}</div>
        <a class="nav-drawer-cta" href="${escapeHtml(rootPath('admin/'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          进入创作后台
        </a>
      </div>
    </div>
  `;
}

function footerHtml({ omitSitePv = false } = {}) {
  const social = CONFIG.site.social || {};
  const links = Object.entries(social)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const icon = SOCIAL_ICONS[k] || '';
      const href = k === 'email' ? `mailto:${v}` : v;
      return `<a class="social-link" href="${escapeHtml(href)}" target="_blank" rel="noopener" title="${escapeHtml(k)}">${icon}</a>`;
    }).join('');
  const pvCfg = CONFIG.pageviews || {};
  const wantFooterPv = pvCfg.showFooterStats !== false && !omitSitePv;
  const pvHtml = wantFooterPv ? bszSiteStatsHtml({ compact: true }) : '';
  const pv = pvHtml ? `<div class="footer-stats">${pvHtml}</div>` : '';
  return `
    <footer class="footer">
      ${links ? `<div class="footer-social">${links}</div>` : ''}
      <p>© <span id="year"></span> <span>${escapeHtml(CONFIG.site.title)}</span> · 由 <a href="https://pages.github.com/" target="_blank">GitHub Pages</a> 托管 · <a href="${escapeHtml(rootPath('admin/'))}">写文章</a></p>
      ${pv}
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
  allPostsCache = (data.posts || []).filter(p => !p.draft && p.type !== 'note');
  return allPostsCache;
}

// data/search.json 含每篇文章的纯文本片段，由 build.mjs 生成。
// 找不到就降级用 posts.json（没有正文）的标题/摘要做匹配。
let searchIndexCache = null;
async function getSearchIndex() {
  if (searchIndexCache) return searchIndexCache;
  try {
    const r = await fetch('data/search.json?_=' + Date.now(), { cache: 'no-cache' });
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.docs)) {
        searchIndexCache = j.docs;
        return searchIndexCache;
      }
    }
  } catch {}
  searchIndexCache = null;
  return null;
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
    <a class="search-item" href="${postPathFromPost(p)}">
      <div class="search-title">${highlight(p.title || '无标题', q)}</div>
      <div class="search-summary">${highlight(p._snippet || p.summary || '', q)}</div>
      <div class="search-meta">${fmtDate(p.date)} · ${(p.tags || []).map(t => '#' + escapeHtml(t)).join(' ')}</div>
    </a>
  `).join('');
}

// 简单的多关键词 AND 匹配 + 评分：标题命中 > 标签命中 > 摘要 > 正文
// 支持多关键词空格分隔（"git pages" 同时匹配 git 和 pages）
function searchPosts(posts, q, fullDocs) {
  if (!q) return [];
  const tokens = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const docMap = fullDocs ? new Map(fullDocs.map(d => [d.slug, d])) : null;

  function scoreItem(p) {
    const title = String(p.title || '').toLowerCase();
    const summary = String(p.summary || '').toLowerCase();
    const tags = (p.tags || []).map(t => String(t).toLowerCase());
    const doc = docMap ? docMap.get(p.slug) : null;
    const body = doc ? String(doc.text || '').toLowerCase() : '';

    let total = 0;
    for (const t of tokens) {
      let s = 0;
      if (title.includes(t)) s += 50;
      if (tags.some(tag => tag.includes(t))) s += 30;
      if (summary.includes(t)) s += 18;
      if (body && body.includes(t)) s += 10;
      if (!s) return -1; // AND：任一 token 没命中就丢弃
      total += s;
    }
    return total;
  }

  return posts
    .map(p => ({ p, s: scoreItem(p) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => {
      const doc = docMap ? docMap.get(x.p.slug) : null;
      // 给结果带一个 "snippet"：从正文中取关键词附近的一段，渲染时高亮
      let snippet = x.p.summary || '';
      if (doc && doc.text) {
        const lower = doc.text.toLowerCase();
        const first = tokens.map(t => lower.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0];
        if (first != null && first >= 0) {
          const start = Math.max(0, first - 28);
          const end = Math.min(doc.text.length, first + 92);
          snippet = (start > 0 ? '…' : '') + doc.text.slice(start, end) + (end < doc.text.length ? '…' : '');
        }
      }
      return { ...x.p, _snippet: snippet };
    });
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

  // 第一次打开时静默拉一下 search.json（即使没输关键词），避免输入第一个字时再等 RTT
  const warmIndex = () => { getSearchIndex(); };
  $('#searchBtn').addEventListener('click', warmIndex);

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      const [posts, docs] = await Promise.all([getAllPosts(), getSearchIndex()]);
      renderResults(searchPosts(posts, q, docs), q);
    }, 80);
  });
}

function bindNavDrawer() {
  const drawer = $('#navDrawer');
  const btn = $('#navMenuBtn');
  const closeBtn = $('#navDrawerClose');
  if (!drawer || !btn) return;
  const open = () => {
    drawer.classList.remove('is-hidden');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    drawer.classList.add('is-hidden');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };
  btn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  drawer.addEventListener('click', e => { if (e.target === drawer) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !drawer.classList.contains('is-hidden')) close();
  });
}

function injectAnalytics() {
  const code = CONFIG.analytics && CONFIG.analytics.enabled ? String(CONFIG.analytics.snippet || '').trim() : '';
  if (!code || document.getElementById('siteAnalyticsSnippet')) return;
  const tpl = document.createElement('template');
  tpl.innerHTML = code;
  const marker = document.createElement('meta');
  marker.id = 'siteAnalyticsSnippet';
  marker.name = 'site-analytics-snippet';
  marker.content = 'enabled';
  document.head.appendChild(marker);
  [...tpl.content.childNodes].forEach(node => {
    if (node.nodeName.toLowerCase() === 'script') {
      const script = document.createElement('script');
      [...node.attributes].forEach(attr => script.setAttribute(attr.name, attr.value));
      script.textContent = node.textContent;
      document.head.appendChild(script);
    } else {
      document.head.appendChild(node.cloneNode(true));
    }
  });
}

export function initSite({ active = '', skipDuplicateSitePv = false } = {}) {
  initTheme();
  applyFavicon();
  const navHost = $('#site-nav');
  if (navHost) navHost.innerHTML = navHtml(active);
  const footerHost = $('#site-footer');
  const pvCfg = CONFIG.pageviews || {};
  const omitFooterSitePv = skipDuplicateSitePv && pvCfg.showHomeStats !== false;
  if (footerHost) footerHost.innerHTML = footerHtml({ omitSitePv: omitFooterSitePv });
  const overlayHost = $('#site-overlays');
  if (overlayHost) overlayHost.innerHTML = searchOverlayHtml();

  bindThemeToggle();
  bindNavDrawer();
  if ($('#searchBtn')) bindSearchOverlay();
  if ($('#year')) $('#year').textContent = new Date().getFullYear();
  injectAnalytics();
  initPageviews();
  registerServiceWorker();
}

// PWA / 离线：把 sw.js 注册成根作用域（必须放在站点根目录，scope: ./）
// admin/* 的写操作 sw 内部已经放过去不缓存了，避免出现"看起来发布成功了其实在缓存里"
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  // 不在 admin 后台启用 sw（避免缓存登录页 / 后台资源），让 admin 永远是最新版本
  if (location.pathname.includes('/admin/')) return;
  window.addEventListener('load', () => {
    const bp = siteBasePath();
    const scope = bp ? `${bp}/` : '/';
    const swUrl = bp ? `${bp}/sw.js` : '/sw.js';
    navigator.serviceWorker.register(swUrl, { scope })
      .then(reg => {
        // 检查到新版本时静默更新；下次刷新自动生效
        if (reg && reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        reg && reg.addEventListener && reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage('SKIP_WAITING');
            }
          });
        });
      }).catch(() => {});
  });
}
