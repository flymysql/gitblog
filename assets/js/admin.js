// ============================================================================
// 后台首页：文章管理（已发布 / 草稿 tab）
// 使用 admin-shell 提供的统一 sidebar 布局
// ============================================================================

import { CONFIG } from './config.js';
import { readIndex, fetchIndexPublic, deleteFile, readFile, writeIndex } from './api.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';

const $ = sel => document.querySelector(sel);

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function topActions() {
  return `
    <a class="btn btn-primary" href="editor.html">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;vertical-align:-2px"><path d="M12 5v14M5 12h14"/></svg>
      新建文章
    </a>
  `;
}

async function renderDashboard(content) {
  content.innerHTML = `
    <div class="admin-toolbar">
      <div class="admin-tabs">
        <button data-tab="all" class="active">全部</button>
        <button data-tab="published">已发布</button>
        <button data-tab="draft">草稿</button>
      </div>
      <div class="admin-toolbar-spacer"></div>
      <input class="search-input" id="search" placeholder="搜索标题或标签">
    </div>
    <div class="admin-list" id="list">
      <div class="loading">加载中…</div>
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

(async function init() {
  const ctx = await mountAdminShell({ active: 'posts', title: '文章管理', actions: topActions() });
  if (!ctx) return;
  try {
    await renderDashboard(ctx.content);
  } catch (err) {
    console.error(err);
    ctx.showToast('加载失败：' + err.message, 'error');
  }
})();
