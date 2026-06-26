'use strict';

const crypto = require('crypto');

const GH_API = 'https://api.github.com';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const AUTH_FAIL_WINDOW_MS = 15 * 60 * 1000;
const AUTH_FAIL_MAX = 8;

/** 允许通过代理读写的仓库路径 */
const ALLOWED_EXACT = new Set([
  'data/posts.json',
  'data/search.json',
  'assets/js/config.js',
]);

const ALLOWED_PREFIXES = [
  'posts/',
  'post/',
  'assets/uploads/',
];

const authFailLog = new Map();

function normalizeRepoPath(raw) {
  let p = String(raw || '').trim().replace(/\\/g, '/');
  p = p.replace(/^\/+/, '');
  if (p.includes('..')) throw new Error('非法路径');
  return p;
}

function assertPathAllowed(path) {
  const p = normalizeRepoPath(path);
  if (!p) throw new Error('缺少 path');
  if (ALLOWED_EXACT.has(p)) return p;
  if (ALLOWED_PREFIXES.some(pre => p.startsWith(pre))) return p;
  throw new Error(`路径不在允许列表内: ${p}`);
}

function repoFromEnv() {
  const owner = String(process.env.GITHUB_REPO_OWNER || '').trim();
  const name = String(process.env.GITHUB_REPO_NAME || '').trim();
  const branch = String(process.env.GITHUB_REPO_BRANCH || 'main').trim() || 'main';
  if (!owner || !name) throw new Error('云函数未配置 GITHUB_REPO_OWNER / GITHUB_REPO_NAME');
  return { owner, name, branch };
}

function sessionSecret() {
  const s = String(process.env.COMMENT_ADMIN_SECRET || '').trim();
  if (!s) throw new Error('云函数未配置 COMMENT_ADMIN_SECRET');
  return s;
}

function signSessionPayload(exp, nonce) {
  return crypto.createHmac('sha256', sessionSecret()).update(`${exp}:${nonce}`).digest('hex');
}

function issueEditorSession() {
  const exp = Date.now() + SESSION_TTL_MS;
  const nonce = crypto.randomBytes(12).toString('hex');
  const sig = signSessionPayload(exp, nonce);
  return {
    sessionToken: `${exp}.${nonce}.${sig}`,
    expiresAt: new Date(exp).toISOString(),
    expiresInMs: SESSION_TTL_MS,
  };
}

function verifyEditorSession(token) {
  const raw = String(token || '').trim();
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length !== 3) return false;
  const exp = Number(parts[0]);
  const nonce = parts[1];
  const sig = parts[2];
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  if (!nonce || !sig) return false;
  const expected = signSessionPayload(exp, nonce);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function checkAuthRateLimit(ip) {
  const key = String(ip || 'unknown').slice(0, 64);
  const now = Date.now();
  let row = authFailLog.get(key);
  if (!row || now - row.startedAt > AUTH_FAIL_WINDOW_MS) {
    row = { startedAt: now, count: 0 };
    authFailLog.set(key, row);
  }
  if (row.count >= AUTH_FAIL_MAX) {
    throw new Error('登录尝试过多，请 15 分钟后再试');
  }
}

function recordAuthFailure(ip) {
  const key = String(ip || 'unknown').slice(0, 64);
  const now = Date.now();
  let row = authFailLog.get(key);
  if (!row || now - row.startedAt > AUTH_FAIL_WINDOW_MS) {
    row = { startedAt: now, count: 0 };
  }
  row.count += 1;
  authFailLog.set(key, row);
}

function clearAuthFailures(ip) {
  authFailLog.delete(String(ip || 'unknown').slice(0, 64));
}

function getGithubPat() {
  const pat = String(process.env.GITHUB_PAT || '').trim();
  if (!pat) throw new Error('云函数未配置 GITHUB_PAT（GitHub 仓库写入令牌）');
  return pat;
}

