// ============================================================================
// 后台站点设置：在线编辑 assets/js/config.js
// ============================================================================

import { CONFIG } from './config.js';
import { readFile, writeFile } from './api.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';
import { PRESETS, applyTokenOverrides, applyCustomCss, setPreset } from './theme.js';

const THEME_TOKEN_FIELDS = [
  { key: 'primary',         label: '主色 / Primary',     type: 'color' },
  { key: 'primary-hover',   label: '主色 hover',         type: 'color' },
  { key: 'bg',              label: '背景 / Background',  type: 'color' },
  { key: 'bg-soft',         label: '次要背景',           type: 'color' },
  { key: 'bg-elev',         label: '凸起背景 / Card',    type: 'color' },
  { key: 'text-main',       label: '正文文字',           type: 'color' },
  { key: 'text-secondary',  label: '次要文字',           type: 'color' },
  { key: 'text-tertiary',   label: '提示文字',           type: 'color' },
  { key: 'border',          label: '边框',               type: 'color' },
  { key: 'border-strong',   label: '强调边框',           type: 'color' },
  { key: 'highlight',       label: '高亮 / mark',        type: 'color' },
  { key: 'radius',          label: '圆角',               type: 'text', placeholder: '6px' },
  { key: 'radius-lg',       label: '大圆角',             type: 'text', placeholder: '10px' },
  { key: 'font-sans',       label: '正文字体',           type: 'text', placeholder: '-apple-system, ...' },
  { key: 'font-mono',       label: '代码字体',           type: 'text', placeholder: 'Menlo, ...' },
];

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
  const el = $('#settingsStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'settings-status ' + kind;
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
    } else if (name === 'pageviews.saobby.extra') {
      // 由可视化编辑器渲染，避免在 hidden textarea 里塞出 [object Object] 字符串
      value = '';
    }

    if (el.type === 'checkbox') {
      el.checked = !!value;
    } else {
      el.value = value == null ? '' : String(value);
    }
  });
  renderNavEditor(config.site.nav || []);
  fillThemeTokens(config.theme && config.theme.tokens);
  renderSaobbyExtraEditor((config.pageviews && config.pageviews.saobby && config.pageviews.saobby.extra) || []);
}

function fillThemeTokens(tokens) {
  const t = tokens || {};
  THEME_TOKEN_FIELDS.forEach(f => {
    const el = document.querySelector(`[data-token="${f.key}"]`);
    if (!el) return;
    el.value = t[f.key] || '';
    const text = document.querySelector(`[data-token-text="${f.key}"]`);
    if (text) text.value = t[f.key] || '';
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
        config.site.nav = readVisualNav();
      } catch (e) {
        throw new Error('顶部导航设置错误：' + e.message);
      }
      return;
    }
    if (name === 'pageviews.saobby.extra') {
      try {
        setByPath(config, 'pageviews.saobby.extra', readSaobbyExtra());
      } catch (e) {
        throw new Error('saobby 额外计数器设置错误：' + e.message);
      }
      return;
    }

    const value = el.type === 'checkbox' ? el.checked : el.value.trim();
    setByPath(config, name, value);
  });

  // theme tokens（调色板）
  config.theme = config.theme || {};
  config.theme.tokens = readThemeTokens();

  normalizeConfig(config);
  validateConfig(config);
  return config;
}

