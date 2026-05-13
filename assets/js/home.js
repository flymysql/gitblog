// ============================================================================
// 首页：Hero + 文章列表 + 侧栏（标签云、最近文章）
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic } from './api.js';
import { initSite, escapeHtml, fmtDate, timeAgo, tagHtml, bindLazyImages, LAZY_PLACEHOLDER, postPathFromPost, postPath } from './site.js';
import { initPageviews, bszSiteStatsHtml } from './pageviews.js';
import { setMeta, setJsonLd } from './seo.js';
import { isGiscusReady, mountGiscusScript, notesFeedTerm } from './giscus-embed.js';

const $ = sel => document.querySelector(sel);

// 从文章页返回首页时恢复列表滚动位置（配合无限加载先铺到离开前的条数）
const HOME_SCROLL_KEY = 'gitblog_home_scroll_v1';

function navEntryType() {
  const n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  return (n && n.type) || 'navigate';
}

function scheduleRestoreHomeScroll(y) {
  const apply = () => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(Math.max(0, Number(y) || 0), max));
  };
  requestAnimationFrame(() => requestAnimationFrame(apply));
  setTimeout(apply, 80);
  setTimeout(apply, 320);
}

function publicImageUrl(url) {
  return String(url || '').replace(/^\.\.\/assets\//, 'assets/');
}

function renderHero(posts) {
  const hero = $('#hero');
  if (!hero) return;
  hero.hidden = false;
  const tagCount = new Set();
  posts.forEach(p => (p.tags || []).forEach(t => tagCount.add(t)));
  // 整块 hero 包一层 <a> 跳转到「关于」页面：支持点击 / 右键新标签 / 中键新窗口
  hero.innerHTML = `
    <a class="hero-link" href="${postPath('about')}" aria-label="关于${escapeHtml(CONFIG.site.title || '本站')}">
      <div class="hero-avatar-wrap">
        <div class="hero-avatar" style="background-image:url(${escapeHtml(CONFIG.site.avatar || '')})"></div>
      </div>
      <div class="hero-info">
        <div class="hero-subtitle">${escapeHtml(CONFIG.site.description || CONFIG.site.subtitle || '')}</div>
        <div class="hero-stats">
          <div class="stat"><strong>${posts.length}</strong>篇文章</div>
          <div class="stat"><strong>${tagCount.size}</strong>个标签</div>
          ${posts.length ? `<div class="stat">最近更新 ${timeAgo(posts[0].date)}</div>` : ''}
          ${(CONFIG.pageviews || {}).showHomeStats !== false ? bszSiteStatsHtml() : ''}
        </div>
      </div>
      <span class="hero-arrow" aria-hidden="true">›</span>
    </a>
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
        <a class="carousel-slide${i === 0 ? ' active' : ''}" href="${postPathFromPost(p)}" aria-label="${escapeHtml(p.title || '文章')}">
          <img
            src="${escapeHtml(i === 0 ? publicImageUrl(p.cover) : LAZY_PLACEHOLDER)}"
            ${i === 0 ? 'fetchpriority="high"' : `data-src="${escapeHtml(publicImageUrl(p.cover))}" fetchpriority="low"`}
            alt="${escapeHtml(p.title || '')}"
            loading="${i === 0 ? 'eager' : 'lazy'}"
            decoding="async">
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

  root.querySelector('.prev').addEventListener('click', () => { setActive(current - 1); restartAuto(); });
  root.querySelector('.next').addEventListener('click', () => { setActive(current + 1); restartAuto(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { setActive(i); restartAuto(); }));

  // -------- 自动播放（鼠标悬停 / 触摸拖动期间暂停） --------
  let timer = null;
  const startAuto = () => {
    if (slides.length <= 1) return;
    stopAuto();
    timer = setInterval(() => setActive(current + 1), 4500);
  };
  const stopAuto = () => {
    if (timer) { clearInterval(timer); timer = null; }
  };
  const restartAuto = () => { stopAuto(); startAuto(); };
  startAuto();
  root.addEventListener('mouseenter', stopAuto);
  root.addEventListener('mouseleave', startAuto);

  // -------- 触摸 / 鼠标拖动手势（移动端核心需求） --------
  if (slides.length > 1) {
    const viewport = root.querySelector('.carousel-viewport');
    const SWIPE_DIST = 40;     // 至少滑这么多 px 才算切换
    const MAX_OFF_AXIS = 60;   // 纵向偏移大于这个就认为是滚页面，不是 swipe
    let startX = 0, startY = 0, startT = 0;
    let tracking = false;      // 当前正在按住跟踪手势
    let swiping = false;       // 这次按下是否构成"拖动"，用于阻止 <a> 的 click 跳转

    const begin = (x, y) => {
      tracking = true;
      swiping = false;
      startX = x; startY = y; startT = Date.now();
      stopAuto();
      viewport.classList.add('is-swiping');
    };
    const move = (x, y) => {
      if (!tracking) return;
      if (Math.abs(x - startX) > 8 && Math.abs(x - startX) > Math.abs(y - startY)) {
        swiping = true;
      }
    };
    const end = (x, y) => {
      if (!tracking) { startAuto(); return; }
      tracking = false;
      viewport.classList.remove('is-swiping');
      const dx = x - startX;
      const dy = y - startY;
      const dt = Date.now() - startT;
      // 横向位移够大 + 纵向位移没超 + 不是长按（< 800ms 内的快速滑）
      if (Math.abs(dx) >= SWIPE_DIST && Math.abs(dy) <= MAX_OFF_AXIS && dt < 800) {
        setActive(current + (dx < 0 ? 1 : -1));
      }
      startAuto();
    };

    // Pointer Events 覆盖现代移动端 + 桌面鼠标拖动
    if (window.PointerEvent) {
      viewport.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        begin(e.clientX, e.clientY);
      });
      viewport.addEventListener('pointermove', e => move(e.clientX, e.clientY));
      viewport.addEventListener('pointerup', e => end(e.clientX, e.clientY));
      viewport.addEventListener('pointercancel', () => {
        tracking = false; swiping = false;
        viewport.classList.remove('is-swiping');
        startAuto();
      });
    } else {
      // 旧 iOS Safari 等不支持 Pointer Events
      viewport.addEventListener('touchstart', e => {
        const t = e.changedTouches[0];
        begin(t.clientX, t.clientY);
      }, { passive: true });
      viewport.addEventListener('touchmove', e => {
        const t = e.changedTouches[0];
        move(t.clientX, t.clientY);
      }, { passive: true });
      viewport.addEventListener('touchend', e => {
        const t = e.changedTouches[0];
        end(t.clientX, t.clientY);
      }, { passive: true });
      viewport.addEventListener('touchcancel', () => {
        tracking = false; swiping = false;
        viewport.classList.remove('is-swiping');
        startAuto();
      });
    }

    // slide 是 <a>，如果刚才是 swipe 就不要触发跳转
    viewport.addEventListener('click', e => {
      if (!swiping) return;
      e.preventDefault();
      e.stopPropagation();
      swiping = false;
    }, true);
  }
}

const PAGE_SIZE = 15;

function postItemHtml(p, author, avatar) {
  return `
    <li class="post-item" data-slug="${escapeHtml(p.slug)}">
      <a class="post-content" href="${postPathFromPost(p)}">
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
      ${p.cover ? `<a href="${postPathFromPost(p)}" class="post-thumbnail"><img src="${LAZY_PLACEHOLDER}" data-src="${escapeHtml(publicImageUrl(p.thumbnail || p.cover))}" alt="${escapeHtml(p.title || '')}" loading="lazy" decoding="async" fetchpriority="low"></a>` : ''}
    </li>
  `;
}

// 懒加载状态：每次切 tab/筛选都会被替换
let listState = null;

function renderList(posts, tab = 'latest') {
  const ul = $('#postList');
  // 销毁上一次的观察器
  if (listState && listState.observer) listState.observer.disconnect();

  if (!posts.length) {
    const emptyMsg = tab === 'series'
      ? '暂无归入系列的文章（在文章 frontmatter 里设置 series 即可）'
      : '还没有文章。点击右上角"写文章"开始第一篇～';
    ul.innerHTML = `<li class="empty">${emptyMsg}</li>`;
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

  const state = { loaded: firstChunk.length, observer: null, loadNext: null };
  const sentinel = document.getElementById('loadMoreSentinel');

  function loadNext() {
    const nextChunk = posts.slice(state.loaded, state.loaded + PAGE_SIZE);
    if (!nextChunk.length) return;
    const frag = document.createElement('div');
    frag.innerHTML = nextChunk.map(p => postItemHtml(p, author, avatar)).join('');
    const inserted = [...frag.children];
    inserted.forEach(node => ul.insertBefore(node, sentinel));
    inserted.forEach(node => bindLazyImages(node, { eagerCount: 0 }));
    state.loaded += nextChunk.length;
    if (state.loaded >= posts.length) {
      // 全部加载完，把 sentinel 替换成"到底"提示
      if (state.observer) state.observer.disconnect();
      sentinel.outerHTML = `<li class="load-more-end">已经到底啦 · 共 ${posts.length} 篇</li>`;
    }
  }

  state.loadNext = loadNext;

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

  state.observer = observer;
  listState = state;
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
    <li><a href="${postPathFromPost(p)}">${escapeHtml(p.title || '无标题')}</a></li>
  `).join('');
}

