// ============================================================================
// 短动态（type: note）时间线页面
// 拉 data/notes.json 渲染；已登录且白名单用户显示简易发布框（直写 posts/*.md）
// ============================================================================

import { CONFIG } from './config.js';
import { initSite, escapeHtml, fmtDate, timeAgo, tagHtml } from './site.js';
import { renderMarkdown, stringifyFrontmatter, extractSummary, slugify } from './markdown.js';
import { setMeta } from './seo.js';
import { writeFile, uploadImage } from './api.js';
import { getToken, getUser, isAuthorized, rememberReturnTo, logout } from './auth.js';

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
  }, 2600);
}

function uniqueTags(tags) {
  const seen = new Set();
  const list = [];
  for (const raw of tags || []) {
    const tag = String(raw || '').trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    list.push(tag);
  }
  return list;
}

function parseTagsInput(s) {
  return uniqueTags(String(s || '').split(/[,，]/).map(x => x.trim()).filter(Boolean));
}

function insertAtCursor(ta, text) {
  if (!ta) return;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
  const pos = start + text.length;
  ta.setSelectionRange(pos, pos);
  ta.focus();
}

function defaultNoteTitle() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `随笔 · ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function makeNoteSlug(titleForSlug) {
  const base = slugify(titleForSlug || 'note');
  return `${base}-${Date.now().toString(36)}`;
}

function setComposeStatus(text, cls = '') {
  const el = $('#noteComposeStatus');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'note-composer-tip' + (cls ? ' ' + cls : '');
}

async function publishNoteFromPage() {
  if (!getToken()) {
    showToast('请先登录', 'error');
    return;
  }
  if (!isAuthorized()) {
    showToast('当前账号不在白名单内', 'error');
    return;
  }

  const titleInput = ($('#noteComposeTitle') && $('#noteComposeTitle').value.trim()) || '';
  const bodyEl = $('#noteComposeBody');
  const content = (bodyEl && bodyEl.value || '').trim();
  if (!content) {
    setComposeStatus('正文不能为空', 'error');
    return;
  }

  const title = titleInput || defaultNoteTitle();
  const tags = parseTagsInput($('#noteComposeTags') && $('#noteComposeTags').value);
  const finalTags = tags.length ? tags : ['随笔'];
  const author = (getUser() && getUser().name) || CONFIG.site.author || '';
  const now = new Date().toISOString();
  const summary = extractSummary(content, 120);

  const fm = {
    title,
    date: now,
    updated: now,
    author,
    tags: finalTags,
    type: 'note',
    summary,
  };

  const md = stringifyFrontmatter(fm, content.endsWith('\n') ? content : content + '\n');
  const slug = makeNoteSlug(titleInput || title);
  const path = `${CONFIG.paths.posts}/${slug}.md`;

  const btn = $('#noteComposePublish');
  if (btn) btn.disabled = true;
  setComposeStatus('正在提交到 GitHub…');

  try {
    await writeFile(path, md, `note: 发布 ${title}`, null);
    setComposeStatus('已保存。仓库构建完成后会出现在列表与首页「随笔」栏。', 'ok');
    showToast('发布成功');
    if (bodyEl) bodyEl.value = '';
    if ($('#noteComposeTitle')) $('#noteComposeTitle').value = '';
    const iso = now;
    const html = await renderMarkdown(content);
    const list = $('#noteList');
    const empty = list && list.querySelector('.notes-empty');
    if (empty) empty.remove();
    if (list) {
      const li = document.createElement('li');
      li.className = 'note-item';
      li.innerHTML = `
      <div class="note-meta">
        <span>${escapeHtml(author)}</span>
        <span>·</span>
        <span title="${escapeHtml(iso)}">刚刚</span>
      </div>
      <div class="note-content">${html}</div>
      ${finalTags.length ? `<div class="note-tags">${finalTags.map(t => tagHtml(t, { href: 'tags.html#' + encodeURIComponent(t) })).join('')}</div>` : ''}
    `;
      list.insertBefore(li, list.firstChild);
    }
  } catch (e) {
    console.error(e);
    if (e.status === 401) {
      logout(window.location.href);
      return;
    }
    setComposeStatus(e.message || '发布失败', 'error');
    showToast(e.message || '发布失败', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleComposeImages(files) {
  if (!getToken() || !isAuthorized()) {
    showToast('请先登录', 'error');
    return;
  }
  const ta = $('#noteComposeBody');
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    setComposeStatus(`上传 ${file.name}…`);
    try {
      const path = await uploadImage(file, file.name);
      const url = path.startsWith('http') ? path : path.replace(/^\.\//, '');
      const md = `\n![${file.name.replace(/]/g, '')}](${url})\n`;
      insertAtCursor(ta, md);
      setComposeStatus('');
    } catch (e) {
      console.error(e);
      if (e.status === 401) { logout(window.location.href); return; }
      setComposeStatus(e.message || '上传失败', 'error');
    }
  }
}

function mountComposer() {
  const wrap = $('#noteComposerWrap');
  const hint = $('#noteLoginHint');
  const token = getToken();
  const ok = token && isAuthorized();
  if (wrap) wrap.hidden = !ok;
  if (hint) hint.hidden = ok;

  const loginLink = $('#noteLoginLink');
  if (loginLink) {
    loginLink.addEventListener('click', e => {
      e.preventDefault();
      rememberReturnTo(window.location.href);
      window.location.href = 'admin/index.html';
    });
  }

  if (!ok) return;

  const ta = $('#noteComposeBody');
  const pick = $('#noteComposePickImg');
  const fileInp = $('#noteComposeFile');
  const pub = $('#noteComposePublish');

  if (pick && fileInp) {
    pick.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', () => {
      const f = fileInp.files;
      if (f && f.length) handleComposeImages([...f]);
      fileInp.value = '';
    });
  }

  if (ta) {
    ta.addEventListener('paste', e => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const imgs = [];
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length) {
        e.preventDefault();
        handleComposeImages(imgs);
      }
    });
    ta.addEventListener('dragover', e => { e.preventDefault(); });
    ta.addEventListener('drop', e => {
      e.preventDefault();
      const dt = e.dataTransfer;
      if (!dt || !dt.files || !dt.files.length) return;
      handleComposeImages([...dt.files]);
    });
  }

  if (pub) pub.addEventListener('click', () => publishNoteFromPage());
}

async function renderNoteList(notes) {
  const list = $('#noteList');
  if (!notes.length) {
    list.innerHTML = `
      <li class="notes-empty">
        还没有任何短动态。<br>
        ${getToken() && isAuthorized()
          ? '在上方写一条并发送，或到后台编辑器把文章的 <code>type</code> 设为 <code>note</code>。'
          : '在编辑器里把 frontmatter 的 <code>type</code> 设为 <code>note</code> 就会出现在这里。'}
      </li>
    `;
    return;
  }

  const htmls = await Promise.all(notes.map(n => renderMarkdown(n.content || '')));
  list.innerHTML = notes.map((n, i) => `
    <li class="note-item">
      <div class="note-meta">
        <span>${escapeHtml(n.author || CONFIG.site.author || '')}</span>
        <span>·</span>
        <span title="${escapeHtml(n.date || '')}">${escapeHtml(timeAgo(n.date) || fmtDate(n.date))}</span>
      </div>
      <div class="note-content">${htmls[i]}</div>
      ${(n.tags && n.tags.length) ? `<div class="note-tags">${n.tags.map(t => tagHtml(t, { href: 'tags.html#' + encodeURIComponent(t) })).join('')}</div>` : ''}
    </li>
  `).join('');
}

(async function init() {
  initSite({ active: 'notes.html' });
  setMeta({
    title: '随笔',
    description: '不成体系的小想法、灵感与备忘',
  });

  mountComposer();

  let notes = [];
  try {
    const r = await fetch('data/notes.json?_=' + Date.now(), { cache: 'no-cache' });
    if (r.ok) {
      const j = await r.json();
      notes = Array.isArray(j.notes) ? j.notes : [];
    }
  } catch (e) {
    console.warn('[notes] load failed', e);
  }

  await renderNoteList(notes);
})();
