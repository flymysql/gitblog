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
} from './cloudbase-pv.js';
import { isCommentsReady } from './comments-embed.js';

const VCOUNT_DEFAULT_SRC = 'https://events.vercount.one/js';

const STATE = {
  vercountInjected: false,
  articlePvTask: null,
  listStatsTask: null,
};

const LIST_STATS_CACHE_KEY = 'gitblog_list_stats_v1';
const LIST_STATS_CACHE_MS = 5 * 60 * 1000;

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
    fillSaobbySite(el, override || siteImg, sitePrefix);
  });
}

function injectCloudBaseSiteSlots(root = document) {
  root.querySelectorAll('[data-saobby-slot="site"]').forEach(el => {
    renderSitePvSlot(el);
  });
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

function readListStatsCache() {
  try {
    const raw = sessionStorage.getItem(LIST_STATS_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (!Number.isFinite(data.ts) || Date.now() - data.ts > LIST_STATS_CACHE_MS) return null;
    return {
      pv: data.pv && typeof data.pv === 'object' ? data.pv : {},
      comments: data.comments && typeof data.comments === 'object' ? data.comments : {},
    };
  } catch {
    return null;
  }
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

function applyListStatsToSlot(el, pv, comments, opts) {
  if (!el || el.dataset.listStatsDone === '1') return;
  const html = listStatsHtml(pv, comments, opts);
  if (!html) {
    el.hidden = true;
    el.dataset.listStatsDone = '1';
    return;
  }
  el.innerHTML = html;
  el.hidden = false;
  el.dataset.listStatsDone = '1';
}

function scheduleListStatsWork(fn) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn(), { timeout: 2000 });
  } else {
    setTimeout(fn, 0);
  }
}

export async function renderArticleListViews(root = document) {
  const list = root.querySelector ? root.querySelector('#postList') : null;
  if (!list || list.classList.contains('post-list--giscus')) return;

  const showPv = useCloudBase() && pvCfg().showPostViews !== false;
  const showCm = isCommentsReady();
  if (!showPv && !showCm) return;

  const slots = [...list.querySelectorAll('.post-list-stats:not([data-list-stats-done="1"])')];
  if (!slots.length) return;

  if (STATE.listStatsTask) {
    try { await STATE.listStatsTask; } catch { /* ignore */ }
  }

  const task = (async () => {
    const cache = readListStatsCache();
    const needPv = new Set();
    const needCm = new Set();
    const slotMeta = slots.map(el => ({
      el,
      pvPath: String(el.dataset.pvPath || '').trim(),
      commentPath: String(el.dataset.commentPath || '').trim(),
    }));

    for (const { el, pvPath, commentPath } of slotMeta) {
      const cachedPv = showPv && pvPath && cache?.pv ? cache.pv[pvPath] : undefined;
      const cachedCm = showCm && commentPath && cache?.comments ? cache.comments[commentPath] : undefined;
      const hasPv = !showPv || cachedPv != null;
      const hasCm = !showCm || cachedCm != null;
      if (hasPv && hasCm) {
        applyListStatsToSlot(el, cachedPv ?? 0, cachedCm ?? 0, { showPv, showCm });
        continue;
      }
      if (showPv && pvPath && cachedPv == null) needPv.add(pvPath);
      if (showCm && commentPath && cachedCm == null) needCm.add(commentPath);
    }

    const pending = slotMeta.filter(({ el }) => el.dataset.listStatsDone !== '1');
    if (!pending.length) return;

    const [pvMap, cmMap] = await Promise.all([
      needPv.size ? batchGetPageViews([...needPv]).catch(() => ({})) : Promise.resolve({}),
      needCm.size ? batchGetCommentCounts([...needCm]).catch(() => ({})) : Promise.resolve({}),
    ]);

    if (Object.keys(pvMap).length || Object.keys(cmMap).length) {
      writeListStatsCache(pvMap, cmMap);
    }

    const mergedCache = readListStatsCache();
    for (const { el, pvPath, commentPath } of pending) {
      if (el.dataset.listStatsDone === '1') continue;
      const pv = showPv && pvPath
        ? (mergedCache?.pv?.[pvPath] ?? pvMap[pvPath] ?? 0)
        : 0;
      const cm = showCm && commentPath
        ? (mergedCache?.comments?.[commentPath] ?? cmMap[commentPath] ?? 0)
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

export function queueArticleListViews(root = document) {
  scheduleListStatsWork(() => {
    renderArticleListViews(root).catch(() => {});
  });
}

export function initPageviews() {
  const cfg = pvCfg();
  if (!cfg.enabled) {
    hideAllSaobby(document);
    return;
  }

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