function buildHomeList({ allPosts, tab, q, tag }) {
  let r = [...allPosts];
  if (tab === 'series') r = r.filter(p => String(p.series || '').trim());
  if (q) {
    const lq = q.toLowerCase();
    r = r.filter(p =>
      String(p.title || '').toLowerCase().includes(lq) ||
      String(p.summary || '').toLowerCase().includes(lq) ||
      (p.tags || []).some(t => String(t).toLowerCase().includes(lq))
    );
  }
  if (tag) r = r.filter(p => (p.tags || []).includes(tag));
  r.sort((a, b) => {
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (a.pinned && b.pinned && Number(a.pinnedOrder || 0) !== Number(b.pinnedOrder || 0)) {
      return Number(a.pinnedOrder || 9999) - Number(b.pinnedOrder || 9999);
    }
    return new Date(b.date || 0) - new Date(a.date || 0);
  });
  return r;
}

(async function init() {
  // 避免 hero 与 footer 各有一份站点 Saobby 图（会各请求一次、+2）
  initSite({ active: './', skipDuplicateSitePv: true });
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
    allPosts = (Array.isArray(data.posts) ? data.posts : []).filter(p => !p.draft && p.type !== 'note');
  } catch (e) {
    $('#postList').innerHTML = `<li class="error">加载文章列表失败：${escapeHtml(e.message)}</li>`;
    return;
  }

  renderHero(allPosts);
  renderCarousel(allPosts);
  renderTags(allPosts);
  renderRecent(allPosts);
  // hero-stats 是渲染完才出现的，重新触发一次（pageviews 内部幂等）
  initPageviews();

  let tab = 'latest';
  let activeTag = '';
  let pendingRestore = null;

  if (navEntryType() === 'back_forward') {
    try {
      const raw = sessionStorage.getItem(HOME_SCROLL_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (typeof o.y === 'number' && o.y >= 0 && Number.isFinite(o.y)) {
          pendingRestore = o;
          if (o.tab === 'latest' || o.tab === 'series' || o.tab === 'notes') tab = o.tab;
          else if (o.tab === 'hot' || o.tab === 'all') tab = 'latest';
          if (typeof o.tag === 'string') activeTag = o.tag;
        }
      }
    } catch {}
  } else {
    try { sessionStorage.removeItem(HOME_SCROLL_KEY); } catch {}
  }

  function refresh() {
    const ul = $('#postList');
    if (tab === 'notes') {
      if (listState && listState.observer) listState.observer.disconnect();
      listState = null;
      ul.classList.add('post-list--giscus');
      if (!isGiscusReady()) {
        ul.innerHTML = `<li class="empty">请先在后台启用 giscus 并填写完整配置。随笔内容通过评论发布（与 <a href="notes.html">随笔页</a> 同一条讨论）。</li>`;
      } else {
        ul.innerHTML = `
          <li class="home-giscus-only">
            <p class="home-notes-lead">这里是一处开放广场，谁都可以随手写几句想法。</p>
            <div class="home-notes-giscus" id="homeNotesGiscusRoot"></div>
          </li>`;
        const root = $('#homeNotesGiscusRoot');
        if (root) mountGiscusScript(root, notesFeedTerm());
      }
    } else {
      ul.classList.remove('post-list--giscus');
      const filtered = buildHomeList({ allPosts, tab, q: '', tag: activeTag });
      renderList(filtered, tab);
    }

    if (pendingRestore) {
      const pr = pendingRestore;
      pendingRestore = null;
      if (tab !== 'notes' && listState && typeof listState.loadNext === 'function') {
        const filtered = buildHomeList({ allPosts, tab, q: '', tag: activeTag });
        const targetLoaded = Math.min(
          Math.max(Number(pr.loaded) || PAGE_SIZE, PAGE_SIZE),
          filtered.length,
        );
        let guard = 0;
        while (listState.loaded < targetLoaded && guard++ < 250) {
          listState.loadNext();
        }
      }
      scheduleRestoreHomeScroll(pr.y);
    }
  }

  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      tab = el.dataset.tab;
      refresh();
    });
  });

  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });

  window.addEventListener('pagehide', () => {
    try {
      sessionStorage.setItem(HOME_SCROLL_KEY, JSON.stringify({
        y: window.scrollY || document.documentElement.scrollTop || 0,
        tab,
        tag: activeTag,
        loaded: listState && typeof listState.loaded === 'number' ? listState.loaded : PAGE_SIZE,
      }));
    } catch {}
  });

  refresh();
})();
