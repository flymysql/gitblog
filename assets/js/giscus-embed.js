// ============================================================================
// giscus 嵌入：文章页（按 urlKey/slug）与随笔聚合页（固定 notesTerm）共用
// ============================================================================

import { CONFIG } from './config.js';
import {
  notesFeedTerm,
  notesCommentCategory,
  commentPathForPost,
  giscusTermForPost,
} from './comment-term.js';

export {
  notesFeedTerm,
  commentPathForPost,
  giscusTermForPost,
};

/** 是否已配置完整，可在页面上挂载评论框 */
export function isGiscusReady() {
  const g = CONFIG.giscus;
  return !!(g && g.enabled && g.repoId && g.categoryId);
}


export function notesGiscusCategory() {
  return notesCommentCategory();
}

export function isNotesGiscusReady() {
  const g = CONFIG.giscus;
  const notes = notesGiscusCategory();
  return !!(g && g.enabled && g.repoId && notes.categoryId);
}

/**
 * 在目标元素内注入 giscus client.js（会清空 targetEl 原有内容）
 * @param {string} term 文章 urlKey/slug，或随笔聚合用的 notesFeedTerm()
 * @returns {boolean} 是否已注入脚本
 */
export function mountGiscusScript(targetEl, term, opts = {}) {
  if (!targetEl || !term) return false;
  const g = CONFIG.giscus;
  if (!g || !g.enabled) {
    targetEl.innerHTML = '';
    return false;
  }
  const category = opts.category || g.category;
  const categoryId = opts.categoryId || g.categoryId;
  if (!g.repoId || !categoryId) {
    targetEl.innerHTML = `
      <div class="comments-hint">
        评论已启用但缺少 <code>repoId</code> 或 <code>categoryId</code>，请到
        <a href="https://giscus.app" target="_blank" rel="noopener">giscus.app</a> 与
        <a href="admin/settings.html">后台设置</a> 补全。
      </div>
    `;
    return false;
  }

  const html = document.documentElement;
  const choice = html.dataset.themeChoice || 'auto';
  const resolved = choice === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;

  let mapping = (g.mapping || 'specific').toLowerCase();
  let dataTerm = '';
  if (mapping === 'pathname' || mapping === 'url') {
    mapping = 'specific';
    dataTerm = term;
  } else if (mapping === 'specific') {
    dataTerm = term;
  }

  targetEl.textContent = '';
  const s = document.createElement('script');
  s.src = 'https://giscus.app/client.js';
  s.crossOrigin = 'anonymous';
  s.async = true;
  const attrs = {
    'data-repo': g.repo,
    'data-repo-id': g.repoId,
    'data-category': category,
    'data-category-id': categoryId,
    'data-mapping': mapping,
    'data-strict': g.strict || '0',
    'data-reactions-enabled': g.reactionsEnabled || '1',
    'data-emit-metadata': g.emitMetadata || '0',
    'data-input-position': g.inputPosition || 'top',
    'data-theme': resolved,
    'data-lang': g.lang || 'zh-CN',
    'data-loading': opts.loading || 'lazy',
  };
  if (dataTerm) attrs['data-term'] = dataTerm;
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  targetEl.appendChild(s);
  return true;
}

/** 挂载随笔广场 giscus（使用 notesCategoryId，与文章评论分类可不同） */
export function mountNotesGiscusScript(targetEl, opts = {}) {
  const notes = notesGiscusCategory();
  return mountGiscusScript(targetEl, notesFeedTerm(), {
    ...opts,
    category: notes.category,
    categoryId: notes.categoryId,
  });
}
