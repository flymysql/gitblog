/**
 * CloudBase 评论嵌入页（托管于 {envId}-{appId}.tcloudbaseapp.com）
 * 优先用 Web SDK callFunction（同环境托管域，移动端/微信更稳定）；
 * HTTP 仅作桌面端兜底。
 */
const SDK_URL = 'https://static.cloudbase.net/cloudbase-js-sdk/2.17.3/cloudbase.full.js';
const PROFILE_KEY = 'gitblog-comment-profile-v1';

const EMOJI_GROUPS = [
  ['😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋'],
  ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️', '🤞', '🎉', '🔥', '❤️'],
  ['😅', '😭', '😤', '😱', '🤔', '😴', '🥳', '🤯', '😎', '🤗', '🫡', '💯'],
  ['🌸', '🌿', '☀️', '🌙', '⭐', '🍵', '☕', '🍜', '🎈', '📚', '💡', '🚀'],
];

const params = new URLSearchParams(location.search);
const cfg = {
  path: String(params.get('path') || '').trim(),
  envId: String(params.get('env') || '').trim(),
  region: String(params.get('region') || 'ap-shanghai').trim() || 'ap-shanghai',
  functionName: String(params.get('fn') || 'gitblog-comments').trim() || 'gitblog-comments',
  httpUrl: String(params.get('httpUrl') || '').trim(),
  pageTitle: String(params.get('title') || '').trim(),
  pageUrl: String(params.get('pageUrl') || '').trim(),
  placeholderNick: '访客',
  moderation: false,
  maxLength: 5000,
  allowImage: true,
  pageSize: 50,
};

const mode = String(params.get('mode') || 'light').trim().toLowerCase();
document.documentElement.setAttribute('data-mode', mode === 'dark' ? 'dark' : 'light');

let _heightTimer = null;
let _app = null;
let _authReady = null;

const SDK_HINT = '评论服务连接失败：请在控制台开启「匿名登录」，并将云函数 gitblog-comments 安全规则 invoke 设为 true（见 cloudbase/README.md）';

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

function resolveHttpUrl() {
  if (cfg.httpUrl) return cfg.httpUrl;
  if (!cfg.envId) throw new Error('缺少 env 参数');
  return `https://${cfg.envId}.${cfg.region}.app.tcloudbase.com/${cfg.functionName}`;
}

function parseApiResult(result, httpStatus) {
  if (result?.code === 'OPERATION_FAIL' || /PERMISSION_DENIED/i.test(String(result?.msg || result?.message || ''))) {
    throw new Error('云函数权限不足：请开启匿名登录，并将安全规则 invoke 设为 true（见 cloudbase/README.md）');
  }
  if (!result || result.ok === false) {
    throw new Error(result?.message || result?.msg || `评论服务请求失败${httpStatus ? `（HTTP ${httpStatus}）` : ''}`);
  }
  return result;
}

async function callApiViaSdk(payload) {
  const app = await getApp();
  const res = await app.callFunction({ name: cfg.functionName, data: payload });
  return parseApiResult(res?.result);
}

async function callApiViaHttp(payload) {
  const url = resolveHttpUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let result;
  try {
    result = await res.json();
  } catch {
    throw new Error(`评论服务响应异常（HTTP ${res.status}）`);
  }
  return parseApiResult(result, res.status);
}

async function callApi(payload) {
  try {
    return await callApiViaSdk(payload);
  } catch (sdkErr) {
    try {
      return await callApiViaHttp(payload);
    } catch {
      throw new Error(sdkErr?.message || SDK_HINT);
    }
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function postHeight(ready = false) {
  clearTimeout(_heightTimer);
  _heightTimer = setTimeout(() => {
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    try {
      window.parent.postMessage({ type: 'gitblog-comments-height', height: h, ready }, '*');
    } catch { /* ignore */ }
  }, 80);
}

function observeHeight() {
  postHeight(true);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => postHeight(true));
    ro.observe(document.body);
  } else {
    window.addEventListener('load', () => postHeight(true));
    setInterval(() => postHeight(true), 1500);
  }
}