function readThemeTokens() {
  const tokens = {};
  THEME_TOKEN_FIELDS.forEach(f => {
    const el = document.querySelector(`[data-token="${f.key}"]`);
    if (!el) return;
    // color input 无法真正清空：空值会被浏览器变成 #000000。
    // 因此颜色字段只以旁边的文本框为准；文本框为空 = 不覆盖预设。
    const textEl = document.querySelector(`[data-token-text="${f.key}"]`);
    const source = f.type === 'color' && textEl ? textEl : el;
    const v = (source.value || '').trim();
    if (v) tokens[f.key] = v;
  });
  return tokens;
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
  config.theme.preset = config.theme.preset || 'jianshu';
  config.theme.allowReaderPresetSwitch = config.theme.allowReaderPresetSwitch !== false;
  config.theme.tokens = config.theme.tokens && typeof config.theme.tokens === 'object' ? config.theme.tokens : {};
  config.theme.customCss = String(config.theme.customCss || '');
  config.analytics = config.analytics || { enabled: false, snippet: '' };
  config.pageviews = config.pageviews || { enabled: true, showHomeStats: true, showPostViews: true, showFooterStats: true };
  config.pageviews.saobby = config.pageviews.saobby || { site: { img: '', dashboard: '', label: '' }, extra: [] };
  config.pageviews.saobby.site = config.pageviews.saobby.site || { img: '', dashboard: '', label: '' };
  if (!Array.isArray(config.pageviews.saobby.extra)) config.pageviews.saobby.extra = [];
  config.pageviews.vercount = config.pageviews.vercount || { scriptSrc: '', label: '' };
  delete config.pageviews.provider;
  delete config.pageviews.articleProvider;
  delete config.pageviews.showListPostViews;
  if (config.pageviews.saobby.article) delete config.pageviews.saobby.article;
  config.share = config.share || { enabled: true, showInPosts: true, showInPages: false, qrcodeOfPage: true };
  config.share.enabled = config.share.enabled !== false;
  config.share.showInPosts = config.share.showInPosts !== false;
  config.share.showInPages = !!config.share.showInPages;
  config.share.qrcodeOfPage = config.share.qrcodeOfPage !== false;
  config.donate = config.donate || { enabled: false, title: '', wechat: '', alipay: '', paypal: '' };
  config.donate.enabled = !!config.donate.enabled;
  config.donate.title = String(config.donate.title || '').trim();
  config.donate.wechat = String(config.donate.wechat || '').trim();
  config.donate.alipay = String(config.donate.alipay || '').trim();
  config.donate.paypal = String(config.donate.paypal || '').trim();
  config.upload = config.upload || { preferWebp: true, webpQuality: 0.85, maxWidth: 1920 };
  config.upload.preferWebp = config.upload.preferWebp !== false;
  config.upload.webpQuality = Number(config.upload.webpQuality) || 0.85;
  config.upload.maxWidth = Number(config.upload.maxWidth) || 1920;
  config.auth = config.auth || {};
  config.auth.githubDeviceFlow = config.auth.githubDeviceFlow || { clientId: '', scope: 'repo read:user' };
  if (!['auto', 'light', 'dark'].includes(config.theme.default)) config.theme.default = 'auto';

  config.giscus.strict = String(config.giscus.strict ?? '0');
  config.giscus.reactionsEnabled = String(config.giscus.reactionsEnabled ?? '1');
  config.giscus.emitMetadata = String(config.giscus.emitMetadata ?? '0');
  config.giscus.inputPosition = config.giscus.inputPosition || 'top';
  config.giscus.notesTerm = String(config.giscus.notesTerm || 'gitblog-notes-feed').trim() || 'gitblog-notes-feed';
  config.analytics.enabled = !!config.analytics.enabled;
  config.analytics.snippet = String(config.analytics.snippet || '').trim();
  config.pageviews.enabled = config.pageviews.enabled !== false;
  config.pageviews.showHomeStats = config.pageviews.showHomeStats !== false;
  config.pageviews.showPostViews = config.pageviews.showPostViews !== false;
  config.pageviews.showFooterStats = config.pageviews.showFooterStats !== false;
  const site = config.pageviews.saobby.site;
  site.img = String(site.img || '').trim();
  site.dashboard = String(site.dashboard || '').trim();
  site.label = String(site.label || '总访问').trim() || '总访问';
  config.pageviews.vercount.scriptSrc = String(config.pageviews.vercount.scriptSrc || '').trim();
  config.pageviews.vercount.label = String(config.pageviews.vercount.label || '阅读').trim() || '阅读';
  config.pageviews.saobby.extra = config.pageviews.saobby.extra
    .map(it => ({
      name: String((it && it.name) || '').trim(),
      img: String((it && it.img) || '').trim(),
      dashboard: String((it && it.dashboard) || '').trim(),
    }))
    .filter(it => it.name || it.img || it.dashboard);
  config.auth.githubDeviceFlow.clientId = String(config.auth.githubDeviceFlow.clientId || '').trim();
  config.auth.githubDeviceFlow.scope = String(config.auth.githubDeviceFlow.scope || 'repo read:user').trim();
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
  if ($('#saveTop')) $('#saveTop').disabled = true;
  try {
    if (!state.sourceSha) await loadRemoteConfigSha();
    const source = toSource(config);
    const res = await writeFile(CONFIG_PATH, source, 'config: 更新站点设置', state.sourceSha);
    state.sourceSha = res && res.content && res.content.sha;
    state.current = config;
    setStatus('已保存', 'saved');
    showToast('设置已保存，Pages 重新部署后生效');
    alert('设置已保存。\n\nGitHub Pages 通常会在 30-120 秒后更新。若前台仍是旧配置，请强制刷新或在 URL 后加 ?v=' + Date.now());
  } catch (e) {
    console.error(e);
    setStatus('保存失败', 'error');
    alert('保存失败：\n\n' + (e.message || String(e)));
  } finally {
    $('#saveBtn').disabled = false;
    if ($('#saveTop')) $('#saveTop').disabled = false;
  }
}

