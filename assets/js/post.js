// ============================================================================
// 文章阅读页：渲染 Markdown + TOC + giscus 评论
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic, fetchPostMarkdownPublic } from './api.js';
import { renderMarkdown, parseFrontmatter } from './markdown.js';
import { initSite, escapeHtml, fmtDate } from './site.js';
import { setMeta } from './seo.js';

const $ = sel => document.querySelector(sel);

function buildToc(article) {
  const headings = [...article.querySelectorAll('h2, h3')];
  if (headings.length < 2) return null;
  const items = headings.map((h, i) => {
    const id = h.id || ('toc-' + i + '-' + (h.textContent.trim().replace(/\s+/g, '-').slice(0, 40)));
    h.id = id;
    return {
      id,
      level: h.tagName === 'H2' ? 2 : 3,
      text: h.textContent.trim(),
    };
  });
  return items;
}

function renderToc(items) {
  const sidebar = $('#tocSidebar');
  if (!items || !items.length) return;
  sidebar.hidden = false;
  sidebar.innerHTML = `
    <nav class="toc">
      <div class="toc-title">目录</div>
      ${items.map(i => `<a class="toc-item level-${i.level}" href="#${encodeURIComponent(i.id)}" data-id="${escapeHtml(i.id)}">${escapeHtml(i.text)}</a>`).join('')}
    </nav>
  `;
  // 滚动高亮
  const tocLinks = sidebar.querySelectorAll('.toc-item');
  const headings = items.map(i => document.getElementById(i.id)).filter(Boolean);
  const onScroll = () => {
    const scrollY = window.scrollY + 100;
    let active = headings[0];
    for (const h of headings) if (h.offsetTop <= scrollY) active = h;
    tocLinks.forEach(a => a.classList.toggle('active', a.dataset.id === (active && active.id)));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  // 平滑滚动
  tocLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const id = a.dataset.id;
      const target = document.getElementById(id);
      if (target) {
        window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
        history.replaceState(null, '', '#' + encodeURIComponent(id));
      }
    });
  });
}

function renderGiscus(slug, title) {
  const g = CONFIG.giscus;
  if (!g || !g.enabled || !g.repoId || !g.categoryId) return;
  const article = $('#article');
  const wrap = document.createElement('section');
  wrap.className = 'comments';
  wrap.innerHTML = `<div class="comments-title">评论</div><div id="giscusBox"></div>`;
  article.appendChild(wrap);

  const html = document.documentElement;
  const choice = html.dataset.themeChoice || 'auto';
  const resolved = choice === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;

  const s = document.createElement('script');
  s.src = 'https://giscus.app/client.js';
  s.crossOrigin = 'anonymous';
  s.async = true;
  Object.entries({
    'data-repo': g.repo,
    'data-repo-id': g.repoId,
    'data-category': g.category,
    'data-category-id': g.categoryId,
    'data-mapping': g.mapping || 'pathname',
    'data-strict': g.strict || '0',
    'data-reactions-enabled': g.reactionsEnabled || '1',
    'data-emit-metadata': g.emitMetadata || '0',
    'data-input-position': g.inputPosition || 'top',
    'data-theme': resolved,
    'data-lang': g.lang || 'zh-CN',
    'data-loading': 'lazy',
  }).forEach(([k, v]) => s.setAttribute(k, v));
  $('#giscusBox').appendChild(s);
}

(async function init() {
  initSite({ active: '' });

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
  const updated = (meta && meta.updated) || data.updated || date;
  const author = (meta && meta.author) || data.author || CONFIG.site.author;
  const avatar = (meta && meta.avatar) || CONFIG.site.avatar;
  const cover = (meta && meta.cover) || data.cover || '';
  const tags = (meta && meta.tags) || data.tags || [];
  const summary = (meta && meta.summary) || data.summary || '';

  setMeta({
    title,
    description: summary,
    image: cover || avatar,
    type: 'article',
    publishedTime: date,
    modifiedTime: updated,
    author,
    tags,
  });

  const html = await renderMarkdown(content);

  article.innerHTML = `
    ${cover ? `<div class="article-cover" style="background-image:url(${escapeHtml(cover)})"></div>` : ''}
    <header class="article-header">
      ${tags.length ? `<div class="article-tags-top">${tags.map(t => `<a class="tag" href="tags.html#${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join('')}</div>` : ''}
      <h1 class="article-title">${escapeHtml(title)}</h1>
      <div class="article-author">
        <div class="avatar" style="background-image:url(${escapeHtml(avatar || '')})"></div>
        <div class="info">
          <div class="name">${escapeHtml(author)}</div>
          <div class="meta">
            <span>${fmtDate(date)}</span>
            ${updated && updated !== date ? `<span class="dot"></span><span>更新于 ${fmtDate(updated)}</span>` : ''}
            <span class="dot"></span>
            <span>${(content || '').length} 字</span>
          </div>
        </div>
        <a class="article-edit" href="admin/editor.html?slug=${encodeURIComponent(slug)}" title="编辑此文">编辑</a>
      </div>
    </header>
    <div class="article-body">${html}</div>
    ${tags.length ? `<footer class="article-footer">
      <div class="article-tags">${tags.map(t => `<a class="tag" href="tags.html#${encodeURIComponent(t)}">${escapeHtml(t)}</a>`).join('')}</div>
    </footer>` : ''}
  `;

  // TOC
  const items = buildToc(article);
  if (items) renderToc(items);

  // 评论
  renderGiscus(slug, title);
})();
