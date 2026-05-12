// ============================================================================
// 访问计数：支持两种 provider
//
//   1. busuanzi（不蒜子）— 默认零配置，按 Referer 自动区分站点 / 单页
//   2. saobby（https://www.saobby.com）— 需要在站长控制面板各创建一个计数器，
//      把图片 URL + 控制面板 URL 填进站点设置即可。每张图片放到页面上 = 自带计数 +1
//
// 模型差异：
//   - busuanzi：一段 CDN 脚本 + DOM 占位，回填数字
//   - saobby ：每个计数器 = 一张图，图片 src 加载即 +1，本身就是数字图
//     ⚠ 一个计数器代表「一类页面」，不能在首页用一张图统计每篇文章的阅读量；
//        所以 saobby provider 下，首页文章列表的逐篇阅读量会自动隐藏。
//
// 加固：
//   - 没有任何占位元素时，不注入 / 不生成 img（避免无意义请求）
//   - 配置缺失（saobby.site.img 没填）→ 占位静默隐藏，不影响布局
//   - busuanzi 5 秒兜底：到点还没拿到数字 → 隐藏所有 .bsz 占位
// ============================================================================

import { CONFIG } from './config.js';

const BUSUANZI_SRC = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
const PAGE_VIEWS_API = 'https://page-views-api.ratneshc.com/api/v1';

const STATE = {
  injected: false,
  fallbackTimer: null,
};
const VIEW_CACHE_KEY = 'article_view_cache_v1';
const VIEW_CACHE_TTL = 10 * 60 * 1000;
const LIST_VIEW_CONCURRENCY = 4;

// ---------- provider helpers ----------------------------------------------

function pvCfg() {
  return CONFIG.pageviews || {};
}

function provider() {
  const cfg = pvCfg();
  if (!cfg.enabled) return 'none';
  return cfg.provider || 'busuanzi';
}

export function isBusuanziOn() {
  return provider() === 'busuanzi';
}

export function isSaobbyOn() {
  return provider() === 'saobby';
}

function saobbyCfg() {
  return (pvCfg().saobby) || {};
}

function saobbySiteImg() {
  return String((saobbyCfg().site || {}).img || '').trim();
}

function saobbyArticleImg() {
  return String((saobbyCfg().article || {}).img || '').trim();
}

function articleProvider() {
  const cfg = pvCfg();
  return cfg.articleProvider || 'page-views-api';
}

function pageViewsApiOn() {
  // 仅在 busuanzi 模式下，列表逐篇阅读数才走 Page Views API。
  // saobby 模式下整个 list 阅读量隐藏，避免误导。
  return isBusuanziOn() && !!pvCfg().enabled && articleProvider() === 'page-views-api';
}

// ---------- busuanzi --------------------------------------------------------

function hideAllBsz(root = document) {
  root.querySelectorAll('.bsz').forEach(el => { el.style.display = 'none'; });
}

function hideEmptyBsz(root = document) {
  root.querySelectorAll('.bsz').forEach(el => {
    const num = el.querySelector('.bsz-num');
    if (!num) return;
    if (!num.textContent || !num.textContent.trim()) el.style.display = 'none';
  });
}

function injectBusuanzi() {
  if (STATE.injected) return;
  STATE.injected = true;
  const s = document.createElement('script');
  s.src = BUSUANZI_SRC;
  s.async = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  s.onerror = () => hideAllBsz();
  document.head.appendChild(s);
}

function hasBszContainer() {
  return !!document.querySelector(
    '#busuanzi_container_site_pv, #busuanzi_container_site_uv, #busuanzi_container_page_pv'
  );
}

// ---------- saobby ---------------------------------------------------------
// 一个 saobby 计数器 = 一张图。我们把图片插入到对应占位里，
// 浏览器加载这张图就 +1，图本身渲染就是数字。

function hideAllSaobby(root = document) {
  root.querySelectorAll('[data-saobby-slot]').forEach(el => { el.hidden = true; });
}

