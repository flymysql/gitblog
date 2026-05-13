// ============================================================================
// 文章阅读页：渲染 Markdown + TOC + giscus 评论
// 加上：阅读进度条 / 回到顶部 / 代码复制 / 标题锚点 / 图片灯箱 / 上下篇 / 相关文章 / 阅读时间
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic, fetchPostMarkdownPublic } from './api.js';
import { renderMarkdown, parseFrontmatter } from './markdown.js';
import { initSite, escapeHtml, fmtDate, readingMinutes, tagHtml, bindLazyImages, postPath, postPathFromPost, rootPath, isPostPublicPathKey } from './site.js';
import { initPageviews, bszPagePvHtml, trackAndRenderArticleView } from './pageviews.js';
import { setMeta, setJsonLd } from './seo.js';
import { enhanceMath, enhanceMermaid, enhanceCodeAdvanced } from './enhancers.js';
import { shareCardHtml, bindShareCard } from './share.js';
import { mountGiscusScript } from './giscus-embed.js';

const $ = sel => document.querySelector(sel);

function publicImageUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('//')) return s;
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;

  let rel = s.replace(/^\.\//, '');
  rel = rel.replace(/^\/+/, '');
  while (rel.startsWith('../')) rel = rel.slice(3);

  if (rel.startsWith('assets/') || rel.startsWith('posts/')) {
    return rootPath(rel);
  }
  return s;
}

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

function renderGiscus(slug) {
  const g = CONFIG.giscus;
  if (!g || !g.enabled) return;
  const article = $('#article');
  const wrap = document.createElement('section');
  wrap.className = 'comments';
  article.appendChild(wrap);

  wrap.innerHTML = `<div class="comments-title">评论</div><div id="giscusBox"></div>`;
  mountGiscusScript($('#giscusBox'), slug);
}

// ---------- 阅读进度条 ----------
function bindReadingProgress() {
  const bar = $('#reading-progress');
  if (!bar) return;
  const update = () => {
    const h = document.documentElement;
    const total = h.scrollHeight - h.clientHeight;
    const pct = total > 0 ? Math.min(100, Math.max(0, (h.scrollTop / total) * 100)) : 0;
    bar.style.width = pct + '%';
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

// ---------- 回到顶部 ----------
function bindBackToTop() {
  const btn = $('#backToTop');
  if (!btn) return;
  const update = () => {
    btn.hidden = window.scrollY < 480;
  };
  window.addEventListener('scroll', update, { passive: true });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  update();
}

// ---------- 代码块复制按钮 ----------
function enhanceCodeBlocks(article) {
  article.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.code-copy')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = '已复制';
        btn.classList.add('done');
        setTimeout(() => {
          btn.textContent = '复制';
          btn.classList.remove('done');
        }, 1600);
      } catch {
        btn.textContent = '失败';
        setTimeout(() => { btn.textContent = '复制'; }, 1600);
      }
    });
    pre.classList.add('has-copy');
    pre.appendChild(btn);
  });
}

// ---------- 标题悬停锚点 ----------
function enhanceHeadings(article) {
  article.querySelectorAll('h2, h3, h4').forEach(h => {
    if (!h.id) return;
    if (h.querySelector('.heading-anchor')) return;
    const a = document.createElement('a');
    a.className = 'heading-anchor';
    a.href = '#' + encodeURIComponent(h.id);
    a.setAttribute('aria-label', '复制段落链接');
    a.title = '复制段落链接';
    a.textContent = '#';
    a.addEventListener('click', e => {
      e.preventDefault();
      const url = window.location.href.replace(/#.*$/, '') + '#' + encodeURIComponent(h.id);
      history.replaceState(null, '', '#' + encodeURIComponent(h.id));
      window.scrollTo({ top: h.offsetTop - 80, behavior: 'smooth' });
      navigator.clipboard && navigator.clipboard.writeText(url).catch(() => {});
    });
    h.appendChild(a);
  });
}

// ---------- 图片懒加载 + 灯箱 ----------
function enhanceImages(article) {
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightboxImg');
  const closeBtn = lightbox && lightbox.querySelector('.lightbox-close');

  article.querySelectorAll('img').forEach(img => {
    const rawSrc = img.getAttribute('src') || '';
    if (
      rawSrc
      && !/^https?:\/\//i.test(rawSrc)
      && !rawSrc.startsWith('//')
      && !rawSrc.startsWith('data:')
      && !rawSrc.startsWith('blob:')
    ) {
      const fixed = publicImageUrl(rawSrc);
      if (fixed) img.setAttribute('src', fixed);
    }
    // 清除老内容里的固定 width / height（公众号常见 width="600"），让图按容器宽度自适应
    if (img.hasAttribute('width')) img.removeAttribute('width');
    if (img.hasAttribute('height')) img.removeAttribute('height');
    if (img.style && img.style.width) img.style.width = '';
    if (img.style && img.style.height) img.style.height = '';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(img.dataset.src || img.src, img.alt));
  });
  // 真正的懒加载：第一张图首屏 eager（LCP 友好），其它图视口附近才下载
  bindLazyImages(article, { eagerCount: 1 });

  function openLightbox(src, alt) {
    if (!lightbox) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.remove('is-hidden');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.add('is-hidden');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lightboxImg.src = '';
  }
  if (lightbox) {
    lightbox.addEventListener('click', e => {
      if (e.target === lightbox || e.target === lightboxImg) closeLightbox();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !lightbox.classList.contains('is-hidden')) closeLightbox();
    });
  }
}

