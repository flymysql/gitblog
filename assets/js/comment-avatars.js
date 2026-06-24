// 评论头像：flymysql/cpti generated-avatars/thumbs
export const COMMENT_AVATAR_BASE =
  'https://raw.githubusercontent.com/flymysql/cpti/main/generated-avatars/thumbs';

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
  return `${COMMENT_AVATAR_BASE}/${file}`;
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

/** 在 compose-meta 内挂载头像选择器，返回 getSelected */
export function mountAvatarPicker(hostEl, { selected, onChange } = {}) {
  if (!hostEl || hostEl.querySelector('[data-cb-avatar-picker]')) {
    return {
      getSelected: () => resolveCommentAvatar(selected, ''),
    };
  }

  const current = resolveCommentAvatar(selected, '');
  const wrap = document.createElement('div');
  wrap.className = 'cb-field cb-field--avatar';
  wrap.innerHTML = `
    <span class="cb-avatar-picker-label">头像</span>
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
  picker.addEventListener('click', e => {
    const btn = e.target.closest('[data-avatar]');
    if (!btn) return;
    e.preventDefault();
    picker.querySelectorAll('.cb-avatar-option').forEach(b => {
      b.classList.remove('is-selected');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('is-selected');
    btn.setAttribute('aria-selected', 'true');
    onChange?.(btn.dataset.avatar || '');
  });

  return {
    getSelected: () => picker.querySelector('.cb-avatar-option.is-selected')?.dataset.avatar || current,
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
