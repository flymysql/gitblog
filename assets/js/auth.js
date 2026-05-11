// ============================================================================
// 极简鉴权：粘贴 GitHub Fine-grained Personal Access Token
// 完全没有后端 / 没有 OAuth Server / 没有 Cloudflare Worker
// 流程：
//   1. 在登录页粘贴 PAT
//   2. 调一次 GET /user 验证 token 是否有效
//   3. 通过后写入 localStorage（记住我）或 sessionStorage（仅本次）
//   4. 检查 user.login 是否在 authorizedUsers 白名单中
// ============================================================================

import { CONFIG } from './config.js';
import {
  setToken,
  setUser,
  getToken,
  getUser,
  clearAuth,
  getCurrentUser,
} from './api.js';

const STORAGE_FLAG_KEY = 'gh_token_persistent';

// 用 PAT 登录：验证 + 存储
export async function loginWithToken(token, { remember = true } = {}) {
  if (!token || !/^[A-Za-z0-9_]{20,}$/.test(token.trim())) {
    throw new Error('Token 格式不对，请粘贴完整的 Personal Access Token');
  }
  const trimmed = token.trim();
  // 临时把 token 放进 localStorage 让 api.ghFetch 用上，再调 /user 验证
  // 验证失败会清掉
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

  const allowed = (CONFIG.authorizedUsers || []).map(s => String(s).toLowerCase());
  if (allowed.length && !allowed.includes(String(user.login).toLowerCase())) {
    clearAuth();
    throw new Error(`账号 ${user.login} 不在白名单内`);
  }

  setUser({
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
  });

  // remember: 默认 localStorage（持久），否则切到 sessionStorage 模式
  if (!remember) {
    // 把 token 从 localStorage 搬到 sessionStorage，之后 api.js 也会优先读 sessionStorage
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

// 用于在登录后跳回原页面
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
