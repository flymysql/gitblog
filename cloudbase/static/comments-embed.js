/**
 * CloudBase 评论嵌入页（托管于 {envId}-{appId}.tcloudbaseapp.com）
 * 优先用 Web SDK callFunction（同环境托管域，移动端/微信更稳定）；
 * HTTP 仅作桌面端兜底。
 */
import {
  mountAvatarPicker,
  renderCommentAvatarHtml,
  resolveCommentAvatar,
  isValidCommentAvatar,
  pickRandomCommentAvatar,
} from './comment-avatars.js';

const SDK_URL = 'https://static.cloudbase.net/cloudbase-js-sdk/2.17.3/cloudbase.full.js';
const COMMENT_IMG_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const PROFILE_KEY = 'gitblog-comment-profile-v1';
const GUEST_NICK_COOKIE = 'gitblog_guest_nick';
const GUEST_NICK_COOKIE_MAX_AGE_DAYS = 365;
const GUEST_NICK_ADJS = ['快乐', '热心', '佛系', '可爱', '神秘', '躺平', '元气', '沉思', '打卡', '随手'];
const GUEST_NICK_NOUNS = ['小鸡', '访客', '码农', '旅人', '吃瓜选手', '夜猫子', '冲浪人', '书虫', '种花人', '路人甲'];

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
  mobileDock: params.get('mobileDock') === '1',
  context: String(params.get('context') || 'post').trim().toLowerCase(),
};

const mode = String(params.get('mode') || 'light').trim().toLowerCase();
document.documentElement.setAttribute('data-mode', mode === 'dark' ? 'dark' : 'light');

let _heightTimer = null;
let _app = null;
let _authReady = null;
let _commentCount = null;

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

