/**
 * CloudBase 评论嵌入页（托管于 {envId}-{appId}.tcloudbaseapp.com）
 * 通过 HTTP 调云函数，无需 Web SDK 匿名登录，避免 PERMISSION_DENIED。
 */
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
  placeholderNick: '访客',
  moderation: false,
  maxLength: 5000,
  allowImage: true,
  pageSize: 50,
};

const mode = String(params.get('mode') || 'light').trim().toLowerCase();
document.documentElement.setAttribute('data-mode', mode === 'dark' ? 'dark' : 'light');

let _heightTimer = null;

const HTTP_HINT = '请确认：① 云函数 gitblog-comments 已部署；② 控制台已开启 HTTP 访问；③ 重新部署云函数（含 CORS）。详见 cloudbase/README.md';

function resolveHttpUrl() {
  if (cfg.httpUrl) return cfg.httpUrl;
  if (!cfg.envId) throw new Error('缺少 env 参数');
  return `https://${cfg.envId}.${cfg.region}.app.tcloudbase.com/${cfg.functionName}`;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

async function callApi(payload) {
  const url = resolveHttpUrl();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(HTTP_HINT);
  }
  let result;
  try {
    result = await res.json();
  } catch {
    throw new Error(`评论服务响应异常（HTTP ${res.status}）`);
  }
  if (result?.code === 'OPERATION_FAIL' || /PERMISSION_DENIED/i.test(String(result?.msg || result?.message || ''))) {
    throw new Error('云函数权限不足：请在控制台 → 云函数 → gitblog-comments → 开启 HTTP 访问，并将安全规则 invoke 设为 true（见 cloudbase/README.md）');
  }
  if (!result || result.ok === false) {
    throw new Error(result?.message || result?.msg || `评论服务请求失败（HTTP ${res.status}）`);
  }
  return result;
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
        if (tag === 'SPAN' && n === 'class') return;
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
        <div class="cb-editor-toolbar" role="toolbar" aria-label="评论格式">
          <button type="button" class="cb-tb" data-cmd="bold" title="粗体"><b>B</b></button>
          <button type="button" class="cb-tb" data-cmd="italic" title="斜体"><i>I</i></button>
          <button type="button" class="cb-tb" data-cmd="underline" title="下划线"><u>U</u></button>
          <button type="button" class="cb-tb" data-cmd="strikeThrough" title="删除线"><s>S</s></button>
          <span class="cb-tb-sep"></span>
          <button type="button" class="cb-tb" data-cmd="insertUnorderedList" title="列表">≡</button>
          <button type="button" class="cb-tb" data-cmd="formatBlock" data-value="blockquote" title="引用">❝</button>
          <button type="button" class="cb-tb" data-cmd="createLink" title="链接">🔗</button>
          <button type="button" class="cb-tb" data-cmd="inlineCode" title="行内代码">&lt;/&gt;</button>
          <span class="cb-tb-sep"></span>
          <button type="button" class="cb-tb" data-action="emoji" title="表情">😊</button>
          ${this.allowImage ? '<button type="button" class="cb-tb" data-action="image" title="插入图片">🖼</button>' : ''}
        </div>
        <div class="cb-editor-emoji" hidden></div>
        <div class="cb-editor-body" contenteditable="true" data-placeholder="写下你的想法…" role="textbox" aria-multiline="true"></div>
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
      const btn = e.target.closest('[data-cmd], [data-action]');
      if (!btn) return;
      e.preventDefault();
      const action = btn.dataset.action;
      if (action === 'emoji') {
        this._toggleEmoji();
        return;
      }
      if (action === 'image') {
        this.fileInput.click();
        return;
      }
      const cmd = btn.dataset.cmd;
      if (cmd === 'createLink') {
        const url = window.prompt('链接地址（https://）');
        if (url) document.execCommand('createLink', false, url);
        return;
      }
      if (cmd === 'inlineCode') {
        this._wrapInlineCode();
        return;
      }
      if (cmd === 'formatBlock') {
        document.execCommand('formatBlock', false, btn.dataset.value || 'p');
        return;
      }
      document.execCommand(cmd, false, null);
      this.body.focus();
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

  _wrapInlineCode() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const code = document.createElement('code');
    if (range.collapsed) {
      code.textContent = 'code';
      range.insertNode(code);
    } else {
      code.appendChild(range.extractContents());
      range.insertNode(code);
    }
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

  isValid() {
    const len = this.getPlainLength();
    return len > 0 && len <= this.maxLength;
  }
}

function renderCommentItem(c) {
  const nick = escapeHtml(c.nick || '访客');
  const hue = avatarColor(c.nick);
  const content = sanitizeCommentHtml(c.contentHtml || '');
  const replies = (c.replies || []).map(r => renderCommentItem(r)).join('');
  return `
    <article class="cb-comment${c.parentId ? ' is-reply' : ''}" data-id="${escapeHtml(c._id)}">
      <div class="cb-comment-avatar" style="--cb-avatar-hue:${hue}" aria-hidden="true">${nick.slice(0, 1).toUpperCase()}</div>
      <div class="cb-comment-main">
        <header class="cb-comment-head">
          <strong class="cb-comment-nick">${nick}</strong>
          <time class="cb-comment-time">${escapeHtml(formatTime(c.createdAt))}</time>
        </header>
        <div class="cb-comment-body">${content || '<p></p>'}</div>
        <footer class="cb-comment-actions">
          <button type="button" class="cb-link-btn" data-reply="${escapeHtml(c._id)}">回复</button>
        </footer>
        ${replies ? `<div class="cb-replies">${replies}</div>` : ''}
      </div>
    </article>
  `;
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
        <p class="cb-compose-hint">支持粗体、链接、引用、表情与图片；Ctrl/⌘ + Enter 提交</p>
        <div class="cb-compose-actions">
          <span class="cb-compose-status" aria-live="polite"></span>
          <button type="submit" class="cb-submit">发表评论</button>
        </div>
        <input type="hidden" name="parentId" value="">
      </form>
    </div>
  `;

  const listEl = root.querySelector('.cb-comments-list');
  const loadingEl = root.querySelector('.cb-comments-loading');
  const form = root.querySelector('.cb-compose');
  const statusEl = root.querySelector('.cb-compose-status');
  const parentInput = form.querySelector('[name="parentId"]');
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

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-reply]');
    if (!btn) return;
    parentInput.value = btn.dataset.reply || '';
    statusEl.textContent = '正在回复一条评论…';
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    editor.body.focus();
  });

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
        parentId: parentInput.value.trim() || null,
        pageTitle: cfg.pageTitle || document.title,
        pageUrl: params.get('pageUrl') || '',
      });
      saveProfile({ nick, email });
      editor.clear();
      parentInput.value = '';
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
