/**
 * Cloudflare Pages Function：同源代理 GitHub Device Flow。
 * 若站点托管在 Cloudflare Pages，此文件会自动生效，无需单独部署 Worker。
 */

const GITHUB_ENDPOINTS = {
  code: 'https://github.com/login/device/code',
  access_token: 'https://github.com/login/oauth/access_token',
};

export async function onRequestPost(context) {
  const path = context.params.path;
  const target = GITHUB_ENDPOINTS[path];
  if (!target) {
    return new Response('Not found', { status: 404 });
  }

  const body = await context.request.text();
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
