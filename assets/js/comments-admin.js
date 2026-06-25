// ============================================================================
// 后台「评论管理」：查看与删除 CloudBase 评论
// ============================================================================

import { CONFIG } from './config.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';

const SECRET_KEY = 'gitblog-comment-admin-secret-v1';
const $ = sel => document.querySelector(sel);

function cloudbaseCfg() {
  return CONFIG.cloudbase || {};
}

function resolveHttpUrl(cfg) {
  const custom = String(cfg.httpUrl || '').trim();
  if (custom) return custom;
  const envId = String(cfg.envId || '').trim();
  const region = String(cfg.region || 'ap-shanghai').trim() || 'ap-shanghai';
  const fn = String(cfg.functionName || 'gitblog-comments').trim() || 'gitblog-comments';
  return `https://${envId}.${region}.app.tcloudbase.com/${fn}`;
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

async function callAdminApi(payload) {
  const cfg = cloudbaseCfg();
  if (!cfg.enabled || !cfg.envId) {
    throw new Error('请先在站点设置中启用 CloudBase 评论并填写 envId');
  }
  const url = resolveHttpUrl(cfg);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('无法连接评论云函数，请确认已部署 gitblog-comments');
  }
  let result;
  try {
    result = await res.json();
  } catch {
    throw new Error(`评论服务响应异常（HTTP ${res.status}）`);
  }
  if (!result || result.ok === false) {
    throw new Error(result?.message || `请求失败（HTTP ${res.status}）`);
  }
  return result;
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
  const base = String(CONFIG.site?.url || '').replace(/\/+$/, '') || '';
  if (!path) return base || '#';
  if (path.includes('/')) return `${base}/${path}`;
  return `${base}/post/${path}/`;
}

function renderSecretGate(host) {
  host.innerHTML = `
    <section class="admin-empty-card">
      <h2>输入评论管理密钥</h2>
      <p class="settings-hint">密钥在云函数环境变量 <code>COMMENT_ADMIN_SECRET</code> 中配置，与 <code>cloudbase/secrets.env</code> 一致。仅保存在本浏览器。</p>
      <form id="secretForm" class="settings-form" style="max-width:420px;margin-top:16px">
        <label>
          <span>管理密钥</span>
          <input type="password" id="secretInput" placeholder="COMMENT_ADMIN_SECRET" required autocomplete="off">
        </label>
        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary" id="secretSubmit">验证并进入</button>
          <a class="btn btn-secondary" href="settings.html">站点设置</a>
        </div>
        <div id="secretError" class="settings-hint" style="color:#d9534f;margin-top:12px" hidden></div>
      </form>
    </section>
  `;

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
      errEl.textContent = err.message || '验证失败';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = '验证并进入';
    }
  });
}

function topActions() {
  return `
    <button class="btn btn-secondary" type="button" id="reloadComments">刷新</button>
    <button class="btn btn-secondary" type="button" id="clearSecretBtn">更换密钥</button>
  `;
}

async function renderCommentsAdmin(content, secret) {
  let skip = 0;
  const limit = 50;
  let currentStatus = 'all';
  let currentPath = '';
  let loading = false;

  content.innerHTML = `
    <div class="admin-toolbar">
      <div class="admin-tabs">
        <button data-status="all" class="active">全部</button>
        <button data-status="visible">已显示</button>
        <button data-status="pending">待审核</button>
      </div>
      <div class="admin-toolbar-spacer"></div>
      <input class="search-input" id="pathFilter" placeholder="按 path 筛选，如 20260616">
    </div>
    <div class="admin-list comments-admin-list" id="commentList">
      <div class="loading">加载中…</div>
    </div>
    <div class="comments-admin-more" id="loadMoreWrap" hidden>
      <button type="button" class="btn btn-secondary" id="loadMoreBtn">加载更多</button>
    </div>
  `;

  const listEl = $('#commentList');
  const loadMoreWrap = $('#loadMoreWrap');
  const loadMoreBtn = $('#loadMoreBtn');

  function renderRows(comments, append) {
    if (!append) {
      listEl.innerHTML = `
        <div class="admin-row head comments-admin-row">
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
      return;
    }
    const html = comments.map(c => {
      const link = resolvePageLink(c);
      const pageLabel = escapeHtml(c.pageTitle || c.path || '—');
      const excerpt = escapeHtml(c.contentPlain || '（无文字内容）');
      const replyHint = c.replyToNick ? `<span class="badge carousel">回复 @${escapeHtml(c.replyToNick)}</span> ` : '';
      return `
        <div class="admin-row comments-admin-row" data-id="${escapeHtml(c._id)}">
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
    if (append) listEl.insertAdjacentHTML('beforeend', html);
    else listEl.insertAdjacentHTML('beforeend', html);
  }

  async function load({ append = false } = {}) {
    if (loading) return;
    loading = true;
    if (!append) {
      skip = 0;
      listEl.innerHTML = '<div class="loading">加载中…</div>';
      loadMoreWrap.hidden = true;
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
      } else {
        showToast(err.message || '加载失败', 'error');
      }
    } finally {
      loading = false;
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '加载更多';
      }
    }
  }

  document.querySelectorAll('.admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tabs button').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status || 'all';
      load();
    });
  });

  let pathTimer = null;
  $('#pathFilter').addEventListener('input', e => {
    clearTimeout(pathTimer);
    pathTimer = setTimeout(() => {
      currentPath = e.target.value.trim();
      load();
    }, 350);
  });

  loadMoreBtn.addEventListener('click', () => load({ append: true }));

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
      showToast('评论已删除');
      if (!listEl.querySelector('.admin-row:not(.head)')) {
        listEl.innerHTML = '<div class="empty">暂无评论</div>';
      }
    } catch (err) {
      showToast(err.message || '删除失败', 'error');
      btn.disabled = false;
    }
  });

  $('#reloadComments')?.addEventListener('click', () => load());
  $('#clearSecretBtn')?.addEventListener('click', () => {
    if (!window.confirm('清除本机保存的管理密钥？')) return;
    clearSecret();
    window.location.reload();
  });

  await load();
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

  const secret = getStoredSecret();
  if (!secret) {
    renderSecretGate(ctx.content);
    return;
  }

  try {
    await renderCommentsAdmin(ctx.content, secret);
  } catch (err) {
    if (/管理密钥无效|403/.test(String(err.message || ''))) {
      clearSecret();
      renderSecretGate(ctx.content);
      showToast('管理密钥无效，请重新输入', 'error');
      return;
    }
    ctx.content.innerHTML = `<div class="error">${escapeHtml(err.message || '加载失败')}</div>`;
  }
}

main();
