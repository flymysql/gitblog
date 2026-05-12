// ============================================================================
// 短动态（type: note）时间线页面
// 直接拉 data/notes.json（含每条 note 的完整 markdown），渲染为时间轴卡片
// ============================================================================

import { CONFIG } from './config.js';
import { initSite, escapeHtml, fmtDate, timeAgo, tagHtml } from './site.js';
import { renderMarkdown } from './markdown.js';
import { setMeta } from './seo.js';

const $ = sel => document.querySelector(sel);

(async function init() {
  initSite({ active: 'notes' });
  setMeta({
    title: '随笔',
    description: '不成体系的小想法、灵感与备忘',
  });

  let notes = [];
  try {
    const r = await fetch('data/notes.json?_=' + Date.now(), { cache: 'no-cache' });
    if (r.ok) {
      const j = await r.json();
      notes = Array.isArray(j.notes) ? j.notes : [];
    }
  } catch (e) {
    console.warn('[notes] load failed', e);
  }

  const list = $('#noteList');
  if (!notes.length) {
    list.innerHTML = `
      <li class="notes-empty">
        还没有任何短动态。<br>
        在编辑器里把 frontmatter 的 <code>type</code> 设为 <code>note</code> 就会出现在这里。
      </li>
    `;
    return;
  }

  const htmls = await Promise.all(notes.map(n => renderMarkdown(n.content || '')));
  list.innerHTML = notes.map((n, i) => `
    <li class="note-item">
      <div class="note-meta">
        <span>${escapeHtml(n.author || CONFIG.site.author || '')}</span>
        <span>·</span>
        <span title="${escapeHtml(n.date || '')}">${escapeHtml(timeAgo(n.date) || fmtDate(n.date))}</span>
      </div>
      <div class="note-content">${htmls[i]}</div>
      ${(n.tags && n.tags.length) ? `<div class="note-tags">${n.tags.map(t => tagHtml(t, { href: 'tags.html#' + encodeURIComponent(t) })).join('')}</div>` : ''}
    </li>
  `).join('');
})();
