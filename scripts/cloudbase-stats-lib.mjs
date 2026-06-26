// CloudBase 备份索引与构建期 HTML 辅助（build / backup 共用）
import { escapeHtml } from './markdown-render.mjs';

const POST_URL_KEY_RE = /^\d{8}(-\d+)?$/;
const POST_PATH_SLUGS = new Set(['welcome', 'about']);

const COMMENT_AVATAR_FILES = new Set([
  'badboy.webp', 'badgirl.webp', 'boundary-female.webp', 'boundary-male.webp',
  'caveman-female.webp', 'caveman-male.webp', 'daddy.webp', 'foodie-female.webp',
  'foodie-male.webp', 'goodman-female.webp', 'goodman-male.webp', 'hollow-female.webp',
  'hollow-male.webp', 'kitten-female.webp', 'kitten-male.webp', 'lovebrain-female.webp',
  'lovebrain-male.webp', 'manmom.webp', 'mom.webp', 'mute-female.webp', 'mute-male.webp',
  'netchat-female.webp', 'netchat-male.webp', 'newbie-female.webp', 'newbie-male.webp',
  'player-female.webp', 'player-male.webp', 'puppy-female.webp', 'puppy-male.webp',
  'purelove-female.webp', 'purelove-male.webp', 'rush-female.webp', 'rush-male.webp',
  'simp-female.webp', 'simp-male.webp', 'siren-female.webp', 'siren-male.webp',
  'solo-female.webp', 'solo-male.webp', 'spender-female.webp', 'spender-male.webp',
  'straight-female.webp', 'straight-male.webp', 'swordsman-female.webp', 'swordsman-male.webp',
  'zen-female.webp', 'zen-male.webp',
]);

function isPostPublicPathKey(seg) {
  const s = String(seg || '').trim();
  return POST_URL_KEY_RE.test(s) || POST_PATH_SLUGS.has(s);
}

export function commentPathForPost({ slug, urlKey } = {}) {
  const k = String(urlKey || '').trim();
  if (k && isPostPublicPathKey(k)) return k;
  return String(slug || '').trim();
}

export function pvPathForPost(p) {
  const urlKey = String(p?.urlKey || '').trim();
  if (urlKey && /^[a-z0-9-]+$/i.test(urlKey)) return `/post/${urlKey}`;
  const slug = String(p?.slug || '').trim();
  return slug ? `/post/${slug}` : '';
}