// ---------- 兼容旧文章：清掉撑爆视口的 inline 固定宽度，用包裹层让宽表格横向滚动 ----------
function sanitizeArticleLayout(article) {
  const body = article.querySelector('.article-body');
  if (!body) return;

  // 1) 给 <table> 套一层可横向滚动的容器
  body.querySelectorAll('table').forEach(table => {
    if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });

  // 2) 清掉 section / div / figure / span / p 上 inline style 里的固定宽度，
  //    避免公众号迁移内容里 width: 600px 这类把整页撑大、触发移动端 shrink-to-fit
  const fixedWidthRe = /(?:^|;)\s*(?:min-width|width)\s*:\s*[^;]+/gi;
  body.querySelectorAll('[style]').forEach(el => {
    const s = el.getAttribute('style') || '';
    if (!s) return;
    if (fixedWidthRe.test(s)) {
      el.setAttribute('style', s.replace(fixedWidthRe, '').replace(/^;\s*/, ''));
    }
  });
  // 3) 干掉 <font size="..."> / <font color="..."> 这种古早标签的视觉污染（保留文本）
  body.querySelectorAll('font[size]').forEach(el => el.removeAttribute('size'));
}

// ---------- 外链自动新窗口 + 图标 ----------
function enhanceLinks(article) {
  article.querySelectorAll('.article-body a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.classList.add('external-link');
    }
  });
}

function legacyPostLinkBase() {
  try {
    const u = String(CONFIG.site.url || '').trim();
    if (u) return u.endsWith('/') ? u : `${u}/`;
  } catch { /* */ }
  return `${window.location.origin}/`;
}

/** 正文里旧的 post.html?slug= 链接改写成 /post/{slug}/，避免在 /post/当前/ 下相对路径断裂 */
function rewriteLegacyPostLinks(article) {
  const base = legacyPostLinkBase();
  article.querySelectorAll('.article-body a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#')) return;
    try {
      const u = new URL(href, base);
      if (!String(u.pathname || '').endsWith('post.html')) return;
      const s = u.searchParams.get('slug');
      if (s) a.setAttribute('href', `${rootPath('post.html')}?slug=${encodeURIComponent(s)}`);
    } catch { /* */ }
  });
}