function navRowHtml(item = {}, index = 0) {
  return `
    <div class="nav-editor-row" draggable="true" data-index="${index}">
      <span class="nav-row-handle" title="拖拽排序">☰</span>
      <label>名称 <input data-nav-field="name" value="${escapeHtml(item.name || '')}" placeholder="首页"></label>
      <label>链接 <input data-nav-field="href" value="${escapeHtml(item.href || '')}" placeholder="./"></label>
      <button type="button" class="btn btn-secondary nav-row-remove">删除</button>
    </div>
  `;
}

function renderNavEditor(nav) {
  const host = $('#navEditor');
  if (!host) return;
  const list = Array.isArray(nav) && nav.length ? nav : [{ name: '首页', href: './' }];
  host.innerHTML = list.map((item, i) => navRowHtml(item, i)).join('');
}

function readVisualNav() {
  const rows = [...document.querySelectorAll('.nav-editor-row')];
  const nav = rows.map(row => {
    const name = row.querySelector('[data-nav-field="name"]').value.trim();
    const href = row.querySelector('[data-nav-field="href"]').value.trim();
    return { name, href };
  }).filter(n => n.name || n.href);
  nav.forEach((n, i) => {
    if (!n.name || !n.href) throw new Error(`第 ${i + 1} 项缺少名称或链接`);
  });
  return nav;
}

function saobbyExtraRowHtml(item = {}, index = 0) {
  return `
    <div class="saobby-extra-row" data-index="${index}">
      <label>名称 <input data-saobby-field="name" value="${escapeHtml(item.name || '')}" placeholder="首页 / 关于 …"></label>
      <label>图片 URL <input data-saobby-field="img" value="${escapeHtml(item.img || '')}" placeholder="https://www.saobby.com/webcounter/..."></label>
      <label>控制面板 URL <input data-saobby-field="dashboard" value="${escapeHtml(item.dashboard || '')}" placeholder="https://www.saobby.com/webcounter_dashboard?key=..."></label>
      <button type="button" class="btn btn-secondary saobby-extra-remove">删除</button>
    </div>
  `;
}

function renderSaobbyExtraEditor(extras) {
  const host = $('#saobbyExtraEditor');
  if (!host) return;
  const list = Array.isArray(extras) ? extras : [];
  host.innerHTML = list.length
    ? list.map((it, i) => saobbyExtraRowHtml(it, i)).join('')
    : '<p class="settings-hint" style="margin:0">暂无额外计数器。点上方「添加计数器」即可新增。</p>';
}

