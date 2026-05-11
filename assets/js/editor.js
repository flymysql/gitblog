// ============================================================================
// 编辑器：EasyMDE + 草稿/置顶 + 拖拽/粘贴上传图片 + 发布前校验
// ============================================================================

import { CONFIG } from './config.js';
import { isAuthorized, getToken, getUser, logout, rememberReturnTo } from './auth.js';
import { readFile, writeFile, deleteFile, readIndex, writeIndex, uploadImage } from './api.js';
import {
  renderMarkdown,
  parseFrontmatter,
  stringifyFrontmatter,
  extractSummary,
  slugify,
} from './markdown.js';
import { initTheme, bindThemeToggle } from './theme.js';

const $ = sel => document.querySelector(sel);

function showToast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 200);
  }, 2400);
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
  loadedSlug: initialSlug,
  loadedSha: null,
  loadedPath: null,
  data: {},
  loading: false,
  mde: null,
};

function getContent() {
  return state.mde ? state.mde.value() : ($('#content').value || '');
}
function setContent(v) {
  if (state.mde) state.mde.value(v || '');
  else $('#content').value = v || '';
}

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
    $('#draftToggle').checked = !!data.draft;
    $('#pinnedToggle').checked = !!data.pinned;
    setContent(content);
    document.title = `编辑：${data.title || slug}`;
    setStatus('已加载', 'saved');
    $('#btnDelete').style.display = '';
    updatePreview();
  } catch (e) {
    console.error(e);
    if (e.status === 401) { logout(window.location.href); return; }
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
    $('#preview').innerHTML = await renderMarkdown(getContent());
  }, 200);
}