function guessFileIdFromImgEl(img) {
  const fid = String(img.getAttribute('data-cb-fileid') || '').trim();
  if (fid.startsWith('cloud://')) return fid;
  const raw = String(img.getAttribute('src') || '').trim();
  if (raw.startsWith('cloud://')) return raw;
  try {
    const u = new URL(raw);
    const proxyFileId = u.searchParams.get('fileId');
    if (String(u.searchParams.get('action') || '').toUpperCase() === 'IMAGE' && proxyFileId?.startsWith('cloud://')) {
      return proxyFileId;
    }
    if (/\.tcb\.qcloud\.la$/i.test(u.hostname) && u.pathname.includes('/comments/')) {
      const cloudPath = decodeURIComponent(u.pathname.replace(/^\//, ''));
      if (cfg.envId && cloudPath) return `cloud://${cfg.envId}/${cloudPath}`;
    }
  } catch { /* ignore */ }
  return '';
}

function imgNeedsHydration(img) {
  const src = String(img.getAttribute('src') || '');
  if (!guessFileIdFromImgEl(img)) return false;
  if (!src || src === COMMENT_IMG_PLACEHOLDER) return true;
  if (src.startsWith('cloud://')) return true;
  try {
    const u = new URL(src);
    if (String(u.searchParams.get('action') || '').toUpperCase() === 'IMAGE') return true;
    if (/\.tcb\.qcloud\.la$/i.test(u.hostname)) return true;
  } catch { /* ignore */ }
  return false;
}

async function hydrateCommentImages(root, callApiFn) {
  if (!root || !callApiFn) return;
  const imgs = [...root.querySelectorAll('img')].filter(imgNeedsHydration);
  if (!imgs.length) return;
  await Promise.all(imgs.map(async img => {
    if (img.dataset.cbHydrating === '1' || img.dataset.cbHydrated === '1') return;
    const fileId = guessFileIdFromImgEl(img);
    if (!fileId) return;
    img.setAttribute('data-cb-fileid', fileId);
    img.dataset.cbHydrating = '1';
    try {
      const res = await callApiFn({ action: 'IMAGE', fileId });
      if (res?.base64 && res?.mime) {
        img.src = `data:${res.mime};base64,${res.base64}`;
        img.dataset.cbHydrated = '1';
      }
    } catch { /* keep placeholder */ } finally {
      delete img.dataset.cbHydrating;
    }
  }));
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function measureComposeHeight(form) {
  if (!form) return 0;
  return Math.ceil(Math.max(form.offsetHeight, form.scrollHeight, form.getBoundingClientRect().height));
}

function postHeight(ready = false) {
  clearTimeout(_heightTimer);
  _heightTimer = setTimeout(() => {
    const form = document.querySelector('.cb-compose.is-sheet-open');
    const composeOpen = !!form;
    const composeHeight = composeOpen ? measureComposeHeight(form) : 0;
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    try {
      window.parent.postMessage({
        type: 'gitblog-comments-height',
        height: h,
        composeHeight,
        composeOpen,
        commentCount: _commentCount,
        ready,
      }, '*');
    } catch { /* ignore */ }
  }, 80);
}

function observeHeight() {
  postHeight(true);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => postHeight(true));
    ro.observe(document.body);
    const form = document.querySelector('.cb-compose');
    if (form) ro.observe(form);
    const editorBody = document.querySelector('.cb-compose .cb-editor-body');
    if (editorBody) ro.observe(editorBody);
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
      if (tag === 'SPAN' && (child.getAttribute('class') || '') === 'cb-mention') {
        child.remove();
        return;
      }
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
        if (tag === 'IMG' && (n === 'src' || n === 'alt' || n === 'title' || n === 'loading' || n === 'data-cb-fileid')) return;
        if (tag === 'SPAN' && n === 'class') {
          const cls = child.getAttribute('class') || '';
          if (cls === 'cb-uploading') return;
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
        const fileId = child.getAttribute('data-cb-fileid') || '';
        if (!/^https?:\/\//i.test(src) && !src.startsWith('cloud://') && !src.startsWith('data:image/') && !fileId.startsWith('cloud://')) {
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

function saveProfile({ nick, email, avatar }) {
  try {
    const prev = readProfile();
    const next = {
      nick: nick ?? prev.nick ?? '',
      email: email ?? prev.email ?? '',
      avatar: avatar ?? prev.avatar ?? '',
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function getOrCreateGuestAvatar() {
  const profile = readProfile();
  if (isValidCommentAvatar(profile.avatar)) return profile.avatar;
  const avatar = pickRandomCommentAvatar();
  saveProfile({ avatar });
  return avatar;
}

function readGuestNickCookie() {
  const m = document.cookie.match(new RegExp(`(?:^|; )${GUEST_NICK_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : '';
}

function writeGuestNickCookie(nick) {
  const safe = encodeURIComponent(String(nick || '').slice(0, 40));
  const maxAge = GUEST_NICK_COOKIE_MAX_AGE_DAYS * 86400;
  document.cookie = `${GUEST_NICK_COOKIE}=${safe}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function sanitizeCustomNick(raw) {
  return String(raw || '').replace(/\d/g, '').trim().slice(0, 40);
}

function randomGuestNick() {
  const adj = GUEST_NICK_ADJS[Math.floor(Math.random() * GUEST_NICK_ADJS.length)];
  const noun = GUEST_NICK_NOUNS[Math.floor(Math.random() * GUEST_NICK_NOUNS.length)];
  return `${adj}${noun}`;
}

function getOrCreateGuestNick() {
  const cached = sanitizeCustomNick(readGuestNickCookie());
  if (cached) return cached;
  const nick = randomGuestNick();
  writeGuestNickCookie(nick);
  return nick;
}

function resolveCommentNick(inputNick) {
  const trimmed = String(inputNick || '').trim();
  if (trimmed) {
    const nick = sanitizeCustomNick(trimmed);
    if (nick) {
      writeGuestNickCookie(nick);
      return nick;
    }
    return getOrCreateGuestNick();
  }
  return getOrCreateGuestNick();
}

function prefillCommentNick(inputEl) {
  if (!inputEl || inputEl.value.trim()) return;
  const profile = readProfile();
  if (profile.nick) {
    inputEl.value = sanitizeCustomNick(profile.nick) || getOrCreateGuestNick();
    return;
  }
  inputEl.value = getOrCreateGuestNick();
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
  constructor(root, { allowImage = true, maxLength = 5000, onUpload, onDiscardUpload, onChange, alwaysShowBar = false } = {}) {
    this.root = root;
    this.allowImage = allowImage;
    this.maxLength = maxLength;
    this.onUpload = onUpload;
    this.onDiscardUpload = onDiscardUpload;
    this.onChange = onChange;
    this.alwaysShowBar = alwaysShowBar;
    this.attachments = [];
    this._attachmentSeq = 0;
    this._emojiOpen = false;
    this._render();
    this._bind();
  }

  _render() {
    this.root.innerHTML = `
      <div class="cb-editor-wrap">
        <div class="cb-editor-attachments" hidden></div>
        <div class="cb-editor cb-editor--minimal">
          <div class="cb-editor-body" contenteditable="true" data-placeholder="写下你的想法…" role="textbox" aria-multiline="true"></div>
          <div class="cb-editor-emoji" hidden></div>
          <div class="cb-editor-bar">
            <div class="cb-editor-tools" role="toolbar" aria-label="评论工具">
              <button type="button" class="cb-tb" data-action="emoji" title="表情">😊</button>
              ${this.allowImage ? '<button type="button" class="cb-tb" data-action="image" title="图片">🖼</button>' : ''}
            </div>
            <span class="cb-editor-count" hidden>0 / ${this.maxLength}</span>
          </div>
          <input type="file" accept="image/*" class="cb-editor-file" hidden>
        </div>
      </div>
    `;
    this.wrapEl = this.root.querySelector('.cb-editor-wrap');
    this.attachmentsEl = this.root.querySelector('.cb-editor-attachments');
    this.editorEl = this.root.querySelector('.cb-editor');
    this.tools = this.root.querySelector('.cb-editor-tools');
    this.body = this.root.querySelector('.cb-editor-body');
    this.emojiPanel = this.root.querySelector('.cb-editor-emoji');
    this.countEl = this.root.querySelector('.cb-editor-count');
    this.fileInput = this.root.querySelector('.cb-editor-file');
    if (this.alwaysShowBar) this.editorEl.classList.add('is-focused');
    this.emojiPanel.innerHTML = EMOJI_GROUPS.map(row =>
      `<div class="cb-emoji-row">${row.map(e =>
        `<button type="button" class="cb-emoji-btn" data-emoji="${e}">${e}</button>`
      ).join('')}</div>`
    ).join('');
  }

  _bind() {
    this.tools.addEventListener('click', e => {
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
    this.attachmentsEl.addEventListener('click', e => {
      const btn = e.target.closest('.cb-editor-attachment-remove');
      if (!btn) return;
      e.preventDefault();
      const item = btn.closest('.cb-editor-attachment');
      const id = Number(item?.dataset.aid);
      if (id) this._removeAttachment(id);
    });
    this.body.addEventListener('focus', () => this.editorEl.classList.add('is-focused'));
    this.body.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.root.contains(document.activeElement)) {
          this.editorEl.classList.remove('is-focused');
        }
      }, 0);
    });

    document.addEventListener('click', e => {
      if (!this._emojiOpen) return;
      if (this.root.contains(e.target)) return;
      this._toggleEmoji(false);
    });
  }

  _toggleEmoji(open) {
    this._emojiOpen = open ?? this.emojiPanel.hidden;
    this.emojiPanel.hidden = !this._emojiOpen;
    this._autosizeBody();
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
      if (file) await this._uploadAttachment(file);
      return;
    }
  }

  async _onPickImage() {
    const file = this.fileInput.files?.[0];
    this.fileInput.value = '';
    if (!file) return;
    await this._uploadAttachment(file);
  }

  _syncAttachmentsBar() {
    const items = this.attachments;
    this.attachmentsEl.hidden = !items.length;
    this.attachmentsEl.innerHTML = items.map(a => `
      <div class="cb-editor-attachment${a.uploading ? ' is-uploading' : ''}" data-aid="${a.id}">
        ${a.uploading
    ? '<span class="cb-editor-attachment-loading" aria-hidden="true"></span>'
    : `<img src="${escapeHtml(a.previewUrl)}" alt="待发送图片" loading="lazy">`}
        <button type="button" class="cb-editor-attachment-remove" aria-label="移除图片" ${a.uploading ? 'hidden' : ''}>×</button>
      </div>
    `).join('');
    postHeight(true);
  }

  _removeAttachment(id) {
    const att = this.attachments.find(a => a.id === id);
    if (att?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(att.previewUrl);
    if (att?.fileId) {
      this.onDiscardUpload?.(att.fileId).catch(() => null);
    }
    this.attachments = this.attachments.filter(a => a.id !== id);
    this._syncAttachmentsBar();
    this._syncCount();
  }

  async _uploadAttachment(file) {
    if (!this.onUpload) return;
    const id = ++this._attachmentSeq;
    const previewUrl = URL.createObjectURL(file);
    this.attachments.push({ id, fileId: '', previewUrl, uploading: true });
    this._syncAttachmentsBar();
    this._syncCount();
    try {
      const result = await this.onUpload(file);
      const fileId = typeof result === 'object' ? result?.fileId : '';
      if (!fileId) throw new Error('图片上传失败');
      const att = this.attachments.find(a => a.id === id);
      if (att) {
        att.fileId = fileId;
        att.uploading = false;
      }
      this._syncAttachmentsBar();
      this._syncCount();
    } catch {
      this._removeAttachment(id);
      throw new Error('图片上传失败');
    }
  }

  _hasReadyAttachments() {
    return this.attachments.some(a => a.fileId && !a.uploading);
  }

  _getTextHtml() {
    const clone = this.body.cloneNode(true);
    clone.querySelectorAll('img, .cb-uploading').forEach(n => n.remove());
    return sanitizeCommentHtml(clone.innerHTML);
  }

  _getAttachmentHtml() {
    return this.attachments
      .filter(a => a.fileId && !a.uploading)
      .map(a => `<p class="cb-comment-img-line"><img src="${COMMENT_IMG_PLACEHOLDER}" alt="评论图片" loading="lazy" data-cb-fileid="${escapeHtml(a.fileId)}"></p>`)
      .join('');
  }

  _autosizeBody() {
    const el = this.body;
    if (!el) return;
    const inSheet = el.closest('.cb-compose.is-sheet-open');
    if (!inSheet) {
      el.style.height = '';
      el.style.overflowY = '';
      return;
    }
    el.style.height = 'auto';
    const cap = Math.round(window.innerHeight * 0.5);
    const needed = el.scrollHeight;
    if (needed > cap) {
      el.style.height = `${cap}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${Math.max(needed, 48)}px`;
      el.style.overflowY = 'hidden';
    }
  }

  _syncCount() {
    const text = this.body.innerText || '';
    const len = text.length;
    const hasText = len > 0;
    const hasContent = hasText || this._hasReadyAttachments() || this.attachments.some(a => a.uploading);
    this.countEl.textContent = `${len} / ${this.maxLength}`;
    this.countEl.hidden = !hasText;
    this.countEl.classList.toggle('is-over', len > this.maxLength);
    this.editorEl.classList.toggle('has-content', hasContent);
    this.wrapEl?.classList.toggle('has-attachments', this.attachments.length > 0);
    this._autosizeBody();
    this.onChange?.(len);
    postHeight(true);
  }

  getHtml() {
    return `${this._getTextHtml()}${this._getAttachmentHtml()}`.trim();
  }

  getPlainLength() {
    return (this.body.innerText || '').length;
  }

  hasAttachments() {
    return this._hasReadyAttachments();
  }

  clear() {
    this.attachments.forEach(a => {
      if (a.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(a.previewUrl);
    });
    this.attachments = [];
    this._syncAttachmentsBar();
    this.body.innerHTML = '';
    this._syncCount();
  }

  setReplyMention(nick) {
    const name = String(nick || '访客').trim() || '访客';
    const prefix = `@${name} `;
    this.body.innerHTML = '';
    const textNode = document.createTextNode(prefix);
    this.body.appendChild(textNode);
    this.body.focus();
    try {
      const range = document.createRange();
      range.setStart(textNode, textNode.length);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch { /* ignore */ }
    this._syncCount();
    postHeight(true);
  }

  isValid() {
    const len = this.getPlainLength();
    if (this.attachments.some(a => a.uploading)) return false;
    const hasContent = len > 0 || this._hasReadyAttachments();
    return hasContent && len <= this.maxLength;
  }
}

function renderCommentItem(c, { nested = true } = {}) {
  const nick = escapeHtml(c.nick || '访客');
  const nickRaw = escapeHtml(c.nick || '访客');
  const avatarHtml = renderCommentAvatarHtml(c, { escape: escapeHtml });
  const content = sanitizeCommentHtml(c.contentHtml || '');
  const replies = nested && (c.replies || []).length
    ? `<div class="cb-replies">${(c.replies || []).map(r => renderCommentItem(r, { nested: false })).join('')}</div>`
    : '';
  return `
    <article class="cb-comment${c.parentId ? ' is-reply' : ''}" data-id="${escapeHtml(c._id)}">
      ${avatarHtml}
      <div class="cb-comment-main">
        <header class="cb-comment-head">
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

function setupCommentMeta(metaEl, profile, onAvatarChange) {
  if (!metaEl) return { getAvatar: getOrCreateGuestAvatar };
  const initial = isValidCommentAvatar(profile.avatar) ? profile.avatar : getOrCreateGuestAvatar();
  const picker = mountAvatarPicker(metaEl, {
    selected: initial,
    onChange: file => {
      saveProfile({ avatar: file });
      onAvatarChange?.(file);
      postHeight(true);
    },
  });
  return {
    getAvatar: () => resolveCommentAvatar(picker.getSelected(), ''),
  };
}

function commentPageContext() {
  return String(cfg.context || 'post').trim().toLowerCase();
}

function isMobileDock() {
  // 以父页传入的 mobileDock 为准（父页按自身视口判断）。
  // PC 端随笔区 iframe 较窄时，iframe 内 matchMedia 会误判为移动端，故不能依赖它。
  const dockParam = params.get('mobileDock');
  if (dockParam === '1') return true;
  if (dockParam === '0') return false;
  return window.matchMedia('(max-width: 640px)').matches;
}

function isMobileComposeActive() {
  return isMobileDock();
}

function shouldShowPersistentMobileDock() {
  const ctx = String(cfg.context || 'post').trim().toLowerCase();
  return ctx === 'post';
}

function notifyParentComposePin(open) {
  try {
    window.parent.postMessage({ type: 'gitblog-comments-compose-pin', open: !!open }, '*');
  } catch { /* ignore */ }
}

function initMobileComposePortal(root, form) {
  if (!isMobileDock() || !root || !form) return;
  root.classList.add('cb-comments--mobile-dock');
  form.classList.add('cb-compose--mobile-portal');
  if (form.parentElement !== document.body) {
    document.body.appendChild(form);
  }
}

/** 评论底栏：头像居左，发送居右（PC / 移动端共用） */
function setupComposeFooterChrome(form, metaEl, actionsEl) {
  if (!form) return;
  let footer = form.querySelector('.cb-compose-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'cb-compose-footer';
    footer.hidden = true;
    form.appendChild(footer);
  }
  let avatarWrap = footer.querySelector('[data-cb-avatar-picker-wrap]')
    || metaEl?.querySelector('[data-cb-avatar-picker-wrap]')
    || form.querySelector('[data-cb-avatar-picker-wrap]');
  if (avatarWrap && !footer.contains(avatarWrap)) {
    avatarWrap.classList.add('cb-compose-footer-avatar');
    avatarWrap.querySelector('.cb-avatar-picker-label')?.setAttribute('hidden', '');
    footer.insertBefore(avatarWrap, footer.firstChild);
  }
  const status = actionsEl?.querySelector('.cb-compose-status')
    || form.querySelector('.cb-compose-status');
  const submit = actionsEl?.querySelector('.cb-submit')
    || form.querySelector('.cb-submit');
  if (status && !footer.contains(status)) footer.appendChild(status);
  if (submit && !footer.contains(submit)) {
    submit.textContent = '发送';
    footer.appendChild(submit);
  }
}

function bindMobileComposeTrigger(root, mobileCtrl) {
  if (!isMobileDock() || !root || !mobileCtrl) return;
  if (shouldShowPersistentMobileDock()) return;
  if (root.querySelector('.cb-mobile-compose-trigger')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cb-mobile-compose-trigger';
  btn.textContent = '说点什么…';
  btn.setAttribute('aria-label', '写评论');
  btn.addEventListener('click', () => {
    mobileCtrl.clearReply();
    mobileCtrl.open();
  });
  const anchor = root.querySelector('.cb-comments-loading') || root.querySelector('.cb-comments-list');
  if (anchor) root.insertBefore(btn, anchor);
  else root.appendChild(btn);
}

function bindComposeReveal(form, editor, { metaEl, actionsEl, mobileMode = false } = {}) {
  const footer = form.querySelector('.cb-compose-footer');
  const refresh = () => {
    const showExtra = editorHasContent(editor);
    const sheetOpen = form.classList.contains('is-sheet-open');
    if (mobileMode) {
      if (footer) footer.hidden = !sheetOpen;
      if (metaEl) metaEl.hidden = !sheetOpen || !showExtra;
      if (actionsEl) actionsEl.hidden = true;
    } else {
      if (footer) footer.hidden = !showExtra;
      if (metaEl) metaEl.hidden = !showExtra;
      if (actionsEl) actionsEl.hidden = true;
    }
    form.classList.toggle('cb-compose--active', showExtra || sheetOpen);
    editor._autosizeBody?.();
    postHeight(true);
  };
  const prevOnChange = editor.onChange;
  editor.onChange = len => {
    prevOnChange?.(len);
    refresh();
  };
  form.addEventListener('focusin', () => form.classList.add('cb-compose--focused'));
  form.addEventListener('focusout', e => {
    if (!form.contains(e.relatedTarget)) form.classList.remove('cb-compose--focused');
  });
  form.addEventListener('cb-compose-sheet-change', refresh);
  refresh();
  return refresh;
}

function editorHasContent(editor) {
  const body = editor?.body;
  if (!body) return false;
  if (String(body.innerText || '').replace(/\u200b/g, '').trim().length > 0) return true;
  if (editor.hasAttachments?.()) return true;
  return !!(editor.attachments?.some(a => a.uploading));
}

function commentSubmitHint(editor, maxLength) {
  if (editor.attachments?.some(a => a.uploading)) return '图片上传中，请稍候';
  if (editor.getPlainLength() > maxLength) return '内容过长';
  if (!editor.getPlainLength() && !editor.hasAttachments?.()) return '请输入评论内容';
  return '请输入评论内容';
}

function syncReplyMetaVisibility(editor, metaEl) {
  if (!metaEl) return;
  const show = editorHasContent(editor);
  if (show) {
    metaEl.removeAttribute('hidden');
    metaEl.classList.add('is-visible');
  } else {
    metaEl.setAttribute('hidden', '');
    metaEl.classList.remove('is-visible');
  }
  editor._autosizeBody?.();
}

function bindInlineReplyReveal(editor, metaEl) {
  const refresh = () => {
    syncReplyMetaVisibility(editor, metaEl);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => postHeight(true));
    });
  };
  const prevOnChange = editor.onChange;
  editor.onChange = () => {
    prevOnChange?.(editor.getPlainLength());
    refresh();
  };
  if (editor.body) {
    editor.body.addEventListener('input', refresh);
    editor.body.addEventListener('keyup', refresh);
    editor.body.addEventListener('paste', () => setTimeout(refresh, 0));
    editor.body.addEventListener('compositionend', refresh);
  }
  refresh();
}

function isEmbedIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function createMobileComposeController(root, form, editor) {
  const state = {
    mode: 'new',
    parentId: null,
    replyNick: null,
    replyBtn: null,
  };

  const updateSheetTitle = () => {
    const title = form.querySelector('.cb-mobile-sheet-title');
    if (!title) return;
    title.textContent = state.mode === 'reply' && state.replyNick
      ? `回复 ${state.replyNick}`
      : '发表评论';
  };

  const clearReply = () => {
    state.replyBtn?.classList.remove('is-active');
    state.mode = 'new';
    state.parentId = null;
    state.replyNick = null;
    state.replyBtn = null;
    updateSheetTitle();
  };

  const setReply = ({ parentId, replyNick, replyBtn }) => {
    closeAllInlineReplies(root);
    clearReply();
    state.mode = 'reply';
    state.parentId = parentId;
    state.replyNick = replyNick;
    state.replyBtn = replyBtn;
    replyBtn?.classList.add('is-active');
    updateSheetTitle();
    editor.clear();
  };

  const applyReplyMention = () => {
    if (state.mode === 'reply' && state.replyNick) {
      editor.setReplyMention(state.replyNick);
    }
  };

  const sheet = bindMobileComposeSheet(form, editor, {
    root,
    onOpen: () => postHeight(true),
    onClose: () => {
      clearReply();
      postHeight(true);
    },
  });

  const onMessage = e => {
    if (e.data?.type === 'gitblog-comments-compose-open') {
      if (e.data.parentId) {
        setReply({
          parentId: e.data.parentId,
          replyNick: e.data.replyNick || '访客',
          replyBtn: null,
        });
        sheet.open({ onReady: applyReplyMention });
      } else {
        clearReply();
        sheet.open();
      }
      return;
    }
    if (e.data?.type === 'gitblog-comments-compose-close') sheet.close();
  };
  window.addEventListener('message', onMessage);

  return {
    sheet,
    setReply,
    clearReply,
    getParentId: () => (state.mode === 'reply' ? state.parentId : null),
    open: replyCtx => {
      if (replyCtx?.parentId) {
        setReply(replyCtx);
        sheet.open({ onReady: applyReplyMention });
      } else {
        clearReply();
        editor.clear();
        sheet.open();
      }
    },
    close: () => sheet.close(),
    notifySubmitted: () => sheet.notifySubmitted(),
    cleanup: () => window.removeEventListener('message', onMessage),
  };
}

function bindMobileComposeSheet(form, editor, { root, onClose, onOpen } = {}) {
  if (!isMobileDock()) {
    return { open: () => {}, close: () => {}, notifySubmitted: () => {} };
  }

  const commentsRoot = root || form.closest('.cb-comments');
  commentsRoot?.classList.add('cb-comments--mobile-dock');

  if (!form.querySelector('.cb-mobile-sheet-header')) {
    const header = document.createElement('div');
    header.className = 'cb-mobile-sheet-header';
    header.innerHTML = `
      <span class="cb-mobile-sheet-title">发表评论</span>
      <button type="button" class="cb-mobile-sheet-close" aria-label="关闭">取消</button>
    `;
    form.prepend(header);
  }

  const close = () => {
    if (!form.classList.contains('is-sheet-open')) return;
    form.classList.remove('is-sheet-open');
    commentsRoot?.classList.remove('cb-comments--compose-only');
    editor.clear();
    editor.body.blur();
    form.dispatchEvent(new CustomEvent('cb-compose-sheet-change', { bubbles: true }));
    notifyParentComposePin(false);
    onClose?.();
    postHeight(true);
    try {
      window.parent.postMessage({ type: 'gitblog-comments-compose-close' }, '*');
    } catch { /* ignore */ }
  };

  const open = (opts = {}) => {
    const wasOpen = form.classList.contains('is-sheet-open');
    if (!wasOpen) {
      form.classList.add('is-sheet-open');
      commentsRoot?.classList.add('cb-comments--compose-only');
      onOpen?.();
      postHeight(true);
    }
    setupComposeFooterChrome(form, form.querySelector('.cb-compose-meta'), form.querySelector('.cb-compose-actions'));
    notifyParentComposePin(true);
    form.dispatchEvent(new CustomEvent('cb-compose-sheet-change', { bubbles: true }));
    setTimeout(() => {
      editor._autosizeBody?.();
      postHeight(true);
      editor.body.focus();
      opts.onReady?.();
    }, wasOpen ? 0 : 120);
  };

  form.querySelector('.cb-mobile-sheet-close')?.addEventListener('click', close);

  window.addEventListener('message', e => {
    if (e.data?.type === 'gitblog-comments-dock' && commentsRoot) {
      commentsRoot.style.paddingBottom = e.data.visible ? 'calc(56px + env(safe-area-inset-bottom))' : '';
      postHeight(true);
    }
  });

  return {
    open,
    close,
    notifySubmitted: () => {
      close();
      try {
        window.parent.postMessage({ type: 'gitblog-comments-compose-submitted' }, '*');
      } catch { /* ignore */ }
    },
  };
}

function closeAllInlineReplies(root) {
  if (!root) return;
  root.querySelectorAll('.cb-inline-reply').forEach(el => el.remove());
  root.querySelectorAll('[data-reply].is-active').forEach(btn => btn.classList.remove('is-active'));
}

function mountInlineReply(slot, ctx) {
  if (isMobileComposeActive()) {
    ctx.mobileCtrl?.open({
      parentId: ctx.parentId || '',
      replyNick: ctx.replyNick || '访客',
      replyBtn: null,
    });
    return;
  }
  const { parentId, replyNick, path, callApi, onSuccess } = ctx;
  const commentsRoot = slot.closest('.cb-comments');
  closeAllInlineReplies(commentsRoot);
  const placeholderNick = String(cfg.placeholderNick || '访客').trim() || '访客';

  const panel = document.createElement('div');
  panel.className = 'cb-inline-reply';
  panel.innerHTML = `
    <div class="cb-inline-reply-head">回复 ${escapeHtml(replyNick)}</div>
    <div class="cb-inline-reply-editor"></div>
    <div class="cb-inline-reply-actions">
      <div class="cb-inline-reply-meta cb-compose-meta" hidden>
        <label class="cb-field">
          <span>昵称</span>
          <input type="text" name="nick" maxlength="40" placeholder="${escapeHtml(placeholderNick)}（可选）" autocomplete="nickname">
        </label>
        <label class="cb-field">
          <span>邮箱</span>
          <input type="email" name="email" maxlength="120" placeholder="可选，用于接收回复通知" autocomplete="email">
        </label>
      </div>
      <div class="cb-inline-reply-buttons">
        <button type="button" class="cb-link-btn" data-cancel-reply>取消</button>
        <button type="button" class="cb-submit cb-submit--sm" data-submit-reply>发送</button>
      </div>
    </div>
    <span class="cb-inline-reply-status" aria-live="polite"></span>
  `;
  slot.appendChild(panel);

  const editorHost = panel.querySelector('.cb-inline-reply-editor');
  const metaEl = panel.querySelector('.cb-inline-reply-meta');
  const nickInput = panel.querySelector('[name="nick"]');
  const emailInput = panel.querySelector('[name="email"]');
  const statusEl = panel.querySelector('.cb-inline-reply-status');
  const profile = readProfile();
  prefillCommentNick(nickInput);
  if (profile.email) emailInput.value = profile.email;
  const metaAvatar = setupCommentMeta(metaEl, profile);
  const editor = new CommentRichEditor(editorHost, {
    allowImage: cfg.allowImage,
    maxLength: cfg.maxLength,
    alwaysShowBar: true,
    onDiscardUpload: fileId => callApi({ action: 'DISCARD_UPLOAD', fileId }).catch(() => null),
    onUpload: async file => {
      const base64 = await fileToBase64(file);
      const res = await callApi({
        action: 'UPLOAD',
        path,
        fileName: file.name,
        mime: file.type,
        base64,
      });
      return { url: res.url, fileId: res.fileId };
    },
  });
  bindInlineReplyReveal(editor, metaEl);
  editor.setReplyMention(replyNick);
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => postHeight(true));
    ro.observe(panel);
  }

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
      statusEl.textContent = commentSubmitHint(editor, cfg.maxLength);
      statusEl.classList.add('is-error');
      return;
    }
    const nick = resolveCommentNick(nickInput.value);
    const email = emailInput.value.trim() || profile.email || '';
    const avatar = resolveCommentAvatar(metaAvatar.getAvatar(), nick);
    submitBtn.disabled = true;
    statusEl.classList.remove('is-error');
    statusEl.textContent = '发送中…';
    try {
      await callApi({
        action: 'POST',
        path,
        nick,
        email,
        avatar,
        contentHtml: editor.getHtml(),
        parentId,
        pageTitle: cfg.pageTitle || document.title,
        pageUrl: cfg.pageUrl || params.get('pageUrl') || '',
      });
      saveProfile({ nick, email, avatar });
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
  postHeight(true);
  editor.body.focus();
  postHeight(true);
}

function bindCommentListInteractions(listEl, ctx) {
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-reply]');
    if (!btn || e.target.closest('.cb-inline-reply')) return;
    e.preventDefault();
    if (isMobileComposeActive()) {
      closeAllInlineReplies(btn.closest('.cb-comments'));
      if (!ctx.mobileCtrl) return;
      ctx.mobileCtrl.open({
        parentId: btn.dataset.reply || '',
        replyNick: btn.dataset.replyNick || '访客',
        replyBtn: btn,
      });
      return;
    }
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
    <div class="cb-comments${cfg.context === 'tool' ? ' cb-comments--flat' : ''}" data-path="${escapeHtml(cfg.path)}">
      <form class="cb-compose cb-compose--minimal" novalidate>
        <div class="cb-compose-editor"></div>
        <div class="cb-compose-meta" hidden>
          <label class="cb-field">
            <span>昵称</span>
            <input type="text" name="nick" maxlength="40" placeholder="${escapeHtml(cfg.placeholderNick)}（可选）" autocomplete="nickname">
          </label>
          <label class="cb-field">
            <span>邮箱</span>
            <input type="email" name="email" maxlength="120" placeholder="可选，用于接收回复通知" autocomplete="email">
          </label>
        </div>
        <div class="cb-compose-actions" hidden>
          <span class="cb-compose-status" aria-live="polite"></span>
          <button type="submit" class="cb-submit">发表</button>
        </div>
      </form>
      <div class="cb-comments-loading" aria-live="polite">评论加载中…</div>
      <div class="cb-comments-list" hidden></div>
    </div>
  `;

  const commentsRoot = root.querySelector('.cb-comments') || root;
  const listEl = commentsRoot.querySelector('.cb-comments-list');
  const loadingEl = commentsRoot.querySelector('.cb-comments-loading');
  const form = commentsRoot.querySelector('.cb-compose');
  const statusEl = commentsRoot.querySelector('.cb-compose-status');
  const metaEl = form.querySelector('.cb-compose-meta');
  const actionsEl = form.querySelector('.cb-compose-actions');
  const nickInput = form.querySelector('[name="nick"]');
  const emailInput = form.querySelector('[name="email"]');
  const editorHost = commentsRoot.querySelector('.cb-compose-editor');

  const profile = readProfile();
  prefillCommentNick(nickInput);
  if (profile.email) emailInput.value = profile.email;
  const metaAvatar = setupCommentMeta(metaEl, profile);
  const mobileMode = isMobileDock();
  if (mobileMode) {
    initMobileComposePortal(commentsRoot, form);
  }
  setupComposeFooterChrome(form, metaEl, actionsEl);

  const editor = new CommentRichEditor(editorHost, {
    allowImage: cfg.allowImage,
    maxLength: cfg.maxLength,
    onDiscardUpload: fileId => callApi({ action: 'DISCARD_UPLOAD', fileId }).catch(() => null),
    onUpload: async file => {
      const base64 = await fileToBase64(file);
      const res = await callApi({
        action: 'UPLOAD',
        path: cfg.path,
        fileName: file.name,
        mime: file.type,
        base64,
      });
      return { url: res.url, fileId: res.fileId };
    },
  });

  bindComposeReveal(form, editor, { metaEl, actionsEl, mobileMode });

  const mobileCtrl = mobileMode
    ? createMobileComposeController(commentsRoot, form, editor)
    : null;

  bindMobileComposeTrigger(commentsRoot, mobileCtrl);

  async function loadList() {
    loadingEl.hidden = false;
    listEl.hidden = true;
    try {
      const res = await callApi({ action: 'GET', path: cfg.path, limit: cfg.pageSize });
      const comments = res.comments || [];
      _commentCount = comments.length;
      listEl.innerHTML = comments.length
        ? comments.map(c => renderCommentItem(c)).join('')
        : '';
      await hydrateCommentImages(listEl, callApi);
      loadingEl.hidden = true;
      listEl.hidden = false;
      postHeight(true);
    } catch (err) {
      loadingEl.innerHTML = `<div class="comments-hint">${escapeHtml(err.message || '加载失败')}</div>`;
      postHeight(true);
    }
  }

  bindCommentListInteractions(listEl, { path: cfg.path, callApi, onSuccess: loadList, mobileCtrl });

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
      statusEl.textContent = commentSubmitHint(editor, cfg.maxLength);
      statusEl.classList.add('is-error');
      return;
    }
    const nick = resolveCommentNick(nickInput.value);
    const email = emailInput.value.trim();
    const avatar = resolveCommentAvatar(metaAvatar.getAvatar(), nick);
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
        avatar,
        contentHtml: editor.getHtml(),
        parentId: mobileCtrl?.getParentId() ?? null,
        pageTitle: cfg.pageTitle || document.title,
        pageUrl: cfg.pageUrl || params.get('pageUrl') || '',
      });
      saveProfile({ nick, email, avatar });
      editor.clear();
      statusEl.textContent = cfg.moderation ? '已提交，待审核通过后显示' : '发表成功';
      mobileCtrl?.notifySubmitted?.();
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
