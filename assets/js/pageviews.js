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
} from './cloudbase-pv.js';

const VCOUNT_DEFAULT_SRC = 'https://events.vercount.one/js';

const STATE = {
  vercountInjected: false,
  articlePvTask: null,
};

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
      await renderPagePvEl(el, { ...meta, slug, title, hit: true });
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

export async function renderArticleListViews() {}

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
