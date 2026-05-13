// ============================================================================
// 访问计数（固定双通道）
//
//   · 站点总访问量（首页 Hero / Footer）：Saobby 计数图片
//   · 文章页 / 独立页（post.html?slug=…）阅读量：Vercount（events.vercount.one）
//
// 不再支持不蒜子、Page Views API 或其它 provider。
// ============================================================================

import { CONFIG } from './config.js';

const VCOUNT_DEFAULT_SRC = 'https://events.vercount.one/js';

const STATE = {
  vercountInjected: false,
};

function pvCfg() {
  return CONFIG.pageviews || {};
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

/** 站点级 Saobby 已配置且总开关打开（供后台「访问数据」等判断） */
export function isSaobbyOn() {
  const c = pvCfg();
  return c.enabled !== false && !!saobbySiteImg();
}

// ---------- Saobby（仅站点 slot） -------------------------------------------

function hideAllSaobby(root = document) {
  root.querySelectorAll('[data-saobby-slot]').forEach(el => { el.hidden = true; });
}

function siteSlotPrefix() {
  return String(((saobbyCfg().site || {}).label || '总访问')).trim() || '总访问';
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

// ---------- Vercount（仅文章页 #vercount_value_page_pv） --------------------

function injectVercountScript() {
  if (STATE.vercountInjected) return;
  const el = document.getElementById('vercount_value_page_pv');
  if (!el) return;
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

// ---------- public API -------------------------------------------------------

export function initPageviews() {
  const cfg = pvCfg();
  if (!cfg.enabled) {
    hideAllSaobby(document);
    return;
  }
  if (saobbySiteImg()) {
    injectSaobbySiteSlots(document);
  } else {
    hideAllSaobby(document);
  }
  injectVercountScript();
}

/** 首页 Hero / Footer：站点 Saobby 占位 */
export function bszSiteStatsHtml({ compact = false } = {}) {
  const cfg = pvCfg();
  if (cfg.enabled === false || !saobbySiteImg()) return '';
  const prefix = siteSlotPrefix();
  if (compact) {
    return `<span class="saobby-slot saobby-slot-compact" data-saobby-slot="site" data-saobby-suffix="${escapeAttr(prefix)}" hidden></span>`;
  }
  return `<div class="stat saobby-slot saobby-slot-stat" data-saobby-slot="site" data-saobby-prefix="${escapeAttr(prefix)}" hidden></div>`;
}

/** 文章 meta：Vercount 页阅读量（按当前 URL 区分 slug） */
export function bszPagePvHtml() {
  const cfg = pvCfg();
  if (cfg.enabled === false || cfg.showPostViews === false) return '';
  const label = String(vercountCfg().label || '阅读').trim() || '阅读';
  return `<span class="vercount-inline"><span class="vercount-prefix">${escapeHtml(label)} </span><span id="vercount_value_page_pv">…</span><span class="vercount-suffix"> 次</span></span>`;
}

/** 已废弃：首页列表不再展示逐篇阅读数 */
export function articleListPvHtml() {
  return '';
}

/** 占位：兼容旧 home.js 调用链 */
export async function renderArticleListViews() {}

export async function trackAndRenderArticleView() {
  initPageviews();
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