function sanitizeCommentHtml(raw) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(raw || '');
  const allowed = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'CODE', 'PRE',
    'BLOCKQUOTE', 'A', 'IMG', 'UL', 'OL', 'LI', 'SPAN',
  ]);

  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        return;
      }
      const tag = child.tagName;
      if (!allowed.has(tag)) {
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        child.replaceWith(frag);
        walk(frag);
        return;
      }
      [...child.attributes].forEach(attr => {
        const n = attr.name.toLowerCase();
        if (tag === 'A' && (n === 'href' || n === 'title' || n === 'target' || n === 'rel')) return;
        if (tag === 'IMG' && (n === 'src' || n === 'alt' || n === 'title' || n === 'loading')) return;
        if (tag === 'SPAN' && n === 'class') {
          const cls = child.getAttribute('class') || '';
          if (cls === 'cb-mention' || cls === 'cb-uploading') return;
          child.removeAttribute(attr.name);
          return;
        }
        child.removeAttribute(attr.name);
      });
      if (tag === 'A') {
        const href = child.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:')) {
          child.removeAttribute('href');
        } else {
          child.setAttribute('rel', 'nofollow noopener noreferrer');
          child.setAttribute('target', '_blank');
        }
      }
      if (tag === 'IMG') {
        const src = child.getAttribute('src') || '';
        if (!/^https?:\/\//i.test(src) && !src.startsWith('cloud://')) {
          child.remove();
          return;
        }
        child.setAttribute('loading', 'lazy');
      }
      walk(child);
    });
  };
  walk(tpl.content);
  return tpl.innerHTML.trim();
}

function readProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveProfile({ nick, email }) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ nick: nick || '', email: email || '' }));
  } catch { /* ignore */ }
}

function formatTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function avatarColor(name) {
  let h = 0;
  const s = String(name || '访客');
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  const hues = [12, 28, 45, 160, 200, 260, 310];
  return hues[h % hues.length];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.includes(',') ? s.split(',')[1] : s);
    };
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

class CommentRichEditor {
  constructor(root, { allowImage = true, maxLength = 5000, onUpload } = {}) {
    this.root = root;
    this.allowImage = allowImage;
    this.maxLength = maxLength;
    this.onUpload = onUpload;
    this._emojiOpen = false;
    this._render();
    this._bind();
  }

  _render() {
    this.root.innerHTML = `
      <div class="cb-editor">
        <div class="cb-editor-toolbar cb-editor-toolbar--simple" role="toolbar" aria-label="评论工具">
          <button type="button" class="cb-tb" data-action="emoji" title="表情">😊</button>
          ${this.allowImage ? '<button type="button" class="cb-tb" data-action="image" title="插入图片">🖼</button>' : ''}
        </div>
        <div class="cb-editor-emoji" hidden></div>
        <div class="cb-editor-body" contenteditable="true" data-placeholder="写下你的想法…支持表情与粘贴图片" role="textbox" aria-multiline="true"></div>
        <div class="cb-editor-foot">
          <span class="cb-editor-count">0 / ${this.maxLength}</span>
        </div>
        <input type="file" accept="image/*" class="cb-editor-file" hidden>
      </div>
    `;
    this.toolbar = this.root.querySelector('.cb-editor-toolbar');
    this.body = this.root.querySelector('.cb-editor-body');
    this.emojiPanel = this.root.querySelector('.cb-editor-emoji');
    this.countEl = this.root.querySelector('.cb-editor-count');
    this.fileInput = this.root.querySelector('.cb-editor-file');
    this.emojiPanel.innerHTML = EMOJI_GROUPS.map(row =>
      `<div class="cb-emoji-row">${row.map(e =>
        `<button type="button" class="cb-emoji-btn" data-emoji="${e}">${e}</button>`
      ).join('')}</div>`
    ).join('');
  }

