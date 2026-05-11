// ============================================================================
// 后台首页：登录 + 文章管理（已发布 / 草稿 tab）
// ============================================================================

import { CONFIG } from './config.js';
import { loginWithToken, logout, isAuthorized, getToken, getUser, popReturnTo } from './auth.js';
import { readIndex, fetchIndexPublic, deleteFile, readFile, writeIndex } from './api.js';
import { initTheme, bindThemeToggle, themeToggleHtml } from './theme.js';

const $ = sel => document.querySelector(sel);

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

function renderThemeToggle() {
  const host = $('#themeToggleHost');
  if (!host) return;
  host.outerHTML = themeToggleHtml();
  bindThemeToggle();
}

function renderLogin() {
  $('#navActions').innerHTML = '';
  const tokenUrl = buildTokenCreateUrl();
  $('#main').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="logo">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A12 12 0 0012 .3"/>
          </svg>
        </div>
        <h1>登录后台</h1>
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
          <div id="loginError" style="display:none;margin-top:12px;color:#d9534f;font-size:13px;text-align:center"></div>
        </form>
        <div class="login-warn">
          仅 ${escapeHtml((CONFIG.authorizedUsers || []).join('、') || '已配置的用户')} 可进入后台。<br>
          token 只保存在当前浏览器，不会上传到任何第三方。<br>
          遇到问题？<a href="diagnose.html" style="color:var(--primary)">打开诊断页</a>
        </div>
      </div>
    </div>
  `;

  const $form = $('#loginForm');
  const $token = $('#tokenInput');
  const $err = $('#loginError');
  const $btn = $('#btnLogin');

  $('#togglePwd').addEventListener('click', () => {
    $token.type = $token.type === 'password' ? 'text' : 'password';
  });

  $form.addEventListener('submit', async e => {
    e.preventDefault();
    $err.style.display = 'none';
    $btn.disabled = true;
    $btn.textContent = '验证中…';
    try {
      await loginWithToken($token.value, { remember: $('#remember').checked });
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
}

function renderUnauthorized() {
  const user = getUser();
  $('#main').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="logo">!</div>
        <h1>没有权限</h1>
        <p>当前账号 <b>${escapeHtml(user ? user.login : '')}</b> 不在白名单内。<br>
        如果需要授权，请把你的 GitHub 用户名加入 <code>assets/js/config.js</code> 的 <code>authorizedUsers</code>。</p>
        <button class="btn-github" id="btnLogout">退出登录</button>
      </div>
    </div>
  `;
  $('#btnLogout').addEventListener('click', () => logout(window.location.href));
}

function renderHeaderUser() {
  const user = getUser();
  $('#navActions').innerHTML = `
    <a class="btn-write" href="editor.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
      新建文章
    </a>
    <div class="nav-avatar" style="background-image:url(${escapeHtml(user && user.avatar_url || '')});width:32px;height:32px;border-radius:50%;background-size:cover" title="${escapeHtml(user ? user.login : '')}"></div>
    <button class="btn-ghost" id="btnLogout">退出</button>
  `;
  $('#btnLogout').addEventListener('click', () => logout(window.location.href));
}

