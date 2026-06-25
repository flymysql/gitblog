// 评论头像：源自 flymysql/cpti generated-avatars/thumbs，托管于本站
function resolveCommentAvatarBase() {
  try {
    const host = String(location?.hostname || '');
    if (/\.tcloudbaseapp\.com$/i.test(host)) {
      return new URL('comment-avatars/', location.href).href.replace(/\/$/, '');
    }
  } catch { /* ignore */ }
  return '/assets/comment-avatars';
}

export function getCommentAvatarBase() {
  return resolveCommentAvatarBase();
}

/** @deprecated 请用 getCommentAvatarBase()；保留导出以免旧代码引用报错 */
export const COMMENT_AVATAR_BASE = '/assets/comment-avatars';

export const COMMENT_AVATAR_FILES = [
  'badboy.webp',
  'badgirl.webp',
  'boundary-female.webp',
  'boundary-male.webp',
  'caveman-female.webp',
  'caveman-male.webp',
  'daddy.webp',
  'foodie-female.webp',
  'foodie-male.webp',
  'goodman-female.webp',
  'goodman-male.webp',
  'hollow-female.webp',
  'hollow-male.webp',
  'kitten-female.webp',
  'kitten-male.webp',
  'lovebrain-female.webp',
  'lovebrain-male.webp',
  'manmom.webp',
  'mom.webp',
  'mute-female.webp',
  'mute-male.webp',
  'netchat-female.webp',
  'netchat-male.webp',
  'newbie-female.webp',
  'newbie-male.webp',
  'player-female.webp',
  'player-male.webp',
  'puppy-female.webp',
  'puppy-male.webp',
  'purelove-female.webp',
  'purelove-male.webp',
  'rush-female.webp',
  'rush-male.webp',
  'simp-female.webp',
  'simp-male.webp',
  'siren-female.webp',
  'siren-male.webp',
  'solo-female.webp',
  'solo-male.webp',
  'spender-female.webp',
  'spender-male.webp',
  'straight-female.webp',
  'straight-male.webp',
  'swordsman-female.webp',
  'swordsman-male.webp',
  'zen-female.webp',
  'zen-male.webp',
];

const AVATAR_SET = new Set(COMMENT_AVATAR_FILES);

export function isValidCommentAvatar(name) {
  return AVATAR_SET.has(String(name || '').trim());
}

export function commentAvatarUrl(name) {
  const file = String(name || '').trim();
  if (!isValidCommentAvatar(file)) return '';
  return `${getCommentAvatarBase()}/${file}`;
}

export function pickRandomCommentAvatar() {
  return COMMENT_AVATAR_FILES[Math.floor(Math.random() * COMMENT_AVATAR_FILES.length)];
}

export function pickCommentAvatarForNick(nick) {
  let h = 0;
  const s = String(nick || '访客');
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  return COMMENT_AVATAR_FILES[h % COMMENT_AVATAR_FILES.length];
}

export function resolveCommentAvatar(selected, nick) {
  if (isValidCommentAvatar(selected)) return selected;
  return pickCommentAvatarForNick(nick);
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/** 在 compose-meta 内挂载头像：默认只显示当前头像，点击后展开选择网格 */
export function mountAvatarPicker(hostEl, { selected, onChange } = {}) {
  if (!hostEl || hostEl.querySelector('[data-cb-avatar-picker-wrap]')) {
    return {
      getSelected: () => resolveCommentAvatar(selected, ''),
      close: () => {},
    };
  }

  let current = resolveCommentAvatar(selected, '');
  const wrap = document.createElement('div');
  wrap.className = 'cb-field cb-field--avatar';
  wrap.setAttribute('data-cb-avatar-picker-wrap', '');

  const renderCurrentImg = () => {
    const img = wrap.querySelector('.cb-avatar-current img');
    if (img) img.src = commentAvatarUrl(current);
  };

  wrap.innerHTML = `
    <span class="cb-avatar-picker-label">头像</span>
    <button type="button" class="cb-avatar-current" aria-label="点击更换头像" aria-expanded="false">
      <img src="${escapeHtml(commentAvatarUrl(current))}" alt="" loading="lazy" width="40" height="40">
    </button>
    <div class="cb-avatar-picker" data-cb-avatar-picker role="listbox" aria-label="选择头像">
      ${COMMENT_AVATAR_FILES.map(file => `
        <button type="button" class="cb-avatar-option${file === current ? ' is-selected' : ''}"
          data-avatar="${escapeHtml(file)}"
          aria-label="${escapeHtml(file.replace(/\.webp$/i, ''))}"
          aria-selected="${file === current ? 'true' : 'false'}">
          <img src="${escapeHtml(commentAvatarUrl(file))}" alt="" loading="lazy" width="36" height="36">
        </button>
      `).join('')}
    </div>
  `;
  hostEl.prepend(wrap);

  const picker = wrap.querySelector('[data-cb-avatar-picker]');
  const currentBtn = wrap.querySelector('.cb-avatar-current');

  const closePicker = () => {
    picker.classList.remove('is-open');
    wrap.classList.remove('cb-field--avatar-open');
    currentBtn?.setAttribute('aria-expanded', 'false');
  };

  const openPicker = () => {
    picker.classList.add('is-open');
    wrap.classList.add('cb-field--avatar-open');
    currentBtn?.setAttribute('aria-expanded', 'true');
  };

  const isOpen = () => picker.classList.contains('is-open');

  currentBtn?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen()) closePicker();
    else openPicker();
  });

  picker.addEventListener('click', e => {
    const btn = e.target.closest('[data-avatar]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    current = btn.dataset.avatar || current;
    picker.querySelectorAll('.cb-avatar-option').forEach(b => {
      const on = b.dataset.avatar === current;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    renderCurrentImg();
    closePicker();
    onChange?.(current);
  });

  const onDocClick = e => {
    if (!isOpen()) return;
    if (wrap.contains(e.target)) return;
    closePicker();
  };
  document.addEventListener('click', onDocClick);

  return {
    getSelected: () => current,
    close: () => {
      closePicker();
      document.removeEventListener('click', onDocClick);
    },
  };
}

export function renderCommentAvatarHtml(comment, { escape = escapeHtml } = {}) {
  const nick = String(comment?.nick || '访客');
  const avatar = resolveCommentAvatar(comment?.avatar, nick);
  const url = commentAvatarUrl(avatar);
  if (url) {
    return `<div class="cb-comment-avatar cb-comment-avatar--img" aria-hidden="true"><img src="${escape(url)}" alt="" loading="lazy" width="36" height="36"></div>`;
  }
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = (Math.imul(31, h) + nick.charCodeAt(i)) >>> 0;
  const hues = [12, 28, 45, 160, 200, 260, 310];
  const hue = hues[h % hues.length];
  const letter = escape(nick.slice(0, 1).toUpperCase());
  return `<div class="cb-comment-avatar" style="--cb-avatar-hue:${hue}" aria-hidden="true">${letter}</div>`;
}
