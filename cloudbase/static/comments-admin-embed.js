/**
 * 评论管理嵌入页（托管于 {envId}-{appId}.tcloudbaseapp.com）
 * 通过 Web SDK callFunction 调用云函数，避免 gitpull.cn 直连 HTTP 的 CORS 限制。
 */
const SDK_URL = 'https://static.cloudbase.net/cloudbase-js-sdk/2.17.3/cloudbase.full.js';
const SECRET_KEY = 'gitblog-comment-admin-secret-v1';
const SDK_HINT = '评论服务连接失败：请在控制台开启「匿名登录」，并将云函数 gitblog-comments 安全规则 invoke 设为 true（见 cloudbase/README.md）';

const params = new URLSearchParams(location.search);
const cfg = {
  envId: String(params.get('env') || '').trim(),
  region: String(params.get('region') || 'ap-shanghai').trim() || 'ap-shanghai',
  functionName: String(params.get('fn') || 'gitblog-comments').trim() || 'gitblog-comments',
  siteUrl: String(params.get('siteUrl') || 'https://gitpull.cn').trim().replace(/\/+$/, '') || 'https://gitpull.cn',
};

const $ = sel => document.querySelector(sel);
const root = $('#comments-admin-root');

let _app = null;
let _authReady = null;

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('CloudBase SDK 加载失败'));
    document.head.appendChild(s);
  });
}

async function getApp() {
  if (_app) return _app;
  if (!cfg.envId) throw new Error('缺少 env 参数');
  await loadScript(SDK_URL);
  // eslint-disable-next-line no-undef
  _app = cloudbase.init({ env: cfg.envId, region: cfg.region });
  if (!_authReady) {
    _authReady = (async () => {
      const auth = _app.auth();
      const state = await auth.getLoginState();
      if (!state) await auth.signInAnonymously();
    })();
  }
  await _authReady;
  return _app;
}

function parseApiResult(result) {
  if (result?.code === 'OPERATION_FAIL' || /PERMISSION_DENIED/i.test(String(result?.msg || result?.message || ''))) {
    throw new Error('云函数权限不足：请开启匿名登录，并将安全规则 invoke 设为 true');
  }
  if (!result || result.ok === false) {
    throw new Error(result?.message || result?.msg || '请求失败');
  }
  return result;
}

async function callAdminApi(payload) {
  const app = await getApp();
  const res = await app.callFunction({ name: cfg.functionName, data: payload });
  return parseApiResult(res?.result);
}

function getStoredSecret() {
  return String(localStorage.getItem(SECRET_KEY) || '').trim();
}

function saveSecret(secret) {
  localStorage.setItem(SECRET_KEY, String(secret || '').trim());
}

function clearSecret() {
  localStorage.removeItem(SECRET_KEY);
}

function postHeight() {
  try {
    const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 320);
    window.parent.postMessage({ type: 'gitblog-comments-admin-height', height }, '*');
  } catch { /* ignore */ }
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(status) {
  const s = status || 'visible';
  if (s === 'pending') return '<span class="badge draft">待审核</span>';
  if (s === 'deleted') return '<span class="badge draft">已删除</span>';
  return '已显示';
}

function resolvePageLink(c) {
  const pageUrl = String(c.pageUrl || '').trim();
  if (/^https?:\/\//i.test(pageUrl)) return pageUrl;
  const path = String(c.path || '').trim();
  const base = cfg.siteUrl;
  if (!path) return base || '#';
  if (path.includes('/')) return `${base}/${path}`;
  return `${base}/post/${path}/`;
}

function renderSecretGate() {
  root.innerHTML = `
    <section class="admin-empty-card">
      <h2>输入评论管理密钥</h2>
      <p class="settings-hint">密钥在云函数环境变量 <code>COMMENT_ADMIN_SECRET</code> 中配置，与 <code>cloudbase/secrets.env</code> 一致。仅保存在本浏览器（CloudBase 托管域）。</p>
      <form id="secretForm" style="max-width:420px;margin-top:16px">
        <label class="settings-hint" style="display:block;margin-bottom:6px">管理密钥</label>
        <input type="password" id="secretInput" placeholder="COMMENT_ADMIN_SECRET" required autocomplete="off">
        <div style="margin-top:14px">
          <button type="submit" class="btn btn-primary" id="secretSubmit">验证并进入</button>
        </div>
        <div id="secretError" class="settings-hint" style="color:var(--danger);margin-top:12px" hidden></div>
      </form>
    </section>
  `;
  postHeight();

  $('#secretForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#secretSubmit');
    const errEl = $('#secretError');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = '验证中…';
    const secret = $('#secretInput').value.trim();
    try {
      await callAdminApi({ action: 'ADMIN_LIST', adminSecret: secret, limit: 1 });
      saveSecret(secret);
      window.location.reload();
    } catch (err) {
      errEl.textContent = err.message || SDK_HINT;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = '验证并进入';
      postHeight();
    }
  });
}

