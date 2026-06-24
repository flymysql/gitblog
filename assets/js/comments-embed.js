// ============================================================================
// 评论挂载：CloudBase 评论区
// ============================================================================

import { CONFIG } from './config.js';
import {
  notesFeedTerm,
  commentPathForPost,
} from './comment-term.js';
import { isCloudBaseReady, mountCloudBaseComments } from './cloudbase-comments.js';

export { notesFeedTerm, commentPathForPost };
/** @deprecated 兼容旧 import */
export const giscusTermForPost = commentPathForPost;

export function getCommentsProvider() {
  if (CONFIG.cloudbase?.enabled && CONFIG.cloudbase?.envId) return 'cloudbase';
  return 'none';
}

export function isCommentsReady() {
  return isCloudBaseReady();
}

function hintHtml(message) {
  return `<div class="comments-hint">${message}</div>`;
}

export function mountComments(targetEl, term, opts = {}) {
  if (!targetEl || !term) return false;

  if (!isCloudBaseReady()) {
    targetEl.innerHTML = hintHtml(
      'CloudBase 评论未就绪：请在 <a href="admin/settings.html">后台设置</a> 填写 <code>envId</code> 并勾选启用，然后在 <code>cloudbase/</code> 部署云函数 <code>gitblog-comments</code>（见 README）。'
    );
    return false;
  }
  return mountCloudBaseComments(targetEl, term, opts);
}

export function mountNotesComments(targetEl, opts = {}) {
  return mountComments(targetEl, notesFeedTerm(), { ...opts, context: 'notes' });
}
