// ============================================================================
// 访问计数
//
//   provider: cloudbase — 站点总访问 + 文章阅读量（CloudBase 数据库）
//   provider: third-party — Saobby 站点图 + Vercount 文章阅读（默认兼容）
// ============================================================================

import { CONFIG } from './config.js';
import {
  isCloudBasePvEnabled,
  renderSitePvSlot,
  renderPagePvEl,
  hitPageView,
  batchGetPageViews,
  batchGetCommentCounts,
  formatCount,
  preloadPvBeacon,
} from './cloudbase-pv.js';
import { isCommentsReady } from './comments-embed.js';
import { holdLazyImages, releaseLazyImages } from './load-priority.js';

const VCOUNT_DEFAULT_SRC = 'https://events.vercount.one/js';

const STATE = {
  vercountInjected: false,
  articlePvTask: null,
  listStatsTask: null,
};

const LIST_STATS_CACHE_KEY = 'gitblog_list_stats_v1';
const LIST_STATS_CACHE_MS = 5 * 60 * 1000;
const PV_IMAGE_RELEASE_TIMEOUT_MS = 8000;

let _pvImageHoldActive = false;
let _pvWorkCount = 0;
let _pvReleaseTimer = null;

function shouldPrioritizeStatsOverImages() {
  const cfg = pvCfg();
  if (cfg.enabled === false) return false;
  if (useCloudBase()) return true;
  if (saobbySiteImg()) return true;
  if (cfg.showPostViews !== false && vercountScriptSrc()) return true;
  return isCommentsReady();
}

function beginPvImageHold() {
  if (!shouldPrioritizeStatsOverImages() || _pvImageHoldActive) return;
  _pvImageHoldActive = true;
  holdLazyImages();
}

function schedulePvImageRelease() {
  clearTimeout(_pvReleaseTimer);
  _pvReleaseTimer = setTimeout(() => {
    _pvWorkCount = 0;
    finishPvImageHold();
  }, PV_IMAGE_RELEASE_TIMEOUT_MS);
}

function finishPvImageHold() {
  clearTimeout(_pvReleaseTimer);
  _pvReleaseTimer = null;
  if (!_pvImageHoldActive) return;
  _pvImageHoldActive = false;
  releaseLazyImages();
}

function endPvWorkUnit() {
  _pvWorkCount = Math.max(0, _pvWorkCount - 1);
  if (_pvWorkCount === 0) finishPvImageHold();
  else schedulePvImageRelease();
}

function runWithPageviewPriority(task) {
  if (!shouldPrioritizeStatsOverImages()) {
    return Promise.resolve(task());
  }
  beginPvImageHold();
  _pvWorkCount += 1;
  schedulePvImageRelease();
  return Promise.resolve(task()).finally(() => endPvWorkUnit());
}