  _bind() {
    this.toolbar.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      const action = btn.dataset.action;
      if (action === 'emoji') {
        this._toggleEmoji();
        return;
      }
      if (action === 'image') {
        this.fileInput.click();
      }
    });

    this.emojiPanel.addEventListener('click', e => {
      const b = e.target.closest('[data-emoji]');
      if (!b) return;
      e.preventDefault();
      this._insertText(b.dataset.emoji);
      this._toggleEmoji(false);
    });

    this.body.addEventListener('input', () => this._syncCount());
    this.body.addEventListener('paste', e => this._onPaste(e));
    this.fileInput.addEventListener('change', () => this._onPickImage());

    document.addEventListener('click', e => {
      if (!this._emojiOpen) return;
      if (this.root.contains(e.target)) return;
      this._toggleEmoji(false);
    });
  }

  _toggleEmoji(open) {
    this._emojiOpen = open ?? this.emojiPanel.hidden;
    this.emojiPanel.hidden = !this._emojiOpen;
  }

  _insertText(text) {
    this.body.focus();
    document.execCommand('insertText', false, text);
    this._syncCount();
  }

  async _onPaste(e) {
    const items = e.clipboardData?.items;
    if (!items || !this.allowImage) return;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      const file = item.getAsFile();
      if (file) await this._uploadAndInsert(file);
      return;
    }
  }

  async _onPickImage() {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = '';
    if (!file) return;
    await this._uploadAndInsert(file);
  }

  async _uploadAndInsert(file) {
    if (!this.onUpload) return;
    const placeholder = document.createElement('span');
    placeholder.className = 'cb-uploading';
    placeholder.textContent = '图片上传中…';
    this.body.focus();
    document.execCommand('insertHTML', false, placeholder.outerHTML);
    try {
      const url = await this.onUpload(file);
      const html = `<img src="${escapeHtml(url)}" alt="评论图片" loading="lazy">`;
      this.root.querySelector('.cb-uploading')?.replaceWith(
        ...(() => {
          const t = document.createElement('template');
          t.innerHTML = html;
          return [...t.content.childNodes];
        })()
      );
    } catch {
      this.root.querySelector('.cb-uploading')?.remove();
      throw new Error('图片上传失败');
    }
    this._syncCount();
  }

  _syncCount() {
    const text = this.body.innerText || '';
    const len = text.length;
    this.countEl.textContent = `${len} / ${this.maxLength}`;
    this.countEl.classList.toggle('is-over', len > this.maxLength);
  }

  getHtml() {
    return sanitizeCommentHtml(this.body.innerHTML);
  }

  getPlainLength() {
    return (this.body.innerText || '').length;
  }

  clear() {
    this.body.innerHTML = '';
    this._syncCount();
  }

  setMentionPrefix(nick) {
    const name = String(nick || '访客').trim() || '访客';
    this.body.innerHTML = `<span class="cb-mention">@${escapeHtml(name)}</span>&nbsp;`;
    this._syncCount();
  }

  isValid() {
    const len = this.getPlainLength();
    return len > 0 && len <= this.maxLength;
  }
}

function renderCommentItem(c, { nested = true } = {}) {
  const nick = escapeHtml(c.nick || '访客');
  const nickRaw = escapeHtml(c.nick || '访客');
  const replyTo = c.replyToNick ? escapeHtml(c.replyToNick) : '';
  const hue = avatarColor(c.nick);
  const content = sanitizeCommentHtml(c.contentHtml || '');
  const replies = nested && (c.replies || []).length
    ? `<div class="cb-replies">${(c.replies || []).map(r => renderCommentItem(r, { nested: false })).join('')}</div>`
    : '';
  return `
    <article class="cb-comment${c.parentId ? ' is-reply' : ''}" data-id="${escapeHtml(c._id)}">
      <div class="cb-comment-avatar" style="--cb-avatar-hue:${hue}" aria-hidden="true">${nick.slice(0, 1).toUpperCase()}</div>
      <div class="cb-comment-main">
        <header class="cb-comment-head">
          ${replyTo ? `<span class="cb-comment-reply-badge">回复 <span class="cb-mention">@${replyTo}</span></span>` : ''}
          <strong class="cb-comment-nick">${nick}</strong>
          <time class="cb-comment-time">${escapeHtml(formatTime(c.createdAt))}</time>
        </header>
        <div class="cb-comment-body">${content || '<p></p>'}</div>
        <footer class="cb-comment-actions">
          <button type="button" class="cb-link-btn" data-reply="${escapeHtml(c._id)}" data-reply-nick="${nickRaw}">回复</button>
        </footer>
        <div class="cb-inline-reply-slot"></div>
        ${replies}
      </div>
    </article>
  `;
}

