// ============================================================================
// CloudBase 访问统计客户端（通过 embed 域 iframe + postMessage）
// ============================================================================

import { CONFIG } from './config.js';

const REQ_PREFIX = 'pv_';
let _reqSeq = 0;
let _iframe = null;
let _ready = null;
let _pending = new Map();

function cloudCfg() {
  return CONFIG.cloudbase || {};
}

function pvCfg() {
  return CONFIG.pageviews || {};
}

export function isCloudBasePvEnabled() {
  const c = pvCfg();
  const cb = cloudCfg();
  return c.enabled !== false
    && String(c.provider || '').trim().toLowerCase() === 'cloudbase'
    && cb.enabled
    && String(cb.envId || '').trim()
    && String(cb.embedBaseUrl || '').trim();
}

function beaconUrl() {
  const cb = cloudCfg();
  const base = String(cb.embedBaseUrl || '').trim().replace(/\/+$/, '');
  const v = String(cb.embedAssetVersion || '').trim();
  const u = new URL(`${base}/pv-beacon.html`);
  u.searchParams.set('env', String(cb.envId || '').trim());
  u.searchParams.set('region', String(cb.region || 'ap-shanghai').trim() || 'ap-shanghai');
  u.searchParams.set('fn', String(cb.functionName || 'gitblog-comments').trim() || 'gitblog-comments');
  if (v) u.searchParams.set('v', v);
  return u.toString();
}

function ensureBeacon() {
  if (!isCloudBasePvEnabled()) return Promise.reject(new Error('CloudBase PV 未启用'));
  if (_ready) return _ready;
  _ready = new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = beaconUrl();
    iframe.title = 'GitBlog PV';
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;clip:rect(0,0,0,0);';
    const timer = setTimeout(() => reject(new Error('PV beacon 超时')), 12000);
    const onMsg = (e) => {
      if (e.source !== iframe.contentWindow) return;
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'gitblog-pv-ready') {
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        _iframe = iframe;
        resolve(iframe);
        return;
      }
      if (msg.type === 'gitblog-pv-reply' && msg.reqId) {
        const pending = _pending.get(msg.reqId);
        if (!pending) return;
        _pending.delete(msg.reqId);
        if (msg.ok) pending.resolve(msg.data);
        else pending.reject(new Error(msg.data?.message || 'PV 失败'));
      }
    };
    window.addEventListener('message', onMsg);
    iframe.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('PV beacon 加载失败'));
    }, { once: true });
    document.body.appendChild(iframe);
  });
  return _ready;
}

function callBeacon(payload) {
  return ensureBeacon().then(() => new Promise((resolve, reject) => {
    const reqId = `${REQ_PREFIX}${Date.now()}_${++_reqSeq}`;
    _pending.set(reqId, { resolve, reject });
    _iframe.contentWindow.postMessage({ type: 'gitblog-pv', reqId, ...payload }, '*');
    setTimeout(() => {
      if (!_pending.has(reqId)) return;
      _pending.delete(reqId);
      reject(new Error('PV 请求超时'));
    }, 10000);
  }));
}

export function normalizeClientPath(pathOrUrl) {
  let p = String(pathOrUrl || '').trim();
  if (!p && typeof location !== 'undefined') p = location.pathname || '/';
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch { /* ignore */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

function dedupeKey(path) {
  const day = new Date().toISOString().slice(0, 10);
  return `gitblog-pv-hit:${path}:${day}`;
}

function shouldSkipClientDedupe(path) {
  try {
    if (sessionStorage.getItem(dedupeKey(path)) === '1') return true;
    sessionStorage.setItem(dedupeKey(path), '1');
  } catch { /* ignore */ }
  return false;
}

export async function hitPageView({ path, slug, title } = {}) {
  const p = normalizeClientPath(path);
  if (shouldSkipClientDedupe(p)) {
    return callBeacon({ action: 'get', path: p });
  }
  return callBeacon({ action: 'hit', path: p, slug, title });
}

export async function getPageView(path) {
  return callBeacon({ action: 'get', path: normalizeClientPath(path) });
}

export async function getSiteViewStats() {
  return callBeacon({ action: 'site' });
}

export async function getAdminTopPages(adminSecret, limit = 20) {
  return callBeacon({ action: 'admin-top', adminSecret, limit });
}

export async function importPageViewStats(adminSecret, { site, pages, source } = {}) {
  return callBeacon({
    action: 'import',
    adminSecret,
    site,
    pages,
    source,
  });
}

export function formatCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '—';
  return String(Math.floor(v));
}

export async function renderSitePvSlot(el) {
  if (!el) return;
  const label = String(pvCfg().siteLabel || '人来过').trim() || '人来过';
  try {
    const data = await getSiteViewStats();
    const num = formatCount(data.sitePv);
    if (el.classList.contains('saobby-slot-stat')) {
      el.innerHTML = `<strong class="saobby-num gitblog-pv-num">${num}</strong><span class="saobby-label">${escapeHtml(label)}</span>`;
    } else {
      el.innerHTML = `<span class="saobby-prefix">${escapeHtml(label)}</span><span class="gitblog-pv-num">${num}</span>`;
    }
    el.hidden = false;
  } catch {
    el.hidden = true;
  }
}

export async function renderPagePvEl(el, { path, slug, title, hit = true } = {}) {
  if (!el) return;
  try {
    const data = hit
      ? await hitPageView({ path: path || location.pathname, slug, title })
      : await getPageView(path || location.pathname);
    el.textContent = formatCount(data.pv);
  } catch {
    el.textContent = '—';
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
