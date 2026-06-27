// ============================================================================
// CloudBase 评论区：昵称/邮箱（可选）+ 富文本（表情、图片、基础格式）
// 通过云函数 gitblog-comments 读写数据库，不在前端暴露密钥
// ============================================================================

import { CONFIG } from './config.js';
import {
  mountAvatarPicker,
  renderCommentAvatarHtml,
  resolveCommentAvatar,
  isValidCommentAvatar,
  pickRandomCommentAvatar,
} from './comment-avatars.js';

const PROFILE_KEY = 'gitblog-comment-profile-v1';
const GUEST_NICK_COOKIE = 'gitblog_guest_nick';
const GUEST_NICK_COOKIE_MAX_AGE_DAYS = 365;
const GUEST_NICK_ADJS = ['快乐', '热心', '佛系', '可爱', '神秘', '躺平', '元气', '沉思', '打卡', '随手'];
const GUEST_NICK_NOUNS = ['小鸡', '访客', '码农', '旅人', '吃瓜选手', '夜猫子', '冲浪人', '书虫', '种花人', '路人甲'];
const SDK_URL = 'https://static.cloudbase.net/cloudbase-js-sdk/2.17.3/cloudbase.full.js';
const COMMENT_IMG_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const EMOJI_GROUPS = [
  ['😀', '😁', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋'],
  ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️', '🤞', '🎉', '🔥', '❤️'],
  ['😅', '😭', '😤', '😱', '🤔', '😴', '🥳', '🤯', '😎', '🤗', '🫡', '💯'],
  ['🌸', '🌿', '☀️', '🌙', '⭐', '🍵', '☕', '🍜', '🎈', '📚', '💡', '🚀'],
];

let _app = null;
let _authReady = null;
let _sdkPromise = null;

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

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
    s.onerror = () => reject(new Error(`脚本加载失败: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureCloudBaseAuth(app) {
  if (_authReady) return _authReady;
  _authReady = (async () => {
    const auth = app.auth();
    try {
      const state = await auth.getLoginState();
      if (!state) await auth.signInAnonymously();
    } catch (err) {
      throw new Error('CloudBase 匿名登录失败，请在控制台开启「匿名登录」：' + (err.message || err));
    }
  })();
  return _authReady;
}

async function getCloudBaseApp() {
  if (_app) return _app;
  if (!_sdkPromise) {
    _sdkPromise = loadScript(SDK_URL).then(async () => {
      const cfg = CONFIG.cloudbase || {};
      const envId = String(cfg.envId || '').trim();
      if (!envId) throw new Error('缺少 cloudbase.envId');
      // eslint-disable-next-line no-undef
      _app = cloudbase.init({
        env: envId,
        region: String(cfg.region || 'ap-shanghai').trim() || 'ap-shanghai',
      });
      await ensureCloudBaseAuth(_app);
      return _app;
    });
  }
  return _sdkPromise;
}

export function isCloudBaseReady() {
  const c = CONFIG.cloudbase || {};
  return !!(c.enabled && String(c.envId || '').trim());
}

function cloudbaseCfg() {
  return CONFIG.cloudbase || {};
}

const CORS_HINT = 'CloudBase 跨域：免费版无法添加 gitpull.cn 安全域名，请将 accessMode 改为 embed 并部署 cloudbase/static（详见 cloudbase/README.md）；升级个人版后可添加安全域名并使用 http/sdk 模式';

function resolveHttpUrl(cfg) {
  const custom = String(cfg.httpUrl || '').trim();
  if (custom) return custom;
  const envId = String(cfg.envId || '').trim();
  const region = String(cfg.region || 'ap-shanghai').trim() || 'ap-shanghai';
  const fn = String(cfg.functionName || 'gitblog-comments').trim() || 'gitblog-comments';
  return `https://${envId}.${region}.app.tcloudbase.com/${fn}`;
}

function useHttpAccess(cfg) {
  const mode = String(cfg.accessMode || 'embed').trim().toLowerCase();
  return mode === 'http';
}

async function callCommentApiHttp(payload) {
  const cfg = cloudbaseCfg();
  const url = resolveHttpUrl(cfg);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(CORS_HINT);
  }
  let result;
  try {
    result = await res.json();
  } catch {
    throw new Error(`评论服务响应异常（HTTP ${res.status}）`);
  }
  if (!result || result.ok === false) {
    throw new Error(result?.message || `评论服务请求失败（HTTP ${res.status}）`);
  }
  return result;
}

async function callCommentApi(payload) {
  if (useHttpAccess(cloudbaseCfg())) {
    return callCommentApiHttp(payload);
  }
  const app = await getCloudBaseApp();
  const fn = String(cloudbaseCfg().functionName || 'gitblog-comments').trim() || 'gitblog-comments';
  let res;
  try {
    res = await app.callFunction({ name: fn, data: payload });
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/auth|CORS|fetch|network|Failed/i.test(msg)) {
      throw new Error(CORS_HINT);
    }
    throw err;
  }
  const result = res?.result;
  if (!result || result.ok === false) {
    throw new Error(result?.message || '评论服务请求失败');
  }
  return result;
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
      const envId = String(cloudbaseCfg().envId || '').trim();
      if (envId && cloudPath) return `cloud://${envId}/${cloudPath}`;
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

async function hydrateCommentImages(root, callApi) {
  if (!root || !callApi) return;
  const imgs = [...root.querySelectorAll('img')].filter(imgNeedsHydration);
  if (!imgs.length) return;
  await Promise.all(imgs.map(async img => {
    if (img.dataset.cbHydrating === '1' || img.dataset.cbHydrated === '1') return;
    const fileId = guessFileIdFromImgEl(img);
    if (!fileId) return;
    img.setAttribute('data-cb-fileid', fileId);
    img.dataset.cbHydrating = '1';
    try {
      const res = await callApi({ action: 'IMAGE', fileId });
      if (res?.base64 && res?.mime) {
        img.src = `data:${res.mime};base64,${res.base64}`;
        img.dataset.cbHydrated = '1';
      }
    } catch { /* keep placeholder */ } finally {
      delete img.dataset.cbHydrating;
    }
  }));
}

/** 展示用 HTML 白名单净化（服务端也会再滤一遍） */
export function sanitizeCommentHtml(raw) {
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

/** 未填昵称时自动生成并写入 cookie；用户自填昵称也会缓存（不含数字） */
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
    this._renderEmoji();
  }

  _renderEmoji() {
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
    } catch (err) {
      this._removeAttachment(id);
      throw err;
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
    this.body.innerHTML = '';
    const mention = document.createElement('span');
    mention.className = 'cb-mention';
    mention.setAttribute('data-mention', name);
    mention.setAttribute('contenteditable', 'false');
    mention.textContent = `@${name}`;
    const space = document.createTextNode(' ');
    this.body.appendChild(mention);
    this.body.appendChild(space);
    this.body.focus();
    try {
      const range = document.createRange();
      range.setStart(space, 1);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch { /* ignore */ }
    this._syncCount();
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
          <time class="cb-comment-time" datetime="${escapeHtml(c.createdAtIso || '')}">${escapeHtml(formatTime(c.createdAt))}</time>
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
    },
  });
  return {
    getAvatar: () => resolveCommentAvatar(picker.getSelected(), ''),
  };
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