function closeAllInlineReplies(root) {
  if (!root) return;
  root.querySelectorAll('.cb-inline-reply').forEach(el => el.remove());
  root.querySelectorAll('[data-reply].is-active').forEach(btn => btn.classList.remove('is-active'));
}

function mountInlineReply(slot, ctx) {
  const { parentId, replyNick, path, callApi, onSuccess } = ctx;
  const commentsRoot = slot.closest('.cb-comments');
  closeAllInlineReplies(commentsRoot);

  const panel = document.createElement('div');
  panel.className = 'cb-inline-reply';
  panel.innerHTML = `
    <div class="cb-inline-reply-head">回复 <span class="cb-mention">@${escapeHtml(replyNick)}</span></div>
    <div class="cb-inline-reply-editor"></div>
    <div class="cb-inline-reply-actions">
      <button type="button" class="cb-link-btn" data-cancel-reply>取消</button>
      <button type="button" class="cb-submit cb-submit--sm" data-submit-reply>发送</button>
    </div>
    <span class="cb-inline-reply-status" aria-live="polite"></span>
  `;
  slot.appendChild(panel);

  const editorHost = panel.querySelector('.cb-inline-reply-editor');
  const statusEl = panel.querySelector('.cb-inline-reply-status');
  const editor = new CommentRichEditor(editorHost, {
    allowImage: cfg.allowImage,
    maxLength: cfg.maxLength,
    onUpload: async file => {
      const base64 = await fileToBase64(file);
      const res = await callApi({
        action: 'UPLOAD',
        path,
        fileName: file.name,
        mime: file.type,
        base64,
      });
      return res.url;
    },
  });
  editor.setMentionPrefix(replyNick);

  const replyBtn = commentsRoot?.querySelector(`[data-reply="${CSS.escape(parentId)}"]`);
  replyBtn?.classList.add('is-active');

  panel.querySelector('[data-cancel-reply]').addEventListener('click', () => {
    panel.remove();
    replyBtn?.classList.remove('is-active');
    postHeight(true);
  });

  const submitBtn = panel.querySelector('[data-submit-reply]');
  const doSubmit = async () => {
    statusEl.textContent = '';
    if (!editor.isValid()) {
      statusEl.textContent = editor.getPlainLength() > cfg.maxLength ? '内容过长' : '请输入回复内容';
      statusEl.classList.add('is-error');
      return;
    }
    const profile = readProfile();
    submitBtn.disabled = true;
    statusEl.classList.remove('is-error');
    statusEl.textContent = '发送中…';
    try {
      await callApi({
        action: 'POST',
        path,
        nick: profile.nick || '',
        email: profile.email || '',
        contentHtml: editor.getHtml(),
        parentId,
        pageTitle: cfg.pageTitle || document.title,
        pageUrl: cfg.pageUrl || params.get('pageUrl') || '',
      });
      saveProfile({ nick: profile.nick, email: profile.email });
      closeAllInlineReplies(commentsRoot);
      await onSuccess();
    } catch (err) {
      statusEl.textContent = err.message || '发送失败';
      statusEl.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      postHeight(true);
    }
  };

  submitBtn.addEventListener('click', doSubmit);
  editorHost.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doSubmit();
    }
  });

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  editor.body.focus();
  postHeight(true);
}

function bindCommentListInteractions(listEl, ctx) {
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-reply]');
    if (!btn || e.target.closest('.cb-inline-reply')) return;
    e.preventDefault();
    const slot = btn.closest('.cb-comment-main')?.querySelector('.cb-inline-reply-slot');
    if (!slot) return;
    mountInlineReply(slot, {
      ...ctx,
      parentId: btn.dataset.reply || '',
      replyNick: btn.dataset.replyNick || '访客',
    });
  });
}

function showError(root, message) {
  root.innerHTML = `<div class="comments-hint">${escapeHtml(message)}</div>`;
  postHeight(true);
}