function fillSaobbyImage(slotEl, src, label = '访问') {
  if (!slotEl) return;
  if (!src) { slotEl.hidden = true; return; }
  // 在已渲染过的 slot 里插入一张图，避免重复插入
  if (slotEl.dataset.saobbyDone === '1') return;
  slotEl.dataset.saobbyDone = '1';
  slotEl.hidden = false;
  // 加 referrerPolicy 让 saobby 服务可以按完整 URL 区分页面
  slotEl.innerHTML = `<img src="${escapeAttr(src)}" alt="${escapeAttr(label)}" referrerpolicy="no-referrer-when-downgrade" loading="eager" decoding="async" class="saobby-counter">`;
  const img = slotEl.querySelector('img');
  if (img) {
    img.addEventListener('error', () => { slotEl.hidden = true; }, { once: true });
  }
}

function injectSaobby(root = document) {
  const siteImg = saobbySiteImg();
  const articleImg = saobbyArticleImg();
  root.querySelectorAll('[data-saobby-slot="site"]').forEach(el => fillSaobbyImage(el, siteImg, '总访问量'));
  root.querySelectorAll('[data-saobby-slot="article"]').forEach(el => fillSaobbyImage(el, articleImg, '阅读次数'));
}

// ---------- public API -----------------------------------------------------

// 在每个页面入口 / 渲染完成后调用一次。重复调用安全。
export function initPageviews() {
  const cfg = pvCfg();
  if (!cfg.enabled || provider() === 'none') {
    hideAllBsz();
    hideAllSaobby();
    return;
  }
  if (isBusuanziOn()) {
    if (!hasBszContainer()) return;
    injectBusuanzi();
    if (STATE.fallbackTimer) clearTimeout(STATE.fallbackTimer);
    STATE.fallbackTimer = setTimeout(() => hideEmptyBsz(), 5000);
    return;
  }
  if (isSaobbyOn()) {
    injectSaobby();
    return;
  }
}

// 站点级 PV / UV 占位 HTML（首页 hero / footer 都用它）
export function bszSiteStatsHtml({ compact = false } = {}) {
  if (isBusuanziOn()) {
    if (compact) {
      return `
        <span class="bsz" id="busuanzi_container_site_pv">总访问 <span id="busuanzi_value_site_pv" class="bsz-num"></span></span>
        <span class="bsz-sep">·</span>
        <span class="bsz" id="busuanzi_container_site_uv">访客 <span id="busuanzi_value_site_uv" class="bsz-num"></span></span>
      `;
    }
    return `
      <div class="stat bsz" id="busuanzi_container_site_pv">
        <strong class="bsz-num"><span id="busuanzi_value_site_pv"></span></strong>次访问
      </div>
      <div class="stat bsz" id="busuanzi_container_site_uv">
        <strong class="bsz-num"><span id="busuanzi_value_site_uv"></span></strong>位访客
      </div>
    `;
  }
  if (isSaobbyOn() && saobbySiteImg()) {
    if (compact) {
      return `<span class="saobby-slot saobby-slot-compact" data-saobby-slot="site" hidden></span>`;
    }
    return `<div class="stat saobby-slot" data-saobby-slot="site" hidden></div>`;
  }
  return '';
}

// 文章页阅读次数占位
export function bszPagePvHtml() {
  if (isBusuanziOn()) {
    if (pageViewsApiOn()) {
      return `<span class="pvapi" data-pv-current="1">阅读 <span class="pvapi-num"></span></span>`;
    }
    return `<span class="bsz" id="busuanzi_container_page_pv">阅读 <span id="busuanzi_value_page_pv" class="bsz-num"></span></span>`;
  }
  if (isSaobbyOn() && saobbyArticleImg()) {
    return `<span class="saobby-slot saobby-slot-inline" data-saobby-slot="article" hidden></span>`;
  }
  return '';
}

// 首页文章列表逐篇阅读量
// saobby 模型不支持按 slug 查，直接返回空 → 列表里这一栏不会出现
export function articleListPvHtml(slug) {
  if (!slug) return '';
  const cfg = pvCfg();
  if (cfg.showListPostViews === false || cfg.showPostViews === false) return '';
  if (isSaobbyOn()) return '';
  if (!pageViewsApiOn()) return '';
  return `<span class="post-views pvapi" data-pv-slug="${escapeAttr(slug)}" hidden>阅读 <span class="pvapi-num"></span></span>`;
}

