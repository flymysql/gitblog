// ============================================================================
// 主题：light / dark / auto（跟随系统）
// 在 <html> 上设置 data-theme，CSS 通过该属性切换变量
// 优先级：localStorage > config.theme.default > auto
// ============================================================================

import { CONFIG } from './config.js';

const KEY = 'blog_theme';

export function getStoredTheme() {
  return localStorage.getItem(KEY) || CONFIG.theme.default || 'auto';
}

export function applyTheme(t) {
  const html = document.documentElement;
  let resolved = t;
  if (t === 'auto') {
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    resolved = m.matches ? 'dark' : 'light';
  }
  html.setAttribute('data-theme', resolved);
  html.dataset.themeChoice = t;
}

export function setTheme(t) {
  localStorage.setItem(KEY, t);
  applyTheme(t);
  // 同步到 giscus 等内嵌组件
  notifyGiscus(t);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
}

export function cycleTheme() {
  const cur = getStoredTheme();
  const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light';
  setTheme(next);
  return next;
}

export function initTheme() {
  applyTheme(getStoredTheme());
  // 跟随系统变化
  const m = window.matchMedia('(prefers-color-scheme: dark)');
  m.addEventListener('change', () => {
    if (getStoredTheme() === 'auto') applyTheme('auto');
  });
}

function notifyGiscus(t) {
  const iframe = document.querySelector('iframe.giscus-frame');
  if (!iframe) return;
  const resolved = t === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t;
  iframe.contentWindow.postMessage(
    { giscus: { setConfig: { theme: resolved } } },
    'https://giscus.app'
  );
}

// 渲染主题切换按钮 SVG（三态）
export function themeToggleHtml() {
  return `
    <button id="themeToggle" class="icon-btn" title="切换主题" aria-label="切换主题">
      <svg class="icon-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
      <svg class="icon-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
      <svg class="icon-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 3v18M3 12a9 9 0 0 1 9-9v18a9 9 0 0 1-9-9z" fill="currentColor" stroke="none"/>
      </svg>
    </button>
  `;
}

export function bindThemeToggle(root = document) {
  const btn = root.querySelector('#themeToggle');
  if (!btn) return;
  btn.addEventListener('click', cycleTheme);
}
