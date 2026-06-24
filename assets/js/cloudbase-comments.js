// ============================================================================
// CloudBase 评论区：昵称/邮箱（可选）+ 富文本（表情、图片、基础格式）
// 通过云函数 gitblog-comments 读写数据库，不在前端暴露密钥
// ============================================================================

import { CONFIG } from './config.js';

const PROFILE_KEY = 'gitblog-comment-profile-v1';
const SDK_URL = 'https://static.cloudbase.net/cloudbase-js-sdk/2.17.3/cloudbase.full.js';

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
        if (tag === 'IMG' && (n === 'src' || n === 'alt' || n === 'title' || n === 'loading')) return;
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

class CommentRichEditor {
  constructor(root, { allowImage = true, maxLength = 5000, onUpload, onChange, alwaysShowBar = false } = {}) {
    this.root = root;
    this.allowImage = allowImage;
    this.maxLength = maxLength;
    this.onUpload = onUpload;
    this.onChange = onChange;
    this.alwaysShowBar = alwaysShowBar;
    this._emojiOpen = false;
    this._render();
    this._bind();
  }

  _render() {
    this.root.innerHTML = `
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
    `;
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
    } catch (err) {
      this.root.querySelector('.cb-uploading')?.remove();
      throw err;
    }
    this._syncCount();
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
    const has = len > 0;
    this.countEl.textContent = `${len} / ${this.maxLength}`;
    this.countEl.hidden = !has;
    this.countEl.classList.toggle('is-over', len > this.maxLength);
    this.editorEl.classList.toggle('has-content', has);
    this._autosizeBody();
    this.onChange?.(len);
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

  setMentionPrefix() {
    /* @mention 已停用 */
  }

  isValid() {
    const len = this.getPlainLength();
    return len > 0 && len <= this.maxLength;
  }
}

