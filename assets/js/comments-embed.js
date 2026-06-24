// ============================================================================
// 评论挂载门面：按 CONFIG 选择 giscus 或 CloudBase
// ============================================================================

import { CONFIG } from './config.js';
import {
  notesFeedTerm,
  notesCommentCategory,
  commentPathForPost,
  giscusTermForPost,
} from './comment-term.js';
import {
  isGiscusReady,
  isNotesGiscusReady,
  mountGiscusScript,
  mountNotesGiscusScript,
} from './giscus-embed.js';
import { isCloudBaseReady, mountCloudBaseComments } from './cloudbase-comments.js';

export { notesFeedTerm, notesCommentCategory, commentPathForPost, giscusTermForPost };

export function getCommentsProvider() {
  const explicit = String(CONFIG.comments?.provider || '').trim().toLowerCase();
  if (explicit === 'cloudbase' || explicit === 'giscus' || explicit === 'none') return explicit;
  if (CONFIG.cloudbase?.enabled && CONFIG.cloudbase?.envId) return 'cloudbase';
  if (CONFIG.giscus?.enabled) return 'giscus';
  return 'none';
}

export function isCommentsReady(context = 'post') {
  const p = getCommentsProvider();
  if (p === 'cloudbase') return isCloudBaseReady();
  if (p === 'giscus') return context === 'notes' ? isNotesGiscusReady() : isGiscusReady();
  return false;
}

/** @deprecated */
export function isNotesGiscusReadyCompat() {
  return isCommentsReady('notes');
}

function hintHtml(message) {
  return `<div class="comments-hint">${message}</div>`;
}

export function mountComments(targetEl, term, opts = {}) {
  if (!targetEl || !term) return false;
  const provider = getCommentsProvider();

  if (provider === 'none') {
    targetEl.innerHTML = hintHtml(
      '评论未启用。请在 <a href="admin/settings.html">后台 · 站点设置</a> 中配置 CloudBase 或 giscus。'
    );
    return false;
  }

  if (provider === 'cloudbase') {
    if (!isCloudBaseReady()) {
      targetEl.innerHTML = hintHtml(
        'CloudBase 评论已启用但缺少 <code>envId</code>，请到 <a href="admin/settings.html">后台设置</a> 填写环境 ID，并部署云函数 <code>gitblog-comments</code>。'
      );
      return false;
    }
    return mountCloudBaseComments(targetEl, term, opts);
  }

  if (!isGiscusReady()) {
    targetEl.innerHTML = hintHtml(
      'giscus 已选为评论方式但配置不完整，请到 <a href="https://giscus.app" target="_blank" rel="noopener">giscus.app</a> 与 <a href="admin/settings.html">后台设置</a> 补全。'
    );
    return false;
  }
  return mountGiscusScript(targetEl, term, opts);
}

export function mountNotesComments(targetEl, opts = {}) {
  const notes = notesCommentCategory();
  if (getCommentsProvider() === 'giscus') {
    return mountNotesGiscusScript(targetEl, opts);
  }
  return mountComments(targetEl, notesFeedTerm(), { ...opts, context: 'notes' });
}
