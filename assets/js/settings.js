// ============================================================================
// 后台站点设置：在线编辑 assets/js/config.js
// ============================================================================

import { CONFIG, VERSION } from './config.js';
import { getToken, isAuthorized, rememberReturnTo } from './auth.js';
import { readFile, writeFile } from './api.js';

const CONFIG_PATH = 'assets/js/config.js';
const $ = sel => document.querySelector(sel);

const state = {
  current: clone(CONFIG),
  sourceSha: null,
};

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function setStatus(text, kind = '') {
  const el = $('#status');
  el.textContent = text;
  el.className = 'editor-status ' + kind;
}

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 200);
  }, 2600);
}

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function fillForm(config) {
  const form = $('#settingsForm');
  form.querySelectorAll('[name]').forEach(el => {
    const name = el.name;
    let value = getByPath(config, name);
    if (name === 'authorizedUsers') {
      value = (config.authorizedUsers || []).join('\n');
    } else if (name === 'site.nav') {
      value = JSON.stringify(config.site.nav || [], null, 2);
    }

    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else {
      el.value = value == null ? '' : String(value);
    }
  });
}

function readForm() {
  const config = clone(state.current);
  const form = $('#settingsForm');

  form.querySelectorAll('[name]').forEach(el => {
    const name = el.name;
    if (name === 'authorizedUsers') {
      config.authorizedUsers = splitList(el.value).map(s => s.toLowerCase());
      return;
    }
    if (name === 'site.nav') {
      try {
        const nav = JSON.parse(el.value || '[]');
        if (!Array.isArray(nav)) throw new Error('导航必须是数组');
        nav.forEach((n, i) => {
          if (!n || typeof n !== 'object' || !n.name || !n.href) {
            throw new Error(`第 ${i + 1} 项缺少 name 或 href`);
          }
        });
        config.site.nav = nav;
      } catch (e) {
        throw new Error('顶部导航 JSON 格式错误：' + e.message);
      }
      return;
    }

    const value = el.type === 'checkbox' ? el.checked : el.value.trim();
    setByPath(config, name, value);
  });

  normalizeConfig(config);
  validateConfig(config);
  return config;
}

function splitList(text) {
  return String(text || '')
    .split(/[\n,，]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeConfig(config) {
  config.site.url = String(config.site.url || '').replace(/\/+$/, '');
  config.site.social = config.site.social || {};
  config.paths = config.paths || {};
  config.giscus = config.giscus || {};
  config.theme = config.theme || { default: 'auto' };
  if (!['auto', 'light', 'dark'].includes(config.theme.default)) config.theme.default = 'auto';

  // giscus 使用字符串配置，避免第三方脚本 data-* 属性类型不一致
  config.giscus.strict = String(config.giscus.strict ?? '0');
  config.giscus.reactionsEnabled = String(config.giscus.reactionsEnabled ?? '1');
  config.giscus.emitMetadata = String(config.giscus.emitMetadata ?? '0');
  config.giscus.inputPosition = config.giscus.inputPosition || 'top';
}

function validateConfig(config) {
  const required = [
    ['repo.owner', config.repo.owner],
    ['repo.name', config.repo.name],
    ['repo.branch', config.repo.branch],
    ['site.title', config.site.title],
    ['site.url', config.site.url],
    ['paths.posts', config.paths.posts],
    ['paths.index', config.paths.index],
    ['paths.uploads', config.paths.uploads],
  ];
  const missing = required.filter(([, v]) => !String(v || '').trim()).map(([k]) => k);
  if (missing.length) throw new Error('以下配置不能为空：' + missing.join(', '));
  if (!/^https?:\/\//.test(config.site.url)) {
    throw new Error('site.url 必须是完整 URL，例如 https://flymysql.github.io/gitblog');
  }
}

function toSource(config) {
  const version = makeVersion();
  return `// ============================================================================
// 公共配置 —— 可在后台 /admin/settings.html 在线编辑
// 这里都是公开信息，不要把 token 等密钥放进来
// ============================================================================

export const VERSION = '${version}';

export const CONFIG = ${stableStringify(config, 0)};
`;
}

function makeVersion() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

function stableStringify(obj, indent = 0) {
  // 生成更适合人工阅读的 JS object literal；配置里只含 JSON 数据
  const space = '  '.repeat(indent);
  const next = '  '.repeat(indent + 1);
  if (Array.isArray(obj)) {
    if (!obj.length) return '[]';
    if (obj.every(v => v == null || ['string', 'number', 'boolean'].includes(typeof v))) {
      return `[${obj.map(formatValue).join(', ')}]`;
    }
    return `[\n${obj.map(v => `${next}${stableStringify(v, indent + 1)}`).join(',\n')}\n${space}]`;
  }
  if (obj && typeof obj === 'object') {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    if (!entries.length) return '{}';
    return `{\n${entries.map(([k, v]) => `${next}${safeKey(k)}: ${stableStringify(v, indent + 1)}`).join(',\n')}\n${space}}`;
  }
  return formatValue(obj);
}

function formatValue(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v === null) return 'null';
  return JSON.stringify(v);
}

function safeKey(k) {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
}

async function loadRemoteConfigSha() {
  try {
    const file = await readFile(CONFIG_PATH);
    state.sourceSha = file && file.sha;
  } catch (e) {
    console.warn('load config sha failed', e);
  }
}

async function save() {
  let config;
  try {
    config = readForm();
  } catch (e) {
    alert(e.message);
    return;
  }

  if (!confirm('确定保存站点设置吗？\n\n这会提交一次 commit，更新 assets/js/config.js。')) return;

  setStatus('保存中…', 'saving');
  $('#saveBtn').disabled = true;
  $('#saveTop').disabled = true;
  try {
    if (!state.sourceSha) await loadRemoteConfigSha();
    const source = toSource(config);
    const res = await writeFile(CONFIG_PATH, source, 'config: 更新站点设置', state.sourceSha);
    state.sourceSha = res && res.content && res.content.sha;
    state.current = config;
    setStatus('已保存', 'saved');
    toast('设置已保存，Pages 重新部署后生效');
    alert('设置已保存。\n\nGitHub Pages 通常会在 30-120 秒后更新。若前台仍是旧配置，请强制刷新或在 URL 后加 ?v=' + Date.now());
  } catch (e) {
    console.error(e);
    setStatus('保存失败', 'error');
    alert('保存失败：\n\n' + (e.message || String(e)));
  } finally {
    $('#saveBtn').disabled = false;
    $('#saveTop').disabled = false;
  }
}

function gate() {
  if (!getToken()) {
    rememberReturnTo(window.location.href);
    window.location.href = './';
    return false;
  }
  if (!isAuthorized()) {
    alert('当前账号不在白名单内，无法修改设置');
    window.location.href = './';
    return false;
  }
  return true;
}

async function init() {
  if (!gate()) return;
  document.title = `站点设置 · ${CONFIG.site.title}`;
  fillForm(state.current);
  await loadRemoteConfigSha();

  $('#saveBtn').addEventListener('click', save);
  $('#saveTop').addEventListener('click', save);
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('确定恢复为当前线上配置吗？未保存修改会丢失。')) fillForm(state.current);
  });

  $('#settingsForm').addEventListener('input', () => setStatus('未保存', 'saving'));
}

init();
