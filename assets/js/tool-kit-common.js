import { initSite } from './site.js';
import { setMeta, setJsonLd } from './seo.js';
import { CONFIG } from './config.js';
import { isGiscusReady, mountGiscusScript } from './giscus-embed.js';

export const TOOLS_INDEX = 'tools/';

export function initToolPage({ title, description, path, giscusTerm, commentsHint }) {
  initSite({ active: TOOLS_INDEX });
  setMeta({ title, description, type: 'website' });
  const base = CONFIG.site.url || location.origin;
  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: title,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    url: `${base}/${path}`,
  });
  mountToolComments(giscusTerm || path.replace(/\.html$/i, ''), commentsHint);
}

/** 工具页底部 giscus 评论区（每页独立 Discussion term） */
export function mountToolComments(term, hint) {
  const host = document.getElementById('toolGiscus');
  if (!host) return;
  const section = host.closest('.tool-comments');
  if (section && hint) {
    const p = section.querySelector('p');
    if (p) p.textContent = hint;
  }
  if (!isGiscusReady()) {
    host.innerHTML = '<div class="tool-comments-hint">留言板未启用。可在后台设置里打开 giscus。</div>';
    return;
  }
  host.innerHTML = '<p class="tool-comments-loading" aria-live="polite">评论加载中…</p>';
  mountGiscusScript(host, term, { loading: 'eager' });
}

export function $(id) { return document.getElementById(id); }

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function copyText(text) {
  return navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

export function dateSeed(extra = '') {
  const d = new Date();
  const base = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 0;
  for (const c of base + extra) h = (Math.imul(31, h) + c.charCodeAt(0)) >>> 0;
  return h;
}

export function pick(arr, seed) {
  return arr[seed % arr.length];
}

export function renderKv(target, rows) {
  target.innerHTML = rows.map(([k, v]) =>
    `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v ?? '—'))}</dd></div>`
  ).join('');
}

export function setStatus(el, msg, ok = true) {
  el.textContent = msg;
  el.className = 'tool-kit-status' + (ok ? '' : ' is-error');
}

export const TOOL_PAGES = [
  { slug: 'tool-age', title: '年龄计算器', icon: '🎂' },
  { slug: 'tool-fortune', title: '今日运势', icon: '🎋' },
  { slug: 'tool-json', title: 'JSON 格式化', icon: '{ }' },
  { slug: 'tool-codec', title: '编解码', icon: '🔤' },
  { slug: 'tool-timestamp', title: '时间戳转换', icon: '⏱' },
  { slug: 'tool-regex', title: '正则测试', icon: '.*' },
  { slug: 'tool-qrcode', title: '二维码生成', icon: '▣' },
  { slug: 'tool-image', title: '图片压缩', icon: '🖼' },
  { slug: 'tool-network', title: '网络信息', icon: '🌐' },
  { slug: 'tool-farm-seed', title: '微信农场种子助手', icon: '🌾' },
];
