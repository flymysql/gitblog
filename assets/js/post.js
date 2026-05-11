// ============================================================================
// 文章阅读页：根据 ?slug=xxx 拉取 posts/<slug>.md 渲染
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic, fetchPostMarkdownPublic } from './api.js';
import { renderMarkdown, parseFrontmatter } from './markdown.js';

const $ = sel => document.querySelector(sel);

function applyBindings() {
  document.querySelectorAll('[data-bind]').forEach(el => {
    const path = el.dataset.bind;
    const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), CONFIG);
    if (v != null) el.textContent = v;
  });
  const ye = $('#year');
  if (ye) ye.textContent = new Date().getFullYear();
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

(async function init() {
  applyBindings();

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const article = $('#article');
  if (!slug) {
    article.innerHTML = '<div class="error">缺少 slug 参数</div>';
    return;
  }

  let meta = null;
  try {
    const idx = await fetchIndexPublic();
    meta = (idx.posts || []).find(p => p.slug === slug) || null;
  } catch {}

  let raw = '';
  try {
    raw = await fetchPostMarkdownPublic(slug);
  } catch (e) {
    article.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
    return;
  }

  const { data, content } = parseFrontmatter(raw);
  const title = (meta && meta.title) || data.title || '无标题';
  const date = (meta && meta.date) || data.date || '';
  const author = (meta && meta.author) || data.author || CONFIG.site.author;
  const avatar = (meta && meta.avatar) || CONFIG.site.avatar;
  const tags = (meta && meta.tags) || data.tags || [];

  document.title = `${title} · ${CONFIG.site.title}`;

  const html = await renderMarkdown(content);

  article.innerHTML = `
    <header class="article-header">
      <h1 class="article-title">${escapeHtml(title)}</h1>
      <div class="article-author">
        <div class="avatar" style="background-image:url(${escapeHtml(avatar || '')})"></div>
        <div class="info">
          <div class="name">${escapeHtml(author)}</div>
          <div class="meta">
            <span>${fmtDate(date)}</span>
            <span class="dot"></span>
            <span>${(content || '').length} 字</span>
          </div>
        </div>
        <a class="article-edit" href="admin/editor.html?slug=${encodeURIComponent(slug)}" title="在后台编辑">编辑</a>
      </div>
    </header>
    <div class="article-body">${html}</div>
    ${tags && tags.length ? `<footer class="article-footer">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</footer>` : ''}
  `;

  // 让阅读页隐藏顶部导航的"编辑"按钮（默认隐藏，登录后亦可由 article 内的入口替代）
  const editBtn = $('#editBtn');
  if (editBtn) editBtn.href = `admin/editor.html?slug=${encodeURIComponent(slug)}`;
})();
