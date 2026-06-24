// ============================================================================
// 评论页标识（path）：文章 urlKey、随笔、工具页等共用
// ============================================================================

import { CONFIG } from './config.js';
import { isPostPublicPathKey } from './site.js';

/** 首页「随笔」与 notes.html 共用的讨论 path */
export function notesFeedTerm() {
  const c = CONFIG.cloudbase || {};
  const t = String(c.notesTerm || '').trim();
  return t || 'gitblog-notes-feed';
}

/**
 * 文章页评论 path：优先 urlKey（如 20260616、welcome），否则 slug。
 */
export function commentPathForPost({ slug, urlKey } = {}) {
  const k = String(urlKey || '').trim();
  if (k && isPostPublicPathKey(k)) return k;
  return String(slug || '').trim();
}
