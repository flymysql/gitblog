// ============================================================================
// 文章阅读页：渲染 Markdown + TOC + giscus 评论
// 加上：阅读进度条 / 回到顶部 / 代码复制 / 标题锚点 / 图片灯箱 / 上下篇 / 相关文章 / 阅读时间
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic, fetchPostMarkdownPublic } from './api.js';
import { renderMarkdown, parseFrontmatter } from './markdown.js';
import { initSite, escapeHtml, fmtDate, readingMinutes, tagHtml, bindLazyImages, postPath, postPathFromPost, rootPath, isPostPublicPathKey, thumbUrlFor, LAZY_PLACEHOLDER } from './site.js';
import { bszPagePvHtml, trackAndRenderArticleView } from './pageviews.js';
import { setMeta, setJsonLd } from './seo.js';
import { enhanceMath, enhanceMermaid, enhanceCodeAdvanced } from './enhancers.js';
import { shareCardHtml, bindShareCard } from './share.js';
import { commentPathForPost, mountComments, getCommentsProvider } from './comments-embed.js';

const $ = sel => document.querySelector(sel);

function isMobilePostViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

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

function absolutePublicImageUrl(url) {
  const path = publicImageUrl(url);
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) return path;
  const origin = String(CONFIG.site.url || '').replace(/\/+$/, '');
  return origin ? `${origin}${path.startsWith('/') ? path : `/${path}`}` : path;
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

function renderCommentsSection(meta, slug) {
  if (getCommentsProvider() === 'none') return;
  const article = $('#article');
  const wrap = document.createElement('section');
  wrap.className = 'comments';
  article.appendChild(wrap);

  const term = commentPathForPost({ slug, urlKey: meta && meta.urlKey });
  wrap.innerHTML = `
    <div class="comments-title">评论</div>
    <div id="commentsRoot"></div>
    <p class="comments-end-hint" hidden aria-hidden="true"></p>
  `;
  mountComments($('#commentsRoot'), term, {
    pageTitle: meta?.title || document.title,
    pageUrl: location.href,
    context: 'post',
  });
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
    if (!img.dataset.fullSrc) {
      if (
        rawSrc
        && !/^https?:\/\//i.test(rawSrc)
        && !rawSrc.startsWith('//')
        && !rawSrc.startsWith('data:')
        && !rawSrc.startsWith('blob:')
      ) {
        const fixed = publicImageUrl(rawSrc);
        if (fixed) {
          if (!/\.thumb\.webp(?:\?|$)/i.test(fixed)) {
            img.setAttribute('src', fixed);
            img.dataset.fullSrc = fixed;
          } else {
            img.dataset.fullSrc = fixed.replace(/\.thumb\.webp(\?.*)?$/i, '.webp$1');
          }
        }
      } else if (rawSrc) {
        img.dataset.fullSrc = rawSrc;
      }
    }
    const full = img.dataset.fullSrc || '';
    if (!img.dataset.thumb) {
      const thumbRel = thumbUrlFor(full);
      if (thumbRel) {
        const thumb = publicImageUrl(thumbRel);
        if (thumb && thumb !== full) img.dataset.thumb = thumb;
      }
    }
    // 清除老内容里的固定 width / height（公众号常见 width="600"），让图按容器宽度自适应
    if (img.hasAttribute('width')) img.removeAttribute('width');
    if (img.hasAttribute('height')) img.removeAttribute('height');
    if (img.style && img.style.width) img.style.width = '';
    if (img.style && img.style.height) img.style.height = '';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(img.dataset.fullSrc || img.dataset.src || img.src, img.alt));
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

  const mobile = isMobilePostViewport();

  if (!mobile && (prev || next)) {
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
    sec.className = mobile ? 'post-related post-related--cards' : 'post-related';
    if (mobile) {
      sec.innerHTML = `
        <div class="post-related-title">相关文章</div>
        <div class="post-related-cards">
          ${related.map(p => renderRelatedCard(p)).join('')}
        </div>
      `;
    } else {
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
    }
    article.appendChild(sec);
    if (mobile) bindRelatedCardThumbs(sec);
  }
}

function bindRelatedCardThumbs(sec) {
  const imgs = sec.querySelectorAll('.post-related-card-media img[data-src]');
  if (!imgs.length) return;

  const load = () => {
    for (const img of imgs) {
      const src = img.dataset.src;
      if (!src) continue;
      img.src = src;
      img.removeAttribute('data-src');
      img.classList.remove('lazy-pending');
    }
  };

  const schedule = () => {
    const ric = window.requestIdleCallback;
    if (ric) ric(load, { timeout: 2000 });
    else setTimeout(load, 100);
  };

  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}