function readSaobbyExtra() {
  const host = $('#saobbyExtraEditor');
  if (!host) return [];
  const rows = [...host.querySelectorAll('.saobby-extra-row')];
  return rows.map(row => {
    const name = row.querySelector('[data-saobby-field="name"]').value.trim();
    const img = row.querySelector('[data-saobby-field="img"]').value.trim();
    const dashboard = row.querySelector('[data-saobby-field="dashboard"]').value.trim();
    return { name, img, dashboard };
  }).filter(it => it.name || it.img || it.dashboard);
}

function bindSaobbyEditor() {
  const host = $('#saobbyExtraEditor');
  const addBtn = $('#addSaobbyExtra');
  if (!host || !addBtn) return;
  addBtn.addEventListener('click', () => {
    const empty = host.querySelector('p.settings-hint');
    if (empty) host.innerHTML = '';
    host.insertAdjacentHTML('beforeend', saobbyExtraRowHtml({}, host.querySelectorAll('.saobby-extra-row').length));
    setStatus('未保存', 'saving');
  });
  host.addEventListener('click', e => {
    const btn = e.target.closest('.saobby-extra-remove');
    if (!btn) return;
    btn.closest('.saobby-extra-row').remove();
    if (!host.querySelector('.saobby-extra-row')) {
      host.innerHTML = '<p class="settings-hint" style="margin:0">暂无额外计数器。点上方「添加计数器」即可新增。</p>';
    }
    setStatus('未保存', 'saving');
  });
}

function bindNavEditor() {
  const host = $('#navEditor');
  const addBtn = $('#addNavItem');
  if (!host || !addBtn) return;
  addBtn.addEventListener('click', () => {
    host.insertAdjacentHTML('beforeend', navRowHtml({}, host.querySelectorAll('.nav-editor-row').length));
    setStatus('未保存', 'saving');
  });
  host.addEventListener('click', e => {
    const btn = e.target.closest('.nav-row-remove');
    if (!btn) return;
    const rows = host.querySelectorAll('.nav-editor-row');
    if (rows.length <= 1) {
      alert('至少保留一个导航项');
      return;
    }
    btn.closest('.nav-editor-row').remove();
    setStatus('未保存', 'saving');
  });
  let dragging = null;
  host.addEventListener('dragstart', e => {
    const row = e.target.closest('.nav-editor-row');
    if (!row) return;
    dragging = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  host.addEventListener('dragend', () => {
    if (dragging) dragging.classList.remove('dragging');
    dragging = null;
  });
  host.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragging) return;
    const after = [...host.querySelectorAll('.nav-editor-row:not(.dragging)')]
      .find(row => e.clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2);
    if (after) host.insertBefore(dragging, after);
    else host.appendChild(dragging);
  });
  host.addEventListener('drop', () => setStatus('未保存', 'saving'));
}

