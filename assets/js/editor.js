// ============================================================================
// 编辑器：新建 / 编辑 文章
// 流程：
//   1. 加载（如果有 ?slug=xxx）：拉取 posts/<slug>.md 解析 frontmatter 填表单
//   2. 编辑：实时预览（marked）
//   3. 发布：组装 frontmatter+正文 → 写 posts/<slug>.md → 更新 data/posts.json
// ============================================================================

import { CONFIG } from './config.js';
import { isAuthorized, getToken, getUser, logout, rememberReturnTo } from './auth.js';
import { readFile, writeFile, deleteFile, readIndex, writeIndex } from './api.js';
import {
  renderMarkdown,
  parseFrontmatter,
  stringifyFrontmatter,
  extractSummary,
  slugify,
} from './markdown.js';

const $ = sel => document.querySelector(sel);

function showToast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  if (kind === 'error') t.style.background = '#d9534f';
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 200);
  }, 2200);
}

function setStatus(text, kind = '') {
  const el = $('#status');
  el.textContent = text;
  el.className = 'editor-status ' + kind;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const params = new URLSearchParams(window.location.search);
const initialSlug = params.get('slug');

const state = {
  loadedSlug: initialSlug,    // 从 URL 加载时的原 slug，用于检测重命名
  loadedSha: null,            // 当前文章文件 sha
  loadedPath: null,           // 当前文章路径
  data: {},                   // 原 frontmatter
  loading: false,
};

function goLogin() {
  rememberReturnTo(window.location.href);
  window.location.href = './';
}

function gateAuth() {
  if (!getToken()) {
    if (confirm('需要先登录后台。点击确定前往登录页。')) goLogin();
    return false;
  }
  if (!isAuthorized()) {
    showToast('当前账号不在白名单内', 'error');
    return false;
  }
  return true;
}

async function loadPost(slug) {
  state.loading = true;
  setStatus('加载中…');
  const path = `${CONFIG.paths.posts}/${slug}.md`;
  try {
    const file = await readFile(path);
    if (!file) {
      setStatus('未找到文章', 'error');
      return;
    }
    const { data, content } = parseFrontmatter(file.content);
    state.loadedSha = file.sha;
    state.loadedPath = file.path;
    state.data = data;
    $('#title').value = data.title || '';
    $('#author').value = data.author || (getUser() && getUser().name) || CONFIG.site.author || '';
    $('#tags').value = (data.tags || []).join(', ');
    $('#cover').value = data.cover || '';
    $('#slug').value = slug;
    $('#content').value = content;
    document.title = `编辑：${data.title || slug}`;
    setStatus('已加载', 'saved');
    $('#btnDelete').style.display = '';
    updatePreview();
  } catch (e) {
    console.error(e);
    if (e.status === 401) {
      logout(window.location.href);
      return;
    }
    setStatus('加载失败：' + e.message, 'error');
  } finally {
    state.loading = false;
  }
}

let previewTimer = null;
async function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const t = $('#title').value || '预览';
    $('#previewTitle').textContent = t;
    $('#preview').innerHTML = await renderMarkdown($('#content').value || '');
  }, 150);
}

function toCommaList(s) {
  return String(s || '')
    .split(/[,，]/)
    .map(x => x.trim())
    .filter(Boolean);
}

async function publish() {
  if (!gateAuth()) return;

  const title = $('#title').value.trim();
  if (!title) {
    showToast('请填写标题', 'error');
    return;
  }
  const content = $('#content').value;

  let slug = $('#slug').value.trim();
  if (!slug) slug = slugify(title);
  $('#slug').value = slug;

  const tags = toCommaList($('#tags').value);
  const author = $('#author').value.trim() || (getUser() && getUser().name) || CONFIG.site.author || '';
  const cover = $('#cover').value.trim();

  const now = new Date().toISOString();
  const data = {
    title,
    date: state.data.date || now,
    updated: now,
    author,
    tags,
  };
  if (cover) data.cover = cover;
  const summary = state.data.summary || extractSummary(content, 80);
  if (summary) data.summary = summary;

  const md = stringifyFrontmatter(data, content);
  const path = `${CONFIG.paths.posts}/${slug}.md`;
  const isRename = state.loadedSlug && state.loadedSlug !== slug;

  setStatus('发布中…', 'saving');
  $('#btnPublish').disabled = true;

  try {
    // 如果发生 rename：先写新文件、再删除旧文件
    let sha = state.loadedSha;
    if (isRename) sha = null; // 新路径
    let writeRes;
    try {
      writeRes = await writeFile(path, md, `post: ${state.loadedSha ? '更新' : '新增'} ${title}`, sha);
    } catch (e) {
      // 如果是新建却报 sha 冲突（同名文件已存在），自动加 -2
      if (!sha && e.status === 422) {
        const altSlug = `${slug}-${Date.now().toString(36)}`;
        const altPath = `${CONFIG.paths.posts}/${altSlug}.md`;
        writeRes = await writeFile(altPath, md, `post: 新增 ${title}`);
        slug = altSlug;
        $('#slug').value = altSlug;
      } else {
        throw e;
      }
    }
    state.loadedSha = writeRes && writeRes.content && writeRes.content.sha;
    state.loadedPath = `${CONFIG.paths.posts}/${slug}.md`;

    if (isRename) {
      try {
        const oldPath = `${CONFIG.paths.posts}/${state.loadedSlug}.md`;
        const oldFile = await readFile(oldPath);
        if (oldFile) {
          await deleteFile(oldPath, oldFile.sha, `post: 重命名 ${state.loadedSlug} -> ${slug}`);
        }
      } catch (e) {
        console.warn('删除旧文件失败', e);
      }
    }

    // 更新索引
    await updateIndex({
      slug,
      title,
      date: data.date,
      updated: data.updated,
      author,
      summary,
      tags,
      cover: cover || undefined,
      path: state.loadedPath,
      removeSlug: isRename ? state.loadedSlug : null,
    });

    state.loadedSlug = slug;
    state.data = data;
    setStatus('已发布', 'saved');
    showToast('发布成功，几十秒后 GitHub Pages 会自动更新');

    // 切换到"编辑模式"的 URL，便于后续保存
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('slug', slug);
    window.history.replaceState(null, '', newUrl.toString());
    $('#btnDelete').style.display = '';
  } catch (e) {
    console.error(e);
    if (e.status === 401) {
      logout(window.location.href);
      return;
    }
    if (e.status === 409 || /sha/i.test(e.message || '')) {
      setStatus('版本冲突：请刷新后重试', 'error');
      showToast('版本冲突：仓库里已有更新版本，请刷新页面重试', 'error');
    } else if (e.status === 404 || e.status === 403) {
      setStatus('发布失败：权限不足', 'error');
      alert('发布失败\n\n' + (e.message || '权限不足'));
    } else {
      setStatus('发布失败：' + e.message, 'error');
      showToast('发布失败：' + e.message, 'error');
    }
  } finally {
    $('#btnPublish').disabled = false;
  }
}

