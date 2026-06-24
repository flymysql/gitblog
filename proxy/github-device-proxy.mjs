#!/usr/bin/env node
/**
 * 通用 GitHub Device Flow 代理（零依赖，Node 18+）。
 *
 * GitHub OAuth 端点不支持浏览器 CORS，纯静态站点无法直连。
 * 若你有源站（nginx / 腾讯云 CDN 回源服务器等），可运行本脚本，
 * 再用 nginx 把 /api/github-device/* 反代到本服务。
 *
 * 启动：node proxy/github-device-proxy.mjs
 * 默认监听 127.0.0.1:8787
 *
 * nginx 示例：
 *   location /api/github-device/ {
 *     proxy_pass http://127.0.0.1:8787/api/github-device/;
 *     proxy_http_version 1.1;
 *     proxy_set_header Host $host;
 *   }
 *
 * 然后在 config.js 设置 auth.githubDeviceFlow.proxyBase = "/api/github-device"
 */

import http from 'node:http';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);

const GITHUB = {
  code: 'https://github.com/login/device/code',
  access_token: 'https://github.com/login/oauth/access_token',
};

async function proxyToGitHub(target, body) {
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  return {
    status: res.status,
    text: await res.text(),
    contentType: res.headers.get('Content-Type') || 'application/json; charset=utf-8',
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const suffix = url.pathname.replace(/^\/api\/github-device\/?/, '');
  const target = GITHUB[suffix];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST' || !target) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString('utf8');

  try {
    const upstream = await proxyToGitHub(target, body);
    const headers = {
      'Content-Type': upstream.contentType,
      'Cache-Control': 'no-store',
    };
    if (req.headers.origin) {
      headers['Access-Control-Allow-Origin'] = req.headers.origin;
      headers.Vary = 'Origin';
    }
    res.writeHead(upstream.status, headers);
    res.end(upstream.text);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad gateway: ' + (e.message || String(e)));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`GitHub Device Flow proxy listening on http://${HOST}:${PORT}`);
});
