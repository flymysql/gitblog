// 构建期首页首屏 HTML（与 assets/js/home.js 结构对齐，减少 FOUC / CLS）
import { escapeHtml } from './markdown-render.mjs';

const LAZY_PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%204%203%22%2F%3E';

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

function tagStyle(tag) {
  const c = TAG_PALETTE[tagHash(tag) % TAG_PALETTE.length];
  return `--tag-bg:${c.bg};--tag-text:${c.text};--tag-border:${c.border};--tag-dark-bg:${c.darkBg};--tag-dark-text:${c.darkText};--tag-dark-border:${c.darkBorder};`;
}

function tagHtml(tag) {
  return `<span class="tag tag-colored" style="${tagStyle(tag)}">${escapeHtml(tag)}</span>`;
}

export function parseNavItems(cfgRaw) {
  const navBlock = cfgRaw.match(/nav:\s*\[([\s\S]*?)\]\s*,/);
  if (!navBlock) return [];
  const items = [];
  const re = /name:\s*"([^"]+)"\s*,\s*href:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(navBlock[1]))) items.push({ name: m[1], href: m[2] });
  return items;
}

export function buildRootPath(rel, pathPrefix = '') {
  const r = String(rel || '').replace(/^\//, '');
  const bp = String(pathPrefix || '').replace(/\/+$/, '');
  if (bp) return `${bp}/${r}`;
  return `/${r}`;
}

function navResolveHref(href, pathPrefix) {
  const h = String(href || '').trim();
  if (!h || /^https?:\/\//i.test(h) || h.startsWith('//')) return h;
  if (h.startsWith('/')) return h;
  if (h === './' || h === 'index.html') return buildRootPath('', pathPrefix) || '/';
  return buildRootPath(h, pathPrefix);
}

function navLinkAttrs(href) {
  const h = String(href || '').trim();
  return /^https?:\/\//i.test(h) ? ' target="_blank" rel="noopener noreferrer"' : '';
}

function logoHtml(siteLogo, siteTitle) {
  if (siteLogo) {
    return `<img class="nav-logo-img" src="${escapeHtml(siteLogo)}" alt="${escapeHtml(siteTitle || 'logo')}">`;
  }
  return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.27l7 3.5v7.46l-7-3.5V9.27zm9 10.96v-7.46l7-3.5v7.46l-7 3.5z"/></svg>';
}

const THEME_TOGGLE_HTML = `
    <button id="themeToggle" class="icon-btn" title="切换日 / 月 / 自动" aria-label="切换日 / 月 / 自动">
      <svg class="icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
      <svg class="icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
      <svg class="icon-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3v18M3 12a9 9 0 0 1 9-9v18a9 9 0 0 1-9-9z" fill="currentColor" stroke="none"/>
      </svg>
    </button>
    <button id="presetToggle" class="icon-btn" title="选择主题" aria-label="选择主题">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 21a9 9 0 1 0-9-9c0 5 4 5 6 4s2-2 1-3-1-2 1-2 4 0 4-3" fill="currentColor" stroke="none" opacity="0.85"/>
      </svg>
    </button>`;

export function buildNavShell({ siteTitle, siteLogo, navItems, pathPrefix, active = './' }) {
  const homeHref = buildRootPath('', pathPrefix) || '/';
  const links = navItems.map(n => {
    const res = navResolveHref(n.href, pathPrefix);
    const isActive = n.href === active || (active === './' && (n.href === './' || n.href === 'index.html'));
    return `<a class="nav-link${isActive ? ' active' : ''}" href="${escapeHtml(res)}"${navLinkAttrs(n.href)}>${escapeHtml(n.name)}</a>`;
  }).join('');
  const drawerLinks = navItems.map(n => {
    const res = navResolveHref(n.href, pathPrefix);
    const isActive = n.href === active || (active === './' && (n.href === './' || n.href === 'index.html'));
    return `<a class="nav-drawer-link${isActive ? ' active' : ''}" href="${escapeHtml(res)}"${navLinkAttrs(n.href)}>${escapeHtml(n.name)}</a>`;
  }).join('');
  const adminHref = buildRootPath('admin/', pathPrefix);

  return `<nav class="nav">
      <div class="nav-inner">
        <button id="navMenuBtn" class="icon-btn nav-menu-btn" type="button" aria-label="菜单">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <a class="nav-logo" href="${escapeHtml(homeHref)}">
          ${logoHtml(siteLogo, siteTitle)}
          <span>${escapeHtml(siteTitle || '')}</span>
        </a>
        <div class="nav-links">${links}</div>
        <div class="nav-spacer"></div>
        <button id="searchBtn" class="icon-btn" title="搜索" aria-label="搜索">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        ${THEME_TOGGLE_HTML}
        <a class="btn-write" href="${escapeHtml(adminHref)}" title="进入创作后台">
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
        <a class="nav-drawer-cta" href="${escapeHtml(adminHref)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          进入创作后台
        </a>
      </div>
    </div>`;
}

function timeAgo(iso) {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} 个月前`;
  return `${Math.floor(months / 12)} 年前`;
}

function publicImageUrl(url) {
  return String(url || '').replace(/^\.\.\/assets\//, 'assets/');
}

export function postHrefFromEntry(p, postPublicAbsUrl) {
  try {
    return new URL(postPublicAbsUrl(p)).pathname;
  } catch {
    return '#';
  }
}

export function buildHeroShell({ description, avatar, postCount, tagCount, pathPrefix }) {
  const aboutHref = buildRootPath('post/about/', pathPrefix);
  return `<a class="hero-link" href="${escapeHtml(aboutHref)}" aria-label="关于本站">
      <div class="hero-avatar-wrap">
        <div class="hero-avatar" style="background-image:url(${escapeHtml(avatar || '')})"></div>
      </div>
      <div class="hero-info">
        <div class="hero-subtitle">${escapeHtml(description || '')}</div>
        <div class="hero-stats">
          <div class="stat"><strong>${postCount}</strong>篇文章</div>
          <div class="stat"><strong>${tagCount}</strong>个标签</div>
        </div>
      </div>
      <span class="hero-arrow" aria-hidden="true">›</span>
    </a>`;
}

export function buildPostItemShell(p, { author, avatar, postHrefFromEntry: hrefFn }) {
  const href = hrefFn(p);
  const cover = p.cover ? publicImageUrl(p.thumbnail || p.cover) : '';
  return `<li class="post-item" data-slug="${escapeHtml(p.slug || '')}">
      <a class="post-content" href="${escapeHtml(href)}">
        <div class="post-author-row">
          <div class="avatar" style="background-image:url(${escapeHtml(p.avatar || avatar || '')})"></div>
          <span class="name">${escapeHtml(p.author || author || '')}</span>
          <span>·</span>
          <span>${escapeHtml(timeAgo(p.date))}</span>
          ${p.pinned ? '<span class="post-pin">置顶</span>' : ''}
        </div>
        <h3 class="post-title">${escapeHtml(p.title || '无标题')}</h3>
        <p class="post-summary">${escapeHtml(p.summary || '')}</p>
        <div class="post-meta">
          ${(p.tags || []).slice(0, 3).map(t => tagHtml(t)).join('')}
        </div>
      </a>
      ${cover ? `<a href="${escapeHtml(href)}" class="post-thumbnail"><img src="${LAZY_PLACEHOLDER}" data-src="${escapeHtml(cover)}" alt="${escapeHtml(p.title || '')}" loading="lazy" decoding="async" fetchpriority="low" class="lazy-pending"></a>` : ''}
    </li>`;
}

export function pickCarouselItems(posts) {
  const sortFn = (a, b) => {
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (a.pinned && b.pinned && Number(a.pinnedOrder || 0) !== Number(b.pinnedOrder || 0)) {
      return Number(a.pinnedOrder || 9999) - Number(b.pinnedOrder || 9999);
    }
    return new Date(b.date || 0) - new Date(a.date || 0);
  };
  const picked = posts.filter(p => p.carousel && p.cover);
  return picked.length
    ? [...picked].sort(sortFn).slice(0, 8)
    : [...posts].filter(p => p.cover).sort(sortFn).slice(0, 5);
}

export function buildCarouselShell(items, { postHrefFromEntry: hrefFn }) {
  if (!items.length) return '';
  return `<div class="carousel-viewport">
      ${items.map((p, i) => `
        <a class="carousel-slide${i === 0 ? ' active' : ''}" href="${escapeHtml(hrefFn(p))}" aria-label="${escapeHtml(p.title || '文章')}">
          <img
            src="${escapeHtml(i === 0 ? publicImageUrl(p.cover) : LAZY_PLACEHOLDER)}"
            ${i === 0 ? 'fetchpriority="high"' : `data-src="${escapeHtml(publicImageUrl(p.cover))}" fetchpriority="low"`}
            alt="${escapeHtml(p.title || '')}"
            loading="${i === 0 ? 'eager' : 'lazy'}"
            decoding="async">
          <span class="carousel-shade"></span>
          <span class="carousel-content">
            ${p.pinned ? '<span class="carousel-badge">置顶推荐</span>' : '<span class="carousel-badge">精选文章</span>'}
            <strong>${escapeHtml(p.title || '无标题')}</strong>
            ${p.summary ? `<em>${escapeHtml(p.summary)}</em>` : ''}
          </span>
        </a>
      `).join('')}
      <button class="carousel-btn prev" type="button" aria-label="上一张">‹</button>
      <button class="carousel-btn next" type="button" aria-label="下一张">›</button>
      <div class="carousel-dots">
        ${items.map((_, i) => `<button class="${i === 0 ? 'active' : ''}" type="button" aria-label="第 ${i + 1} 张"></button>`).join('')}
      </div>
    </div>`;
}

export function buildCriticalHomeCss() {
  return `<style id="critical-home">
:root{--nav-height:60px;--content-max:980px;--radius:6px;--radius-lg:10px;--primary:#EA6F5A;--text-main:#2F2F2F;--text-secondary:#6B6B6B;--text-tertiary:#9C9C9C;--border:#ECECEC;--bg:#FFF;--bg-soft:#F8F8F8;--nav-bg:rgba(255,255,255,.85);--shadow:0 1px 3px rgba(0,0,0,.04)}
:root[data-mode=dark],:root[data-theme=dark]{--text-main:#E6E6E6;--text-secondary:#A3A3A3;--border:#2A2A2D;--bg:#131316;--bg-soft:#1A1A1E;--nav-bg:rgba(19,19,22,.78)}
html,body{margin:0;background:var(--bg);color:var(--text-main);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
[hidden]{display:none!important}
.nav{position:sticky;top:0;z-index:100;height:var(--nav-height);background:var(--nav-bg);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 24px}
.nav-inner{width:100%;max-width:1200px;margin:0 auto;height:100%;display:flex;align-items:center;gap:18px}
.nav-logo{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--text-main)}
.nav-links{display:flex;gap:2px;flex:0 1 auto;overflow:hidden}
.nav-link{padding:8px 12px;border-radius:var(--radius);font-size:14px;color:var(--text-secondary);white-space:nowrap}
.nav-spacer{flex:1}
.hero{max-width:var(--content-max);margin:28px auto 0;border-radius:var(--radius-lg);background:linear-gradient(135deg,rgba(234,111,90,.08),rgba(234,111,90,.02))}
.hero-link{display:flex;align-items:center;gap:26px;padding:32px 24px;color:inherit;text-decoration:none}
.hero-avatar-wrap{width:72px;height:72px;flex:0 0 auto}
.hero-avatar{width:100%;height:100%;border-radius:50%;background-size:cover;background-position:center;background-color:var(--bg-soft)}
.layout{max-width:var(--content-max);margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1fr 260px;gap:36px}
.home-carousel{max-width:var(--content-max);margin:18px auto 0;padding:0 24px}
.carousel-viewport{position:relative;height:260px;border-radius:var(--radius-lg);overflow:hidden;background:var(--bg-soft)}
.post-list{list-style:none;margin:0;padding:0}
.post-item{display:flex;gap:22px;padding:20px 4px;border-bottom:1px solid var(--border)}
.post-content{flex:1;min-width:0}
.post-title{font-size:18px;font-weight:700;margin:0 0 8px;line-height:1.5}
@media(max-width:880px){.layout{grid-template-columns:1fr}.sidebar{display:none}}
@media(max-width:820px){.nav-links{display:none}}
@media(max-width:720px){.nav{padding:0 12px}.hero{margin:8px 12px 0}.layout{padding:0 14px}.home-carousel{padding:0 14px}.carousel-viewport{height:180px}.hero-link{padding:4px 12px}}
</style>`;
}
