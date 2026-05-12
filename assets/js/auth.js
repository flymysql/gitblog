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

// ============================================================================
// PAT 过期 / 无效 检测
// 调一次 GET /user 检查 token 状态：
//   - 200：还活着；如果响应里有 GitHub-Authentication-Token-Expiration（fine-grained PAT
//          会带），把过期时间写入 localStorage 并按距离决定 banner 颜色
//   - 401：token 已被吊销 / 过期 / 错误，立刻清掉登录状态
// 因为 GitHub 不会主动通知前端 token 过期，我们 24h 主动复检一次即可，避免 rate-limit
// ============================================================================
const PAT_LAST_CHECK_KEY = 'gh_token_last_check';
const PAT_EXPIRES_KEY = 'gh_token_expires_at';
const PAT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function checkPatStatus({ force = false } = {}) {
  const token = getToken();
  if (!token) return { state: 'no-token' };
  const last = Number(localStorage.getItem(PAT_LAST_CHECK_KEY) || 0);
  if (!force && last && Date.now() - last < PAT_CHECK_INTERVAL_MS) {
    const expRaw = localStorage.getItem(PAT_EXPIRES_KEY);
    if (expRaw) return classifyExpiry(expRaw);
    return { state: 'ok' };
  }
  try {
    // 用裸 fetch 拿到原始 headers
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (res.status === 401) {
      clearAuth();
      localStorage.removeItem(PAT_EXPIRES_KEY);
      return { state: 'invalid' };
    }
    if (!res.ok) return { state: 'unknown', status: res.status };
    const exp = res.headers.get('GitHub-Authentication-Token-Expiration') ||
                res.headers.get('github-authentication-token-expiration') || '';
    if (exp) localStorage.setItem(PAT_EXPIRES_KEY, exp);
    else localStorage.removeItem(PAT_EXPIRES_KEY);
    localStorage.setItem(PAT_LAST_CHECK_KEY, String(Date.now()));
    return classifyExpiry(exp);
  } catch (e) {
    // 离线 / CORS 等错误不强制踢人
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
