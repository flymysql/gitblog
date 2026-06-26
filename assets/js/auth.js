// ============================================================================
// 后台鉴权：CloudBase 短密码（默认）或 GitHub PAT（高级 / auth.editorMode=pat）
// ============================================================================

import { CONFIG } from './config.js';
import {
  setToken,
  setUser,
  getToken,
  getUser,
  clearAuth,
  getCurrentUser,
  setAuthMode,
  useCloudEditorProxy,
  isCloudbaseEditorConfigured,
} from './api.js';
import { editorLogin, ghUser, preloadEditorBeacon } from './cloudbase-github.js';
import { saveAdminSecret } from './cloudbase-admin-secret.js';

const STORAGE_FLAG_KEY = 'gh_token_persistent';

function assertWhitelisted(user) {
  const allowed = (CONFIG.authorizedUsers || []).map(s => String(s).toLowerCase());
  if (allowed.length && !allowed.includes(String(user.login || '').toLowerCase())) {
    throw new Error(`账号 ${user.login} 不在白名单内`);
  }
}

function persistSession(token, remember) {
  setToken(token);
  if (!remember) {
    sessionStorage.setItem('gh_oauth_token_session', token);
    localStorage.removeItem('gh_oauth_token');
    localStorage.removeItem(STORAGE_FLAG_KEY);
  } else {
    localStorage.setItem(STORAGE_FLAG_KEY, '1');
    sessionStorage.removeItem('gh_oauth_token_session');
  }
}

/** 短密码登录（CloudBase 云函数校验 → 返回 session，GitHub PAT 仅存服务端） */
export async function loginWithPassword(password, { remember = true } = {}) {
  const trimmed = String(password || '').trim();
  if (!trimmed) throw new Error('请输入管理密码');
  if (!isCloudbaseEditorConfigured()) {
    throw new Error('CloudBase 后台代理未启用，请在 config.js 开启 cloudbase 或改用 PAT 登录');
  }

  preloadEditorBeacon();
  let res;
  try {
    res = await editorLogin(trimmed);
  } catch (e) {
    clearAuth();
    throw new Error(e.message || '登录失败');
  }

  const sessionToken = String(res.sessionToken || '').trim();
  const user = res.user;
  if (!sessionToken || !user?.login) {
    clearAuth();
    throw new Error('登录响应无效，请确认云函数已部署 EDITOR_AUTH');
  }

  assertWhitelisted(user);
  persistSession(sessionToken, remember);
  setAuthMode('cloudbase');
  setUser({
    login: user.login,
    name: user.name || user.login,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
  });
  saveAdminSecret(trimmed);
  if (res.expiresAt) storeSessionExpiry(res.expiresAt);
  return user;
}

// 用 PAT 登录：验证 + 存储（auth.editorMode=pat 或高级入口）
export async function loginWithToken(token, { remember = true } = {}) {
  if (!token || !/^[A-Za-z0-9_]{20,}$/.test(token.trim())) {
    throw new Error('Token 格式不对，请粘贴完整的 Personal Access Token');
  }
  const trimmed = token.trim();
  setToken(trimmed);
  let user;
  try {
    user = await getCurrentUser();
  } catch (e) {
    clearAuth();
    if (e.status === 401) {
      throw new Error('Token 无效或已过期，请重新生成');
    }
    throw new Error('验证失败：' + (e.message || String(e)));
  }

  assertWhitelisted(user);
  setAuthMode('pat');
  setUser({
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
  });

  if (!remember) {
    sessionStorage.setItem('gh_oauth_token_session', trimmed);
    localStorage.removeItem('gh_oauth_token');
    localStorage.removeItem(STORAGE_FLAG_KEY);
  } else {
    localStorage.setItem(STORAGE_FLAG_KEY, '1');
    sessionStorage.removeItem('gh_oauth_token_session');
  }
  return user;
}

