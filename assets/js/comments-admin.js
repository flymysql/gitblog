// ============================================================================
// 后台「评论管理」：通过 CloudBase 托管 iframe 调用云函数（避免 CORS）
// ============================================================================

import { CONFIG } from './config.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';

const $ = sel => document.querySelector(sel);

function cloudbaseCfg() {
  return CONFIG.cloudbase || {};
}

function resolveAdminEmbedUrl() {
  const cfg = cloudbaseCfg();
  const envId = String(cfg.envId || '').trim();
  const region = String(cfg.region || 'ap-shanghai').trim() || 'ap-shanghai';
  const custom = String(cfg.embedUrl || '').trim();
  let url;
  if (custom) {
    url = new URL(custom);
    url.pathname = url.pathname.replace(/[^/]+$/, 'comments-admin-embed.html');
  } else {
    const base = String(cfg.embedBaseUrl || '').trim();
    if (!base) return null;
    url = new URL('comments-admin-embed.html', base.endsWith('/') ? base : `${base}/`);
  }
  url.searchParams.set('env', envId);
  url.searchParams.set('region', region);
  url.searchParams.set('fn', String(cfg.functionName || 'gitblog-comments').trim() || 'gitblog-comments');
  url.searchParams.set('siteUrl', String(CONFIG.site?.url || '').trim() || 'https://gitpull.cn');
  const mode = document.documentElement.getAttribute('data-mode') || 'light';
  url.searchParams.set('mode', mode);
  const assetVer = String(cfg.embedAssetVersion || '').trim();
  if (assetVer) url.searchParams.set('v', assetVer);
  return url.toString();
}

const EMBED_HINT = '请在站点设置填写 <code>embedBaseUrl</code>（<code>tcb hosting deploy</code> 输出的完整域名），并执行 <code>npm run cloudbase:deploy-embed</code> 部署评论嵌入页。';

function topActions() {
  return `
    <button class="btn btn-secondary" type="button" id="reloadComments">刷新</button>
    <button class="btn btn-secondary" type="button" id="clearSecretBtn">更换密钥</button>
  `;
}

function bindIframeControls(iframe) {
  $('#reloadComments')?.addEventListener('click', () => {
    iframe?.contentWindow?.postMessage({ type: 'gitblog-comments-admin-reload' }, '*');
  });
  $('#clearSecretBtn')?.addEventListener('click', () => {
    iframe?.contentWindow?.postMessage({ type: 'gitblog-comments-admin-clear-secret' }, '*');
  });
}

async function main() {
  const ctx = await mountAdminShell({ active: 'comments', title: '评论管理', actions: topActions() });
  if (!ctx) return;

  const cfg = cloudbaseCfg();
  if (!cfg.enabled || !cfg.envId) {
    ctx.content.innerHTML = `
      <section class="admin-empty-card">
        <h2>评论功能未启用</h2>
        <p>请先在站点设置中启用 CloudBase 评论并填写 envId。</p>
        <p style="margin-top:18px"><a class="btn btn-primary" href="settings.html">前往站点设置 →</a></p>
      </section>
    `;
    return;
  }

  const src = resolveAdminEmbedUrl();
  if (!src) {
    ctx.content.innerHTML = `<div class="comments-hint">${EMBED_HINT}</div>`;
    return;
  }

  ctx.content.innerHTML = `
    <div class="comments-admin-embed-wrap">
      <iframe
        class="comments-admin-embed-frame"
        title="评论管理"
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"
        src="${escapeHtml(src)}"
      ></iframe>
      <p class="settings-hint" style="margin-top:10px">评论管理页通过 CloudBase 托管域名加载，以避免免费版跨域限制。若空白或 404，请重新部署 <code>cloudbase/static</code>。</p>
    </div>
  `;

  const iframe = ctx.content.querySelector('.comments-admin-embed-frame');
  bindIframeControls(iframe);

  window.addEventListener('message', e => {
    if (e.source !== iframe?.contentWindow || !e.data) return;
    if (e.data.type === 'gitblog-comments-admin-height') {
      const h = Number(e.data.height);
      if (h > 0 && iframe) iframe.style.height = `${Math.min(Math.max(h, 360), 3200)}px`;
    }
  });
}

main();