async function renderCommentsAdmin(secret) {
  let skip = 0;
  const limit = 50;
  let currentStatus = 'all';
  let currentPath = '';
  let loading = false;

  root.innerHTML = `
    <div class="admin-toolbar">
      <div class="admin-tabs">
        <button data-status="all" class="active" type="button">全部</button>
        <button data-status="visible" type="button">已显示</button>
        <button data-status="pending" type="button">待审核</button>
      </div>
      <div class="admin-toolbar-spacer"></div>
      <input class="search-input" id="pathFilter" placeholder="按 path 筛选，如 20260616">
    </div>
    <div class="admin-list" id="commentList">
      <div class="loading">加载中…</div>
    </div>
    <div class="comments-admin-more" id="loadMoreWrap" hidden>
      <button type="button" class="btn btn-secondary" id="loadMoreBtn">加载更多</button>
    </div>
  `;
  postHeight();

  const listEl = $('#commentList');
  const loadMoreWrap = $('#loadMoreWrap');
  const loadMoreBtn = $('#loadMoreBtn');

  function renderRows(comments, append) {
    if (!append) {
      listEl.innerHTML = `
        <div class="admin-row head">
          <div>评论</div>
          <div>页面</div>
          <div>时间</div>
          <div>状态</div>
          <div style="text-align:right">操作</div>
        </div>
      `;
    }
    if (!comments.length && !append) {
      listEl.innerHTML += '<div class="empty">暂无评论</div>';
      postHeight();
      return;
    }
    const html = comments.map(c => {
      const link = resolvePageLink(c);
      const pageLabel = escapeHtml(c.pageTitle || c.path || '—');
      const excerpt = escapeHtml(c.contentPlain || '（无文字内容）');
      const replyHint = c.replyToNick ? `<span class="badge carousel">回复 @${escapeHtml(c.replyToNick)}</span> ` : '';
      return `
        <div class="admin-row" data-id="${escapeHtml(c._id)}">
          <div class="title">
            <strong>${escapeHtml(c.nick || '访客')}</strong>
            ${replyHint}
            <div class="comments-admin-excerpt">${excerpt}</div>
          </div>
          <div class="meta">
            <a href="${escapeHtml(link)}" target="_blank" rel="noopener">${pageLabel}</a>
          </div>
          <div class="meta">${fmtTime(c.createdAt)}</div>
          <div class="meta">${statusBadge(c.status)}</div>
          <div class="actions">
            <a href="${escapeHtml(link)}" target="_blank" rel="noopener">查看</a>
            <button class="danger" type="button" data-action="delete" data-id="${escapeHtml(c._id)}">删除</button>
          </div>
        </div>
      `;
    }).join('');
    listEl.insertAdjacentHTML('beforeend', html);
    postHeight();
  }

  async function load({ append = false } = {}) {
    if (loading) return;
    loading = true;
    if (!append) {
      skip = 0;
      listEl.innerHTML = '<div class="loading">加载中…</div>';
      loadMoreWrap.hidden = true;
      postHeight();
    } else {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = '加载中…';
    }
    try {
      const res = await callAdminApi({
        action: 'ADMIN_LIST',
        adminSecret: secret,
        limit,
        skip,
        status: currentStatus,
        path: currentPath,
      });
      const comments = res.comments || [];
      if (!append) renderRows(comments, false);
      else renderRows(comments, true);
      skip += comments.length;
      loadMoreWrap.hidden = comments.length < limit;
    } catch (err) {
      if (!append) {
        listEl.innerHTML = `<div class="error">${escapeHtml(err.message || '加载失败')}</div>`;
      }
      postHeight();
      throw err;
    } finally {
      loading = false;
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '加载更多';
      }
      postHeight();
    }
  }

  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status || 'all';
      load().catch(() => {});
    });
  });

  let pathTimer = null;
  $('#pathFilter').addEventListener('input', e => {
    clearTimeout(pathTimer);
    pathTimer = setTimeout(() => {
      currentPath = e.target.value.trim();
      load().catch(() => {});
    }, 350);
  });

  loadMoreBtn.addEventListener('click', () => load({ append: true }).catch(() => {}));

  listEl.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (!window.confirm('确定删除这条评论？其直接回复也会一并删除。')) return;
    btn.disabled = true;
    try {
      await callAdminApi({ action: 'ADMIN_DELETE', adminSecret: secret, id });
      btn.closest('.admin-row')?.remove();
      if (!listEl.querySelector('.admin-row:not(.head)')) {
        listEl.innerHTML = '<div class="empty">暂无评论</div>';
      }
      postHeight();
    } catch (err) {
      btn.disabled = false;
      alert(err.message || '删除失败');
    }
  });

  window.addEventListener('message', e => {
    if (!e.data) return;
    if (e.data.type === 'gitblog-comments-admin-reload') load().catch(() => {});
    if (e.data.type === 'gitblog-comments-admin-clear-secret') {
      if (!window.confirm('清除本机保存的管理密钥？')) return;
      clearSecret();
      window.location.reload();
    }
  });

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => postHeight()) : null;
  ro?.observe(document.body);

  await load();
}

async function main() {
  if (!cfg.envId) {
    root.innerHTML = '<div class="error">缺少 env 参数</div>';
    postHeight();
    return;
  }

  const secret = getStoredSecret();
  if (!secret) {
    renderSecretGate();
    return;
  }

  try {
    await renderCommentsAdmin(secret);
  } catch (err) {
    if (/管理密钥无效|403/.test(String(err.message || ''))) {
      clearSecret();
      renderSecretGate();
      return;
    }
    root.innerHTML = `<div class="error">${escapeHtml(err.message || SDK_HINT)}</div>`;
    postHeight();
  }
}

main();
