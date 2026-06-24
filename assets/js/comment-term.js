// ============================================================================
// 评论页标识（path / term）：文章 urlKey、随笔、工具页等共用
// ============================================================================

import { CONFIG } from './config.js';
import { isPostPublicPathKey } from './site.js';

/** 首页「随笔」与 notes.html 共用的讨论 path */
export function notesFeedTerm() {
  const g = CONFIG.giscus || {};
  const c = CONFIG.cloudbase || {};
  const provider = String(CONFIG.comments?.provider || '').trim().toLowerCase();
  if (provider === 'cloudbase' || (c.enabled && c.envId)) {
    const t = String(c.notesTerm || g.notesTerm || '').trim();
    return t || 'gitblog-notes-feed';
  }
  const t = String(g.notesTerm || c.notesTerm || '').trim();
  return t || 'gitblog-notes-feed';
}

/** 随笔讨论串配置（giscus 分类；CloudBase 仅复用 notesTerm） */
export function notesCommentCategory() {
  const g = CONFIG.giscus || {};
  return {
    category: String(g.notesCategory || 'Announcements').trim() || 'Announcements',
    categoryId: String(g.notesCategoryId || 'DIC_kwDOSZ6GIc4C8wdV').trim() || 'DIC_kwDOSZ6GIc4C8wdV',
  };
}

/**
 * 文章页评论 path：优先 urlKey（如 20260616、welcome），否则 slug。
 */
export function commentPathForPost({ slug, urlKey } = {}) {
  const k = String(urlKey || '').trim();
  if (k && isPostPublicPathKey(k)) return k;
  return String(slug || '').trim();
}

/** @deprecated 兼容旧名 */
export const giscusTermForPost = commentPathForPost;
