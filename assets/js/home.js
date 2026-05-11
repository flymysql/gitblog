// ============================================================================
// 首页：Hero + 文章列表 + 侧栏（标签云、最近文章）
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic } from './api.js';
import { initSite, escapeHtml, fmtDate, timeAgo, tagHtml, bindLazyImages } from './site.js';
import { setMeta, setJsonLd } from './seo.js';

const $ = sel => document.querySelector(sel);

function publicImageUrl(url) {
  return String(url || '').replace(/^\.\.\/assets\//, 'assets/');
}

function renderHero(posts) {
  const hero = $('#hero');
  if (!hero) return;
  hero.hidden = false;
  const tagCount = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => tagCount.add(t)));
  hero.innerHTML = `
    <div class="hero-avatar" style="background-image:url(${escapeHtml(CONFIG.site.avatar || '')})"></div>
    <div class="hero-info">
      <div class="hero-title">${escapeHtml(CONFIG.site.title)}</div>
      <div class="hero-subtitle">${escapeHtml(CONFIG.site.description || CONFIG.site.subtitle || '')}</div>
      <div class="hero-stats">
        <div class="stat"><strong>${posts.length}</strong>篇文章</div>
        <div class="stat"><strong>${tagCount.size}</strong>个标签</div>
        ${posts.length ? `<div class="stat">最近更新 ${timeAgo(posts[0].date)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderCarousel(posts) {
  const root = $('#homeCarousel');
  if (!root) return;

  // 轮播策略：
  // 1. 如果有任何文章在后台被勾选 carousel=true，只展示这些（按 pinned + date 排，最多 8 张）
  // 2. 否则回退到「按 pinned + cover + date 取前 5 张」的旧行为，保证未配置时也有内容
  const sortFn = (a, b) => {
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (a.pinned && b.pinned && Number(a.pinnedOrder || 0) !== Number(b.pinnedOrder || 0)) {
      return Number(a.pinnedOrder || 9999) - Number(b.pinnedOrder || 9999);
    }
    return new Date(b.date || 0) - new Date(a.date || 0);
  };
  const picked = posts.filter(p => p.carousel && p.cover);
  const items = picked.length
    ? [...picked].sort(sortFn).slice(0, 8)
    : [...posts].filter(p => p.cover).sort(sortFn).slice(0, 5);

  if (!items.length) {
    root.hidden = true;
    return;
  }

  let current = 0;
  root.hidden = false;
  root.innerHTML = `
    <div class="carousel-viewport">
      ${items.map((p, i) => `
        <a class="carousel-slide${i === 0 ? ' active' : ''}" href="post.html?slug=${encodeURIComponent(p.slug)}" aria-label="${escapeHtml(p.title || '文章')}">
          <img src="${escapeHtml(publicImageUrl(p.cover))}" alt="${escapeHtml(p.title || '')}" loading="${i === 0 ? 'eager' : 'lazy'}">
          <span class="carousel-shade"></span>
          <span class="carousel-content">
            ${p.pinned ? '<span class="carousel-badge">置顶推荐</span>' : '<span class="carousel-badge">精选文章</span>'}
            <strong>${escapeHtml(p.title || '无标题')}</strong>
            ${p.summary ? `<em>${escapeHtml(p.summary)}</em>` : ''}
          </span>
        </a>
      `).join('')}
      <button class="carousel-btn prev" type="button" aria-label="上一张">‹</button>
      <button class="carousel-btn next" type="button" aria-label="下一张">›</button>
      <div class="carousel-dots">
        ${items.map((_, i) => `<button class="${i === 0 ? 'active' : ''}" type="button" aria-label="第 ${i + 1} 张"></button>`).join('')}
      </div>
    </div>
  `;

  const slides = [...root.querySelectorAll('.carousel-slide')];
  const dots = [...root.querySelectorAll('.carousel-dots button')];
  const setActive = index => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  };

  // 轮播图：第一张立即加载（LCP 关键），其它走视口懒加载
  bindLazyImages(root, { eagerCount: 1 });

  root.querySelector('.prev').addEventListener('click', () => setActive(current - 1));
  root.querySelector('.next').addEventListener('click', () => setActive(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => setActive(i)));

  if (slides.length > 1) {
    let timer = setInterval(() => setActive(current + 1), 4500);
    root.addEventListener('mouseenter', () => clearInterval(timer));
    root.addEventListener('mouseleave', () => {
      timer = setInterval(() => setActive(current + 1), 4500);
    });
  }
}

const PAGE_SIZE = 15;

function postItemHtml(p, author, avatar) {
  return `
    <li class="post-item" data-slug="${escapeHtml(p.slug)}">
      <a class="post-content" href="post.html?slug=${encodeURIComponent(p.slug)}">
        <div class="post-author-row">
          <div class="avatar" style="background-image:url(${escapeHtml(p.avatar || avatar || '')})"></div>
          <span class="name">${escapeHtml(p.author || author || '')}</span>
          <span>·</span>
          <span>${timeAgo(p.date)}</span>
          ${p.pinned ? '<span class="post-pin">置顶</span>' : ''}
        </div>
        <h3 class="post-title">${escapeHtml(p.title || '无标题')}</h3>
        <p class="post-summary">${escapeHtml(p.summary || '')}</p>
        <div class="post-meta">
          ${(p.tags || []).slice(0, 3).map(t => tagHtml(t)).join('')}
        </div>
      </a>
      ${p.cover ? `<a href="post.html?slug=${encodeURIComponent(p.slug)}" class="post-thumbnail"><img src="${escapeHtml(publicImageUrl(p.cover))}" alt="${escapeHtml(p.title || '')}" loading="lazy"></a>` : ''}
    </li>
  `;
}

