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
  fetchListPageViews,
  batchGetCommentCounts,
  formatCount,
  getCachedArticlePv,
  preloadPvBeacon,
  waitForPvBeacon,
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
  return startArticlePageView(meta);
}

/** 文章页尽早拉阅读数（不阻塞图片与其它增强逻辑） */
export function startArticlePageView(meta = {}) {
  ensureArticlePagePvPlaceholder(document);
  if (!useCloudBase()) {
    injectVercountScript();
    return Promise.resolve();
  }
  if (!STATE.articlePvTask) {
    STATE.articlePvTask = (async () => {
      const el = findPagePvEl(document);
      if (!el) return;
      const article = document.querySelector('#article');
      const slug = meta.slug || article?.dataset?.slug || '';
      const title = meta.title || article?.querySelector('h1')?.textContent?.trim() || '';
      const urlKey = String(meta.urlKey || article?.dataset?.urlKey || '').trim();
      const path = meta.path || ((urlKey && /^[a-z0-9-]+$/i.test(urlKey))
        ? `/post/${urlKey}`
        : location.pathname);
      await renderPagePvEl(el, { ...meta, path, slug, title, hit: true });
    })();
  }
  return STATE.articlePvTask;
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

function cachedListPv(pvPath) {
  const path = String(pvPath || '').trim();
  if (!path) return null;
  const fromArticle = getCachedArticlePv(path);
  if (fromArticle != null) return fromArticle;
  const fromList = readListStatsCache()?.pv?.[path];
  if (fromList != null && fromList > 0) return fromList;
  return null;
}

function cachedListComments(commentPath) {
  const key = String(commentPath || '').trim();
  if (!key) return null;
  const v = readListStatsCache()?.comments?.[key];
  return v != null ? v : null;
}

function writeListStatsCache(pvMap, commentMap) {
  try {
    const prev = readListStatsCacheAny() || { pv: {}, comments: {} };
    sessionStorage.setItem(LIST_STATS_CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      pv: { ...(prev.pv || {}), ...pvMap },
      comments: { ...(prev.comments || {}), ...commentMap },
    }));
  } catch { /* ignore */ }
}

function listStatsHtml(pv, comments, { showPv, showCm }) {
  const parts = [];
  if (showPv) {
    const pvText = pv == null ? '…' : escapeHtml(formatCount(pv));
    parts.push(`<span class="post-stat-pv" title="阅读">👀 ${pvText}</span>`);
  }
  if (showCm) {
    const cmText = comments == null ? '…' : escapeHtml(formatCount(comments));
    parts.push(`<span class="post-stat-cm" title="评论">💬 ${cmText}</span>`);
  }
  return parts.join(' ');
}

function applyListStatsToSlot(el, pv, comments, opts, { finalize = true } = {}) {
  if (!el) return;
  const html = listStatsHtml(pv, comments, opts);
  if (!html) {
    el.hidden = true;
    return;
  }
  el.innerHTML = html;
  el.hidden = false;
  if (finalize) el.dataset.listStatsDone = '1';
  else delete el.dataset.listStatsDone;
}

/** 列表渲染后：仅展示已确认有效的缓存（不展示无依据的 0） */
export function syncArticleListStatsFromCache(root = document) {
  const list = root.querySelector ? root.querySelector('#postList') : null;
  if (!list || list.classList.contains('post-list--giscus')) return;

  const showPv = useCloudBase() && pvCfg().showPostViews !== false;
  const showCm = isCommentsReady();
  if (!showPv && !showCm) return;

  list.querySelectorAll('.post-list-stats').forEach(el => {
    if (el.dataset.listStatsDone === '1') return;
    const pvPath = String(el.dataset.pvPath || '').trim();
    const commentPath = String(el.dataset.commentPath || '').trim();
    const pv = showPv && pvPath ? cachedListPv(pvPath) : null;
    const cm = showCm && commentPath ? cachedListComments(commentPath) : null;
    if (pv == null && cm == null) return;
    applyListStatsToSlot(el, pv, cm, { showPv, showCm }, { finalize: false });
  });
}

export function queueArticleListViews(root = document) {
  renderArticleListViews(root).catch(() => {
    setTimeout(() => {
      root.querySelectorAll('.post-list-stats[data-list-stats-done="1"]').forEach(el => {
        delete el.dataset.listStatsDone;
      });
      renderArticleListViews(root).catch(() => {});
    }, 2500);
  });
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
    const slotMeta = slots.map(el => ({
      el,
      slug: String(el.dataset.slug || '').trim(),
      pvPath: String(el.dataset.pvPath || '').trim(),
      commentPath: String(el.dataset.commentPath || '').trim(),
    }));

    const needPv = [];
    const needCm = new Set();

    for (const row of slotMeta) {
      const pv = showPv && row.pvPath ? cachedListPv(row.pvPath) : null;
      const cm = showCm && row.commentPath ? cachedListComments(row.commentPath) : null;
      applyListStatsToSlot(row.el, pv, cm, { showPv, showCm }, { finalize: false });

      if (showPv && row.pvPath && pv == null) {
        needPv.push({ path: row.pvPath, slug: row.slug || undefined });
      }
      if (showCm && row.commentPath && cm == null) {
        needCm.add(row.commentPath);
      }
    }

    if (!needPv.length && !needCm.size) {
      slotMeta.forEach(({ el, pvPath, commentPath }) => {
        applyListStatsToSlot(
          el,
          showPv && pvPath ? cachedListPv(pvPath) : null,
          showCm && commentPath ? cachedListComments(commentPath) : null,
          { showPv, showCm },
        );
      });
      return;
    }

    let pvMap = {};
    let cmMap = {};

    const fetches = [];
    if (needPv.length) {
      fetches.push(fetchListPageViews(needPv).then(data => { pvMap = data || {}; }));
    }
    if (needCm.size) {
      fetches.push(
        waitForPvBeacon()
          .then(() => batchGetCommentCounts([...needCm]))
          .then(data => { cmMap = data || {}; })
          .catch(() => {}),
      );
    }
    await Promise.all(fetches);

    if (Object.keys(pvMap).length) writeListStatsCache(pvMap, {});
    if (Object.keys(cmMap).length) writeListStatsCache({}, cmMap);

    for (const { el, pvPath, commentPath } of slotMeta) {
      const pv = showPv && pvPath
        ? (pvMap[pvPath] ?? cachedListPv(pvPath))
        : null;
      const cm = showCm && commentPath
        ? (cmMap[commentPath] ?? cachedListComments(commentPath))
        : null;
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