function bindInlineReplyReveal(editor, metaEl, panel) {
  const footer = panel?.querySelector('.cb-compose-footer');
  const refresh = () => {
    const show = editorHasContent(editor);
    syncReplyMetaVisibility(editor, metaEl);
    if (footer) footer.hidden = !show;
    panel?.classList.toggle('cb-inline-reply--active', show);
    editor._autosizeBody?.();
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

function isMobileCommentDock() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
}

/** 移动端所有页面使用底部悬浮评论抽屉 */
function shouldUseMobileCommentDock(opts = {}) {
  return isMobileCommentDock();
}

function commentPageContext(opts = {}) {
  return String(opts?.context || 'post').trim().toLowerCase();
}

/** 仅文章页显示常驻底部「说点什么…」条；随笔/工具页点击后再弹出 */
function shouldShowPersistentMobileDock(opts = {}) {
  return commentPageContext(opts) === 'post';
}

function isMobileComposeActive(opts = {}) {
  return shouldUseMobileCommentDock(opts);
}

function syncEmbedComposePin(embedWrap, open) {
  if (!embedWrap || !open) return;
  requestAnimationFrame(() => scrollEmbedForCompose(embedWrap));
}

/** 打开输入框时滚动父页，使 iframe 底边对齐视口底 —— iframe 内 fixed 输入框即贴屏幕底 */
function scrollEmbedForCompose(embedWrap) {
  if (!embedWrap) return;
  const iframe = embedWrap.querySelector('.cb-embed-frame');
  const rect = embedWrap.getBoundingClientRect();
  const iframeH = iframe?.getBoundingClientRect().height || rect.height;
  const bottom = rect.top + iframeH;
  const delta = bottom - window.innerHeight;
  if (Math.abs(delta) > 4 || rect.top < 0) {
    window.scrollTo({
      top: Math.max(0, window.scrollY + delta),
      behavior: 'smooth',
    });
  }
}

function isEmbedIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** 移动端：评论表单脱离评论区，仅底部抽屉展示 */
function initMobileComposePortal(root, form) {
  if (!isMobileCommentDock() || !root || !form) return;
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

/** 随笔/工具页：列表上方圆角假输入框入口，点开底部抽屉 */
function bindMobileComposeTrigger(root, mobileCtrl, opts = {}) {
  if (!isMobileCommentDock() || !root || !mobileCtrl) return;
  if (shouldShowPersistentMobileDock(opts)) return;
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

function createMobileComposeController(root, form, editor, { onSheetOpen, onSheetClose } = {}) {
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
    onOpen: () => {
      onSheetOpen?.();
    },
    onClose: () => {
      clearReply();
      onSheetClose?.();
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
        replyCtx.replyBtn?.closest('.cb-comment')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

/** 文章页按阅读进度；工具/随笔页按评论区是否进入视口 */
function bindMobileDockVisibility(anchorEl, onReachChange) {
  if (document.getElementById('article')) {
    return bindMobileDockScrollTrigger(anchorEl, onReachChange);
  }
  const target = anchorEl.closest('.comments') || anchorEl;
  let visible = false;
  const update = () => {
    const rect = target.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView === visible) return;
    visible = inView;
    onReachChange(visible);
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
  return () => {
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}

const COMMENTS_END_HINT_MORE = '没有更多评论了~';
const COMMENTS_END_HINT_EMPTY = '暂无评论，来留下一条评论吧~';

function syncCommentsEndHint(targetEl, commentCount) {
  const section = targetEl.closest('.comments');
  const hint = section?.querySelector('.comments-end-hint');
  if (!hint) return;
  const empty = Number(commentCount) === 0;
  hint.textContent = empty ? COMMENTS_END_HINT_EMPTY : COMMENTS_END_HINT_MORE;
  hint.hidden = false;
  hint.setAttribute('aria-hidden', 'false');
  section?.classList.toggle('comments--empty', empty);
}

function resolveEmbedFrameMinHeight(data, opts = {}) {
  if (Number(data.commentCount) === 0) return 0;
  if (data.commentCount == null && isMobileCommentDock()) return 0;
  const mobile = isMobileCommentDock();
  return mobile ? 160 : 320;
}

function resolveEmbedFrameHeight(data, measuredH, opts = {}) {
  const h = Math.max(0, Number(measuredH) || 0);
  const count = data?.commentCount;
  const knownEmpty = count !== null && count !== undefined && Number(count) === 0;
  if (knownEmpty && isMobileCommentDock()) {
    return shouldShowPersistentMobileDock(opts) ? 1 : Math.min(h, 56);
  }
  const minH = resolveEmbedFrameMinHeight(data, opts);
  return Math.min(Math.max(h, minH), 2400);
}

function applyEmbedListFrameHeight(wrap, iframe, measuredH, data, opts = {}) {
  if (!wrap || !iframe) return;
  const applied = resolveEmbedFrameHeight(data, measuredH, opts);
  wrap.dataset.cbEmbedHeight = String(applied);
  iframe.style.height = `${applied}px`;
  const empty = Number(data?.commentCount) === 0;
  wrap.classList.toggle('cb-embed-wrap--empty', empty);
}

/** 移动端：评论表单底部抽屉（直连模式） */
function bindMobileComposeSheet(form, editor, { root, onClose, onOpen } = {}) {
  if (!isMobileCommentDock()) {
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

  const syncComposeSheetPadding = () => {
    if (!commentsRoot) return;
    if (form.classList.contains('is-sheet-open')) {
      const ch = Math.ceil(form.getBoundingClientRect().height) || 280;
      commentsRoot.style.setProperty('--cb-compose-sheet-h', `${ch}px`);
    } else {
      commentsRoot.style.removeProperty('--cb-compose-sheet-h');
    }
  };

  const close = () => {
    if (!form.classList.contains('is-sheet-open')) return;
    form.classList.remove('is-sheet-open');
    commentsRoot?.classList.remove('cb-comments--compose-only');
    commentsRoot?.style.removeProperty('--cb-compose-sheet-h');
    editor.clear();
    editor.body.blur();
    form.dispatchEvent(new CustomEvent('cb-compose-sheet-change', { bubbles: true }));
    onClose?.();
  };

  const open = (opts = {}) => {
    const wasOpen = form.classList.contains('is-sheet-open');
    if (!wasOpen) {
      form.classList.add('is-sheet-open');
      commentsRoot?.classList.add('cb-comments--compose-only');
      onOpen?.();
    }
    setupComposeFooterChrome(form, form.querySelector('.cb-compose-meta'), form.querySelector('.cb-compose-actions'));
    form.dispatchEvent(new CustomEvent('cb-compose-sheet-change', { bubbles: true }));
    editor._autosizeBody?.();
    setTimeout(() => {
      editor._autosizeBody?.();
      syncComposeSheetPadding();
      editor.body.focus();
      opts.onReady?.();
    }, wasOpen ? 0 : 120);
  };

  form.querySelector('.cb-mobile-sheet-close')?.addEventListener('click', close);
  form.addEventListener('cb-compose-sheet-change', syncComposeSheetPadding);

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

function createMobileDockChrome() {
  const dock = document.createElement('div');
  dock.className = 'cb-mobile-dock';
  dock.hidden = true;
  dock.innerHTML = `
    <div class="cb-mobile-dock-bar">
      <button type="button" class="cb-mobile-dock-trigger" aria-label="写评论">说点什么…</button>
    </div>
  `;
  document.body.appendChild(dock);
  return { dock };
}

function syncMobileDockBodyState(show, dock) {
  document.body.classList.toggle('cb-has-mobile-dock', show);
  if (!show) {
    document.body.style.removeProperty('--cb-mobile-dock-h');
    return;
  }
  const apply = () => {
    const h = Math.ceil(dock?.getBoundingClientRect().height || 0);
    if (h > 0) document.body.style.setProperty('--cb-mobile-dock-h', `${h}px`);
  };
  apply();
  requestAnimationFrame(apply);
}

function clearMobileDockBodyState() {
  document.body.classList.remove('cb-has-mobile-dock');
  document.body.style.removeProperty('--cb-mobile-dock-h');
}

const MOBILE_DOCK_ARTICLE_RATIO = 0.5;

function resolveMobileDockScrollRoot(anchorEl) {
  const article = document.getElementById('article');
  if (article) return article;
  return anchorEl?.closest('.comments') || anchorEl?.closest('main') || anchorEl;
}

function isMobileDockScrollReached(scrollRoot) {
  if (!scrollRoot) return false;
  const rect = scrollRoot.getBoundingClientRect();
  const top = window.scrollY + rect.top;
  const height = scrollRoot.offsetHeight || rect.height;
  if (height <= 0) return false;
  const mid = top + height * MOBILE_DOCK_ARTICLE_RATIO;
  const viewportBottom = window.scrollY + window.innerHeight;
  return viewportBottom >= mid;
}

/** 阅读到正文约一半时触发底栏显示 */
function bindMobileDockScrollTrigger(anchorEl, onReachChange) {
  const scrollRoot = resolveMobileDockScrollRoot(anchorEl);
  let reached = false;

  const update = () => {
    const next = isMobileDockScrollReached(scrollRoot);
    if (next === reached) return;
    reached = next;
    onReachChange(reached);
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  return () => {
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}

/** 移动端：父页底部吸附条（仅文章页常驻）+ iframe 评论抽屉 */
function bindMobileEmbedDock(embedWrap, iframe, opts = {}) {
  if (!isMobileCommentDock()) return () => {};

  const persistentDock = shouldShowPersistentMobileDock(opts);
  let dock = null;
  if (persistentDock) {
    ({ dock } = createMobileDockChrome());
  }

  let composeOpen = false;
  let sectionVisible = false;
  let openGuardUntil = 0;

  const postDockState = visible => {
    if (!persistentDock) return;
    try {
      iframe.contentWindow?.postMessage({ type: 'gitblog-comments-dock', visible }, '*');
    } catch { /* ignore */ }
  };

  const syncDock = () => {
    if (!persistentDock || !dock) return;
    const show = sectionVisible && !composeOpen;
    dock.hidden = !show;
    syncMobileDockBodyState(show, dock);
    postDockState(show);
  };

  const setComposeOpen = (open, _composeHeight = 0) => {
    composeOpen = !!open;
    if (open) syncEmbedComposePin(embedWrap, true);
    syncDock();
  };

  const io = persistentDock
    ? bindMobileDockVisibility(embedWrap, visible => {
      sectionVisible = visible;
      syncDock();
    })
    : () => {};

  const openCompose = () => {
    openGuardUntil = Date.now() + 300;
    setComposeOpen(true);
    iframe.contentWindow?.postMessage({ type: 'gitblog-comments-compose-open', mode: 'new' }, '*');
  };

  const closeCompose = () => {
    if (!composeOpen) return;
    setComposeOpen(false);
  };

  dock?.querySelector('.cb-mobile-dock-trigger')?.addEventListener('click', openCompose);

  const onMessage = e => {
    if (e.source !== iframe?.contentWindow) return;
    if (e.data?.type === 'gitblog-comments-compose-close') closeCompose();
    if (e.data?.type === 'gitblog-comments-compose-submitted') closeCompose();
    if (e.data?.type === 'gitblog-comments-compose-pin') {
      setComposeOpen(!!e.data.open, Number(e.data.composeHeight) || 0);
      return;
    }
    if (
      e.data?.type === 'gitblog-comments-height'
      && e.data.composeOpen === true
    ) {
      setComposeOpen(true, Number(e.data.composeHeight) || 0);
      return;
    }
    if (
      e.data?.type === 'gitblog-comments-height'
      && e.data.composeOpen === false
      && composeOpen
      && Date.now() > openGuardUntil
    ) {
      closeCompose();
    }
  };
  window.addEventListener('message', onMessage);

  return () => {
    io();
    dock?.remove();
    window.removeEventListener('message', onMessage);
    clearMobileDockBodyState();
  };
}

/** 移动端：父页底部吸附条 + 本地表单抽屉（直连模式） */
function bindMobileDirectDock(root, form, editor, opts = {}) {
  if (!isMobileCommentDock()) return null;

  const persistentDock = shouldShowPersistentMobileDock(opts);
  let dock = null;
  if (persistentDock) {
    ({ dock } = createMobileDockChrome());
  }

  let composeOpen = false;
  let sectionVisible = false;

  const syncDock = () => {
    if (!persistentDock || !dock) return;
    const show = sectionVisible && !composeOpen;
    dock.hidden = !show;
    syncMobileDockBodyState(show, dock);
  };

  const mobileCtrl = createMobileComposeController(root, form, editor, {
    onSheetOpen: () => {
      composeOpen = true;
      syncDock();
    },
    onSheetClose: () => {
      composeOpen = false;
      syncDock();
    },
  });

  bindMobileComposeTrigger(root, mobileCtrl, opts);

  const io = persistentDock
    ? bindMobileDockVisibility(root, visible => {
      sectionVisible = visible;
      syncDock();
    })
    : () => {};

  dock?.querySelector('.cb-mobile-dock-trigger')?.addEventListener('click', () => {
    mobileCtrl.clearReply();
    mobileCtrl.open();
  });

  return {
    mobileCtrl,
    cleanup: () => {
      mobileCtrl.cleanup?.();
      io();
      dock?.remove();
      clearMobileDockBodyState();
    },
    notifySubmitted: () => {
      composeOpen = false;
      mobileCtrl.notifySubmitted();
      syncDock();
    },
  };
}

function closeAllInlineReplies(root) {
  if (!root) return;
  root.querySelectorAll('.cb-inline-reply').forEach(el => el.remove());
  root.querySelectorAll('[data-reply].is-active').forEach(btn => btn.classList.remove('is-active'));
}

function mountInlineReply(slot, ctx) {
  if (isMobileComposeActive(ctx.opts)) {
    ctx.mobileCtrl?.open({
      parentId: ctx.parentId || '',
      replyNick: ctx.replyNick || '访客',
      replyBtn: null,
    });
    return;
  }
  const { parentId, replyNick, path, cfg, callApi, onSuccess, opts = {} } = ctx;
  const commentsRoot = slot.closest('.cb-comments');
  closeAllInlineReplies(commentsRoot);
  const placeholderNick = String(cfg.placeholderNick || '访客').trim() || '访客';

  const panel = document.createElement('div');
  panel.className = 'cb-inline-reply';
  panel.innerHTML = `
    <div class="cb-inline-reply-head">
      <span class="cb-inline-reply-head-title">回复 ${escapeHtml(replyNick)}</span>
      <button type="button" class="cb-link-btn" data-cancel-reply>取消</button>
    </div>
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
      <div class="cb-inline-reply-buttons" hidden>
        <button type="button" class="cb-submit cb-submit--sm" data-submit-reply>发送</button>
      </div>
    </div>
    <span class="cb-inline-reply-status" aria-live="polite"></span>
  `;
  slot.appendChild(panel);

  const editorHost = panel.querySelector('.cb-inline-reply-editor');
  const metaEl = panel.querySelector('.cb-inline-reply-meta');
  const actionsEl = panel.querySelector('.cb-inline-reply-buttons');
  const nickInput = panel.querySelector('[name="nick"]');
  const emailInput = panel.querySelector('[name="email"]');
  const statusEl = panel.querySelector('.cb-inline-reply-status');
  const profile = readProfile();
  prefillCommentNick(nickInput);
  if (profile.email) emailInput.value = profile.email;
  const metaAvatar = setupCommentMeta(metaEl, profile);
  const maxLength = Number(cfg.maxLength) || 5000;
  const allowImage = cfg.allowImage !== false;
  const editor = new CommentRichEditor(editorHost, {
    allowImage,
    maxLength,
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
  setupComposeFooterChrome(panel, metaEl, actionsEl);
  bindInlineReplyReveal(editor, metaEl, panel);
  editor.setReplyMention(replyNick);

  const replyBtn = commentsRoot?.querySelector(`[data-reply="${CSS.escape(parentId)}"]`);
  replyBtn?.classList.add('is-active');

  panel.querySelector('[data-cancel-reply]').addEventListener('click', () => {
    panel.remove();
    replyBtn?.classList.remove('is-active');
  });

  const submitBtn = panel.querySelector('[data-submit-reply]');
  const doSubmit = async () => {
    statusEl.textContent = '';
    if (!editor.isValid()) {
      statusEl.textContent = commentSubmitHint(editor, maxLength);
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
        pageTitle: opts.pageTitle || document.title,
        pageUrl: opts.pageUrl || location.href,
      });
      saveProfile({ nick, email, avatar });
      closeAllInlineReplies(commentsRoot);
      await onSuccess();
    } catch (err) {
      statusEl.textContent = err.message || '发送失败';
      statusEl.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
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
  try {
    const range = document.createRange();
    range.selectNodeContents(editor.body);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch { /* ignore */ }
}

function bindCommentListInteractions(listEl, ctx) {
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-reply]');
    if (!btn || e.target.closest('.cb-inline-reply')) return;
    e.preventDefault();
    if (isMobileComposeActive(ctx.opts)) {
      closeAllInlineReplies(btn.closest('.cb-comments'));
      if (!ctx.mobileCtrl) return;
      btn.closest('.cb-comment')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

function resolveEmbedPageUrl(cfg, path, opts = {}, embedPageOverride = null) {
  const custom = String(cfg.embedUrl || '').trim();
  const envId = String(cfg.envId || '').trim();
  const region = String(cfg.region || 'ap-shanghai').trim() || 'ap-shanghai';
  let url;
  if (custom) {
    url = new URL(custom);
  } else {
    const base = String(cfg.embedBaseUrl || '').trim();
    if (!base) return null;
    const page = embedPageOverride
      || String(cfg.embedPage || 'comments-embed.html').trim()
      || 'comments-embed.html';
    url = new URL(page, base.endsWith('/') ? base : `${base}/`);
  }
  url.searchParams.set('path', path);
  url.searchParams.set('env', envId);
  url.searchParams.set('region', region);
  url.searchParams.set('fn', String(cfg.functionName || 'gitblog-comments').trim() || 'gitblog-comments');
  const mode = document.documentElement.getAttribute('data-mode') || 'light';
  url.searchParams.set('mode', mode);
  if (opts.pageTitle) url.searchParams.set('title', String(opts.pageTitle).slice(0, 120));
  const pageUrl = String(opts.pageUrl || (typeof location !== 'undefined' ? location.href : '')).trim();
  if (pageUrl) url.searchParams.set('pageUrl', pageUrl.slice(0, 500));
  const httpUrl = String(cfg.httpUrl || '').trim();
  if (httpUrl) url.searchParams.set('httpUrl', httpUrl);
  const assetVer = String(cfg.embedAssetVersion || '').trim();
  if (assetVer) url.searchParams.set('v', assetVer);
  if (shouldUseMobileCommentDock(opts)) {
    url.searchParams.set('mobileDock', '1');
  } else {
    url.searchParams.set('mobileDock', '0');
  }
  const ctx = String(opts.context || 'post').trim().toLowerCase();
  if (ctx) url.searchParams.set('context', ctx);
  return url.toString();
}

const EMBED_BASE_HINT = '请在 config.js 或后台设置填写 <code>embedBaseUrl</code>，值为 <code>tcb hosting deploy</code> 输出中的完整域名（形如 <code>https://{envId}-{数字}.tcloudbaseapp.com</code>，不是 <code>{envId}.tcloudbaseapp.com</code>）。';

/** 移动端双 iframe：列表 iframe + 父页底部悬浮 compose iframe */
function bindMobileEmbedDockSplit(listWrap, opts = {}) {
  if (!isMobileCommentDock()) return { cleanup: () => {}, setComposeOpen: () => {} };

  const persistentDock = shouldShowPersistentMobileDock(opts);
  let dock = null;
  if (persistentDock) {
    ({ dock } = createMobileDockChrome());
  }

  let sectionVisible = false;
  let composeOpen = false;

  const syncDock = () => {
    if (!persistentDock || !dock) return;
    const show = sectionVisible && !composeOpen;
    dock.hidden = !show;
    syncMobileDockBodyState(show, dock);
  };

  const io = persistentDock
    ? bindMobileDockVisibility(listWrap, visible => {
      sectionVisible = visible;
      syncDock();
    })
    : () => {};

  dock?.querySelector('.cb-mobile-dock-trigger')?.addEventListener('click', () => {
    opts.openCompose?.({});
  });

  return {
    setComposeOpen: open => {
      composeOpen = !!open;
      syncDock();
    },
    cleanup: () => {
      io();
      dock?.remove();
      clearMobileDockBodyState();
    },
  };
}

function mountCloudBaseEmbedSplit(targetEl, path, opts = {}) {
  const cfg = cloudbaseCfg();
  const listSrc = resolveEmbedPageUrl(cfg, path, opts, 'comments-list-embed.html');
  const composeSrc = resolveEmbedPageUrl(cfg, path, opts, 'comments-compose-embed.html');
  if (!listSrc || !composeSrc) {
    targetEl.innerHTML = `<div class="comments-hint">${EMBED_BASE_HINT}</div>`;
    return false;
  }

  targetEl.classList.add('cb-comments-host--embed');

  targetEl.innerHTML = `
    <div class="cb-embed-split">
      <div class="cb-embed-wrap cb-embed-wrap--list">
        <iframe
          class="cb-embed-frame cb-embed-frame--list"
          title="评论区"
          loading="eager"
          referrerpolicy="strict-origin-when-cross-origin"
          src="${escapeHtml(listSrc)}"
        ></iframe>
      </div>
      <div class="cb-embed-compose-layer" hidden aria-hidden="true">
        <button type="button" class="cb-embed-compose-backdrop" aria-label="关闭评论"></button>
        <iframe
          class="cb-embed-frame cb-embed-frame--compose"
          title="发表评论"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          src="${escapeHtml(composeSrc)}"
        ></iframe>
      </div>
      <p class="cb-embed-hint comments-hint">评论由 CloudBase 提供；若空白或 404，请核对 <code>embedBaseUrl</code> 是否与 <code>tcb hosting deploy</code> 输出一致（见 cloudbase/README.md）。</p>
    </div>
  `;

  const listWrap = targetEl.querySelector('.cb-embed-wrap--list');
  const listIframe = targetEl.querySelector('.cb-embed-frame--list');
  const composeLayer = targetEl.querySelector('.cb-embed-compose-layer');
  const composeIframe = targetEl.querySelector('.cb-embed-frame--compose');
  const hint = targetEl.querySelector('.cb-embed-hint');

  let composeReady = false;
  let composeOpen = false;
  let pendingComposeInit = null;
  let openCompose = () => {};

  const sendComposeInit = data => {
    composeIframe?.contentWindow?.postMessage({
      type: 'gitblog-comments-compose-init',
      parentId: data?.parentId || '',
      replyNick: data?.replyNick || '',
    }, '*');
  };

  const dockApi = bindMobileEmbedDockSplit(listWrap, {
    ...opts,
    openCompose: data => openCompose(data),
  });

  openCompose = (data = {}) => {
    const scrollY = window.scrollY;
    composeOpen = true;
    dockApi.setComposeOpen(true);
    if (composeLayer.parentElement !== document.body) {
      document.body.appendChild(composeLayer);
    }
    composeLayer.hidden = false;
    composeLayer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cb-compose-layer-open');
    if (composeReady) {
      sendComposeInit(data);
    } else {
      pendingComposeInit = data;
    }
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - scrollY) > 2) {
        window.scrollTo(0, scrollY);
      }
    });
  };

  const closeCompose = () => {
    if (!composeOpen) return;
    composeOpen = false;
    dockApi.setComposeOpen(false);
    composeLayer.hidden = true;
    composeLayer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cb-compose-layer-open');
    composeIframe?.contentWindow?.postMessage({ type: 'gitblog-comments-compose-reset' }, '*');
  };

  const onMessage = e => {
    if (e.source === listIframe?.contentWindow && e.data) {
      if (e.data.type === 'gitblog-comments-height') {
        if (listIframe && !composeOpen) {
          applyEmbedListFrameHeight(listWrap, listIframe, Number(e.data.height), e.data, opts);
        }
        if (hint && e.data.ready) hint.hidden = true;
        if (e.data.ready && Object.prototype.hasOwnProperty.call(e.data, 'commentCount')) {
          syncCommentsEndHint(targetEl, e.data.commentCount);
        }
      }
      if (e.data.type === 'gitblog-comments-open-compose') {
        openCompose({
          parentId: e.data.parentId,
          replyNick: e.data.replyNick,
        });
      }
      return;
    }

    if (e.source === composeIframe?.contentWindow && e.data) {
      if (e.data.type === 'gitblog-comments-compose-ready') {
        composeReady = true;
        if (pendingComposeInit && composeOpen) {
          sendComposeInit(pendingComposeInit);
          pendingComposeInit = null;
        }
      }
      if (e.data.type === 'gitblog-comments-compose-height') {
        const h = Number(e.data.height);
        if (h > 0 && composeIframe) {
          composeIframe.style.height = `${Math.min(h, Math.round(window.innerHeight * 0.85))}px`;
        }
      }
      if (e.data.type === 'gitblog-comments-compose-close') closeCompose();
      if (e.data.type === 'gitblog-comments-compose-submitted') {
        closeCompose();
        listIframe?.contentWindow?.postMessage({ type: 'gitblog-comments-reload' }, '*');
      }
    }
  };

  window.addEventListener('message', onMessage);

  return true;
}

function mountCloudBaseEmbed(targetEl, path, opts = {}) {
  if (shouldUseMobileCommentDock(opts)) {
    return mountCloudBaseEmbedSplit(targetEl, path, opts);
  }
  const cfg = cloudbaseCfg();
  const src = resolveEmbedPageUrl(cfg, path, opts);
  if (!src) {
    targetEl.innerHTML = `<div class="comments-hint">${EMBED_BASE_HINT}</div>`;
    return false;
  }
  targetEl.classList.add('cb-comments-host--embed');
  targetEl.innerHTML = `
    <div class="cb-embed-wrap">
      <iframe
        class="cb-embed-frame"
        title="评论区"
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"
        src="${escapeHtml(src)}"
      ></iframe>
      <p class="cb-embed-hint comments-hint">评论由 CloudBase 提供；若空白或 404，请核对 <code>embedBaseUrl</code> 是否与 <code>tcb hosting deploy</code> 输出一致（见 cloudbase/README.md）。</p>
    </div>
  `;
  const embedWrap = targetEl.querySelector('.cb-embed-wrap');
  const iframe = targetEl.querySelector('.cb-embed-frame');
  const hint = targetEl.querySelector('.cb-embed-hint');
  const onMessage = e => {
    if (e.source !== iframe?.contentWindow || !e.data) return;
    if (e.data.type === 'gitblog-comments-height') {
      const h = Number(e.data.height);
      const composeOpen = !!e.data.composeOpen;
      if (iframe && !composeOpen) {
        applyEmbedListFrameHeight(embedWrap, iframe, h, e.data, opts);
      }
      if (composeOpen) syncEmbedComposePin(embedWrap, true);
      if (hint && e.data.ready) hint.hidden = true;
      if (e.data.ready && Object.prototype.hasOwnProperty.call(e.data, 'commentCount')) {
        syncCommentsEndHint(targetEl, e.data.commentCount);
      }
    }
  };
  window.addEventListener('message', onMessage);
  return true;
}

function commentsFlatClass(opts = {}) {
  return String(opts.context || 'post').trim().toLowerCase() === 'tool' ? ' cb-comments--flat' : '';
}

/**
 * 挂载 CloudBase 评论区（直连模式，表单在页面内）
 */
function mountCloudBaseDirect(targetEl, path, opts = {}) {
  const cfg = cloudbaseCfg();
  const maxLength = Number(cfg.maxLength) || 5000;
  const allowImage = cfg.allowImage !== false;
  const placeholderNick = String(cfg.placeholderNick || '访客').trim() || '访客';

  targetEl.innerHTML = `
    <div class="cb-comments${commentsFlatClass(opts)}" data-path="${escapeHtml(path)}">
      <form class="cb-compose cb-compose--minimal" novalidate>
        <div class="cb-compose-editor"></div>
        <div class="cb-compose-meta" hidden>
          <label class="cb-field">
            <span>昵称</span>
            <input type="text" name="nick" maxlength="40" placeholder="${escapeHtml(placeholderNick)}（可选）" autocomplete="nickname">
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

  const root = targetEl.querySelector('.cb-comments');
  const listEl = root.querySelector('.cb-comments-list');
  const loadingEl = root.querySelector('.cb-comments-loading');
  const form = root.querySelector('.cb-compose');
  const statusEl = root.querySelector('.cb-compose-status');
  const metaEl = form.querySelector('.cb-compose-meta');
  const actionsEl = form.querySelector('.cb-compose-actions');
  const nickInput = form.querySelector('[name="nick"]');
  const emailInput = form.querySelector('[name="email"]');
  const editorHost = root.querySelector('.cb-compose-editor');

  const profile = readProfile();
  prefillCommentNick(nickInput);
  if (profile.email) emailInput.value = profile.email;
  const metaAvatar = setupCommentMeta(metaEl, profile);
  const mobileMode = shouldUseMobileCommentDock(opts);
  if (mobileMode) {
    initMobileComposePortal(root, form);
  }
  setupComposeFooterChrome(form, metaEl, actionsEl);

  const editor = new CommentRichEditor(editorHost, {
    allowImage,
    maxLength,
    onDiscardUpload: fileId => callCommentApi({ action: 'DISCARD_UPLOAD', fileId }).catch(() => null),
    onUpload: async file => {
      const base64 = await fileToBase64(file);
      const res = await callCommentApi({
        action: 'UPLOAD',
        path,
        fileName: file.name,
        mime: file.type,
        base64,
      });
      return { url: res.url, fileId: res.fileId };
    },
  });

  bindComposeReveal(form, editor, { metaEl, actionsEl, mobileMode });

  const mobileDock = mobileMode
    ? bindMobileDirectDock(root, form, editor, opts)
    : null;
  const mobileCtrl = mobileDock?.mobileCtrl ?? null;

  let comments = [];

  async function loadList() {
    loadingEl.hidden = false;
    listEl.hidden = true;
    try {
      const res = await callCommentApi({ action: 'GET', path, limit: Number(cfg.pageSize) || 50 });
      comments = res.comments || [];
      listEl.innerHTML = comments.length
        ? comments.map(c => renderCommentItem(c)).join('')
        : '';
      await hydrateCommentImages(listEl, callCommentApi);
      syncCommentsEndHint(targetEl, comments.length);
      loadingEl.hidden = true;
      listEl.hidden = false;
    } catch (err) {
      loadingEl.innerHTML = `<div class="comments-hint">${escapeHtml(err.message || '加载失败')}</div>`;
    }
  }

  bindCommentListInteractions(listEl, {
    path,
    cfg,
    callApi: callCommentApi,
    onSuccess: loadList,
    opts,
    mobileCtrl,
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
      statusEl.textContent = commentSubmitHint(editor, maxLength);
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
      await callCommentApi({
        action: 'POST',
        path,
        nick,
        email,
        avatar,
        contentHtml: editor.getHtml(),
        parentId: mobileCtrl?.getParentId() ?? null,
        pageTitle: opts.pageTitle || document.title,
        pageUrl: opts.pageUrl || location.href,
      });
      saveProfile({ nick, email, avatar });
      editor.clear();
      statusEl.textContent = cfg.moderation ? '已提交，待审核通过后显示' : '发表成功';
      mobileDock?.notifySubmitted?.();
      await loadList();
    } catch (err) {
      statusEl.textContent = err.message || '发表失败';
      statusEl.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadList();
  return true;
}

/**
 * 挂载 CloudBase 评论区
 * @param {HTMLElement} targetEl
 * @param {string} path 页面标识（urlKey / notesTerm / tool path）
 */
export function mountCloudBaseComments(targetEl, path, opts = {}) {
  if (!targetEl || !path) return false;
  const cfg = cloudbaseCfg();
  const mode = String(cfg.accessMode || 'embed').trim().toLowerCase();
  if (mode === 'embed') {
    return mountCloudBaseEmbed(targetEl, path, opts);
  }
  return mountCloudBaseDirect(targetEl, path, opts);
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
