// ============================================================================
// CloudBase 访问统计客户端（通过 embed 域 iframe + postMessage）
// ============================================================================

import { CONFIG } from './config.js';

const REQ_PREFIX = 'pv_';
let _reqSeq = 0;
let _iframe = null;
let _ready = null;
let _pending = new Map();
let _replyRouterBound = false;
let _queue = Promise.resolve();

function parsePvData(raw) {
  let data = raw;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { /* ignore */ }
  }
  if (!data || typeof data !== 'object') return {};
  return data;
}

function pvNumber(data, key) {
  const v = Number(parsePvData(data)[key]);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

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

function bindReplyRouter() {
  if (_replyRouterBound) return;
  _replyRouterBound = true;
  window.addEventListener('message', (e) => {
    if (!_iframe || e.source !== _iframe.contentWindow) return;
    const msg = e.data;
    if (!msg || typeof msg !== 'object' || msg.type !== 'gitblog-pv-reply' || !msg.reqId) return;
    const pending = _pending.get(msg.reqId);
    if (!pending) return;
    _pending.delete(msg.reqId);
    if (msg.ok) pending.resolve(msg.data);
    else pending.reject(new Error(msg.data?.message || 'PV 失败'));
  });
}

function ensureBeacon() {
  if (!isCloudBasePvEnabled()) return Promise.reject(new Error('CloudBase PV 未启用'));
  bindReplyRouter();
  if (_ready) return _ready;
  _ready = new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = beaconUrl();
    iframe.title = 'GitBlog PV';
    iframe.hidden = true;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;clip:rect(0,0,0,0);';
    const timer = setTimeout(() => {
      window.removeEventListener('message', onReady);
      reject(new Error('PV beacon 超时'));
    }, 12000);
    const onReady = (e) => {
      if (e.source !== iframe.contentWindow) return;
      const msg = e.data;
      if (!msg || msg.type !== 'gitblog-pv-ready') return;
      clearTimeout(timer);
      window.removeEventListener('message', onReady);
      _iframe = iframe;
      resolve(iframe);
    };
    window.addEventListener('message', onReady);
    iframe.addEventListener('error', () => {
      clearTimeout(timer);
      window.removeEventListener('message', onReady);
      reject(new Error('PV beacon 加载失败'));
    }, { once: true });
    document.body.appendChild(iframe);
  });
  return _ready;
}

function callBeacon(payload) {
  const run = () => ensureBeacon().then(() => new Promise((resolve, reject) => {
    const reqId = `${REQ_PREFIX}${Date.now()}_${++_reqSeq}`;
    _pending.set(reqId, { resolve, reject });
    _iframe.contentWindow.postMessage({ type: 'gitblog-pv', reqId, ...payload }, '*');
    setTimeout(() => {
      if (!_pending.has(reqId)) return;
      _pending.delete(reqId);
      reject(new Error('PV 请求超时'));
    }, 15000);
  }));
  const task = _queue.then(run, run);
  _queue = task.catch(() => {});
  return task;
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
    return sessionStorage.getItem(dedupeKey(path)) === '1';
  } catch {
    return false;
  }
}

function markClientDedupe(path) {
  try {
    sessionStorage.setItem(dedupeKey(path), '1');
  } catch { /* ignore */ }
}

export async function hitPageView({ path, slug, title } = {}) {
  const p = normalizeClientPath(path);
  if (shouldSkipClientDedupe(p)) {
    return parsePvData(await callBeacon({ action: 'get', path: p, slug, title }));
  }
  try {
    const data = parsePvData(await callBeacon({ action: 'hit', path: p, slug, title }));
    markClientDedupe(p);
    return data;
  } catch (err) {
    try { sessionStorage.removeItem(dedupeKey(p)); } catch { /* ignore */ }
    throw err;
  }
}

export async function getPageView(path, { slug, title } = {}) {
  return parsePvData(await callBeacon({
    action: 'get',
    path: normalizeClientPath(path),
    slug,
    title,
  }));
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
    const data = await hitPageView({ path: location.pathname });
    const num = formatCount(pvNumber(data, 'sitePv'));
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
  const p = normalizeClientPath(path || location.pathname);
  const opts = { path: p, slug, title };
  const render = async (doHit) => {
    const data = doHit ? await hitPageView(opts) : await getPageView(p, { slug, title });
    return formatCount(pvNumber(data, 'pv'));
  };
  try {
    el.textContent = await render(hit);
  } catch {
    try {
      el.textContent = await render(false);
    } catch {
      el.textContent = '0';
    }
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