function renderRelatedCard(p) {
  const href = postPathFromPost(p);
  const title = escapeHtml(p.title || '无标题');
  const date = fmtDate(p.date);
  const tag = (p.tags || [])[0] || '';
  const coverRel = p.cover ? publicImageUrl(p.cover) : '';
  const thumbRel = coverRel ? thumbUrlFor(coverRel) : '';
  const thumbSrc = thumbRel ? publicImageUrl(thumbRel) : '';
  const placeholderLabel = escapeHtml(tag || '随笔');
  return `
    <a class="post-related-card" href="${href}">
      ${thumbSrc
        ? `<span class="post-related-card-media"><img src="${LAZY_PLACEHOLDER}" data-src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" decoding="async" class="lazy-pending"></span>`
        : `<span class="post-related-card-media post-related-card-media--placeholder" aria-hidden="true"><span>${placeholderLabel}</span></span>`}
      <span class="post-related-card-body">
        <span class="post-related-card-title">${title}</span>
        <span class="post-related-card-meta">${escapeHtml(date)}${tag ? ` · ${escapeHtml(tag)}` : ''}</span>
      </span>
      <span class="post-related-card-chevron" aria-hidden="true">›</span>
    </a>
  `;
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

async function enhancePostArticle(article, { slug, title, tags, allPosts, meta, data }) {
  const items = buildToc(article);
  if (items) renderToc(items);

  sanitizeArticleLayout(article);
  enhanceCodeBlocks(article);
  enhanceCodeAdvanced(article);
  enhanceHeadings(article);
  enhanceImages(article);
  enhanceLinks(article);
  rewriteLegacyPostLinks(article);
  enhanceMath(article);
  enhanceMermaid(article);
  bindShareCard(article, { ...(data || {}), slug, title });

  renderSeriesIndex(allPosts, slug, (meta && meta.series) || (data && data.series));
  renderNeighborsAndRelated(allPosts, slug, tags);
  renderCommentsSection(meta, slug);

  trackAndRenderArticleView({ slug, title });
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
  const isPrerendered = article && article.dataset.prerendered === '1';

  if (!qSlug && !pathSeg && !isPrerendered) {
    article.innerHTML = '<div class="error">未找到文章地址（请使用 /post/YYYYMMDD/、/post/welcome/ 等或 post.html?slug=）</div>';
    return;
  }

  let meta = null;
  let allPosts = [];

  if (!isPrerendered) {
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
  }

  const slug = (meta && meta.slug) || (isPrerendered ? (article.dataset.slug || '').trim() : '') || qSlug || pathSeg;
  if (!slug) {
    article.innerHTML = '<div class="error">未找到对应文章</div>';
    return;
  }

  if (!meta && pathSeg && isPostPublicPathKey(pathSeg) && !isPrerendered) {
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

  if (isPrerendered) {
    const prerenderSlug = (article.dataset.slug || '').trim();
    const titleEl = article.querySelector('.article-title');
    const title = (titleEl && titleEl.textContent.trim()) || '无标题';

    // 正文已在 HTML 中，先同步增强，再单次拉取索引（侧栏/评论/上下篇）
    const items = buildToc(article);
    if (items) renderToc(items);
    sanitizeArticleLayout(article);
    enhanceCodeBlocks(article);
    enhanceCodeAdvanced(article);
    enhanceHeadings(article);
    enhanceImages(article);
    enhanceLinks(article);
    rewriteLegacyPostLinks(article);
    enhanceMath(article);
    enhanceMermaid(article);
    bindShareCard(article, { slug: prerenderSlug, title });

    try {
      const idx = await fetchIndexPublic();
      allPosts = idx.posts || [];
      meta = allPosts.find(p => p.slug === prerenderSlug) || null;
    } catch {}

    const slug = (meta && meta.slug) || prerenderSlug;
    const tags = (meta && meta.tags) || [];
    renderSeriesIndex(allPosts, slug, (meta && meta.series) || '');
    renderNeighborsAndRelated(allPosts, slug, tags);
    renderCommentsSection(meta, slug);
    return;
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
  const coverAbs = absolutePublicImageUrl((meta && meta.cover) || data.cover || '');
  const tags = (meta && meta.tags) || data.tags || [];
  const summary = (meta && meta.summary) || data.summary || '';
  // SEO + 优先用 OG 自动图（assets/og/{slug}.svg）兜底
  const ogAuto = `${CONFIG.site.url || ''}/assets/og/${encodeURIComponent(slug)}.svg`;
  const baseSite = String(CONFIG.site.url || '').replace(/\/+$/, '');
  const canonPathRel = (meta && meta.urlKey && isPostPublicPathKey(meta.urlKey))
    ? postPath(meta.urlKey)
    : `${rootPath('post.html')}?slug=${encodeURIComponent(slug)}`;
  const canonical = baseSite ? `${baseSite}${canonPathRel}` : `${window.location.origin}${canonPathRel}`;
  const ogImage = coverAbs || (CONFIG.site.url ? ogAuto : avatar);
  setMeta({
    title,
    description: summary,
    image: ogImage,
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
    image: ogImage,
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
            <span class="meta-read-mins">约 ${mins} 分钟</span>
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

  await enhancePostArticle(article, { slug, title, tags, allPosts, meta, data });
})();
