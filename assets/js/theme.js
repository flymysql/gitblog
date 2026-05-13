// ============================================================================
// 主题：预设 (preset) + 明暗 (mode) + token 覆盖 + 自定义 CSS 注入
// 在 <html> 上同时设置：
//   data-preset="jianshu | github | solarized | monokai | <自定义>"
//   data-mode="light | dark"
//   data-theme="light | dark"          ← 兼容旧选择器
//   data-theme-choice="auto | light | dark"  ← 表示用户选择
// 优先级：localStorage > config.theme.preset / theme.default
// ============================================================================

import { CONFIG } from './config.js';

const KEY_MODE = 'blog_theme';     // 兼容旧 key：'auto' | 'light' | 'dark'
const KEY_PRESET = 'blog_preset';

export const PRESETS = [
  { id: 'jianshu',   name: '简书暖橘',  primary: '#EA6F5A', bg: '#FFFFFF', darkBg: '#131316', tag: '默认 / 适合写作' },
  { id: 'github',    name: 'GitHub',    primary: '#0969DA', bg: '#FFFFFF', darkBg: '#0D1117', tag: '冷静 / 文档风' },
  { id: 'solarized', name: 'Solarized', primary: '#CB4B16', bg: '#FDF6E3', darkBg: '#002B36', tag: '低对比 / 护眼' },
  { id: 'monokai',   name: 'Monokai',   primary: '#F92672', bg: '#F9F8F5', darkBg: '#1E1F1C', tag: '高对比 / 代码党' },
];

function configTheme() {
  return CONFIG.theme || {};
}

function configAllowReaderSwitch() {
  return configTheme().allowReaderPresetSwitch !== false;
}

function isAdminPath() {
  // 后台始终允许切换 preset，不受 allowReaderPresetSwitch 限制
  return /\/admin(\/|$)/.test(window.location.pathname);
}

// ---------- 状态读取 ----------
export function getStoredMode() {
  return localStorage.getItem(KEY_MODE) || configTheme().default || 'auto';
}
export function getStoredPreset() {
  return localStorage.getItem(KEY_PRESET) || '';
}
export function getEffectivePreset() {
  const stored = getStoredPreset();
  if (isAdminPath() || configAllowReaderSwitch()) {
    return stored || configTheme().preset || 'jianshu';
  }
  return configTheme().preset || 'jianshu';
}
export function resolveMode(choice) {
  if (choice === 'auto' || !choice) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return choice === 'dark' ? 'dark' : 'light';
}

// ---------- 应用 ----------
function applyMode(choice) {
  const mode = resolveMode(choice);
  const html = document.documentElement;
  html.setAttribute('data-mode', mode);
  html.setAttribute('data-theme', mode); // 兼容旧 [data-theme="dark"] 选择器
  html.dataset.themeChoice = choice || 'auto';
  notifyGiscus(mode);
  document.dispatchEvent(new CustomEvent('themechange', { detail: { mode, choice } }));
}

function applyPreset(id) {
  const html = document.documentElement;
  html.setAttribute('data-preset', id);
  document.dispatchEvent(new CustomEvent('themepresetchange', { detail: { preset: id } }));
}

export function applyTokenOverrides(tokens) {
  const root = document.documentElement;
  // 清掉之前的覆盖
  const prev = root.getAttribute('data-token-keys');
  if (prev) prev.split(',').forEach(k => k && root.style.removeProperty(k));
  if (!tokens || typeof tokens !== 'object') {
    root.removeAttribute('data-token-keys');
    return;
  }
  const applied = [];
  Object.entries(tokens).forEach(([k, v]) => {
    if (v == null || v === '') return;
    const cssVar = k.startsWith('--') ? k : '--' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    root.style.setProperty(cssVar, String(v));
    applied.push(cssVar);
  });
  root.setAttribute('data-token-keys', applied.join(','));
}

export function applyCustomCss(css) {
  let el = document.getElementById('blog-custom-css');
  if (!css) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = 'blog-custom-css';
    document.head.appendChild(el);
  }
  el.textContent = String(css);
}

// ---------- 公共 API ----------
export function setMode(choice) {
  localStorage.setItem(KEY_MODE, choice);
  applyMode(choice);
}
export function cycleMode() {
  const cur = getStoredMode();
  const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light';
  setMode(next);
  return next;
}
export function setPreset(id) {
  if (!id) return;
  localStorage.setItem(KEY_PRESET, id);
  applyPreset(id);
}

