// ============================================================================
// 访问计数：默认接入「不蒜子（busuanzi）」
//
// 不蒜子是一款国内静态博客生态常用的纯前端计数器：
//   - 一段 CDN 脚本，不需要后端、不需要注册
//   - 按 Referer 头自动区分站点 / 单页，无需配置
//   - 在页面里放约定 id 的 span 占位，脚本会把数字填进去
//
// 我们做了三件加固：
//   1. 没有任何占位元素时，不注入脚本（避免无意义请求）
//   2. 加载失败 / 5 秒未拿到数字 → 把所有 .bsz 占位静默隐藏，避免布局裸奔
//   3. config.pageviews.enabled = false 时不接入任何 provider
//
// ⚠ 单文 PV 必读：所有文章页 URL 都是 /post.html?slug=xxx，不蒜子靠跨域请求的
//   Referer 头取「页面 URL」当 page_pv 的 key。现代浏览器默认 referrer-policy 是
//   `strict-origin-when-cross-origin`，跨域时只发 origin（没有 path / query）→
//   所有文章会被合并成同一个 page_pv。
//   我们的修复是：在每个 HTML head 里加
//     <meta name="referrer" content="no-referrer-when-downgrade">
//   让同协议跨域请求带完整 URL（含 query），不蒜子就能按 ?slug=xxx 区分每篇文章。
//   下面 script 标签的 referrerPolicy 也设了同样值作为兜底（虽然不蒜子内部
//   `document.write` 出来的 jsonp script 受 meta 控制，与这里设置无关）。
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

function hideAllBsz(root = document) {
  root.querySelectorAll('.bsz').forEach(el => {
    el.style.display = 'none';
  });
}

function hideEmptyBsz(root = document) {
  root.querySelectorAll('.bsz').forEach(el => {
    const num = el.querySelector('.bsz-num');
    if (!num) return;
    if (!num.textContent || !num.textContent.trim()) {
      el.style.display = 'none';
    }
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

function articleProvider() {
  const cfg = CONFIG.pageviews || {};
  // busuanzi 只能拿“当前页面”的 page_pv，不能在首页一次查询多篇文章。
  // 首页文章列表阅读量默认走 Page Views API；全站 PV / UV 仍保留 busuanzi。
  return cfg.articleProvider || 'page-views-api';
}

function pageViewsApiOn() {
  const cfg = CONFIG.pageviews || {};
  return !!cfg.enabled && articleProvider() === 'page-views-api';
}

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
  try {
    sessionStorage.setItem(VIEW_CACHE_KEY, JSON.stringify(cache));
  } catch {}
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

// 在每个页面的入口 / 渲染完成后调用一次。
// 重复调用是安全的：脚本只会注入一次；超时兜底也只生效最后一次。
export function initPageviews() {
  const cfg = CONFIG.pageviews || {};
  if (!cfg.enabled || cfg.provider !== 'busuanzi') {
    hideAllBsz();
    return;
  }
  if (!hasBszContainer()) return;

  injectBusuanzi();

  // 5 秒兜底：到点还没拿到数字 → 把对应占位隐藏
  if (STATE.fallbackTimer) clearTimeout(STATE.fallbackTimer);
  STATE.fallbackTimer = setTimeout(() => hideEmptyBsz(), 5000);
}

// 独立 helper：返回首页 / footer / 文章页的占位 HTML，
// 在各 page 渲染时直接拼接即可，统一文案与 id。
export function bszSiteStatsHtml({ compact = false } = {}) {
  if (!isBusuanziOn()) return '';
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

export function bszPagePvHtml() {
  if (pageViewsApiOn()) {
    return `<span class="pvapi" data-pv-current="1">阅读 <span class="pvapi-num"></span></span>`;
  }
  if (!isBusuanziOn()) return '';
  return `<span class="bsz" id="busuanzi_container_page_pv">阅读 <span id="busuanzi_value_page_pv" class="bsz-num"></span></span>`;
}

export function articleListPvHtml(slug) {
  if (!pageViewsApiOn() || !slug || (CONFIG.pageviews || {}).showPostViews === false) return '';
  return `<span class="post-views pvapi" data-pv-slug="${escapeAttr(slug)}" hidden>阅读 <span class="pvapi-num"></span></span>`;
}

export async function trackAndRenderArticleView(slug) {
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

  // 首页冷启动优先把首屏内容和图片拉出来，阅读量延后、限流补齐即可。
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

export function isBusuanziOn() {
  const cfg = CONFIG.pageviews || {};
  return !!cfg.enabled && cfg.provider === 'busuanzi';
}

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
