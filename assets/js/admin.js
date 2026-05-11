// ============================================================================
// 后台首页：文章管理（已发布 / 草稿 tab）
// 使用 admin-shell 提供的统一 sidebar 布局
// ============================================================================

import { CONFIG } from './config.js';
import { readIndex, fetchIndexPublic, deleteFile, readFile, writeFile, writeIndex } from './api.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';
import { parseFrontmatter, stringifyFrontmatter } from './markdown.js';

const $ = sel => document.querySelector(sel);

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function topActions() {
  return `
    <button class="btn btn-secondary" id="savePinnedOrder" type="button" title="拖动置顶文章后保存排序">保存置顶排序</button>
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
  let indexSha = null;
  try {
    const idx = await readIndex();
    if (idx) {
      indexSha = idx.sha;
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
      if (a.pinned && b.pinned && Number(a.pinnedOrder || 0) !== Number(b.pinnedOrder || 0)) {
        return Number(a.pinnedOrder || 9999) - Number(b.pinnedOrder || 9999);
      }
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
        <div class="admin-row${p.pinned ? ' draggable' : ''}" data-slug="${escapeHtml(p.slug)}" draggable="${p.pinned ? 'true' : 'false'}">
          <div class="title">
            ${p.pinned ? '<span class="drag-handle" title="拖拽调整置顶顺序">☰</span>' : ''}
            ${p.pinned ? '<span class="badge pinned">置顶</span>' : ''}
            ${p.carousel ? '<span class="badge carousel">轮播</span>' : ''}
            ${escapeHtml(p.title || '无标题')}
          </div>
          <div class="meta">${fmtDate(p.updated || p.date)}</div>
          <div class="meta">${(p.tags || []).slice(0, 2).map(t => '#' + escapeHtml(t)).join(' ') || '—'}</div>
          <div class="meta">${p.draft ? '<span class="badge draft">草稿</span>' : '已发布'}</div>
          <div class="actions">
            ${p.draft ? '' : `<a href="../post.html?slug=${encodeURIComponent(p.slug)}" target="_blank">查看</a>`}
            <a href="editor.html?slug=${encodeURIComponent(p.slug)}">编辑</a>
            ${p.cover
              ? `<button data-action="toggle-carousel" data-slug="${escapeHtml(p.slug)}" title="${p.carousel ? '从首页轮播移除' : '加入首页轮播'}">${p.carousel ? '取消轮播' : '加入轮播'}</button>`
              : `<button disabled title="缺少封面图，无法加入轮播">加入轮播</button>`}
            <button class="danger" data-action="delete" data-slug="${escapeHtml(p.slug)}">删除</button>
          </div>
        </div>
      `).join('')}
    `;
  }

  refresh();

  let draggingRow = null;
  $('#list').addEventListener('dragstart', e => {
    const row = e.target.closest('.admin-row.draggable');
    if (!row) return;
    draggingRow = row;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  $('#list').addEventListener('dragend', () => {
    if (draggingRow) draggingRow.classList.remove('dragging');
    draggingRow = null;
  });
  $('#list').addEventListener('dragover', e => {
    if (!draggingRow) return;
    e.preventDefault();
    const rows = [...$('#list').querySelectorAll('.admin-row.draggable:not(.dragging)')];
    const after = rows.find(row => e.clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2);
    if (after) $('#list').insertBefore(draggingRow, after);
    else $('#list').appendChild(draggingRow);
  });

  const savePinnedOrderBtn = $('#savePinnedOrder');
  if (savePinnedOrderBtn) {
    savePinnedOrderBtn.addEventListener('click', async () => {
      const pinnedSlugs = [...$('#list').querySelectorAll('.admin-row.draggable')].map(row => row.dataset.slug);
      if (!pinnedSlugs.length) {
        showToast('当前没有置顶文章');
        return;
      }
      pinnedSlugs.forEach((slug, i) => {
        const item = posts.find(p => p.slug === slug);
        if (item) item.pinnedOrder = i + 1;
      });
      savePinnedOrderBtn.disabled = true;
      savePinnedOrderBtn.textContent = '保存中…';
      try {
        const idx = await readIndex();
        indexSha = idx && idx.sha;
        const data = idx ? idx.data : { posts };
        data.posts = (data.posts || []).map(p => {
          const local = posts.find(x => x.slug === p.slug);
          if (local && local.pinned) return { ...p, pinnedOrder: local.pinnedOrder };
          return p;
        });
        await writeIndex(data, 'index: 更新置顶排序', indexSha);
        posts = data.posts;
        showToast('置顶排序已保存');
        refresh();
      } catch (e) {
        console.error(e);
        showToast('保存失败：' + e.message, 'error');
      } finally {
        savePinnedOrderBtn.disabled = false;
        savePinnedOrderBtn.textContent = '保存置顶排序';
      }
    });
  }

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
    const carouselBtn = e.target.closest('button[data-action="toggle-carousel"]');
    if (carouselBtn) {
      await toggleCarousel(carouselBtn);
      return;
    }
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

  // 一键切换：是否加入首页轮播。改 frontmatter + 同步索引
  async function toggleCarousel(btn) {
    const slug = btn.dataset.slug;
    const item = posts.find(p => p.slug === slug);
    if (!item) return;
    if (!item.cover) {
      showToast('该文章没有封面图，无法加入轮播', 'error');
      return;
    }
    const next = !item.carousel;
    btn.disabled = true;
    btn.textContent = next ? '加入中…' : '取消中…';
    try {
      const path = item.path || `${CONFIG.paths.posts}/${slug}.md`;
      const file = await readFile(path);
      if (!file) throw new Error('文章不存在');
      const { data, content } = parseFrontmatter(file.content);
      if (next) data.carousel = true;
      else delete data.carousel;
      const newRaw = stringifyFrontmatter(data, content);
      await writeFile(path, newRaw, `post: ${next ? '加入' : '移出'}首页轮播 ${item.title || slug}`, file.sha);

      const idx = await readIndex();
      const idxData = idx ? idx.data : { posts };
      idxData.posts = (idxData.posts || []).map(p => {
        if (p.slug !== slug) return p;
        if (next) return { ...p, carousel: true };
        const { carousel, ...rest } = p;
        return rest;
      });
      await writeIndex(idxData, `index: ${next ? '加入' : '移出'}轮播 ${slug}`, idx && idx.sha);
      posts = idxData.posts;
      showToast(next ? '已加入首页轮播' : '已从首页轮播移除');
      refresh();
    } catch (err) {
      console.error(err);
      showToast((next ? '加入' : '取消') + '失败：' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = next ? '加入轮播' : '取消轮播';
    }
  }
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