function toCommaList(s) {
  return String(s || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
}

function validateBeforePublish({ title, slug, content, tags, summary, allPosts, isUpdate }) {
  const errs = [];
  if (!title.trim()) errs.push('标题不能为空');
  if (!content.trim()) errs.push('正文不能为空');
  if (!slug.trim()) errs.push('slug 不能为空');
  if (!tags.length) errs.push('建议至少添加一个标签');
  if (!summary.trim()) errs.push('建议补充摘要（首段或自动生成）');
  if (!isUpdate && allPosts && allPosts.some(p => p.slug === slug)) errs.push('slug 已存在，请改一个');
  return errs;
}

async function publish() {
  if (!gateAuth()) return;

  const title = $('#title').value.trim();
  const content = getContent();
  let slug = $('#slug').value.trim() || slugify(title);
  $('#slug').value = slug;

  const tags = toCommaList($('#tags').value);
  const author = $('#author').value.trim() || (getUser() && getUser().name) || CONFIG.site.author || '';
  const cover = $('#cover').value.trim();
  const draft = $('#draftToggle').checked;
  const pinned = $('#pinnedToggle').checked;
  const summary = state.data.summary || extractSummary(content, 80);

  // 拉一次最新索引用于查重
  let curIndex = null;
  try { curIndex = await readIndex(); } catch {}
  const allPosts = (curIndex && curIndex.data && curIndex.data.posts) || [];
  const isUpdate = !!state.loadedSlug;
  const errs = validateBeforePublish({ title, slug, content, tags, summary, allPosts, isUpdate });
  // 仅 "不能为空" 与 slug 冲突 阻止发布；建议级别的可忽略
  const blockers = errs.filter(e => e.endsWith('不能为空') || e.startsWith('slug 已存在'));
  const warnings = errs.filter(e => !blockers.includes(e));
  if (blockers.length) {
    alert('无法发布：\n\n' + blockers.join('\n'));
    return;
  }
  if (warnings.length) {
    if (!confirm('注意：\n\n' + warnings.join('\n') + '\n\n仍要发布吗？')) return;
  }

  const now = new Date().toISOString();
  const data = {
    title,
    date: state.data.date || now,
    updated: now,
    author,
    tags,
  };
  if (cover) data.cover = cover;
  if (summary) data.summary = summary;
  if (draft) data.draft = true;
  if (pinned) data.pinned = true;

  const md = stringifyFrontmatter(data, content);
  const path = `${CONFIG.paths.posts}/${slug}.md`;
  const isRename = state.loadedSlug && state.loadedSlug !== slug;

  setStatus('发布中…', 'saving');
  $('#btnPublish').disabled = true;

  try {
    let sha = state.loadedSha;
    if (isRename) sha = null;
    let writeRes;
    try {
      writeRes = await writeFile(path, md, `post: ${state.loadedSha ? '更新' : '新增'} ${title}`, sha);
    } catch (e) {
      if (!sha && e.status === 422) {
        const altSlug = `${slug}-${Date.now().toString(36)}`;
        const altPath = `${CONFIG.paths.posts}/${altSlug}.md`;
        writeRes = await writeFile(altPath, md, `post: 新增 ${title}`);
        slug = altSlug;
        $('#slug').value = altSlug;
      } else if (e.status === 409) {
        // 远端 SHA 冲突
        if (confirm('文章已被外部修改。\n\n点确定重新加载远端版本（你将丢失本次修改）。')) {
          await loadPost(state.loadedSlug);
        }
        $('#btnPublish').disabled = false;
        setStatus('已取消（版本冲突）', 'error');
        return;
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

    await updateIndex({
      slug,
      title,
      date: data.date,
      updated: data.updated,
      author,
      summary,
      tags,
      cover: cover || undefined,
      draft,
      pinned,
      path: state.loadedPath,
      removeSlug: isRename ? state.loadedSlug : null,
    });

    state.loadedSlug = slug;
    state.data = data;
    setStatus(draft ? '已保存为草稿' : '已发布', 'saved');
    showToast(draft ? '草稿已保存' : '发布成功，几十秒后线上生效');

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('slug', slug);
    window.history.replaceState(null, '', newUrl.toString());
    $('#btnDelete').style.display = '';
  } catch (e) {
    console.error(e);
    if (e.status === 401) { logout(window.location.href); return; }
    if (e.status === 404 || e.status === 403) {
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

async function updateIndex({ slug, title, date, updated, author, summary, tags, cover, draft, pinned, path, removeSlug }) {
  const idx = await readIndex();
  const data = idx ? idx.data : { posts: [] };
  if (!Array.isArray(data.posts)) data.posts = [];

  if (removeSlug) {
    data.posts = data.posts.filter(p => p.slug !== removeSlug);
  }

  const existing = data.posts.findIndex(p => p.slug === slug);
  const entry = { slug, title, date, updated, author, summary, tags, path };
  if (cover) entry.cover = cover;
  if (draft) entry.draft = true;
  if (pinned) entry.pinned = true;

  if (existing >= 0) data.posts[existing] = entry;
  else data.posts.unshift(entry);

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

// ---------- 图片上传：拖拽 + 粘贴 ----------
async function handleImageFiles(files) {
  if (!gateAuth()) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    setStatus(`上传 ${file.name}…`, 'saving');
    try {
      const path = await uploadImage(file, file.name);
      // 计算相对地址（编辑器在 admin/，文章访问在站点根 → 用站点根相对路径）
      const url = '../' + path;
      const md = `\n![${file.name}](${url})\n`;
      insertAtCursor(md);
      setStatus(`已上传 ${file.name}`, 'saved');
    } catch (e) {
      console.error(e);
      setStatus('上传失败：' + e.message, 'error');
      showToast('上传失败：' + e.message, 'error');
    }
  }
}

function insertAtCursor(text) {
  if (state.mde) {
    const cm = state.mde.codemirror;
    const doc = cm.getDoc();
    const pos = doc.getCursor();
    doc.replaceRange(text, pos);
    cm.focus();
  } else {
    const ta = $('#content');
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.focus();
  }
  updatePreview();
}

function setupDragAndPaste() {
  const pane = document.querySelector('.editor-pane');
  const hint = $('#dropHint');

  ['dragenter', 'dragover'].forEach(ev =>
    pane.addEventListener(ev, e => {
      if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
        hint.hidden = false;
      }
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
    pane.addEventListener(ev, e => {
      hint.hidden = true;
    })
  );
  pane.addEventListener('drop', async e => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      await handleImageFiles([...e.dataTransfer.files]);
    }
  });

  document.addEventListener('paste', async e => {
    if (!e.clipboardData) return;
    const files = [...e.clipboardData.items]
      .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      await handleImageFiles(files);
    }
  });
}

function setupEasyMDE() {
  if (typeof EasyMDE === 'undefined') {
    // 没加载到 EasyMDE 就回退到 textarea
    return;
  }
  state.mde = new EasyMDE({
    element: $('#content'),
    autoDownloadFontAwesome: true,
    spellChecker: false,
    status: false,
    minHeight: '100%',
    placeholder: '开始用 Markdown 写作。支持拖拽 / 粘贴上传图片',
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'table', 'code', '|',
      {
        name: 'upload',
        action: () => {
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = 'image/*';
          inp.multiple = true;
          inp.onchange = () => handleImageFiles([...inp.files]);
          inp.click();
        },
        className: 'fa fa-upload',
        title: '上传图片',
      },
      'horizontal-rule', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide',
    ],
  });
  state.mde.codemirror.on('change', updatePreview);
}

(async function init() {
  initTheme();
  bindThemeToggle();

  if (!getToken()) {
    if (confirm('需要登录后台才能编辑。点击确定前往登录页。')) goLogin();
    else window.location.href = './';
    return;
  }
  if (!isAuthorized()) {
    alert('当前账号不在白名单内，无法编辑');
    window.location.href = './';
    return;
  }

  setStatus('已就绪', 'saved');
  $('#author').value = (getUser() && getUser().name) || CONFIG.site.author || '';

  setupEasyMDE();
  setupDragAndPaste();

  ['title'].forEach(id => {
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

  // 自动草稿到 localStorage
  const draftKey = 'editor_draft_' + (initialSlug || 'new');
  const saved = localStorage.getItem(draftKey);
  if (!initialSlug && saved) {
    try {
      const d = JSON.parse(saved);
      if ((d.title || d.content) && confirm('检测到本地未发布的草稿，是否恢复？')) {
        $('#title').value = d.title || '';
        setContent(d.content || '');
        $('#tags').value = d.tags || '';
        $('#cover').value = d.cover || '';
        $('#slug').value = d.slug || '';
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {}
  }
  setInterval(() => {
    if (state.loading) return;
    localStorage.setItem(draftKey, JSON.stringify({
      title: $('#title').value,
      content: getContent(),
      tags: $('#tags').value,
      cover: $('#cover').value,
      slug: $('#slug').value,
    }));
  }, 4000);

  // Ctrl+S / Cmd+S 触发发布
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      publish();
    }
  });

  if (initialSlug) {
    await loadPost(initialSlug);
  } else {
    updatePreview();
  }
})();
