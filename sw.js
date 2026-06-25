// ============================================================================
// Service Worker —— 离线阅读 + 静态资源 stale-while-revalidate
// 与 ?v=VERSION 的 cache-busting 协同：CACHE_NAME 用 release VERSION 区分批次
// ============================================================================

const SW_VERSION = '20260626235000';
const STATIC_CACHE = `static-${SW_VERSION}`;
const PAGE_CACHE = `pages-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;

// 离线时降级到的 fallback 页（首次安装时预缓存）
const OFFLINE_URL = 'offline.html';

const PRECACHE_ASSETS = [
  'assets/dist/common.min.css?v=20260626235000',
  'assets/dist/home.min.css?v=20260626235000',
  'assets/dist/post.min.css?v=20260626235000',
  'assets/dist/tools.min.css?v=20260626235000',
  'assets/dist/admin.min.css?v=20260626235000',
  'assets/dist/home.min.js?v=20260626235000',
  'assets/dist/post.min.js?v=20260626235000',
  'assets/dist/tags.min.js?v=20260626235000',
  'assets/dist/archives.min.js?v=20260626235000',
  'assets/dist/series.min.js?v=20260626235000',
  'assets/dist/notes.min.js?v=20260626235000',
  'assets/dist/tools.min.js?v=20260626235000',
  'assets/dist/tool-age.min.js?v=20260626235000',
  'assets/dist/tool-fortune.min.js?v=20260626235000',
  'assets/dist/tool-json.min.js?v=20260626235000',
  'assets/dist/tool-codec.min.js?v=20260626235000',
  'assets/dist/tool-timestamp.min.js?v=20260626235000',
  'assets/dist/tool-regex.min.js?v=20260626235000',
  'assets/dist/tool-qrcode.min.js?v=20260626235000',
  'assets/dist/tool-image.min.js?v=20260626235000',
  'assets/dist/tool-network.min.js?v=20260626235000',
  'assets/dist/tool-farm-seed.min.js?v=20260626235000',
  'assets/dist/tool-major.min.js?v=20260626235000',
];

// 安装阶段预缓存关键文件，确保彻底离线也能至少打开首页和 offline.html
const PRECACHE_URLS = [
  './',
  'index.html',
  'tags.html',
  'archives.html',
  'series.html',
  'tools/',
  'tools/index.html',
  'tools/tool-age.html',
  'tools/tool-fortune.html',
  'tools/tool-json.html',
  'tools/tool-codec.html',
  'tools/tool-timestamp.html',
  'tools/tool-regex.html',
  'tools/tool-qrcode.html',
  'tools/tool-image.html',
  'tools/tool-network.html',
  'tools/tool-air-conditioner.html',
  'tools/tool-farm-seed.html',
  'tools/tool-major.html',
  'notes.html',
  'post.html',
  'offline.html',
  'manifest.webmanifest',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll([...PRECACHE_URLS, ...PRECACHE_ASSETS].map(u => new Request(u, { cache: 'reload' }))).catch(() => {})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(() => {}) : null,
      caches.keys().then(keys =>
        Promise.all(keys
        .filter(k => ![STATIC_CACHE, PAGE_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k)))
      ),
    ]).then(() => self.clients.claim())
  );
});

// 不要拦截 GitHub API、giscus、Vercount events、cdn 等跨域资源
function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  // admin/* 写操作不要离线兜底（容易让用户以为发布成功了，其实还在本地）
  if (url.pathname.includes('/admin/')) return false;
  return true;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!shouldHandle(request)) return;

  const url = new URL(request.url);
  const pathname = url.pathname;

  // sw.js 本身必须 network-only，否则新版本无法下发
  if (/\/sw\.js$/i.test(pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  const isNonHtmlDocument = /\.xml$/i.test(pathname)
    || /\/robots\.txt$/i.test(pathname)
    || /\.txt$/i.test(pathname);

  const isHTML = !isNonHtmlDocument && (
    request.mode === 'navigate'
    || (request.headers.get('accept') || '').includes('text/html')
  );

  if (isHTML) {
    event.respondWith(handleHtml(request, event));
    return;
  }

  // 静态资源：stale-while-revalidate
  if (/\.(?:css|js|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|json|xml|txt|webmanifest)$/i.test(pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(request, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});

async function handleHtml(request, event) {
  const url = new URL(request.url);

  const network = (event.preloadResponse || Promise.resolve(null))
    .then(preload => preload || fetch(request))
    .then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(PAGE_CACHE).then(c => c.put(request, copy)).catch(() => {});
      }
      return res;
    });

  // 全部 HTML 导航 network-first，避免旧版壳缓存导致普通刷新看不到更新
  try {
    const res = await network;
    if (res && res.status === 200) return res;
  } catch { /* 离线回退 */ }

  const cached = await matchHtmlShell(request);
  return cached || caches.match(OFFLINE_URL);
}

function isPostArticlePath(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  return /\/post\/[^/]+(?:\/index\.html)?$/i.test(p);
}

/** 工具页迭代快，走 network-first，避免刷新仍命中旧版 HTML 壳 */
function isToolPagePath(pathname) {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  return p === '/tools' || p.startsWith('/tools/');
}

async function matchHtmlShell(request) {
  const direct = await caches.match(request);
  if (direct) return direct;

  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, '');
  if (path === '') path = '/';

  let postSlug = null;
  let m = path.match(/\/post\/([^/]+)\/index\.html$/);
  if (m) postSlug = m[1];
  else {
    m = path.match(/\/post\/([^/]+)\/?$/);
    if (m) postSlug = m[1];
  }
  if (postSlug) {
    let slug = postSlug;
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* 保持原样 */
    }
    const postKeys = [
      `post/${slug}/index.html`,
      `./post/${slug}/index.html`,
    ];
    for (const key of postKeys) {
      const hit = await caches.match(key);
      if (hit) return hit;
    }
  }

  const name = path.split('/').pop() || 'index.html';
  const shell = name === '' ? 'index.html' : name;

  // post.html?slug=xxx / tags.html#xxx 等：query/hash 不同仍共用同一 HTML 壳，只匹配该壳。
  // 切勿对 post.html 等回落到 index.html，否则微信等环境下会「点文章却看到首页」。
  const shellKeys = [shell, './' + shell];
  if (shell === 'index.html') {
    shellKeys.push('./', 'index.html');
  }
  for (const key of shellKeys) {
    const hit = await caches.match(key);
    if (hit) return hit;
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 让页面在 deploy 后能立刻 reload 到新版本
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