function settingsContentHtml() {
  return `
    <div class="admin-toolbar">
      <span id="settingsStatus" class="settings-status">未保存</span>
      <div class="admin-toolbar-spacer"></div>
      <button class="btn btn-secondary" id="resetBtn">恢复当前配置</button>
      <button class="btn btn-primary" id="saveBtn">保存设置</button>
    </div>

    <form id="settingsForm" class="settings-form">
      <section class="settings-card">
        <h3>站点信息</h3>
        <div class="settings-grid">
          <label>站点名称 <input name="site.title" placeholder="我的博客"></label>
          <label>副标题 <input name="site.subtitle" placeholder="记录想法与代码"></label>
          <label>作者名 <input name="site.author" placeholder="作者"></label>
          <label>站点 URL <input name="site.url" placeholder="https://user.github.io/repo"></label>
          <label class="span-2">描述 <textarea name="site.description" rows="3" placeholder="一句话介绍你的博客"></textarea></label>
          <label>头像 URL <input name="site.avatar" placeholder="https://..."></label>
          <label>Logo URL <input name="site.logo" placeholder="可选，顶部导航图标"></label>
          <label>Favicon URL <input name="site.favicon" placeholder="可选，浏览器标签页图标"></label>
          <label>语言 <input name="site.locale" placeholder="zh-CN"></label>
        </div>
      </section>

      <section class="settings-card">
        <h3>仓库与权限</h3>
        <p class="settings-help">这里决定后台保存到哪个 GitHub 仓库。修改仓库名后，本次保存仍会写到当前仓库，下一次刷新后新配置才生效。</p>
        <div class="settings-grid">
          <label>owner <input name="repo.owner" placeholder="flymysql"></label>
          <label>repo name <input name="repo.name" placeholder="gitblog"></label>
          <label>branch <input name="repo.branch" placeholder="main"></label>
          <label class="span-2">后台白名单（逗号或换行分隔） <textarea name="authorizedUsers" rows="3" placeholder="flymysql"></textarea></label>
        </div>
      </section>

      <section class="settings-card">
        <h3>登录方式</h3>
        <p class="settings-help">默认仍保留 PAT 登录。若要启用 Device Flow，需要在 GitHub 创建 OAuth App，并把 Client ID 填到这里；scope 建议保留 <code>repo read:user</code>。</p>
        <div class="settings-grid">
          <label>Device Flow Client ID <input name="auth.githubDeviceFlow.clientId" placeholder="GitHub OAuth App Client ID"></label>
          <label>Device Flow Scope <input name="auth.githubDeviceFlow.scope" placeholder="repo read:user"></label>
        </div>
      </section>

      <section class="settings-card">
        <h3>导航与社交链接</h3>
        <div class="settings-grid">
          <label>GitHub <input name="site.social.github" placeholder="https://github.com/xxx"></label>
          <label>Twitter / X <input name="site.social.twitter" placeholder="https://x.com/xxx"></label>
          <label>Email <input name="site.social.email" placeholder="name@example.com"></label>
          <label>RSS <input name="site.social.rss" placeholder="rss.xml"></label>
          <div class="span-2 nav-editor-card">
            <div class="settings-row-title">
              <span>顶部导航</span>
              <button type="button" class="btn btn-secondary" id="addNavItem">添加导航</button>
            </div>
            <div class="nav-editor" id="navEditor"></div>
            <textarea name="site.nav" hidden></textarea>
            <p class="settings-help">可拖拽左侧手柄排序。链接可填 <code>./</code>、<code>tags.html</code> 或文章地址。</p>
          </div>
        </div>
      </section>

      <section class="settings-card">
        <h3>访问统计</h3>
        <p class="settings-help">可粘贴 Google Analytics、Umami、百度统计等公开脚本片段。它会注入到前台页面 <code>&lt;head&gt;</code>，不要放入任何密钥。</p>
        <div class="settings-grid">
          <label class="settings-check"><input type="checkbox" name="analytics.enabled"> 启用访问统计代码</label>
          <label class="span-2">统计代码片段 <textarea name="analytics.snippet" rows="7" spellcheck="false" placeholder="&lt;script async src=&quot;...&quot;&gt;&lt;/script&gt;"></textarea></label>
        </div>
      </section>

      <section class="settings-card">
        <h3>访问计数（前台展示）</h3>
        <p class="settings-help">本站固定为双通道：<b>Saobby</b> 统计站点总访问（首页 Hero / Footer 计数图）；<b>Vercount</b> 按页面 URL 统计每篇文章 / 独立页阅读（见 <a href="https://vercount.one" target="_blank" rel="noopener">vercount.one</a>）。二者互不影响。</p>
        <div class="settings-grid">
          <label class="settings-check"><input type="checkbox" name="pageviews.enabled"> 启用访问计数</label>
          <label class="settings-check"><input type="checkbox" name="pageviews.showHomeStats"> 首页 Hero 显示站点访问（Saobby）</label>
          <label class="settings-check"><input type="checkbox" name="pageviews.showPostViews"> 文章页显示阅读次数（Vercount）</label>
          <label class="settings-check"><input type="checkbox" name="pageviews.showFooterStats"> Footer 显示站点访问（Saobby）</label>
        </div>
      </section>

      <section class="settings-card">
        <h3>Saobby（站点总访问）</h3>
        <p class="settings-help">在 <a href="https://www.saobby.com/create_webcounter" target="_blank" rel="noopener">saobby.com</a> 创建计数器后，把图片 URL 与控制面板 URL 粘到下方。后台「访问数据」可 iframe 嵌入控制面板。</p>
        <div class="settings-grid">
          <label class="span-2">图片 URL <input name="pageviews.saobby.site.img" placeholder="https://www.saobby.com/webcounter/svg?id=..."></label>
          <label class="span-2">控制面板 URL <input name="pageviews.saobby.site.dashboard" placeholder="https://www.saobby.com/webcounter_dashboard?key=..."></label>
          <label>前缀文字 <input name="pageviews.saobby.site.label" placeholder="总访问"><span class="settings-hint">显示在计数图旁，例如「总访问」</span></label>
        </div>
        <div class="settings-row-title" style="margin-top:14px">
          <span>额外计数器（仅在后台「访问数据」展示）</span>
          <button type="button" class="btn btn-secondary" id="addSaobbyExtra">添加计数器</button>
        </div>
        <div class="saobby-extra-editor" id="saobbyExtraEditor"></div>
        <textarea name="pageviews.saobby.extra" hidden></textarea>
        <p class="settings-help">用于跟踪其它落地页的 Saobby 图（例如单独推广的页面）。</p>
      </section>

      <section class="settings-card">
        <h3>Vercount（文章 / 独立页阅读）</h3>
        <p class="settings-help">文章页会加载官方脚本并显示 <code>#vercount_value_page_pv</code>。留空脚本地址则使用默认 <code>https://events.vercount.one/js</code>；自托管请改成你的脚本 URL。统计需在 <a href="https://vercount.one" target="_blank" rel="noopener">vercount.one</a> 验证域名后查看。</p>
        <div class="settings-grid">
          <label class="span-2">脚本 URL（可选） <input name="pageviews.vercount.scriptSrc" placeholder="https://events.vercount.one/js"></label>
          <label>前缀文字 <input name="pageviews.vercount.label" placeholder="阅读"><span class="settings-hint">显示在数字前，例如「阅读」「浏览」</span></label>
        </div>
      </section>

      <section class="settings-card">
        <h3>分享 / 打赏</h3>
        <p class="settings-help">文章末尾是否展示分享按钮、二维码、打赏码。打赏图请上传后填写图片 URL。</p>
        <div class="settings-grid">
          <label class="settings-check"><input type="checkbox" name="share.enabled"> 启用文章分享卡</label>
          <label class="settings-check"><input type="checkbox" name="share.showInPosts"> 在文章里显示</label>
          <label class="settings-check"><input type="checkbox" name="share.showInPages"> 在独立页（关于等）显示</label>
          <label class="settings-check"><input type="checkbox" name="share.qrcodeOfPage"> 显示当前页 URL 二维码</label>
          <label class="settings-check"><input type="checkbox" name="donate.enabled"> 启用打赏区</label>
          <label class="span-2">打赏标题 <input type="text" name="donate.title" placeholder="如果这篇文章对你有帮助，请作者一杯咖啡 ☕️"></label>
          <label class="span-2">微信收款码 URL <input type="url" name="donate.wechat" placeholder="https://.../wechat-pay.png"></label>
          <label class="span-2">支付宝收款码 URL <input type="url" name="donate.alipay" placeholder="https://.../alipay.png"></label>
          <label class="span-2">PayPal 链接 <input type="url" name="donate.paypal" placeholder="https://paypal.me/yourname"></label>
        </div>
      </section>

      <section class="settings-card">
        <h3>图片上传策略</h3>
        <p class="settings-help">编辑器拖拽 / 粘贴图片时会按这里的规则自动优化（GIF / SVG 不会被改）。WebP 通常比 PNG / JPEG 小 30%~70%。</p>
        <div class="settings-grid">
          <label class="settings-check"><input type="checkbox" name="upload.preferWebp"> 自动转换为 WebP</label>
          <label>WebP 质量 <input type="number" name="upload.webpQuality" step="0.05" min="0.1" max="1.0">
            <span class="settings-hint">0.85 是接近无损的体积平衡点。0.7 起更激进、0.95 起更保真。</span>
          </label>
          <label>最大宽度（像素） <input type="number" name="upload.maxWidth" min="320" step="10">
            <span class="settings-hint">超过该宽度会自动缩放，保留比例。1920 适合大屏阅读。</span>
          </label>
        </div>
      </section>

      <section class="settings-card">
        <h3>评论（giscus）</h3>
        <p class="settings-help">需要先在 GitHub 仓库启用 Discussions，然后到 giscus.app 生成 repoId 和 categoryId。</p>
        <div class="settings-grid">
          <label class="settings-check"><input type="checkbox" name="giscus.enabled"> 启用 giscus 评论</label>
          <label>repo <input name="giscus.repo" placeholder="owner/repo"></label>
          <label>repoId <input name="giscus.repoId"></label>
          <label>category <input name="giscus.category"></label>
          <label>categoryId <input name="giscus.categoryId"></label>
          <label>mapping
            <input name="giscus.mapping" placeholder="specific">
            <span class="settings-hint">推荐 <code>specific</code>：每篇文章按 slug 独立绑定一个 Discussion；本站不要用 <code>pathname</code>/<code>url</code>，会让所有文章共用同一条评论流。</span>
          </label>
          <label>language <input name="giscus.lang" placeholder="zh-CN"></label>
          <label class="span-2">随笔讨论标识（notesTerm）
            <input name="giscus.notesTerm" placeholder="gitblog-notes-feed">
            <span class="settings-hint">首页「随笔」与「随笔」页面共用这一条 giscus 讨论（<code>data-term</code>）。须与 giscus 的 <code>specific</code> mapping 一致；首次留言后会自动创建讨论串。</span>
          </label>
      </section>

      <section class="settings-card">
        <h3>外观与主题</h3>
        <p class="settings-help">主题预设决定整套色板。下面的「调色板」会在预设之上做覆盖，留空则使用预设原色。所有改动会即时预览到当前页面。</p>
        <div class="settings-grid">
          <label>默认主题预设
            <select name="theme.preset">
              ${PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
            </select>
          </label>
          <label>默认明暗
            <select name="theme.default">
              <option value="auto">跟随系统</option>
              <option value="light">日间</option>
              <option value="dark">夜间</option>
            </select>
          </label>
          <label class="settings-check span-2">
            <input type="checkbox" name="theme.allowReaderPresetSwitch">
            允许读者在前台切换主题预设（关闭后只会用站长设置的主题）
          </label>
        </div>

        <div class="theme-preset-preview">
          ${PRESETS.map(p => `
            <button type="button" class="preset-card" data-preset-pick="${p.id}" title="预览 ${p.name}">
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

        <div class="theme-tokens-grid">
          ${THEME_TOKEN_FIELDS.map(f => `
            <label class="theme-token">
              <span class="theme-token-label">${escapeHtml(f.label)}</span>
              ${f.type === 'color' ? `
                <span class="theme-token-row">
                  <input type="color" data-token="${f.key}" value="#000000">
                  <input type="text"  data-token-text="${f.key}" placeholder="#hex 或 rgb()">
                  <button type="button" class="theme-token-clear" data-token-clear="${f.key}">清除</button>
                </span>
              ` : `
                <span class="theme-token-row">
                  <input type="text" data-token="${f.key}" placeholder="${escapeHtml(f.placeholder || '')}">
                  <button type="button" class="theme-token-clear" data-token-clear="${f.key}">清除</button>
                </span>
              `}
            </label>
          `).join('')}
        </div>

        <label class="theme-custom-css">
          <span class="settings-row-title"><span>自定义 CSS（注入到 &lt;head&gt;）</span><button type="button" class="btn btn-secondary" id="previewCustomCss">预览到当前页</button></span>
          <textarea name="theme.customCss" rows="8" spellcheck="false" placeholder=":root { --primary: #36a; }
.article-title { letter-spacing: 0.02em; }"></textarea>
          <p class="settings-help">仅在保存后才会持久。粘贴后点「预览到当前页」即可立刻体验。出错时只会影响样式，不影响功能。</p>
        </label>
      </section>

      <section class="settings-card">
        <h3>路径</h3>
        <div class="settings-grid">
          <label>文章目录 <input name="paths.posts" placeholder="posts"></label>
          <label>索引文件 <input name="paths.index" placeholder="data/posts.json"></label>
          <label>上传目录 <input name="paths.uploads" placeholder="assets/uploads"></label>
        </div>
      </section>
    </form>
  `;
}

function topActions() {
  return `<button class="btn btn-primary" id="saveTop">保存设置</button>`;
}

(async function init() {
  const ctx = await mountAdminShell({ active: 'settings', title: '站点设置', actions: topActions() });
  if (!ctx) return;

  ctx.content.innerHTML = settingsContentHtml();
  fillForm(state.current);
  bindNavEditor();
  bindSaobbyEditor();
  bindThemePanel();
  await loadRemoteConfigSha();

  $('#saveBtn').addEventListener('click', save);
  if ($('#saveTop')) $('#saveTop').addEventListener('click', save);
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('确定恢复为当前线上配置吗？未保存修改会丢失。')) {
      fillForm(state.current);
      // 还原线上的 token 实时预览
      applyTokenOverrides(state.current.theme && state.current.theme.tokens);
      applyCustomCss(state.current.theme && state.current.theme.customCss);
    }
  });

  $('#settingsForm').addEventListener('input', () => setStatus('未保存', 'saving'));
})();

function bindThemePanel() {
  // 1. 颜色选择器和文本输入双向同步 + 实时预览
  THEME_TOKEN_FIELDS.forEach(f => {
    const colorEl = document.querySelector(`[data-token="${f.key}"]`);
    const textEl  = document.querySelector(`[data-token-text="${f.key}"]`);
    if (!colorEl) return;
    if (f.type === 'color' && textEl) {
      // 不要把 color input 的默认 #000000 写回文本框。
      // 文本框为空代表“使用主题预设原色”，只有用户选色时才写入。
      colorEl.addEventListener('input', () => {
        textEl.value = colorEl.value;
        previewTokens();
      });
      textEl.addEventListener('input', () => {
        if (/^#[0-9a-fA-F]{3,8}$/.test(textEl.value.trim())) {
          colorEl.value = textEl.value.trim();
        }
        previewTokens();
      });
    } else {
      colorEl.addEventListener('input', previewTokens);
    }
    const clearBtn = document.querySelector(`[data-token-clear="${f.key}"]`);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (f.type !== 'color') colorEl.value = '';
        if (textEl) textEl.value = '';
        // 删除 inline 后退到 preset 默认
        document.documentElement.style.removeProperty('--' + f.key);
        previewTokens();
      });
    }
  });

  // 2. 主题预设：select 改动 / 直接点卡片，都立刻应用到当前页面
  const presetSelect = document.querySelector('select[name="theme.preset"]');
  if (presetSelect) {
    presetSelect.addEventListener('change', () => {
      setPreset(presetSelect.value);
      previewTokens();
      setStatus('未保存', 'saving');
    });
  }
  document.querySelectorAll('[data-preset-pick]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.presetPick;
      if (presetSelect) presetSelect.value = id;
      setPreset(id);
      previewTokens();
      setStatus('未保存', 'saving');
    });
  });

  // 3. 自定义 CSS 预览
  const previewBtn = $('#previewCustomCss');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      const ta = document.querySelector('textarea[name="theme.customCss"]');
      applyCustomCss(ta ? ta.value : '');
      showToast('自定义 CSS 已预览到当前页');
    });
  }
}

function previewTokens() {
  const tokens = readThemeTokens();
  applyTokenOverrides(tokens);
}