async function updateIndex({ slug, title, date, updated, author, summary, tags, cover, path, removeSlug }) {
  // 重新拉取最新索引避免冲突
  const idx = await readIndex();
  const data = idx ? idx.data : { posts: [] };
  if (!Array.isArray(data.posts)) data.posts = [];

  if (removeSlug) {
    data.posts = data.posts.filter(p => p.slug !== removeSlug);
  }

  const existing = data.posts.findIndex(p => p.slug === slug);
  const entry = {
    slug,
    title,
    date,
    updated,
    author,
    summary,
    tags,
    path,
  };
  if (cover) entry.cover = cover;

  if (existing >= 0) data.posts[existing] = { ...data.posts[existing], ...entry };
  else data.posts.unshift(entry);

  // 按 date desc
  data.posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  await writeIndex(data, `index: 更新 ${slug}`, idx && idx.sha);
}

async function deletePost() {
  if (!gateAuth()) return;
  if (!state.loadedSlug) return;
  if (!confirm(`确定删除「${$('#title').value || state.loadedSlug}」吗？`)) return;
  setStatus('删除中…', 'saving');
  $('#btnDelete').disabled = true;
  try {
    const path = state.loadedPath || `${CONFIG.paths.posts}/${state.loadedSlug}.md`;
    const file = await readFile(path);
    if (file) {
      await deleteFile(path, file.sha, `post: 删除 ${state.loadedSlug}`);
    }
    const idx = await readIndex();
    const data = idx ? idx.data : { posts: [] };
    data.posts = (data.posts || []).filter(p => p.slug !== state.loadedSlug);
    await writeIndex(data, `index: 移除 ${state.loadedSlug}`, idx && idx.sha);
    showToast('已删除');
    setTimeout(() => { window.location.href = './'; }, 600);
  } catch (e) {
    console.error(e);
    setStatus('删除失败：' + e.message, 'error');
    $('#btnDelete').disabled = false;
  }
}

// ---------- 初始化 ----------
(async function init() {
  if (!getToken()) {
    if (confirm('需要登录后台才能编辑。点击确定前往登录页。')) {
      goLogin();
    } else {
      window.location.href = './';
    }
    return;
  }
  if (!isAuthorized()) {
    alert('当前账号不在白名单内，无法编辑');
    window.location.href = './';
    return;
  }

  setStatus('已就绪', 'saved');
  $('#author').value = (getUser() && getUser().name) || CONFIG.site.author || '';

  ['title', 'content'].forEach(id => {
    $('#' + id).addEventListener('input', updatePreview);
  });

  $('#title').addEventListener('blur', () => {
    const slugInput = $('#slug');
    if (!slugInput.value && $('#title').value) {
      slugInput.value = slugify($('#title').value);
    }
  });

  $('#btnPublish').addEventListener('click', publish);
  $('#btnDelete').addEventListener('click', deletePost);
  $('#btnPreview').addEventListener('click', () => {
    document.querySelectorAll('.editor-pane').forEach(el => el.classList.toggle('preview-mode'));
  });

  // 自动保存到 localStorage 以防误关
  const draftKey = 'editor_draft_' + (initialSlug || 'new');
  const saved = localStorage.getItem(draftKey);
  if (!initialSlug && saved) {
    try {
      const d = JSON.parse(saved);
      if (d.title || d.content) {
        if (confirm('检测到本地未发布的草稿，是否恢复？')) {
          $('#title').value = d.title || '';
          $('#content').value = d.content || '';
          $('#tags').value = d.tags || '';
          $('#cover').value = d.cover || '';
          $('#slug').value = d.slug || '';
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    } catch {}
  }
  setInterval(() => {
    if (state.loading) return;
    localStorage.setItem(draftKey, JSON.stringify({
      title: $('#title').value,
      content: $('#content').value,
      tags: $('#tags').value,
      cover: $('#cover').value,
      slug: $('#slug').value,
    }));
  }, 3000);

  if (initialSlug) {
    await loadPost(initialSlug);
  } else {
    updatePreview();
  }
})();
