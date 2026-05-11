// ============================================================================
// GitHub API 封装
// 包含：仓库内容读写、文章索引维护、token 注入
// ============================================================================

import { CONFIG } from './config.js';

const API_BASE = 'https://api.github.com';

// ---------- token 管理 ----------
// 同时支持 localStorage（持久）和 sessionStorage（仅本次）
const TOKEN_KEY = 'gh_oauth_token';
const SESSION_TOKEN_KEY = 'gh_oauth_token_session';
const USER_KEY = 'gh_oauth_user';

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearAuth() {
  setToken(null);
  setUser(null);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

// ---------- 底层 fetch ----------
async function ghFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : API_BASE + path;
  const headers = Object.assign({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }, options.headers || {});
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) return null;
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  else data = await res.text();
  if (!res.ok) {
    const err = new Error(
      (data && data.message) || `GitHub API ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- 当前用户信息 ----------
export function getCurrentUser() {
  return ghFetch('/user');
}

// ---------- Contents API ----------
function repoPath(p) {
  const { owner, name } = CONFIG.repo;
  return `/repos/${owner}/${name}/contents/${encodeURI(p)}`;
}

// 读取文件（返回 { content, sha, path } 或 null）
export async function readFile(path) {
  try {
    const data = await ghFetch(
      `${repoPath(path)}?ref=${CONFIG.repo.branch}&t=${Date.now()}`,
      { headers: { 'Cache-Control': 'no-cache' } }
    );
    if (Array.isArray(data)) return null;
    return {
      sha: data.sha,
      path: data.path,
      content: b64DecodeUtf8(data.content || ''),
    };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

// 写入或更新文件（commit 一次）
export async function writeFile(path, content, message, sha) {
  const body = {
    message,
    content: b64EncodeUtf8(content),
    branch: CONFIG.repo.branch,
  };
  if (sha) body.sha = sha;
  try {
    return await ghFetch(repoPath(path), { method: 'PUT', body });
  } catch (e) {
    // GitHub 在 fine-grained PAT 缺少 Contents:write 权限时会返回 404 而不是 403
    // 这里改写错误信息，给用户更清晰的提示
    if (e.status === 404) {
      const hint = `\n可能原因：\n  1) Token 没有 "Contents: Read and write" 权限\n  2) Token 没有授权访问 ${CONFIG.repo.owner}/${CONFIG.repo.name}\n  3) config.js 里的仓库或分支 (${CONFIG.repo.branch}) 写错了`;
      e.message = (e.message || 'Not Found') + hint;
    }
    throw e;
  }
}

// 删除文件
export async function deleteFile(path, sha, message) {
  return ghFetch(repoPath(path), {
    method: 'DELETE',
    body: { message, sha, branch: CONFIG.repo.branch },
  });
}

// 列举文件夹下文件
export async function listDir(path) {
  try {
    const data = await ghFetch(
      `${repoPath(path)}?ref=${CONFIG.repo.branch}&t=${Date.now()}`
    );
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.status === 404) return [];
    throw e;
  }
}

// ---------- 文章索引 ----------
// posts.json 形如：
// { posts: [ { slug, title, date, summary, tags, author, cover, path } ] }
export async function readIndex() {
  const file = await readFile(CONFIG.paths.index);
  if (!file) {
    // 尝试 fallback 到静态资源（首页未登录时也能加载）
    return null;
  }
  try {
    return { sha: file.sha, data: JSON.parse(file.content) };
  } catch (e) {
    return { sha: file.sha, data: { posts: [] } };
  }
}

// 用 fetch 直接拿静态文件版本（首页未登录时使用，避免 API 限流）
export async function fetchIndexPublic() {
  const url = `./${CONFIG.paths.index}?t=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return { posts: [] };
    return await res.json();
  } catch {
    return { posts: [] };
  }
}

export async function fetchPostMarkdownPublic(slug) {
  const url = `./${CONFIG.paths.posts}/${encodeURIComponent(slug)}.md?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`无法加载文章 ${slug}`);
  return await res.text();
}

// 保存索引
export async function writeIndex(data, message, sha) {
  const json = JSON.stringify(data, null, 2) + '\n';
  return writeFile(CONFIG.paths.index, json, message, sha);
}

// ---------- 一些 base64 utf8 工具 ----------
function b64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function b64DecodeUtf8(b64) {
  // GitHub 返回的 content 带换行
  const clean = b64.replace(/\s/g, '');
  return decodeURIComponent(escape(atob(clean)));
}
