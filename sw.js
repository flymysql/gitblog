// ============================================================================
// Service Worker —— 离线阅读 + 静态资源 stale-while-revalidate
// 与 ?v=VERSION 的 cache-busting 协同：CACHE_NAME 用 release VERSION 区分批次
// ============================================================================

const SW_VERSION = '20260514220000';
const STATIC_CACHE = `static-${SW_VERSION}`;
const PAGE_CACHE = `pages-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;

// 离线时降级到的 fallback 页（首次安装时预缓存）
const OFFLINE_URL = 'offline.html';

// 安装阶段预缓存关键文件，确保彻底离线也能至少打开首页和 offline.html
const PRECACHE_URLS = [
  './',
  'index.html',
  'tags.html',
  'archives.html',
  'series.html',
  'tools.html',
  'tool-air-conditioner.html',
  'notes.html',
  'post.html',
  'offline.html',
  'manifest.webmanifest',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      cache.addAll(PRECACHE_URLS.map(u => new Request(u, { cache: 'reload' }))).catch(() => {})
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
  const isHTML = request.mode === 'navigate' ||
                 (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(handleHtml(request, event));
    return;
  }

  // 静态资源：stale-while-revalidate
  if (/\.(?:css|js|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|json|xml|webmanifest)$/i.test(url.pathname)) {
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
  const cached = await matchHtmlShell(request);
  const network = (event.preloadResponse || Promise.resolve(null))
    .then(preload => preload || fetch(request))
    .then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(PAGE_CACHE).then(c => c.put(request, copy)).catch(() => {});
      }
      return res;
    });

  // 导航页最影响 DCL。已有缓存时立刻返回页面壳，后台静默更新，避免慢 304 卡住首屏。
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }

  // 首次访问且没有缓存时才等网络；最多等 2 秒，随后降级到离线页。
  return Promise.race([
    network.catch(() => null),
    delay(2000).then(() => null),
  ]).then(res => res || caches.match(OFFLINE_URL));
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