async function renderDashboard() {
  renderHeaderUser();
  $('#main').innerHTML = `
    <div class="admin-layout">
      <div class="admin-toolbar">
        <h2>文章管理</h2>
        <div class="admin-tabs">
          <button data-tab="all" class="active">全部</button>
          <button data-tab="published">已发布</button>
          <button data-tab="draft">草稿</button>
        </div>
        <input class="search-input" id="search" placeholder="搜索标题或标签">
        <a class="btn btn-primary" href="editor.html">+ 新建</a>
      </div>
      <div class="admin-list" id="list">
        <div class="loading">加载中…</div>
      </div>
    </div>
  `;

  let posts = [];
  try {
    const idx = await readIndex();
    if (idx) {
      posts = Array.isArray(idx.data.posts) ? idx.data.posts : [];
    } else {
      const data = await fetchIndexPublic();
      posts = Array.isArray(data.posts) ? data.posts : [];
    }
  } catch (e) {
    $('#list').innerHTML = `<div class="error">加载失败：${escapeHtml(e.message)}</div>`;
    return;
  }

  let currentTab = 'all';
  let currentQuery = '';

  function refresh() {
    const list = $('#list');
    let filtered = [...posts];
    if (currentTab === 'published') filtered = filtered.filter(p => !p.draft);
    else if (currentTab === 'draft') filtered = filtered.filter(p => !!p.draft);
    if (currentQuery) {
      const lq = currentQuery.toLowerCase();
      filtered = filtered.filter(p =>
        String(p.title || '').toLowerCase().includes(lq) ||
        (p.tags || []).some(t => String(t).toLowerCase().includes(lq))
      );
    }
    filtered.sort((a, b) => {
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.date || 0) - new Date(a.date || 0);
    });

    if (!filtered.length) {
      list.innerHTML = '<div class="empty">没有匹配的文章</div>';
      return;
    }
    list.innerHTML = `
      <div class="admin-row head">
        <div>标题</div>
        <div>更新时间</div>
        <div>标签</div>
        <div>状态</div>
        <div style="text-align:right">操作</div>
      </div>
      ${filtered.map(p => `
        <div class="admin-row" data-slug="${escapeHtml(p.slug)}">
          <div class="title">
            ${p.pinned ? '<span class="badge pinned">置顶</span>' : ''}
            ${escapeHtml(p.title || '无标题')}
          </div>
          <div class="meta">${fmtDate(p.updated || p.date)}</div>
          <div class="meta">${(p.tags || []).slice(0, 2).map(t => '#' + escapeHtml(t)).join(' ') || '—'}</div>
          <div class="meta">${p.draft ? '<span class="badge draft">草稿</span>' : '已发布'}</div>
          <div class="actions">
            ${p.draft ? '' : `<a href="../post.html?slug=${encodeURIComponent(p.slug)}" target="_blank">查看</a>`}
            <a href="editor.html?slug=${encodeURIComponent(p.slug)}">编辑</a>
            <button class="danger" data-action="delete" data-slug="${escapeHtml(p.slug)}">删除</button>
          </div>
        </div>
      `).join('')}
    `;
  }

  refresh();

  $('#search').addEventListener('input', e => {
    currentQuery = e.target.value.trim();
    refresh();
  });

  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      refresh();
    });
  });

  $('#list').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action="delete"]');
    if (!btn) return;
    const slug = btn.dataset.slug;
    const item = posts.find(p => p.slug === slug);
    if (!item) return;
    if (!confirm(`确定删除「${item.title || slug}」吗？此操作会从仓库 commit 一次删除。`)) return;
    btn.disabled = true;
    btn.textContent = '删除中…';
    try {
      const path = item.path || `${CONFIG.paths.posts}/${slug}.md`;
      const file = await readFile(path);
      if (file) {
        await deleteFile(path, file.sha, `post: 删除 ${item.title || slug}`);
      }
      const idx = await readIndex();
      const data = idx ? idx.data : { posts };
      data.posts = (data.posts || []).filter(p => p.slug !== slug);
      await writeIndex(data, `index: 移除 ${slug}`, idx && idx.sha);
      posts = data.posts;
      showToast('已删除');
      refresh();
    } catch (err) {
      console.error(err);
      showToast('删除失败：' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '删除';
    }
  });
}

function buildTokenCreateUrl() {
  const desc = encodeURIComponent(`Blog Admin - ${CONFIG.repo.owner}/${CONFIG.repo.name}`);
  return `https://github.com/settings/personal-access-tokens/new?description=${desc}&target_name=${encodeURIComponent(CONFIG.repo.owner)}`;
}

(function init() {
  initTheme();
  renderThemeToggle();
  document.title = `后台 · ${CONFIG.site.title}`;

  if (!getToken()) return renderLogin();
  if (!isAuthorized()) return renderUnauthorized();
  renderDashboard().catch(err => {
    console.error(err);
    if (err.status === 401) {
      logout(window.location.href);
      return;
    }
    showToast('加载失败：' + err.message, 'error');
  });
})();
