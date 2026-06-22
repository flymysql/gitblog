import { initSite } from './site.js';
import { setMeta, setJsonLd } from './seo.js';
import { CONFIG } from './config.js';

export function initToolPage({ title, description, path }) {
  initSite({ active: 'tools.html' });
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
];
