// ============================================================================
// 后台图片库：列举 / 复制 Markdown / 删除上传图片
// ============================================================================

import { CONFIG } from './config.js';
import { listDir, deleteFile } from './api.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';

const $ = sel => document.querySelector(sel);

async function listImagesRecursive(base) {
  const out = [];
  async function walk(path) {
    const items = await listDir(path);
    for (const item of items) {
      if (item.type === 'dir') {
        await walk(item.path);
      } else if (item.type === 'file' && /\.(png|jpe?g|gif|webp|svg)$/i.test(item.name)) {
        out.push(item);
      }
    }
  }
  await walk(base);
  return out.sort((a, b) => String(b.path).localeCompare(String(a.path)));
}

function imageUrl(path) {
  return '../' + path;
}

async function renderImages(content) {
  content.innerHTML = `
    <div class="admin-toolbar">
      <span class="settings-status" id="imageStatus">正在扫描 ${escapeHtml(CONFIG.paths.uploads)} …</span>
      <div class="admin-toolbar-spacer"></div>
      <button class="btn btn-secondary" id="refreshImages">刷新</button>
    </div>
    <div class="image-library" id="imageLibrary">
      <div class="loading">加载中…</div>
    </div>
  `;

  let images = [];
  async function load() {
    $('#imageStatus').textContent = '正在扫描图片…';
    $('#imageLibrary').innerHTML = '<div class="loading">加载中…</div>';
    try {
      images = await listImagesRecursive(CONFIG.paths.uploads);
      $('#imageStatus').textContent = `共 ${images.length} 张图片`;
      refresh();
    } catch (e) {
      $('#imageStatus').textContent = '加载失败';
      $('#imageLibrary').innerHTML = `<div class="error">加载失败：${escapeHtml(e.message)}</div>`;
    }
  }

  function refresh() {
    const box = $('#imageLibrary');
    if (!images.length) {
      box.innerHTML = '<div class="empty">还没有上传图片</div>';
      return;
    }
    box.innerHTML = images.map(img => `
      <article class="image-card" data-path="${escapeHtml(img.path)}" data-sha="${escapeHtml(img.sha)}">
        <a href="${escapeHtml(imageUrl(img.path))}" target="_blank">
          <img src="${escapeHtml(imageUrl(img.path))}" alt="${escapeHtml(img.name)}" loading="lazy">
        </a>
        <div class="image-card-body">
          <div class="image-name" title="${escapeHtml(img.path)}">${escapeHtml(img.name)}</div>
          <div class="image-path">${escapeHtml(img.path)}</div>
          <div class="image-actions">
            <button type="button" data-action="copy">复制 Markdown</button>
            <button type="button" data-action="url">复制地址</button>
            <button type="button" data-action="delete" class="danger">删除</button>
          </div>
        </div>
      </article>
    `).join('');
  }

  $('#refreshImages').addEventListener('click', load);
  $('#imageLibrary').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const card = btn.closest('.image-card');
    const path = card.dataset.path;
    const sha = card.dataset.sha;
    const url = imageUrl(path);
    if (btn.dataset.action === 'copy') {
      await navigator.clipboard.writeText(`![${path.split('/').pop()}](../${path})`);
      showToast('已复制 Markdown');
      return;
    }
    if (btn.dataset.action === 'url') {
      await navigator.clipboard.writeText(url);
      showToast('已复制图片地址');
      return;
    }
    if (btn.dataset.action === 'delete') {
      if (!confirm(`确定删除图片？\n\n${path}\n\n注意：如果文章里仍引用它，图片会失效。`)) return;
      btn.disabled = true;
      btn.textContent = '删除中…';
      try {
        await deleteFile(path, sha, `image: 删除 ${path.split('/').pop()}`);
        images = images.filter(x => x.path !== path);
        refresh();
        $('#imageStatus').textContent = `共 ${images.length} 张图片`;
        showToast('图片已删除');
      } catch (err) {
        console.error(err);
        showToast('删除失败：' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '删除';
      }
    }
  });

  await load();
}

(async function init() {
  const ctx = await mountAdminShell({ active: 'images', title: '图片库' });
  if (!ctx) return;
  await renderImages(ctx.content);
})();