// 懒加载状态：每次切 tab/筛选都会被替换
let listState = null;

function renderList(posts) {
  const ul = $('#postList');
  // 销毁上一次的观察器
  if (listState && listState.observer) listState.observer.disconnect();

  if (!posts.length) {
    ul.innerHTML = '<li class="empty">还没有文章。点击右上角"写文章"开始第一篇～</li>';
    listState = null;
    return;
  }

  const author = CONFIG.site.author;
  const avatar = CONFIG.site.avatar;

  // 第一页 + sentinel
  const firstChunk = posts.slice(0, PAGE_SIZE);
  ul.innerHTML = firstChunk.map(p => postItemHtml(p, author, avatar)).join('')
    + (posts.length > PAGE_SIZE
      ? `<li class="load-more-sentinel" id="loadMoreSentinel" aria-hidden="true">
           <span class="load-more-spinner"></span>
           <span class="load-more-text">加载更多</span>
         </li>`
      : `<li class="load-more-end">已经到底啦 · 共 ${posts.length} 篇</li>`);
  // 列表缩略图全部走视口懒加载（首屏前几张视口可见时会立刻加载）
  bindLazyImages(ul, { eagerCount: 0 });

  let loaded = firstChunk.length;
  const sentinel = document.getElementById('loadMoreSentinel');

  function loadNext() {
    const nextChunk = posts.slice(loaded, loaded + PAGE_SIZE);
    if (!nextChunk.length) return;
    const frag = document.createElement('div');
    frag.innerHTML = nextChunk.map(p => postItemHtml(p, author, avatar)).join('');
    const inserted = [...frag.children];
    inserted.forEach(node => ul.insertBefore(node, sentinel));
    inserted.forEach(node => bindLazyImages(node, { eagerCount: 0 }));
    loaded += nextChunk.length;
    if (loaded >= posts.length) {
      // 全部加载完，把 sentinel 替换成"到底"提示
      if (listState && listState.observer) listState.observer.disconnect();
      sentinel.outerHTML = `<li class="load-more-end">已经到底啦 · 共 ${posts.length} 篇</li>`;
    }
  }

  let observer = null;
  if (sentinel && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) loadNext();
    }, { rootMargin: '300px 0px' });
    observer.observe(sentinel);
  } else if (sentinel) {
    sentinel.style.cursor = 'pointer';
    sentinel.addEventListener('click', loadNext);
  }

  listState = { posts, loaded, observer };
}

function renderTags(posts) {
  const cloud = $('#tagCloud');
  if (!cloud) return;
  const counts = new Map();
  for (const p of posts) {
    for (const t of (p.tags || [])) counts.set(t, (counts.get(t) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (!sorted.length) {
    cloud.innerHTML = '<span style="color:var(--text-tertiary);font-size:12px;">暂无标签</span>';
    return;
  }
  cloud.innerHTML = sorted.map(([t, n]) => tagHtml(t, { href: `tags.html#${encodeURIComponent(t)}`, count: ` · ${n}` })).join('');
}

function renderRecent(posts) {
  const list = $('#recentList');
  if (!list) return;
  const recent = [...posts].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 6);
  if (!recent.length) {
    list.innerHTML = '<li style="color:var(--text-tertiary);font-size:12px;">暂无</li>';
    return;
  }
  list.innerHTML = recent.map(p => `
    <li><a href="post.html?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.title || '无标题')}</a></li>
  `).join('');
}

function applyFilter(posts, tab, q, tag) {
  let r = [...posts];
  if (q) {
    const lq = q.toLowerCase();
    r = r.filter(p =>
      String(p.title || '').toLowerCase().includes(lq) ||
      String(p.summary || '').toLowerCase().includes(lq) ||
      (p.tags || []).some(t => String(t).toLowerCase().includes(lq))
    );
  }
  if (tag) r = r.filter(p => (p.tags || []).includes(tag));
  if (tab === 'hot') {
    r.sort((a, b) => (b.views || 0) - (a.views || 0));
  } else if (tab === 'all') {
    r.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN'));
  } else {
    r.sort((a, b) => {
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (a.pinned && b.pinned && Number(a.pinnedOrder || 0) !== Number(b.pinnedOrder || 0)) {
        return Number(a.pinnedOrder || 9999) - Number(b.pinnedOrder || 9999);
      }
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
  }
  return r;
}

(async function init() {
  initSite({ active: './' });
  setMeta({ title: '', description: CONFIG.site.description, type: 'website' });
  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: CONFIG.site.title,
    description: CONFIG.site.description,
    url: CONFIG.site.url || window.location.origin,
    inLanguage: CONFIG.site.locale || 'zh-CN',
    publisher: {
      '@type': 'Person',
      name: CONFIG.site.author,
      image: CONFIG.site.avatar,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${CONFIG.site.url || window.location.origin}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  });

  let allPosts = [];
  try {
    const data = await fetchIndexPublic();
    allPosts = (Array.isArray(data.posts) ? data.posts : []).filter(p => !p.draft);
  } catch (e) {
    $('#postList').innerHTML = `<li class="error">加载文章列表失败：${escapeHtml(e.message)}</li>`;
    return;
  }

  renderHero(allPosts);
  renderCarousel(allPosts);
  renderTags(allPosts);
  renderRecent(allPosts);

  let tab = 'latest';
  let activeTag = '';

  function refresh() {
    renderList(applyFilter(allPosts, tab, '', activeTag));
  }

  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      tab = el.dataset.tab;
      refresh();
    });
  });

  refresh();
})();
