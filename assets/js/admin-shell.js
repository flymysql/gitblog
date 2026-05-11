// ============================================================================
// 后台公共外壳：左侧 sidebar + 顶部 bar + 鉴权 gate
// 用法：
//   import { mountAdminShell } from './admin-shell.js';
//   const ctx = await mountAdminShell({ active: 'posts', title: '文章管理' });
//   if (!ctx) return; // 未登录或未授权时由 shell 自动渲染对应界面
//   ctx.content.innerHTML = '...';
// ============================================================================

import { CONFIG } from './config.js';
import {
  loginWithToken,
  loginWithDeviceFlow,
  logout,
  isAuthorized,
  getToken,
  getUser,
  popReturnTo,
} from './auth.js';
import { initTheme, bindThemeToggle, themeToggleHtml } from './theme.js';

const $ = (sel, root = document) => root.querySelector(sel);

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const NAV = [
  { id: 'posts', name: '文章管理', href: './', icon: iconList() },
  { id: 'editor', name: '写文章', href: 'editor.html', icon: iconPen() },
  { id: 'images', name: '图片库', href: 'images.html', icon: iconImage() },
  { id: 'settings', name: '站点设置', href: 'settings.html', icon: iconCog() },
  { id: 'diagnose', name: '诊断', href: 'diagnose.html', icon: iconStethoscope() },
];

function iconList() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor"/></svg>`;
}
function iconPen() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
}
function iconCog() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 014.21 16.96l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 017.04 4.21l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;
}
function iconImage() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
}
function iconStethoscope() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v6a4 4 0 008 0V3"/><line x1="6" y1="3" x2="3" y2="3"/><line x1="14" y1="3" x2="11" y2="3"/><path d="M10 13a4 4 0 014 4v0a4 4 0 008 0v-3"/><circle cx="20" cy="9" r="2"/></svg>`;
}

function buildTokenCreateUrl() {
  const desc = encodeURIComponent(`Blog Admin - ${CONFIG.repo.owner}/${CONFIG.repo.name}`);
  return `https://github.com/settings/personal-access-tokens/new?description=${desc}&target_name=${encodeURIComponent(CONFIG.repo.owner)}`;
}

function showToast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 200);
  }, 2200);
}

function renderLogin(host) {
  const tokenUrl = buildTokenCreateUrl();
  host.innerHTML = `
    <div class="admin-page-fullscreen">
      <div class="login-wrap">
        <div class="login-card">
          <div class="logo">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0012 .3"/>
            </svg>
          </div>
          <h1>登录创作后台</h1>
          <p>粘贴你的 GitHub Personal Access Token，文章会以 commit 形式直接推到仓库。<br>
          <a href="${tokenUrl}" target="_blank" rel="noopener" style="color:var(--primary)">点这里生成 token →</a></p>
          <form id="loginForm" autocomplete="off" style="text-align:left">
            <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:6px">Personal Access Token</label>
            <div style="position:relative;margin-bottom:14px">
              <input type="password" id="tokenInput" placeholder="ghp_xxx 或 github_pat_xxx" required>
              <button type="button" id="togglePwd" tabindex="-1" class="icon-btn" style="position:absolute;right:4px;top:4px">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);margin-bottom:14px;cursor:pointer">
              <input type="checkbox" id="remember" checked> 在此设备保持登录
            </label>
            <button type="submit" class="btn-github" id="btnLogin">验证并登录</button>
            <button type="button" class="btn-device" id="btnDeviceLogin">使用 GitHub Device Flow 登录</button>
            <div id="deviceLoginBox" class="device-login-box" hidden></div>
            <div id="loginError" style="display:none;margin-top:12px;color:#d9534f;font-size:13px;text-align:center"></div>
          </form>
          <div class="login-warn">
            仅 ${escapeHtml((CONFIG.authorizedUsers || []).join('、') || '已配置的用户')} 可进入后台。<br>
            token 只保存在当前浏览器，不会上传到任何第三方。<br>
            遇到问题？<a href="diagnose.html" style="color:var(--primary)">打开诊断页</a>
          </div>
          <p style="margin-top:18px"><a href="../" style="color:var(--text-tertiary);font-size:12px">← 返回首页</a></p>
        </div>
      </div>
    </div>
  `;

  $('#togglePwd').addEventListener('click', () => {
    const t = $('#tokenInput');
    t.type = t.type === 'password' ? 'text' : 'password';
  });

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const $err = $('#loginError');
    const $btn = $('#btnLogin');
    $err.style.display = 'none';
    $btn.disabled = true;
    $btn.textContent = '验证中…';
    try {
      await loginWithToken($('#tokenInput').value, { remember: $('#remember').checked });
      const back = popReturnTo();
      if (back && back !== window.location.href) window.location.href = back;
      else window.location.reload();
    } catch (err) {
      $err.textContent = err.message || String(err);
      $err.style.display = '';
      $btn.disabled = false;
      $btn.textContent = '验证并登录';
    }
  });

  const deviceBtn = $('#btnDeviceLogin');
  const deviceBox = $('#deviceLoginBox');
  const deviceEnabled = !!(CONFIG.auth && CONFIG.auth.githubDeviceFlow && CONFIG.auth.githubDeviceFlow.clientId);
  if (!deviceEnabled) {
    deviceBtn.disabled = true;
    deviceBtn.title = '请先在 config.js / 后台设置中配置 auth.githubDeviceFlow.clientId';
  }
  deviceBtn.addEventListener('click', async () => {
    const $err = $('#loginError');
    $err.style.display = 'none';
    deviceBtn.disabled = true;
    deviceBtn.textContent = '等待 GitHub 授权…';
    try {
      await loginWithDeviceFlow({
        remember: $('#remember').checked,
        onCode: info => {
          deviceBox.hidden = false;
          deviceBox.innerHTML = `
            <div>在新页面输入验证码：</div>
            <strong>${escapeHtml(info.user_code)}</strong>
            <a href="${escapeHtml(info.verification_uri)}" target="_blank" rel="noopener">打开 GitHub 授权页面 →</a>
          `;
        },
      });
      const back = popReturnTo();
      if (back && back !== window.location.href) window.location.href = back;
      else window.location.reload();
    } catch (err) {
      $err.textContent = err.message || String(err);
      $err.style.display = '';
      deviceBtn.disabled = !deviceEnabled;
      deviceBtn.textContent = '使用 GitHub Device Flow 登录';
    }
  });
}