function waitForSaobbySlot(slotEl) {
  return new Promise(resolve => {
    const img = slotEl?.querySelector('img');
    if (!img) {
      resolve();
      return;
    }
    if (img.complete) {
      resolve();
      return;
    }
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

function pvCfg() {
  return CONFIG.pageviews || {};
}

function useCloudBase() {
  return isCloudBasePvEnabled();
}

function saobbyCfg() {
  return pvCfg().saobby || {};
}

function saobbySiteImg() {
  return String((saobbyCfg().site || {}).img || '').trim();
}

function vercountCfg() {
  return pvCfg().vercount || {};
}

function vercountScriptSrc() {
  const s = String(vercountCfg().scriptSrc || '').trim();
  return s || VCOUNT_DEFAULT_SRC;
}

export function isSaobbyOn() {
  if (useCloudBase()) return pvCfg().enabled !== false;
  const c = pvCfg();
  return c.enabled !== false && !!saobbySiteImg();
}

function hideAllSaobby(root = document) {
  root.querySelectorAll('[data-saobby-slot]').forEach(el => { el.hidden = true; });
}

function siteSlotPrefix() {
  return String(((saobbyCfg().site || {}).label || pvCfg().siteLabel || '总访问')).trim() || '总访问';
}

function pagePvLabel() {
  return String(vercountCfg().label || pvCfg().label || '阅读').trim() || '阅读';
}

function fillSaobbySite(slotEl, src, label = '访问') {
  if (!slotEl) return;
  if (!src) { slotEl.hidden = true; return; }
  if (slotEl.dataset.saobbyDone === '1') return;
  slotEl.dataset.saobbyDone = '1';
  slotEl.hidden = false;
  const prefix = String(slotEl.dataset.saobbyPrefix || '').trim();
  const suffix = String(slotEl.dataset.saobbySuffix || '').trim();
  const isStat = slotEl.classList.contains('saobby-slot-stat');
  const numHtml = `<img src="${escapeAttr(src)}" alt="${escapeAttr(label)}" referrerpolicy="no-referrer-when-downgrade" loading="eager" decoding="async" class="saobby-counter">`;
  if (isStat) {
    slotEl.innerHTML = `
      <strong class="saobby-num">${numHtml}</strong>
      <span class="saobby-label">${escapeAttr(prefix || label)}${suffix ? ' / ' + escapeAttr(suffix) : ''}</span>
    `.trim();
  } else {
    slotEl.innerHTML = [
      prefix ? `<span class="saobby-prefix">${escapeAttr(prefix)}</span>` : '',
      numHtml,
      suffix ? `<span class="saobby-suffix">${escapeAttr(suffix)}</span>` : '',
    ].join('');
  }
  const img = slotEl.querySelector('img');
  if (img) {
    img.addEventListener('error', () => { slotEl.hidden = true; }, { once: true });
  }
}

function injectSaobbySiteSlots(root = document) {
  const siteImg = saobbySiteImg();
  const sitePrefix = siteSlotPrefix();
  root.querySelectorAll('[data-saobby-slot="site"]').forEach(el => {
    if (!el.dataset.saobbyPrefix && !el.dataset.saobbySuffix) el.dataset.saobbyPrefix = sitePrefix;
    const override = (el.dataset.saobbyImg || '').trim();
    runWithPageviewPriority(async () => {
      fillSaobbySite(el, override || siteImg, sitePrefix);
      await waitForSaobbySlot(el);
    });
  });
}

function injectCloudBaseSiteSlots(root = document) {
  root.querySelectorAll('[data-saobby-slot="site"]:not([data-pv-site-done="1"])').forEach(el => {
    runWithPageviewPriority(() => renderSitePvSlot(el));
  });
}

/** 仅挂载指定区域内的站点统计（Hero 重绘后补挂） */
export function mountSitePvSlots(root = document) {
  const cfg = pvCfg();
  if (cfg.enabled === false || !useCloudBase()) return;
  injectCloudBaseSiteSlots(root);
}

function injectVercountScript() {
  if (STATE.vercountInjected) return;
  const el = document.getElementById('vercount_value_page_pv') || document.getElementById('gitblog_page_pv');
  if (!el || useCloudBase()) return;
  const cfg = pvCfg();
  if (cfg.enabled === false || cfg.showPostViews === false) return;
  STATE.vercountInjected = true;
  const s = document.createElement('script');
  s.src = vercountScriptSrc();
  s.defer = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  s.onerror = () => { el.textContent = '—'; };
  document.head.appendChild(s);
}

function ensureArticlePagePvPlaceholder(root = document) {
  const cfg = pvCfg();
  if (cfg.enabled === false || cfg.showPostViews === false) return;
  if (root.getElementById('gitblog_page_pv') || root.getElementById('vercount_value_page_pv')) return;
  const meta = root.querySelector('#article .article-author .meta');
  if (!meta) return;
  const html = bszPagePvHtml();
  if (!html) return;
  meta.insertAdjacentHTML('beforeend', `<span class="dot"></span>${html}`);
}

function findPagePvEl(root = document) {
  return root.getElementById('gitblog_page_pv') || root.getElementById('vercount_value_page_pv');
}

export async function trackAndRenderArticleView(meta = {}) {
  return runWithPageviewPriority(async () => {
    ensureArticlePagePvPlaceholder(document);
    if (!useCloudBase()) {
      injectVercountScript();
      return;
    }
    if (!STATE.articlePvTask) {
      STATE.articlePvTask = (async () => {
        const el = findPagePvEl(document);
        if (!el) return;
        const article = document.querySelector('#article');
        const slug = meta.slug || article?.dataset?.slug || '';
        const title = meta.title || article?.querySelector('h1')?.textContent?.trim() || '';
        const urlKey = String(meta.urlKey || article?.dataset?.urlKey || '').trim();
        const path = (urlKey && /^[a-z0-9-]+$/i.test(urlKey))
          ? `/post/${urlKey}`
          : (meta.path || location.pathname);
        await renderPagePvEl(el, { ...meta, path, slug, title, hit: true });
      })();
    }
    await STATE.articlePvTask;
  });
}

export function bszSiteStatsHtml({ compact = false } = {}) {
  const cfg = pvCfg();
  if (cfg.enabled === false) return '';
  if (!useCloudBase() && !saobbySiteImg()) return '';
  const prefix = siteSlotPrefix();
  if (compact) {
    return `<span class="saobby-slot saobby-slot-compact" data-saobby-slot="site" data-saobby-suffix="${escapeAttr(prefix)}" hidden></span>`;
  }
  return `<div class="stat saobby-slot saobby-slot-stat" data-saobby-slot="site" data-saobby-prefix="${escapeAttr(prefix)}" hidden></div>`;
}

export function bszPagePvHtml() {
  const cfg = pvCfg();
  if (cfg.enabled === false || cfg.showPostViews === false) return '';
  const label = pagePvLabel();
  if (useCloudBase()) {
    return `<span class="gitblog-pv-inline"><span class="gitblog-pv-prefix">${escapeHtml(label)} </span><span id="gitblog_page_pv">…</span><span class="gitblog-pv-suffix"> 次</span></span>`;
  }
  return `<span class="vercount-inline"><span class="vercount-prefix">${escapeHtml(label)} </span><span id="vercount_value_page_pv">…</span><span class="vercount-suffix"> 次</span></span>`;
}

export function articleListPvHtml() {
  return '';
}

function readListStatsCacheAny() {
  try {
    const raw = sessionStorage.getItem(LIST_STATS_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const age = Number.isFinite(data.ts) ? Date.now() - data.ts : Infinity;
    return {
      pv: data.pv && typeof data.pv === 'object' ? data.pv : {},
      comments: data.comments && typeof data.comments === 'object' ? data.comments : {},
      fresh: age <= LIST_STATS_CACHE_MS,
      stale: age > LIST_STATS_CACHE_MS,
    };
  } catch {
    return null;
  }
}

function readListStatsCache() {
  const data = readListStatsCacheAny();
  if (!data || data.stale) return null;
  return { pv: data.pv, comments: data.comments };
}

function writeListStatsCache(pvMap, commentMap) {
  try {
    const prev = readListStatsCache() || { pv: {}, comments: {} };
    sessionStorage.setItem(LIST_STATS_CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      pv: { ...prev.pv, ...pvMap },
      comments: { ...prev.comments, ...commentMap },
    }));
  } catch { /* ignore */ }
}

function listStatsHtml(pv, comments, { showPv, showCm }) {
  const parts = [];
  if (showPv) parts.push(`<span class="post-stat-pv" title="阅读">👀 ${escapeHtml(formatCount(pv))}</span>`);
  if (showCm) parts.push(`<span class="post-stat-cm" title="评论">💬 ${escapeHtml(formatCount(comments))}</span>`);
  return parts.join(' ');
}

function updateListStatsSlot(el, pv, comments, opts) {
  if (!el) return;
  const html = listStatsHtml(pv, comments, opts);
  if (!html) {
    el.hidden = true;
    return;
  }
  el.innerHTML = html;
  el.hidden = false;
}

function applyListStatsToSlot(el, pv, comments, opts, { finalize = true } = {}) {
  updateListStatsSlot(el, pv, comments, opts);
  if (finalize) el.dataset.listStatsDone = '1';
  else delete el.dataset.listStatsDone;
}

/** 列表渲染后立刻用缓存（含过期缓存）同步展示，不阻塞网络 */
export function syncArticleListStatsFromCache(root = document) {
  const list = root.querySelector ? root.querySelector('#postList') : null;
  if (!list || list.classList.contains('post-list--giscus')) return;

  const showPv = useCloudBase() && pvCfg().showPostViews !== false;
  const showCm = isCommentsReady();
  if (!showPv && !showCm) return;

  const cache = readListStatsCacheAny();
  if (!cache) return;

  list.querySelectorAll('.post-list-stats').forEach(el => {
    if (el.dataset.listStatsDone === '1') return;
    const pvPath = String(el.dataset.pvPath || '').trim();
    const commentPath = String(el.dataset.commentPath || '').trim();
    const cachedPv = showPv && pvPath && cache.pv[pvPath] != null ? cache.pv[pvPath] : null;
    const cachedCm = showCm && commentPath && cache.comments[commentPath] != null
      ? cache.comments[commentPath]
      : null;
    const hasPv = !showPv || cachedPv != null;
    const hasCm = !showCm || cachedCm != null;
    if (!hasPv && !hasCm) return;
    applyListStatsToSlot(el, cachedPv ?? 0, cachedCm ?? 0, { showPv, showCm }, { finalize: false });
  });
}

export function queueArticleListViews(root = document) {
  runWithPageviewPriority(() => renderArticleListViews(root).catch(() => {}));
}

export async function renderArticleListViews(root = document) {
  const list = root.querySelector ? root.querySelector('#postList') : null;
  if (!list || list.classList.contains('post-list--giscus')) return;

  const showPv = useCloudBase() && pvCfg().showPostViews !== false;
  const showCm = isCommentsReady();
  if (!showPv && !showCm) return;

  syncArticleListStatsFromCache(root);

  const slots = [...list.querySelectorAll('.post-list-stats:not([data-list-stats-done="1"])')];
  if (!slots.length) return;

  if (STATE.listStatsTask) {
    try { await STATE.listStatsTask; } catch { /* ignore */ }
  }

  const task = (async () => {
    const cache = readListStatsCache();
    const staleCache = readListStatsCacheAny();
    const forceRefresh = !!staleCache?.stale;
    const needPv = new Set();
    const needCm = new Set();
    const slotMeta = slots.map(el => ({
      el,
      pvPath: String(el.dataset.pvPath || '').trim(),
      commentPath: String(el.dataset.commentPath || '').trim(),
    }));

    for (const { el, pvPath, commentPath } of slotMeta) {
      if (!forceRefresh) {
        const cachedPv = showPv && pvPath && cache?.pv ? cache.pv[pvPath] : undefined;
        const cachedCm = showCm && commentPath && cache?.comments ? cache.comments[commentPath] : undefined;
        const hasFreshPv = !showPv || cachedPv != null;
        const hasFreshCm = !showCm || cachedCm != null;
        if (hasFreshPv && hasFreshCm) {
          applyListStatsToSlot(el, cachedPv ?? 0, cachedCm ?? 0, { showPv, showCm });
          continue;
        }
      }
      if (showPv && pvPath) needPv.add(pvPath);
      if (showCm && commentPath) needCm.add(commentPath);
    }

    const pending = slotMeta.filter(({ el }) => el.dataset.listStatsDone !== '1');
    if (!pending.length || (!needPv.size && !needCm.size)) return;

    const [pvMap, cmMap] = await Promise.all([
      needPv.size ? batchGetPageViews([...needPv]).catch(() => ({})) : Promise.resolve({}),
      needCm.size ? batchGetCommentCounts([...needCm]).catch(() => ({})) : Promise.resolve({}),
    ]);

    if (Object.keys(pvMap).length || Object.keys(cmMap).length) {
      writeListStatsCache(pvMap, cmMap);
    }

    const mergedCache = readListStatsCache();
    for (const { el, pvPath, commentPath } of pending) {
      const pv = showPv && pvPath
        ? (mergedCache?.pv?.[pvPath] ?? pvMap[pvPath] ?? staleCache?.pv?.[pvPath] ?? 0)
        : 0;
      const cm = showCm && commentPath
        ? (mergedCache?.comments?.[commentPath] ?? cmMap[commentPath] ?? staleCache?.comments?.[commentPath] ?? 0)
        : 0;
      applyListStatsToSlot(el, pv, cm, { showPv, showCm });
    }
  })();

  STATE.listStatsTask = task;
  try {
    await task;
  } finally {
    if (STATE.listStatsTask === task) STATE.listStatsTask = null;
  }
}

export function initPageviews() {
  const cfg = pvCfg();
  if (!cfg.enabled) {
    hideAllSaobby(document);
    return;
  }

  preloadPvBeacon();

  if (useCloudBase()) {
    injectCloudBaseSiteSlots(document);
    ensureArticlePagePvPlaceholder(document);
    return;
  }

  if (saobbySiteImg()) injectSaobbySiteSlots(document);
  else hideAllSaobby(document);
  ensureArticlePagePvPlaceholder(document);
  injectVercountScript();
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