export function normalizePvPath(pathOrUrl) {
  let p = String(pathOrUrl || '').trim();
  if (!p) return '';
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch { /* ignore */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

export function formatBuildCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return '—';
  return String(Math.floor(v));
}

function resolveCommentAvatar(selected, nick) {
  const file = String(selected || '').trim();
  if (COMMENT_AVATAR_FILES.has(file)) return file;
  let h = 0;
  const s = String(nick || '访客');
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  const list = [...COMMENT_AVATAR_FILES];
  return list[h % list.length];
}

function commentAvatarUrl(name, pathPrefix = '') {
  const file = String(name || '').trim();
  if (!COMMENT_AVATAR_FILES.has(file)) return '';
  const base = String(pathPrefix || '').replace(/\/+$/, '');
  return `${base}/assets/comment-avatars/${file}`;
}

function renderCommentAvatarHtml(comment, pathPrefix) {
  const nick = String(comment?.nick || '访客');
  const avatar = resolveCommentAvatar(comment?.avatar, nick);
  const url = commentAvatarUrl(avatar, pathPrefix);
  if (url) {
    return `<div class="cb-comment-avatar cb-comment-avatar--img" aria-hidden="true"><img src="${escapeHtml(url)}" alt="" loading="lazy" width="36" height="36"></div>`;
  }
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = (Math.imul(31, h) + nick.charCodeAt(i)) >>> 0;
  const hues = [12, 28, 45, 160, 200, 260, 310];
  const hue = hues[h % hues.length];
  const letter = escapeHtml(nick.slice(0, 1).toUpperCase());
  return `<div class="cb-comment-avatar" style="--cb-avatar-hue:${hue}" aria-hidden="true">${letter}</div>`;
}

function formatCommentTime(comment) {
  const iso = comment?.createdAtIso
    || (comment?.createdAt ? new Date(comment.createdAt).toISOString() : '');
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderCommentItemHtml(comment, pathPrefix) {
  const nick = escapeHtml(String(comment?.nick || '访客'));
  const body = String(comment?.contentHtml || '').trim() || '<p></p>';
  const replyClass = comment?.parentId ? ' is-reply' : '';
  const replyTo = comment?.replyToNick
    ? `<span class="cb-comment-reply-to">@${escapeHtml(comment.replyToNick)}</span> `
    : '';
  return `
    <article class="cb-comment${replyClass}" data-id="${escapeHtml(comment?._id || '')}">
      ${renderCommentAvatarHtml(comment, pathPrefix)}
      <div class="cb-comment-main">
        <header class="cb-comment-head">
          <strong class="cb-comment-nick">${nick}</strong>
          <time class="cb-comment-time" datetime="${escapeHtml(comment?.createdAtIso || '')}">${escapeHtml(formatCommentTime(comment))}</time>
        </header>
        <div class="cb-comment-body">${replyTo}${body}</div>
      </div>
    </article>
  `.trim();
}

export function indexCloudbaseBackup(payload) {
  const empty = {
    sitePv: 0,
    pagePvMap: {},
    commentCountMap: {},
    commentsByPath: {},
    generatedAt: '',
  };
  if (!payload || typeof payload !== 'object') return empty;

  const sitePv = Number(payload?.pageviews?.site?.pv) || 0;
  const pagePvMap = {};
  for (const page of payload?.pageviews?.pages || []) {
    const path = normalizePvPath(page?.path);
    if (!path) continue;
    pagePvMap[path] = Number(page.pv) || 0;
  }

  const commentsByPath = {};
  for (const row of payload?.comments?.items || []) {
    if (row?.status !== 'visible') continue;
    const path = String(row.path || '').trim();
    if (!path) continue;
    if (!commentsByPath[path]) commentsByPath[path] = [];
    commentsByPath[path].push(row);
  }

  for (const list of Object.values(commentsByPath)) {
    list.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  }

  const commentCountMap = {};
  for (const [path, list] of Object.entries(commentsByPath)) {
    commentCountMap[path] = list.length;
  }

  return {
    sitePv,
    pagePvMap,
    commentCountMap,
    commentsByPath,
    generatedAt: String(payload.generatedAt || ''),
  };
}

export function lookupPostPv(index, post) {
  const path = pvPathForPost(post);
  if (!path || !index?.pagePvMap) return null;
  const v = index.pagePvMap[path];
  return v == null ? null : Number(v);
}

export function lookupPostCommentCount(index, post) {
  const path = commentPathForPost({ slug: post?.slug, urlKey: post?.urlKey });
  if (!path || !index) return null;
  if (index.commentCountMap && Object.prototype.hasOwnProperty.call(index.commentCountMap, path)) {
    return Number(index.commentCountMap[path]) || 0;
  }
  if (index.generatedAt) return 0;
  return null;
}

export function lookupPostComments(index, post) {
  const path = commentPathForPost({ slug: post?.slug, urlKey: post?.urlKey });
  if (!path || !index?.commentsByPath) return [];
  return index.commentsByPath[path] || [];
}

export function buildListStatsHtml(pv, comments, { showPv = true, showCm = true } = {}) {
  const parts = [];
  if (showPv) {
    const pvText = pv == null ? '…' : escapeHtml(formatBuildCount(pv));
    parts.push(`<span class="post-stat-pv" title="阅读">👀 ${pvText}</span>`);
  }
  if (showCm) {
    const cmText = comments == null ? '…' : escapeHtml(formatBuildCount(comments));
    parts.push(`<span class="post-stat-cm" title="评论">💬 ${cmText}</span>`);
  }
  return parts.join(' ');
}

export function buildCommentsPreviewSection(comments, { pathPrefix = '', limit = 50 } = {}) {
  const list = Array.isArray(comments) ? comments.slice(0, limit) : [];
  const count = list.length;
  const title = count ? `评论（${count}）` : '评论';
  const items = list.map(c => renderCommentItemHtml(c, pathPrefix)).join('\n');
  const listHtml = items
    ? `<div class="comments-build-preview-list cb-comments-list">${items}</div>`
    : `<p class="comments-build-empty">暂无评论，来抢沙发吧。</p>`;
  return `
    <section class="comments comments-build-preview" data-build-comments="1">
      <div class="comments-title">${escapeHtml(title)}</div>
      ${listHtml}
      <div id="commentsRoot"></div>
      <p class="comments-end-hint" hidden aria-hidden="true"></p>
    </section>
  `.trim();
}