function renderCommentItem(c, { nested = true } = {}) {
  const nick = escapeHtml(c.nick || '访客');
  const nickRaw = escapeHtml(c.nick || '访客');
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

function bindComposeReveal(form, editor, { metaEl, actionsEl }) {
  const refresh = () => {
    const len = editor.getPlainLength();
    const showExtra = len > 0;
    if (metaEl) metaEl.hidden = !showExtra;
    if (actionsEl) actionsEl.hidden = !showExtra;
    form.classList.toggle('cb-compose--active', showExtra);
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
  refresh();
}

function isMobileCommentDock() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
}

/** 移动端：评论表单底部抽屉（直连模式） */
function bindMobileComposeSheet(form, editor, { onClose, onOpen } = {}) {
  if (!isMobileCommentDock()) {
    return { open: () => {}, close: () => {}, notifySubmitted: () => {} };
  }

  const root = form.closest('.cb-comments');
  root?.classList.add('cb-comments--mobile-dock');

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
    form.classList.remove('is-sheet-open');
    root?.classList.remove('cb-comments--compose-only');
    const listEl = root?.querySelector('.cb-comments-list');
    const loadingEl = root?.querySelector('.cb-comments-loading');
    if (listEl?.innerHTML) listEl.hidden = false;
    if (loadingEl) loadingEl.hidden = true;
    editor.body.blur();
    onClose?.();
  };

  const open = () => {
    form.classList.add('is-sheet-open');
    root?.classList.add('cb-comments--compose-only');
    const listEl = root?.querySelector('.cb-comments-list');
    const loadingEl = root?.querySelector('.cb-comments-loading');
    if (listEl) listEl.hidden = true;
    if (loadingEl) loadingEl.hidden = true;
    onOpen?.();
    editor._autosizeBody?.();
    setTimeout(() => {
      editor._autosizeBody?.();
      editor.body.focus();
    }, 120);
  };

  form.querySelector('.cb-mobile-sheet-close')?.addEventListener('click', close);

  window.addEventListener('message', e => {
    if (e.data?.type === 'gitblog-comments-compose-open') open();
    if (e.data?.type === 'gitblog-comments-compose-close') close();
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

/** 移动端：父页底部吸附条 + iframe 底栏输入（不锁滚动） */
function bindMobileEmbedDock(embedWrap, iframe) {
  if (!isMobileCommentDock()) return () => {};

  const { dock } = createMobileDockChrome();
  let composeOpen = false;
  let sectionVisible = false;

  const postDockState = visible => {
    try {
      iframe.contentWindow?.postMessage({ type: 'gitblog-comments-dock', visible }, '*');
    } catch { /* ignore */ }
  };

  const syncDock = () => {
    const show = sectionVisible && !composeOpen;
    dock.hidden = !show;
    document.body.classList.toggle('cb-has-mobile-dock', show);
    postDockState(show);
  };

  const io = bindMobileDockScrollTrigger(embedWrap, visible => {
    sectionVisible = visible;
    syncDock();
  });

  const openCompose = () => {
    composeOpen = true;
    syncDock();
    embedWrap.classList.add('cb-embed-wrap--compose-pinned');
    iframe.contentWindow?.postMessage({ type: 'gitblog-comments-compose-open' }, '*');
  };

  const closeCompose = () => {
    composeOpen = false;
    embedWrap.classList.remove('cb-embed-wrap--compose-pinned');
    syncDock();
    iframe.contentWindow?.postMessage({ type: 'gitblog-comments-compose-close' }, '*');
  };

  dock.querySelector('.cb-mobile-dock-trigger')?.addEventListener('click', openCompose);

  const onMessage = e => {
    if (e.source !== iframe?.contentWindow) return;
    if (e.data?.type === 'gitblog-comments-compose-close') closeCompose();
    if (e.data?.type === 'gitblog-comments-compose-submitted') closeCompose();
  };
  window.addEventListener('message', onMessage);

  return () => {
    io();
    dock.remove();
    window.removeEventListener('message', onMessage);
    document.body.classList.remove('cb-has-mobile-dock');
    embedWrap.classList.remove('cb-embed-wrap--compose-pinned');
  };
}

/** 移动端：父页底部吸附条 + 本地表单抽屉（直连模式） */
function bindMobileDirectDock(observeEl, form, editor) {
  if (!isMobileCommentDock()) return null;

  const { dock } = createMobileDockChrome();
  let composeOpen = false;
  let sectionVisible = false;

  const syncDock = () => {
    const show = sectionVisible && !composeOpen;
    dock.hidden = !show;
    document.body.classList.toggle('cb-has-mobile-dock', show);
  };

  const sheet = bindMobileComposeSheet(form, editor, {
    onOpen: () => {
      observeEl.classList.add('cb-comments--compose-pinned');
    },
    onClose: () => {
      composeOpen = false;
      observeEl.classList.remove('cb-comments--compose-pinned');
      syncDock();
    },
  });

  const io = bindMobileDockScrollTrigger(observeEl, visible => {
    sectionVisible = visible;
    syncDock();
  });

  const openCompose = () => {
    composeOpen = true;
    syncDock();
    sheet.open();
  };

  const closeCompose = () => {
    composeOpen = false;
    sheet.close();
  };

  dock.querySelector('.cb-mobile-dock-trigger')?.addEventListener('click', openCompose);

  return {
    cleanup: () => {
      io();
      dock.remove();
      document.body.classList.remove('cb-has-mobile-dock');
    },
    notifySubmitted: () => {
      composeOpen = false;
      sheet.notifySubmitted();
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
  const { parentId, replyNick, path, cfg, callApi, onSuccess, opts = {} } = ctx;
  const commentsRoot = slot.closest('.cb-comments');
  closeAllInlineReplies(commentsRoot);

  const panel = document.createElement('div');
  panel.className = 'cb-inline-reply';
  panel.innerHTML = `
    <div class="cb-inline-reply-head">回复 ${escapeHtml(replyNick)}</div>
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
  const maxLength = Number(cfg.maxLength) || 5000;
  const allowImage = cfg.allowImage !== false;
  const editor = new CommentRichEditor(editorHost, {
    allowImage,
    maxLength,
    alwaysShowBar: true,
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
  // 不再自动插入 @ 前缀

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
      statusEl.textContent = editor.getPlainLength() > maxLength ? '内容过长' : '请输入回复内容';
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
        pageTitle: opts.pageTitle || document.title,
        pageUrl: opts.pageUrl || location.href,
      });
      saveProfile({ nick: profile.nick, email: profile.email });
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
    const slot = btn.closest('.cb-comment-main')?.querySelector('.cb-inline-reply-slot');
    if (!slot) return;
    mountInlineReply(slot, {
      ...ctx,
      parentId: btn.dataset.reply || '',
      replyNick: btn.dataset.replyNick || '访客',
    });
  });
}

function resolveEmbedPageUrl(cfg, path, opts = {}) {
  const custom = String(cfg.embedUrl || '').trim();
  const envId = String(cfg.envId || '').trim();
  const region = String(cfg.region || 'ap-shanghai').trim() || 'ap-shanghai';
  let url;
  if (custom) {
    url = new URL(custom);
  } else {
    const base = String(cfg.embedBaseUrl || '').trim();
    if (!base) return null;
    const page = String(cfg.embedPage || 'comments-embed.html').trim() || 'comments-embed.html';
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
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
    url.searchParams.set('mobileDock', '1');
  }
  return url.toString();
}

const EMBED_BASE_HINT = '请在 config.js 或后台设置填写 <code>embedBaseUrl</code>，值为 <code>tcb hosting deploy</code> 输出中的完整域名（形如 <code>https://{envId}-{数字}.tcloudbaseapp.com</code>，不是 <code>{envId}.tcloudbaseapp.com</code>）。';

function mountCloudBaseEmbed(targetEl, path, opts = {}) {
  const cfg = cloudbaseCfg();
  const src = resolveEmbedPageUrl(cfg, path, opts);
  if (!src) {
    targetEl.innerHTML = `<div class="comments-hint">${EMBED_BASE_HINT}</div>`;
    return false;
  }
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
      if (h > 0 && iframe) {
        if (e.data.composeOpen) {
          const ch = Number(e.data.composeHeight) || h;
          iframe.style.height = `${Math.min(Math.max(ch, 160), Math.round(window.innerHeight * 0.85))}px`;
        } else {
          iframe.style.height = `${Math.min(Math.max(h, 320), 2400)}px`;
        }
      }
      if (hint && e.data.ready) hint.hidden = true;
    }
  };
  window.addEventListener('message', onMessage);
  bindMobileEmbedDock(embedWrap, iframe);
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

  const maxLength = Number(cfg.maxLength) || 5000;
  const allowImage = cfg.allowImage !== false;
  const placeholderNick = String(cfg.placeholderNick || '访客').trim() || '访客';

  targetEl.innerHTML = `
    <div class="cb-comments" data-path="${escapeHtml(path)}">
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
  if (profile.nick) nickInput.value = profile.nick;
  if (profile.email) emailInput.value = profile.email;

  const editor = new CommentRichEditor(editorHost, {
    allowImage,
    maxLength,
    onUpload: async file => {
      const base64 = await fileToBase64(file);
      const res = await callCommentApi({
        action: 'UPLOAD',
        path,
        fileName: file.name,
        mime: file.type,
        base64,
      });
      return res.url;
    },
  });

  bindComposeReveal(form, editor, { metaEl, actionsEl });

  const mobileDock = bindMobileDirectDock(root, form, editor);

  let comments = [];

  async function loadList() {
    loadingEl.hidden = false;
    listEl.hidden = true;
    try {
      const res = await callCommentApi({ action: 'GET', path, limit: Number(cfg.pageSize) || 50 });
      comments = res.comments || [];
      listEl.innerHTML = comments.length
        ? comments.map(c => renderCommentItem(c)).join('')
        : '<p class="cb-empty">暂无评论，来说第一句吧。</p>';
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
      statusEl.textContent = editor.getPlainLength() > maxLength ? '内容过长' : '请输入评论内容';
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
      await callCommentApi({
        action: 'POST',
        path,
        nick,
        email,
        contentHtml: editor.getHtml(),
        parentId: null,
        pageTitle: opts.pageTitle || document.title,
        pageUrl: opts.pageUrl || location.href,
      });
      saveProfile({ nick, email });
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
