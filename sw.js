// ============================================================================
// Service Worker —— 离线阅读 + 静态资源 stale-while-revalidate
// 与 ?v=VERSION 的 cache-busting 协同：CACHE_NAME 用 release VERSION 区分批次
// ============================================================================

const SW_VERSION = '20260512120000';
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
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => ![STATIC_CACHE, PAGE_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 不要拦截 GitHub API、giscus、busuanzi、cdn 这些跨域 / 鉴权资源
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
    // 网络优先，失败则缓存兜底，最后给 offline.html
    event.respondWith(
      fetch(request).then(res => {
        const copy = res.clone();
        caches.open(PAGE_CACHE).then(c => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() =>
        caches.match(request).then(r => r || caches.match(OFFLINE_URL))
      )
    );
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

// 让页面在 deploy 后能立刻 reload 到新版本
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