// 文章页：计数器 +1 并把数字回填到当前页占位
export async function trackAndRenderArticleView(slug) {
  if (isSaobbyOn()) {
    // saobby 走图片即 +1，初始化时已经处理
    initPageviews();
    return;
  }
  if (!pageViewsApiOn() || !slug) {
    initPageviews();
    return;
  }
  document.querySelectorAll('[data-pv-current]').forEach(el => {
    el.dataset.pvSlug = slug;
  });
  try {
    await trackArticleView(slug);
    const views = await fetchArticleViews(slug);
    setArticleView(slug, views);
  } catch (e) {
    console.warn('[pageviews] render article view failed', e);
    hideArticleView(slug);
  }
}

// 首页列表批量补阅读量（仅 busuanzi + page-views-api 时才生效）
export async function renderArticleListViews(root = document) {
  if (!pageViewsApiOn()) return;
  const nodes = [...root.querySelectorAll('[data-pv-slug]')].filter(el => !el.dataset.pvLoaded);
  if (!nodes.length) return;
  const slugs = [...new Set(nodes.map(el => el.dataset.pvSlug).filter(Boolean))];
  nodes.forEach(el => { el.dataset.pvLoaded = '1'; });
  const pending = [];
  for (const slug of slugs) {
    const cached = getCachedArticleViews(slug);
    if (cached != null) {
      setArticleView(slug, cached);
    } else {
      pending.push(slug);
    }
  }
  if (!pending.length) return;
  scheduleIdle(async () => {
    for (let i = 0; i < pending.length; i += LIST_VIEW_CONCURRENCY) {
      const batch = pending.slice(i, i + LIST_VIEW_CONCURRENCY);
      await Promise.allSettled(batch.map(async slug => {
        try {
          const views = await fetchArticleViews(slug);
          setCachedArticleViews(slug, views);
          setArticleView(slug, views);
        } catch (e) {
          console.warn('[pageviews] list view failed', slug, e);
          hideArticleView(slug);
        }
      }));
    }
  });
}

// ---------- internal: page-views-api ---------------------------------------

function siteKey() {
  try {
    const u = new URL(CONFIG.site.url || location.origin);
    return u.host;
  } catch {
    return location.host;
  }
}

function basePath() {
  try {
    const u = new URL(CONFIG.site.url || location.origin);
    return u.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function articlePath(slug) {
  const prefix = basePath();
  const path = `${prefix}/post.html?slug=${encodeURIComponent(slug || '')}`;
  return path.startsWith('/') ? path : `/${path}`;
}

async function fetchArticleViews(slug) {
  const url = `${PAGE_VIEWS_API}/views?site=${encodeURIComponent(siteKey())}&path=${encodeURIComponent(articlePath(slug))}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`views api ${res.status}`);
  const data = await res.json();
  return Number(data.views || 0);
}

function readViewCache() {
  try {
    const raw = sessionStorage.getItem(VIEW_CACHE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeViewCache(cache) {
  try { sessionStorage.setItem(VIEW_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function getCachedArticleViews(slug) {
  const item = readViewCache()[slug];
  if (!item || Date.now() - Number(item.time || 0) > VIEW_CACHE_TTL) return null;
  return Number(item.views || 0);
}

function setCachedArticleViews(slug, views) {
  const cache = readViewCache();
  cache[slug] = { views: Number(views || 0), time: Date.now() };
  writeViewCache(cache);
}

async function trackArticleView(slug) {
  const url = `${PAGE_VIEWS_API}/track?site=${encodeURIComponent(siteKey())}&path=${encodeURIComponent(articlePath(slug))}`;
  try {
    await fetch(url, { cache: 'no-store', keepalive: true });
  } catch (e) {
    console.warn('[pageviews] track failed', e);
  }
}

function setArticleView(slug, views) {
  document.querySelectorAll(`[data-pv-slug="${cssEscape(slug)}"]`).forEach(el => {
    const num = el.querySelector('.pvapi-num');
    if (num) num.textContent = String(views || 0);
    el.hidden = false;
  });
}

function hideArticleView(slug) {
  document.querySelectorAll(`[data-pv-slug="${cssEscape(slug)}"]`).forEach(el => {
    el.hidden = true;
  });
}

// ---------- utilities ------------------------------------------------------

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function cssEscape(s) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(s));
  return String(s).replace(/["\\]/g, '\\$&');
}

function scheduleIdle(fn) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout: 1800 });
  } else {
    setTimeout(fn, 900);
  }
}