function renderUnauthorized(host) {
  const user = getUser();
  host.innerHTML = `
    <div class="admin-page-fullscreen">
      <div class="login-wrap">
        <div class="login-card">
          <div class="logo">!</div>
          <h1>没有权限</h1>
          <p>当前账号 <b>${escapeHtml(user ? user.login : '')}</b> 不在白名单内。<br>
          如果需要授权，请把你的 GitHub 用户名加入 <code>assets/js/config.js</code> 的 <code>authorizedUsers</code>。</p>
          <button class="btn-github" id="btnLogout">退出登录</button>
          <p style="margin-top:18px"><a href="../" style="color:var(--text-tertiary);font-size:12px">← 返回首页</a></p>
        </div>
      </div>
    </div>
  `;
  $('#btnLogout').addEventListener('click', () => logout(window.location.href));
}

function shellHtml({ active, title, actions = '' }) {
  const navItems = NAV.map(n => `
    <a class="admin-nav-item${n.id === active ? ' active' : ''}" href="${n.href}">
      <span class="admin-nav-icon">${n.icon}</span>
      <span>${n.name}</span>
    </a>
  `).join('');

  const user = getUser() || {};
  const avatar = user.avatar_url ? `<img class="admin-user-avatar" src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.login || '')}">` : `<span class="admin-user-avatar fallback">${escapeHtml((user.login || '?')[0])}</span>`;

  return `
    <div class="admin-shell">
      <div id="adminSidebarBackdrop" class="admin-sidebar-backdrop" hidden></div>
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="admin-sidebar-top">
          <a class="admin-brand" href="../">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.82 8 12 11.82 4.18 8 12 4.18zM4 9.27l7 3.5v7.46l-7-3.5V9.27zm9 10.96v-7.46l7-3.5v7.46l-7 3.5z"/></svg>
            <div class="admin-brand-text">
              <span class="admin-brand-title">${escapeHtml(CONFIG.site.title || '创作后台')}</span>
              <span class="admin-brand-sub">创作后台</span>
            </div>
          </a>
          <button id="adminSidebarClose" class="icon-btn admin-sidebar-close" type="button" aria-label="关闭菜单">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <nav class="admin-nav">${navItems}</nav>

        <div class="admin-sidebar-footer">
          <a class="admin-nav-item" href="../" target="_blank" title="在新标签页查看站点">
            <span class="admin-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></span>
            <span>查看站点</span>
          </a>
          <button class="admin-nav-item logout" id="adminLogoutBtn" type="button">
            <span class="admin-nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <div class="admin-main">
        <header class="admin-topbar">
          <button id="adminMenuBtn" class="icon-btn admin-menu-btn" type="button" aria-label="菜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="admin-topbar-title">
            <h1>${escapeHtml(title || '')}</h1>
          </div>
          <div class="admin-topbar-actions" id="adminTopActions">${actions}</div>
          <div class="admin-topbar-tools">
            <span id="adminThemeToggleHost"></span>
            <div class="admin-user">
              ${avatar}
              <span class="admin-user-name">${escapeHtml(user.login || '')}</span>
            </div>
          </div>
        </header>

        <main class="admin-content" id="adminContent"></main>
      </div>
    </div>
  `;
}

export async function mountAdminShell({ active = 'posts', title = '', actions = '' } = {}) {
  initTheme();
  document.title = `${title || '后台'} · ${CONFIG.site.title || ''}`.trim().replace(/^· /, '');

  const host = $('#app') || document.body;

  if (!getToken()) {
    renderLogin(host);
    return null;
  }
  if (!isAuthorized()) {
    renderUnauthorized(host);
    return null;
  }

  host.innerHTML = shellHtml({ active, title, actions });

  // 主题切换按钮
  const themeHost = $('#adminThemeToggleHost');
  if (themeHost) {
    themeHost.outerHTML = themeToggleHtml();
    bindThemeToggle();
  }

  $('#adminLogoutBtn').addEventListener('click', () => logout(window.location.href));

  // 移动端 sidebar 抽屉
  const sidebar = $('#adminSidebar');
  const backdrop = $('#adminSidebarBackdrop');
  const menuBtn = $('#adminMenuBtn');
  const closeBtn = $('#adminSidebarClose');
  const openSide = () => {
    sidebar.classList.add('is-open');
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const closeSide = () => {
    sidebar.classList.remove('is-open');
    backdrop.hidden = true;
    document.body.style.overflow = '';
  };
  if (menuBtn) menuBtn.addEventListener('click', openSide);
  if (closeBtn) closeBtn.addEventListener('click', closeSide);
  if (backdrop) backdrop.addEventListener('click', closeSide);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeSide();
  });

  return {
    content: $('#adminContent'),
    actions: $('#adminTopActions'),
    showToast,
  };
}

export { showToast };