async function mount() {
  const root = document.getElementById('gitblog-comments-root');
  if (!root) return;

  if (!cfg.path) {
    showError(root, '缺少 path 参数');
    return;
  }

  root.innerHTML = `
    <div class="cb-comments" data-path="${escapeHtml(cfg.path)}">
      <div class="cb-comments-loading" aria-live="polite">评论加载中…</div>
      <div class="cb-comments-list" hidden></div>
      <form class="cb-compose" novalidate>
        <div class="cb-compose-meta">
          <label class="cb-field">
            <span>昵称</span>
            <input type="text" name="nick" maxlength="40" placeholder="${escapeHtml(cfg.placeholderNick)}（可选）" autocomplete="nickname">
          </label>
          <label class="cb-field">
            <span>邮箱</span>
            <input type="email" name="email" maxlength="120" placeholder="可选，不会公开显示" autocomplete="email">
          </label>
        </div>
        <div class="cb-compose-editor"></div>
        <p class="cb-compose-hint">发表新评论；点「回复」可在对应楼层下回复并自动 @ 对方。留邮箱可在被回复时收到通知。</p>
        <div class="cb-compose-actions">
          <span class="cb-compose-status" aria-live="polite"></span>
          <button type="submit" class="cb-submit">发表评论</button>
        </div>
      </form>
    </div>
  `;

  const listEl = root.querySelector('.cb-comments-list');
  const loadingEl = root.querySelector('.cb-comments-loading');
  const form = root.querySelector('.cb-compose');
  const statusEl = root.querySelector('.cb-compose-status');
  const nickInput = form.querySelector('[name="nick"]');
  const emailInput = form.querySelector('[name="email"]');
  const editorHost = root.querySelector('.cb-compose-editor');

  const profile = readProfile();
  if (profile.nick) nickInput.value = profile.nick;
  if (profile.email) emailInput.value = profile.email;

  const editor = new CommentRichEditor(editorHost, {
    allowImage: cfg.allowImage,
    maxLength: cfg.maxLength,
    onUpload: async file => {
      const base64 = await fileToBase64(file);
      const res = await callApi({
        action: 'UPLOAD',
        path: cfg.path,
        fileName: file.name,
        mime: file.type,
        base64,
      });
      return res.url;
    },
  });

  async function loadList() {
    loadingEl.hidden = false;
    listEl.hidden = true;
    try {
      const res = await callApi({ action: 'GET', path: cfg.path, limit: cfg.pageSize });
      const comments = res.comments || [];
      listEl.innerHTML = comments.length
        ? comments.map(c => renderCommentItem(c)).join('')
        : '<p class="cb-empty">暂无评论，来说第一句吧。</p>';
      loadingEl.hidden = true;
      listEl.hidden = false;
      postHeight(true);
    } catch (err) {
      loadingEl.innerHTML = `<div class="comments-hint">${escapeHtml(err.message || '加载失败')}</div>`;
      postHeight(true);
    }
  }

  bindCommentListInteractions(listEl, { path: cfg.path, callApi, onSuccess: loadList });

  form.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    statusEl.textContent = '';
    if (!editor.isValid()) {
      statusEl.textContent = editor.getPlainLength() > cfg.maxLength ? '内容过长' : '请输入评论内容';
      statusEl.classList.add('is-error');
      return;
    }
    const nick = nickInput.value.trim();
    const email = emailInput.value.trim();
    const submitBtn = form.querySelector('.cb-submit');
    submitBtn.disabled = true;
    statusEl.classList.remove('is-error');
    statusEl.textContent = '提交中…';
    try {
      await callApi({
        action: 'POST',
        path: cfg.path,
        nick,
        email,
        contentHtml: editor.getHtml(),
        parentId: null,
        pageTitle: cfg.pageTitle || document.title,
        pageUrl: cfg.pageUrl || params.get('pageUrl') || '',
      });
      saveProfile({ nick, email });
      editor.clear();
      statusEl.textContent = cfg.moderation ? '已提交，待审核通过后显示' : '发表成功';
      await loadList();
    } catch (err) {
      statusEl.textContent = err.message || '发表失败';
      statusEl.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      postHeight(true);
    }
  });

  observeHeight();

  try {
    await loadList();
  } catch (err) {
    showError(root, err.message || '初始化失败');
  }
}

mount().catch(err => {
  const root = document.getElementById('gitblog-comments-root');
  if (root) showError(root, err.message || '加载失败');
});