// ---------- 上一篇 / 下一篇 + 相关文章 ----------
function renderNeighborsAndRelated(allPosts, currentSlug, currentTags) {
  const visible = (allPosts || []).filter(p => !p.draft && p.slug !== currentSlug);
  // 上下篇：基于"全部已发布按时间升序"找当前文章相邻位置
  const allByDateAsc = [...(allPosts || []).filter(p => !p.draft)]
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const myIndex = allByDateAsc.findIndex(p => p.slug === currentSlug);
  const prev = myIndex > 0 ? allByDateAsc[myIndex - 1] : null;
  const next = myIndex >= 0 && myIndex < allByDateAsc.length - 1 ? allByDateAsc[myIndex + 1] : null;

  // 相关文章：标签重合度排序，最多 4 篇
  const tagSet = new Set(currentTags || []);
  const related = visible
    .map(p => {
      const overlap = (p.tags || []).filter(t => tagSet.has(t)).length;
      return { p, overlap };
    })
    .filter(x => x.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return new Date(b.p.date || 0) - new Date(a.p.date || 0);
    })
    .slice(0, 4)
    .map(x => x.p);

  const article = $('#article');
  if (!article) return;

  if (prev || next) {
    const nav = document.createElement('nav');
    nav.className = 'post-neighbors';
    nav.innerHTML = `
      ${prev ? `
        <a class="post-neighbor prev" href="${postPathFromPost(prev)}">
          <span class="label">← 上一篇</span>
          <span class="title">${escapeHtml(prev.title || '无标题')}</span>
        </a>` : '<span></span>'}
      ${next ? `
        <a class="post-neighbor next" href="${postPathFromPost(next)}">
          <span class="label">下一篇 →</span>
          <span class="title">${escapeHtml(next.title || '无标题')}</span>
        </a>` : '<span></span>'}
    `;
    article.appendChild(nav);
  }

  if (related.length) {
    const sec = document.createElement('section');
    sec.className = 'post-related';
    sec.innerHTML = `
      <div class="post-related-title">相关文章</div>
      <ul class="post-related-list">
        ${related.map(p => `
          <li>
            <a href="${postPathFromPost(p)}">
              <span class="t">${escapeHtml(p.title || '无标题')}</span>
              <span class="meta">${fmtDate(p.date)} · ${(p.tags || []).slice(0, 3).map(t => '#' + escapeHtml(t)).join(' ')}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    `;
    article.appendChild(sec);
  }
}

// ---------- 系列文章目录 ----------
function renderSeriesIndex(allPosts, currentSlug, seriesName) {
  if (!seriesName) return;
  const list = (allPosts || [])
    .filter(p => !p.draft && p.series === seriesName && p.type !== 'note')
    .sort((a, b) => {
      const ao = a.seriesOrder, bo = b.seriesOrder;
      if (ao != null && bo != null) return ao - bo;
      if (ao != null) return -1;
      if (bo != null) return 1;
      return new Date(a.date || 0) - new Date(b.date || 0);
    });
  if (list.length < 2) return;
  const article = $('#article');
  if (!article) return;
  // 插到正文（.article-body）之前，让读者一眼看到这是系列里的第几篇
  const body = article.querySelector('.article-body');
  const sec = document.createElement('aside');
  sec.className = 'article-series';
  sec.innerHTML = `
    <div class="article-series-head">
      <div class="article-series-title">本文是「${escapeHtml(seriesName)}」系列的第 ${
      Math.max(1, list.findIndex(p => p.slug === currentSlug) + 1)
    } 篇 / 共 ${list.length} 篇</div>
      <a class="article-series-all" href="series.html">全部系列</a>
    </div>
    <ol>
      ${list.map(p => `
        <li class="${p.slug === currentSlug ? 'is-current' : ''}">
          ${p.slug === currentSlug
            ? `<a>${escapeHtml(p.title || '无标题')}</a>`
            : `<a href="${postPathFromPost(p)}">${escapeHtml(p.title || '无标题')}</a>`}
        </li>
      `).join('')}
    </ol>
  `;
  if (body) body.parentNode.insertBefore(sec, body);
  else article.appendChild(sec);
}

(async function init() {
  initSite({ active: '' });
  bindReadingProgress();
  bindBackToTop();

  const params = new URLSearchParams(window.location.search);
  const pathMatch = window.location.pathname.match(/\/post\/([^/]+)\/?$/);
  let pathSeg = '';
  if (pathMatch) {
    try {
      pathSeg = decodeURIComponent(pathMatch[1]).trim();
    } catch {
      pathSeg = pathMatch[1].trim();
    }
  }
  const qSlug = (params.get('slug') || '').trim();

  const article = $('#article');
  if (!qSlug && !pathSeg) {
    article.innerHTML = '<div class="error">未找到文章地址（请使用 /post/YYYYMMDD/、/post/welcome/ 等或 post.html?slug=）</div>';
    return;
  }

  let meta = null;
  let allPosts = [];
  try {
    const idx = await fetchIndexPublic();
    allPosts = idx.posts || [];
    if (qSlug) {
      meta = allPosts.find(p => p.slug === qSlug) || null;
    } else if (pathSeg) {
      meta = allPosts.find(p => p.urlKey === pathSeg)
        || allPosts.find(p => p.slug === pathSeg)
        || null;
    }
  } catch {}

  const slug = (meta && meta.slug) || qSlug || pathSeg;
  if (!slug) {
    article.innerHTML = '<div class="error">未找到对应文章</div>';
    return;
  }

  if (!meta && pathSeg && isPostPublicPathKey(pathSeg)) {
    article.innerHTML = `<div class="error">未找到路径「${escapeHtml(pathSeg)}」对应的文章</div>`;
    return;
  }

  if (window.history && window.history.replaceState && meta && meta.urlKey && isPostPublicPathKey(meta.urlKey)) {
    const canon = postPath(meta.urlKey);
    try {
      if (params.get('slug') || (pathSeg && pathSeg !== meta.urlKey)) {
        window.history.replaceState(null, '', canon);
      }
    } catch {
      /* 部分 WebView 对 replaceState 较严格 */
    }
  }

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
  const cover = publicImageUrl((meta && meta.cover) || data.cover || '');
  const tags = (meta && meta.tags) || data.tags || [];
  const summary = (meta && meta.summary) || data.summary || '';
  // SEO + 优先用 OG 自动图（assets/og/{slug}.svg）兜底
  const ogAuto = `${CONFIG.site.url || ''}/assets/og/${encodeURIComponent(slug)}.svg`;
  const baseSite = String(CONFIG.site.url || '').replace(/\/+$/, '');
  const canonPathRel = (meta && meta.urlKey && isPostPublicPathKey(meta.urlKey))
    ? postPath(meta.urlKey)
    : `${rootPath('post.html')}?slug=${encodeURIComponent(slug)}`;
  const canonical = baseSite ? `${baseSite}${canonPathRel}` : `${window.location.origin}${canonPathRel}`;
  setMeta({
    title,
    description: summary,
    image: cover || (CONFIG.site.url ? ogAuto : avatar),
    type: 'article',
    publishedTime: date,
    modifiedTime: updated,
    author,
    tags,
    url: canonical,
  });

  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: summary,
    image: cover || (CONFIG.site.url ? ogAuto : avatar),
    datePublished: date,
    dateModified: updated,
    author: { '@type': 'Person', name: author || CONFIG.site.author },
    publisher: {
      '@type': 'Organization',
      name: CONFIG.site.title,
      logo: CONFIG.site.logo || CONFIG.site.avatar ? { '@type': 'ImageObject', url: CONFIG.site.logo || CONFIG.site.avatar } : undefined,
    },
    mainEntityOfPage: canonical,
    keywords: (tags || []).join(','),
  });

  const html = await renderMarkdown(content);
  const mins = readingMinutes(content);

  article.innerHTML = `
    <header class="article-header">
      ${tags.length ? `<div class="article-tags-top">${tags.map(t => tagHtml(t, { href: `${rootPath('tags.html')}#${encodeURIComponent(t)}` })).join('')}</div>` : ''}
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
            <span class="dot"></span>
            <span>约 ${mins} 分钟</span>
            ${(() => {
              if ((CONFIG.pageviews || {}).showPostViews === false) return '';
              const pv = bszPagePvHtml();
              return pv ? `<span class="dot"></span>${pv}` : '';
            })()}
          </div>
        </div>
        <a class="article-edit" href="${rootPath(`admin/editor.html?slug=${encodeURIComponent(slug)}`)}" title="编辑此文">编辑</a>
      </div>
    </header>
    <div class="article-body">${html}</div>
      ${tags.length ? `<footer class="article-footer">
      <div class="article-tags">${tags.map(t => tagHtml(t, { href: `${rootPath('tags.html')}#${encodeURIComponent(t)}` })).join('')}</div>
    </footer>` : ''}
    ${shareCardHtml({ ...(meta || {}), ...data, slug, title, page: !!(meta && meta.page) || !!data.page })}
  `;

  // TOC
  const items = buildToc(article);
  if (items) renderToc(items);

  // 增强：清布局 / 代码复制 / 标题锚点 / 图片懒加载+灯箱 / 数学 / Mermaid / 代码行号折叠
  sanitizeArticleLayout(article);
  enhanceCodeBlocks(article);          // 复制按钮（已存在）
  enhanceCodeAdvanced(article);        // 行号 + 长代码折叠 + 语言徽标
  enhanceHeadings(article);
  enhanceImages(article);
  enhanceLinks(article);
  rewriteLegacyPostLinks(article);
  enhanceMath(article);                // KaTeX 渲染 .math 节点（懒加载 KaTeX）
  enhanceMermaid(article);             // Mermaid 渲染 .mermaid 节点（懒加载 mermaid.js）
  bindShareCard(article, { ...data, slug, title });  // 分享 / 二维码 / 打赏

  // 系列文章目录（如果属于某个系列）
  renderSeriesIndex(allPosts, slug, (meta && meta.series) || data.series);

  // 上下篇 + 相关文章
  renderNeighborsAndRelated(allPosts, slug, tags);

  // 评论
  renderGiscus(slug);

  // 文章 author meta 里的「阅读 N」占位是这里渲染的；按 slug 计数，首页列表只读不增。
  initPageviews();
  trackAndRenderArticleView(slug);
})();
