/**
 * Cloudflare Worker：为静态站点代理 GitHub Device Flow OAuth 请求。
 * GitHub 的 /login/device/code 与 /login/oauth/access_token 不支持浏览器 CORS，
 * 纯前端直接 fetch 会报 Failed to fetch，需经同源代理转发。
 *
 * 部署：在 workers/ 目录执行 wrangler deploy，并将路由绑定到
 *   https://你的域名/api/github-device/*
 */

const GITHUB_ENDPOINTS = {
  code: 'https://github.com/login/device/code',
  access_token: 'https://github.com/login/oauth/access_token',
};

async function proxyToGitHub(target, request) {
  const body = await request.text();
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const suffix = url.pathname.replace(/^\/api\/github-device\/?/, '');
    const target = GITHUB_ENDPOINTS[suffix];

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST' || !target) {
      return new Response('Not found', { status: 404 });
    }

    const res = await proxyToGitHub(target, request);
    const origin = request.headers.get('Origin');
    if (origin) {
      const headers = new Headers(res.headers);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Vary', 'Origin');
      return new Response(res.body, { status: res.status, headers });
    }
    return res;
  },
};
