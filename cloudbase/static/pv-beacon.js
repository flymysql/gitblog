/**
 * CloudBase 访问统计 beacon（托管于 *.tcloudbaseapp.com）
 * 父页 gitpull.cn 通过 postMessage 调用，规避免费版安全域名限制。
 */
const SDK_URL = 'https://static.cloudbase.net/cloudbase-js-sdk/2.17.3/cloudbase.full.js';

const params = new URLSearchParams(location.search);
const cfg = {
  envId: String(params.get('env') || '').trim(),
  region: String(params.get('region') || 'ap-shanghai').trim() || 'ap-shanghai',
  functionName: String(params.get('fn') || 'gitblog-comments').trim() || 'gitblog-comments',
};

let _app = null;
let _authReady = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureAuth(app) {
  if (_authReady) return _authReady;
  _authReady = (async () => {
    const auth = app.auth();
    const state = await auth.getLoginState();
    if (!state) await auth.signInAnonymously();
  })();
  return _authReady;
}

async function getApp() {
  if (_app) return _app;
  if (!cfg.envId) throw new Error('缺少 env');
  await loadScript(SDK_URL);
  // eslint-disable-next-line no-undef
  _app = cloudbase.init({ env: cfg.envId, region: cfg.region });
  await ensureAuth(_app);
  return _app;
}

async function callPv(payload) {
  const app = await getApp();
  const res = await app.callFunction({ name: cfg.functionName, data: payload });
  const result = res?.result;
  if (!result || result.ok === false) {
    throw new Error(result?.message || 'PV 请求失败');
  }
  return result;
}

function reply(reqId, ok, data) {
  if (!reqId) return;
  parent.postMessage({ type: 'gitblog-pv-reply', reqId, ok, data }, '*');
}

window.addEventListener('message', async (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'gitblog-pv') return;
  const { reqId, action, path, slug, title, adminSecret, limit } = msg;
  try {
    let data;
    if (action === 'hit') {
      data = await callPv({ action: 'PV_HIT', path, slug, title });
    } else if (action === 'get') {
      data = await callPv({ action: 'PV_GET', path, slug, title });
    } else if (action === 'site') {
      data = await callPv({ action: 'PV_SITE' });
    } else if (action === 'admin-top') {
      data = await callPv({ action: 'PV_ADMIN_TOP', adminSecret, limit });
    } else if (action === 'import') {
      data = await callPv({
        action: 'PV_IMPORT',
        adminSecret,
        site: msg.site,
        pages: msg.pages,
        source: msg.source,
      });
    } else {
      throw new Error('未知 action');
    }
    reply(reqId, true, data);
  } catch (err) {
    reply(reqId, false, { message: String(err?.message || err) });
  }
});

parent.postMessage({ type: 'gitblog-pv-ready' }, '*');
