// ============================================================================
// 后台 GitHub API 代理（CloudBase 云函数 + 短密码 session）
// ============================================================================

import { CONFIG } from './config.js';
import { callCloudFunction, isCloudBasePvEnabled, preloadPvBeacon } from './cloudbase-pv.js';

export function isCloudbaseEditorConfigured() {
  const cb = CONFIG.cloudbase || {};
  const auth = CONFIG.auth || {};
  if (auth.editorMode === 'pat') return false;
  if (auth.editorMode === 'cloudbase') {
    return cb.enabled !== false
      && !!String(cb.envId || '').trim()
      && !!String(cb.embedBaseUrl || '').trim();
  }
  return isCloudBasePvEnabled();
}

/** @deprecated 使用 isCloudbaseEditorConfigured */
export function isCloudbaseEditorEnabled() {
  return isCloudbaseEditorConfigured();
}

export function preloadEditorBeacon() {
  if (isCloudbaseEditorConfigured()) preloadPvBeacon();
}

async function invoke(action, fields = {}) {
  if (!isCloudbaseEditorConfigured()) {
    throw new Error('CloudBase 后台代理未启用');
  }
  return callCloudFunction({ action, ...fields });
}

export async function editorLogin(adminSecret) {
  preloadEditorBeacon();
  return invoke('EDITOR_AUTH', { adminSecret: String(adminSecret || '').trim() });
}

export async function ghUser(editorSession) {
  const res = await invoke('GH_USER', { editorSession });
  return res.user;
}

export async function ghGetContents(path, editorSession) {
  const res = await invoke('GH_GET_CONTENTS', { path, editorSession });
  if (res.missing) return null;
  if (res.isDir) return { entries: res.entries || [], isDir: true };
  return {
    sha: res.sha,
    path: res.path,
    content: res.content || '',
  };
}

export async function ghPutContents(path, contentBase64, message, editorSession, sha) {
  const body = {
    path,
    contentBase64,
    message,
    editorSession,
  };
  if (sha) body.sha = sha;
  return invoke('GH_PUT_CONTENTS', body);
}

export async function ghDeleteContents(path, sha, message, editorSession) {
  return invoke('GH_DELETE_CONTENTS', { path, sha, message, editorSession });
}

export async function ghListDir(path, editorSession) {
  const res = await invoke('GH_LIST_DIR', { path, editorSession });
  return res.entries || [];
}

export async function ghGetRepo(editorSession) {
  const res = await invoke('GH_GET_REPO', { editorSession });
  return res.repo;
}

export async function ghGetBranch(editorSession, branch) {
  const res = await invoke('GH_GET_BRANCH', { editorSession, branch });
  return res.branch;
}

export async function ghGetTree(editorSession, { treeSha, branch, recursive } = {}) {
  const res = await invoke('GH_GET_TREE', {
    editorSession,
    treeSha,
    branch,
    recursive: !!recursive,
  });
  return res.tree;
}