export function initTheme() {
  // 1. preset
  applyPreset(getEffectivePreset());
  // 2. mode（FOUC inline 脚本可能已经设过，这里保证逻辑一致）
  applyMode(getStoredMode());
  // 3. config 里的全局 token 覆盖（站长配置）
  applyTokenOverrides(configTheme().tokens);
  // 4. 自定义 CSS 注入
  applyCustomCss(configTheme().customCss);
  // 5. 跟随系统切换
  const m = window.matchMedia('(prefers-color-scheme: dark)');
  m.addEventListener('change', () => {
    if (getStoredMode() === 'auto') applyMode('auto');
  });
}

// ---------- giscus 同步 ----------
function notifyGiscus(mode) {
  const theme = mode === 'dark' ? 'dark' : 'light';
  document.querySelectorAll('iframe.giscus-frame').forEach(iframe => {
    try {
      iframe.contentWindow.postMessage(
        { giscus: { setConfig: { theme } } },
        'https://giscus.app'
      );
    } catch {
      /* cross-origin / 未就绪 */
    }
  });
}

// ---------- 顶部导航主题按钮 ----------
export function themeToggleHtml() {
  const showPicker = isAdminPath() || configAllowReaderSwitch();
  return `
    <button id="themeToggle" class="icon-btn" title="切换日 / 月 / 自动" aria-label="切换日 / 月 / 自动">
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
    ${showPicker ? `<button id="presetToggle" class="icon-btn" title="选择主题" aria-label="选择主题">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 21a9 9 0 1 0-9-9c0 5 4 5 6 4s2-2 1-3-1-2 1-2 4 0 4-3" fill="currentColor" stroke="none" opacity="0.85"/>
      </svg>
    </button>` : ''}
  `;
}

export function bindThemeToggle(root = document) {
  const modeBtn = root.querySelector('#themeToggle');
  if (modeBtn && !modeBtn.dataset.bound) {
    modeBtn.dataset.bound = '1';
    modeBtn.addEventListener('click', cycleMode);
  }
  const presetBtn = root.querySelector('#presetToggle');
  if (presetBtn && !presetBtn.dataset.bound) {
    presetBtn.dataset.bound = '1';
    presetBtn.addEventListener('click', openPresetPicker);
  }
}

// ---------- 主题选择器弹层 ----------
function openPresetPicker() {
  const exist = document.getElementById('presetPickerLayer');
  if (exist) { exist.remove(); return; }
  const layer = document.createElement('div');
  layer.id = 'presetPickerLayer';
  layer.className = 'preset-picker-layer';

  const currentPreset = document.documentElement.getAttribute('data-preset') || 'jianshu';
  const choice = getStoredMode();

  layer.innerHTML = `
    <div class="preset-picker-panel" role="dialog" aria-label="选择主题">
      <div class="preset-picker-title">
        选择主题
        <button class="close-x" type="button" aria-label="关闭">×</button>
      </div>
      <div class="preset-picker-mode">
        <button data-mode="light" class="${choice === 'light' ? 'active' : ''}">日间</button>
        <button data-mode="dark"  class="${choice === 'dark'  ? 'active' : ''}">夜间</button>
        <button data-mode="auto"  class="${choice === 'auto'  ? 'active' : ''}">跟随系统</button>
      </div>
      <div class="preset-picker-grid">
        ${PRESETS.map(p => `
          <button class="preset-card ${p.id === currentPreset ? 'active' : ''}" data-preset="${p.id}" type="button">
            <span class="preset-swatch" style="background:linear-gradient(135deg, ${p.bg} 50%, ${p.darkBg} 50%)">
              <span class="preset-dot" style="background:${p.primary}"></span>
            </span>
            <span class="preset-meta">
              <span class="preset-name">${p.name}</span>
              <span class="preset-tag">${p.tag}</span>
            </span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(layer);

  const close = () => {
    layer.remove();
    document.removeEventListener('keydown', escClose);
  };
  function escClose(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', escClose);

  layer.addEventListener('click', e => {
    if (e.target === layer) return close();
    const closeBtn = e.target.closest('.close-x');
    if (closeBtn) return close();
    const presetBtn = e.target.closest('[data-preset]');
    if (presetBtn) {
      setPreset(presetBtn.dataset.preset);
      layer.querySelectorAll('.preset-card').forEach(c =>
        c.classList.toggle('active', c.dataset.preset === presetBtn.dataset.preset)
      );
      return;
    }
    const modeBtn = e.target.closest('[data-mode]');
    if (modeBtn) {
      setMode(modeBtn.dataset.mode);
      layer.querySelectorAll('.preset-picker-mode button').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === modeBtn.dataset.mode)
      );
      return;
    }
  });
}

// ---------- 兼容旧 API ----------
export const setTheme = setMode;
export const cycleTheme = cycleMode;
export const getStoredTheme = getStoredMode;
export const applyTheme = applyMode;
