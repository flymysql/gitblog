// ============================================================================
// CloudBase 访问统计客户端（通过 embed 域 iframe + postMessage）
// ============================================================================

import { CONFIG } from './config.js';

const REQ_PREFIX = 'pv_';
let _reqSeq = 0;
let _iframe = null;
let _ready = null;
let _beaconAttempt = 0;
let _pending = new Map();
let _replyRouterBound = false;
let _writeQueue = Promise.resolve();
const _inflightHits = new Map();

const ARTICLE_PV_CACHE_KEY = 'gitblog_article_pv_v1';
const ARTICLE_PV_CACHE_MS = 5 * 60 * 1000;
const LIST_STATS_CACHE_KEY = 'gitblog_list_stats_v1';

function readArticlePvCache(path) {
  try {
    const raw = sessionStorage.getItem(ARTICLE_PV_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const p = normalizeClientPath(path);
    const row = data?.[p];
    if (!row || !Number.isFinite(row.ts) || Date.now() - row.ts > ARTICLE_PV_CACHE_MS) return null;
    const pv = Number(row.pv);
    return Number.isFinite(pv) && pv >= 0 ? pv : null;
  } catch {
    return null;
  }
}

/** 供首页列表复用文章页已拉取的阅读数缓存 */
export function getCachedArticlePv(path) {
  return readArticlePvCache(path);
}

function patchListStatsPvCache(path, pv) {
  try {
    const p = normalizeClientPath(path);
    const v = Number(pv);
    if (!p || !Number.isFinite(v) || v < 0) return;
    let data = null;
    try {
      const raw = sessionStorage.getItem(LIST_STATS_CACHE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch { /* ignore */ }
    if (!data || typeof data !== 'object') data = { ts: Date.now(), pv: {}, comments: {} };
    data.ts = Date.now();
    data.pv = { ...(data.pv || {}), [p]: Math.floor(v) };
    sessionStorage.setItem(LIST_STATS_CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function writeArticlePvCache(path, pv) {
  try {
    const p = normalizeClientPath(path);
    const v = Number(pv);
    if (!Number.isFinite(v) || v < 0) return;
    let data = {};
    try {
      const raw = sessionStorage.getItem(ARTICLE_PV_CACHE_KEY);
      if (raw) data = JSON.parse(raw) || {};
    } catch { /* ignore */ }
    data[p] = { pv: Math.floor(v), ts: Date.now() };
    sessionStorage.setItem(ARTICLE_PV_CACHE_KEY, JSON.stringify(data));
    patchListStatsPvCache(p, v);
  } catch { /* ignore */ }
}

function getPvSessionId() {
  try {
    let id = sessionStorage.getItem('gitblog_pv_sid');
    if (!id) {
      id = `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('gitblog_pv_sid', id);
    }
    return id;
  } catch {
    return '';
  }
}

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

export function beaconUrl() {
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

function beaconOrigin() {
  try {
    return new URL(beaconUrl()).origin;
  } catch {
    return '';
  }
}

/** 尽早建立与 embed 域的连接并加载 pv-beacon iframe */
export function preloadPvBeacon() {
  if (!isCloudBasePvEnabled()) return;
  injectPvBeaconHeadHints();
  ensureBeacon().catch(() => {});
}

/** 等待 pv-beacon 就绪（列表统计等批量请求应先 await） */
export function waitForPvBeacon(timeoutMs = 15000) {
  if (!isCloudBasePvEnabled()) return Promise.resolve();
  return Promise.race([
    ensureBeacon().then(() => {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('PV beacon 等待超时')), timeoutMs)),
  ]);
}

function resetPvBeacon() {
  _ready = null;
  if (_iframe) {
    try { _iframe.remove(); } catch { /* ignore */ }
    _iframe = null;
  }
}

/** 在 document.head 注入 preconnect / dns-prefetch（幂等） */
export function injectPvBeaconHeadHints() {
  if (!isCloudBasePvEnabled() || !document.head) return;
  const origin = beaconOrigin();
  if (!origin) return;
  const mark = 'gitblog-pv-beacon-hints';
  if (document.head.querySelector(`[data-${mark}]`)) return;

  const dns = document.createElement('link');
  dns.rel = 'dns-prefetch';
  dns.href = origin;
  dns.setAttribute(`data-${mark}`, '1');
  document.head.appendChild(dns);

  const pre = document.createElement('link');
  pre.rel = 'preconnect';
  pre.href = origin;
  pre.crossOrigin = 'anonymous';
  pre.setAttribute(`data-${mark}`, '1');
  document.head.appendChild(pre);
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
    const attempt = ++_beaconAttempt;
    const iframe = document.createElement('iframe');
    iframe.src = beaconUrl();
    iframe.title = 'GitBlog PV';
    iframe.setAttribute('aria-hidden', 'true');
    // 移动端部分浏览器会延迟/拦截 0×0 隐藏 iframe，用 1×1 离屏更可靠
    iframe.loading = 'eager';
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    const timer = setTimeout(() => {
      window.removeEventListener('message', onReady);
      if (_iframe === iframe) _iframe = null;
      try { iframe.remove(); } catch { /* ignore */ }
      if (attempt === _beaconAttempt) _ready = null;
      reject(new Error('PV beacon 超时'));
    }, 15000);
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
      if (_iframe === iframe) _iframe = null;
      try { iframe.remove(); } catch { /* ignore */ }
      if (attempt === _beaconAttempt) _ready = null;
      reject(new Error('PV beacon 加载失败'));
    }, { once: true });
    (document.body || document.documentElement).appendChild(iframe);
  });
  return _ready;
}

function isWriteBeaconAction(action) {
  return action === 'hit';
}

function callBeacon(payload) {
  const run = () => ensureBeacon().then(() => new Promise((resolve, reject) => {
    if (!_iframe?.contentWindow) {
      reject(new Error('PV beacon 未就绪'));
      return;
    }
    const reqId = `${REQ_PREFIX}${Date.now()}_${++_reqSeq}`;
    _pending.set(reqId, { resolve, reject });
    _iframe.contentWindow.postMessage({
      type: 'gitblog-pv',
      reqId,
      sessionId: getPvSessionId(),
      ...payload,
    }, '*');
    setTimeout(() => {
      if (!_pending.has(reqId)) return;
      _pending.delete(reqId);
      reject(new Error('PV 请求超时'));
    }, 15000);
  }));

  if (isWriteBeaconAction(payload.action)) {
    const task = _writeQueue.then(run, run);
    _writeQueue = task.catch(() => {});
    return task;
  }
  return run();
}

async function callBeaconWithRetry(payload, { retries = 2 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await callBeacon(payload);
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        resetPvBeacon();
        await new Promise(r => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastErr;
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

export async function hitPageView({ path, slug, title } = {}) {
  const p = normalizeClientPath(path);
  if (_inflightHits.has(p)) {
    return _inflightHits.get(p);
  }
  const task = (async () => {
    const data = parsePvData(await callBeacon({ action: 'hit', path: p, slug, title }));
    return data;
  })();
  _inflightHits.set(p, task);
  try {
    return await task;
  } finally {
    if (_inflightHits.get(p) === task) _inflightHits.delete(p);
  }
}

export function trackPageView({ path, slug, title } = {}) {
  hitPageView({ path, slug, title }).catch(() => {});
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
  return parsePvData(await callBeacon({ action: 'site' }));
}

export async function batchGetCommentCounts(paths = []) {
  const list = [...new Set((Array.isArray(paths) ? paths : []).map(s => String(s || '').trim()).filter(Boolean))];
  if (!list.length) return {};
  const data = parsePvData(await callBeaconWithRetry({ action: 'comment-counts', paths: list }));
  return data.counts && typeof data.counts === 'object' ? data.counts : {};
}

/** 列表阅读数：与文章页相同走 PV_GET（批量接口易返回 0，单篇更可靠） */
export async function fetchListPageViews(entries = []) {
  const items = [];
  const seen = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry === 'string') {
      const path = normalizeClientPath(entry);
      if (!path || seen.has(path)) continue;
      seen.add(path);
      items.push({ path });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const path = normalizeClientPath(entry.path || entry.url || '');
    if (!path || seen.has(path)) continue;
    seen.add(path);
    items.push({
      path,
      slug: String(entry.slug || '').trim() || undefined,
    });
  }
  if (!items.length) return {};

  await waitForPvBeacon();

  const pages = {};
  const CONCURRENCY = 8;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async ({ path, slug }) => {
      try {
        const data = await getPageView(path, { slug });
        pages[path] = pvNumber(data, 'pv');
      } catch { /* 单条失败不影响其它 */ }
    }));
  }
  return pages;
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

function fillSitePvSlot(el, num, label) {
  if (el.classList.contains('saobby-slot-stat')) {
    el.innerHTML = `<strong class="saobby-num gitblog-pv-num">${escapeHtml(num)}</strong><span class="saobby-label">${escapeHtml(label)}</span>`;
  } else {
    el.innerHTML = `<span class="saobby-prefix">${escapeHtml(label)}</span><span class="gitblog-pv-num">${escapeHtml(num)}</span>`;
  }
  el.hidden = false;
}

/** 站点总访问：先只读展示，后台再计数 */
export async function renderSitePvSlot(el) {
  if (!el || el.dataset.pvSiteDone === '1') return;
  el.dataset.pvSiteDone = '1';
  const label = String(pvCfg().siteLabel || '人来过').trim() || '人来过';
  try {
    const data = await getSiteViewStats();
    fillSitePvSlot(el, formatCount(pvNumber(data, 'sitePv')), label);
  } catch {
    el.hidden = true;
    el.dataset.pvSiteDone = '';
    return;
  }
  trackPageView({ path: location.pathname });
}

/** 文章阅读：缓存先展示 → PV_GET → 后台 PV_HIT 计数 */
export async function renderPagePvEl(el, { path, slug, title, hit = true } = {}) {
  if (!el) return;
  const p = normalizeClientPath(path || location.pathname);
  const cached = readArticlePvCache(p);
  if (cached != null) {
    el.textContent = formatCount(cached);
  }
  try {
    const data = await getPageView(p, { slug, title });
    const num = formatCount(pvNumber(data, 'pv'));
    el.textContent = num;
    writeArticlePvCache(p, pvNumber(data, 'pv'));
  } catch {
    if (cached == null) el.textContent = '0';
  }
  if (hit) {
    hitPageView({ path: p, slug, title }).then((data) => {
      const n = formatCount(pvNumber(data, 'pv'));
      if (n !== '—') {
        el.textContent = n;
        writeArticlePvCache(p, pvNumber(data, 'pv'));
      }
    }).catch(() => {});
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