async function ghRequest(path, { method = 'GET', body } = {}) {
  const url = path.startsWith('http') ? path : `${GH_API}${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${getGithubPat()}`,
    'User-Agent': 'gitblog-cloudbase-editor',
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) return { ok: true, status: 204, data: null };
  const ct = res.headers.get('content-type') || '';
  let data = null;
  if (ct.includes('application/json')) data = await res.json();
  else data = await res.text();
  if (!res.ok) {
    const msg = (data && data.message) || `GitHub API ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { ok: true, status: res.status, data };
}

function contentsPath(repo, filePath) {
  return `/repos/${repo.owner}/${repo.name}/contents/${encodeURI(normalizeRepoPath(filePath))}`;
}

function b64DecodeUtf8(b64) {
  const clean = String(b64 || '').replace(/\s/g, '');
  return Buffer.from(clean, 'base64').toString('utf8');
}

function requireSession(event) {
  if (!verifyEditorSession(event?.editorSession)) {
    const err = new Error('登录已过期，请重新输入管理密码');
    err.code = 401;
    throw err;
  }
}

function createGithubHandlers({ jsonOk, jsonErr, verifyAdminSecret }) {
  async function handleEditorAuth(event, context) {
    const ip = context?.requestContext?.sourceIp || '';
    checkAuthRateLimit(ip);
    if (!verifyAdminSecret(event)) {
      recordAuthFailure(ip);
      return jsonErr('管理密码无效', 403);
    }
    try {
      getGithubPat();
    } catch (err) {
      return jsonErr(err.message || '云函数未配置 GITHUB_PAT', 503);
    }

    let user;
    try {
      const res = await ghRequest('/user');
      user = res.data;
    } catch (err) {
      return jsonErr(`GitHub 令牌无效: ${err.message}`, 503);
    }

    clearAuthFailures(ip);
    const session = issueEditorSession();
    return jsonOk({
      ...session,
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
      },
    });
  }

  async function handleGhUser(event) {
    requireSession(event);
    const res = await ghRequest('/user');
    return jsonOk({
      user: {
        login: res.data.login,
        name: res.data.name || res.data.login,
        avatar_url: res.data.avatar_url,
        html_url: res.data.html_url,
      },
    });
  }

  async function handleGhGetContents(event) {
    requireSession(event);
    const repo = repoFromEnv();
    const path = assertPathAllowed(event.path);
    try {
      const res = await ghRequest(
        `${contentsPath(repo, path)}?ref=${encodeURIComponent(repo.branch)}`
      );
      const data = res.data;
      if (Array.isArray(data)) {
        return jsonOk({ path, entries: data, isDir: true });
      }
      return jsonOk({
        path: data.path,
        sha: data.sha,
        content: b64DecodeUtf8(data.content || ''),
        isDir: false,
      });
    } catch (err) {
      if (err.status === 404) return jsonOk({ missing: true, path });
      throw err;
    }
  }

  async function handleGhPutContents(event) {
    requireSession(event);
    const repo = repoFromEnv();
    const path = assertPathAllowed(event.path);
    const message = String(event.message || '').trim();
    if (!message) return jsonErr('缺少 commit message');
    const contentB64 = String(event.contentBase64 || event.content || '').trim();
    if (!contentB64) return jsonErr('缺少文件内容');
    const body = {
      message,
      content: contentB64,
      branch: repo.branch,
    };
    const sha = String(event.sha || '').trim();
    if (sha) body.sha = sha;
    const res = await ghRequest(contentsPath(repo, path), { method: 'PUT', body });
    return jsonOk({ commit: res.data.commit, content: res.data.content });
  }

  async function handleGhDeleteContents(event) {
    requireSession(event);
    const repo = repoFromEnv();
    const path = assertPathAllowed(event.path);
    const sha = String(event.sha || '').trim();
    const message = String(event.message || '').trim();
    if (!sha) return jsonErr('缺少 sha');
    if (!message) return jsonErr('缺少 commit message');
    const res = await ghRequest(contentsPath(repo, path), {
      method: 'DELETE',
      body: { message, sha, branch: repo.branch },
    });
    return jsonOk({ deleted: true, commit: res.data?.commit || null });
  }

  async function handleGhListDir(event) {
    requireSession(event);
    const repo = repoFromEnv();
    const path = assertPathAllowed(event.path || '');
    try {
      const q = path ? `${contentsPath(repo, path)}?ref=${encodeURIComponent(repo.branch)}` :
        `/repos/${repo.owner}/${repo.name}/contents/?ref=${encodeURIComponent(repo.branch)}`;
      const res = await ghRequest(q);
      const entries = Array.isArray(res.data) ? res.data : [];
      return jsonOk({ path: path || '', entries });
    } catch (err) {
      if (err.status === 404) return jsonOk({ path, entries: [] });
      throw err;
    }
  }

  async function handleGhGetRepo(event) {
    requireSession(event);
    const repo = repoFromEnv();
    const res = await ghRequest(`/repos/${repo.owner}/${repo.name}`);
    return jsonOk({ repo: res.data });
  }

  async function handleGhGetBranch(event) {
    requireSession(event);
    const repo = repoFromEnv();
    const branch = String(event.branch || repo.branch).trim() || repo.branch;
    const res = await ghRequest(`/repos/${repo.owner}/${repo.name}/branches/${encodeURIComponent(branch)}`);
    return jsonOk({ branch: res.data });
  }

  async function handleGhGetTree(event) {
    requireSession(event);
    const repo = repoFromEnv();
    let treeSha = String(event.treeSha || '').trim();
    if (!treeSha) {
      const branch = String(event.branch || repo.branch).trim() || repo.branch;
      const br = await ghRequest(`/repos/${repo.owner}/${repo.name}/branches/${encodeURIComponent(branch)}`);
      treeSha = br.data?.commit?.commit?.tree?.sha || br.data?.commit?.sha;
      if (!treeSha) return jsonErr('无法解析 tree sha');
    }
    const recursive = event.recursive ? '?recursive=1' : '';
    const res = await ghRequest(`/repos/${repo.owner}/${repo.name}/git/trees/${treeSha}${recursive}`);
    return jsonOk({ tree: res.data });
  }

  return {
    handleEditorAuth,
    handleGhUser,
    handleGhGetContents,
    handleGhPutContents,
    handleGhDeleteContents,
    handleGhListDir,
    handleGhGetRepo,
    handleGhGetBranch,
    handleGhGetTree,
    verifyEditorSession,
  };
}

module.exports = { createGithubHandlers, assertPathAllowed, normalizeRepoPath };