export async function loginWithDeviceFlow({ remember = true, onCode } = {}) {
  const cfg = CONFIG.auth && CONFIG.auth.githubDeviceFlow;
  const clientId = cfg && cfg.clientId;
  if (!clientId) {
    throw new Error('尚未配置 GitHub Device Flow Client ID。请先在后台设置里填写 OAuth App 的 Client ID。');
  }
  const scope = (cfg.scope || 'repo read:user').trim();
  const startRes = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  const start = await startRes.json();
  if (!startRes.ok || start.error) throw new Error(start.error_description || start.error || '无法启动 Device Flow');
  if (onCode) onCode(start);

  const startedAt = Date.now();
  let interval = Number(start.interval || 5) * 1000;
  while (Date.now() - startedAt < Number(start.expires_in || 900) * 1000) {
    await new Promise(r => setTimeout(r, interval));
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: start.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error === 'authorization_pending') continue;
    if (tokenData.error === 'slow_down') {
      interval += 5000;
      continue;
    }
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error);
    if (tokenData.access_token) {
      return loginWithToken(tokenData.access_token, { remember });
    }
  }
  throw new Error('Device Flow 登录超时，请重试');
}

export function logout(returnTo) {
  clearAuth();
  sessionStorage.removeItem('gh_oauth_token_session');
  localStorage.removeItem(STORAGE_FLAG_KEY);
  window.location.href = returnTo || './';
}

export function isAuthorized() {
  if (!getToken()) return false;
  const user = getUser();
  if (!user) return false;
  const allow = (CONFIG.authorizedUsers || []).map(s => s.toLowerCase());
  if (allow.length === 0) return true;
  return allow.includes(String(user.login || '').toLowerCase());
}

const RETURN_KEY = 'login_return_to';

export function rememberReturnTo(url) {
  if (url) sessionStorage.setItem(RETURN_KEY, url);
}

export function popReturnTo() {
  const url = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  return url;
}

export { getToken, getUser, clearAuth };

const SESSION_LAST_CHECK_KEY = 'gh_token_last_check';
const SESSION_EXPIRES_KEY = 'gh_token_expires_at';
const SESSION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function checkPatStatus({ force = false } = {}) {
  const token = getToken();
  if (!token) return { state: 'no-token' };

  if (useCloudEditorProxy()) {
    const last = Number(localStorage.getItem(SESSION_LAST_CHECK_KEY) || 0);
    const expRaw = localStorage.getItem(SESSION_EXPIRES_KEY);
    if (!force && last && Date.now() - last < SESSION_CHECK_INTERVAL_MS && expRaw) {
      return classifyExpiry(expRaw);
    }
    try {
      await ghUser(token);
      const exp = localStorage.getItem(SESSION_EXPIRES_KEY);
      localStorage.setItem(SESSION_LAST_CHECK_KEY, String(Date.now()));
      return exp ? classifyExpiry(exp) : { state: 'ok' };
    } catch (e) {
      if (e.code === 401 || /过期|无效/.test(String(e.message || ''))) {
        clearAuth();
        return { state: 'invalid' };
      }
      return { state: 'unknown', error: e.message || String(e) };
    }
  }

  const last = Number(localStorage.getItem(SESSION_LAST_CHECK_KEY) || 0);
  if (!force && last && Date.now() - last < SESSION_CHECK_INTERVAL_MS) {
    const expRaw = localStorage.getItem(SESSION_EXPIRES_KEY);
    if (expRaw) return classifyExpiry(expRaw);
    return { state: 'ok' };
  }
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (res.status === 401) {
      clearAuth();
      localStorage.removeItem(SESSION_EXPIRES_KEY);
      return { state: 'invalid' };
    }
    if (!res.ok) return { state: 'unknown', status: res.status };
    const exp = res.headers.get('GitHub-Authentication-Token-Expiration') ||
                res.headers.get('github-authentication-token-expiration') || '';
    if (exp) localStorage.setItem(SESSION_EXPIRES_KEY, exp);
    else localStorage.removeItem(SESSION_EXPIRES_KEY);
    localStorage.setItem(SESSION_LAST_CHECK_KEY, String(Date.now()));
    return classifyExpiry(exp);
  } catch (e) {
    return { state: 'unknown', error: e.message || String(e) };
  }
}

function classifyExpiry(expRaw) {
  if (!expRaw) return { state: 'ok' };
  const ts = Date.parse(expRaw);
  if (!ts) return { state: 'ok' };
  const ms = ts - Date.now();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (ms <= 0) return { state: 'expired', expiresAt: expRaw, days };
  if (days <= 7) return { state: 'expiring', expiresAt: expRaw, days };
  return { state: 'ok', expiresAt: expRaw, days };
}

export function storeSessionExpiry(isoString) {
  if (isoString) localStorage.setItem(SESSION_EXPIRES_KEY, isoString);
}
