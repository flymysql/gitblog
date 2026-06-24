'use strict';

const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const COLLECTION = 'gitblog_comments';
const RATE_COLLECTION = 'gitblog_comment_rates';
const MAX_HTML_LEN = 12000;
const MAX_PLAIN_HINT = 8000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre',
  'blockquote', 'a', 'img', 'ul', 'ol', 'li', 'span',
]);

function jsonOk(data = {}) {
  return { ok: true, ...data };
}

function jsonErr(message, code = 400) {
  return { ok: false, message: String(message || 'error'), code };
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(String(ip || '') + (process.env.COMMENT_SALT || 'gitblog')).digest('hex').slice(0, 24);
}

function stripPlain(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizeHtml(raw) {
  let html = String(raw || '').trim();
  if (!html) return '';
  if (html.length > MAX_HTML_LEN) html = html.slice(0, MAX_HTML_LEN);

  // 移除 script/style
  html = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 逐标签过滤（简单 DOM 不可用时的正则方案）
  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag, attrs) => {
    const t = String(tag || '').toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (full.startsWith('</')) return `</${t}>`;
    if (t === 'br') return '<br>';

    const pick = (name) => {
      const m = attrs.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
      return m ? (m[2] || m[3] || '') : '';
    };

    if (t === 'a') {
      const href = pick('href');
      if (!/^https?:\/\//i.test(href) && !href.startsWith('mailto:')) return '<a>';
      return `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="nofollow noopener noreferrer">`;
    }
    if (t === 'img') {
      const src = pick('src');
      if (!/^https?:\/\//i.test(src) && !src.startsWith('cloud://')) return '';
      const alt = pick('alt').replace(/"/g, '&quot;');
      return `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt}" loading="lazy">`;
    }
    if (t === 'span') {
      const cls = pick('class');
      return cls === 'cb-uploading' ? '<span class="cb-uploading">' : '<span>';
    }
    return `<${t}>`;
  });

  return html.trim();
}

async function ensureCollections() {
  try {
    await db.createCollection(COLLECTION);
  } catch (_) { /* exists */ }
  try {
    await db.createCollection(RATE_COLLECTION);
  } catch (_) { /* exists */ }
}

async function checkRate(ipHash) {
  const now = Date.now();
  const _ = db.command;
  const ref = db.collection(RATE_COLLECTION).doc(ipHash);
  const got = await ref.get().catch(() => null);
  const doc = got?.data?.[0];
  if (!doc) {
    await ref.set({ count: 1, windowStart: now });
    return true;
  }
  if (now - doc.windowStart > RATE_WINDOW_MS) {
    await ref.set({ count: 1, windowStart: now });
    return true;
  }
  if (doc.count >= RATE_MAX) return false;
  await ref.update({ count: _.inc(1) });
  return true;
}

function nestComments(rows) {
  const map = new Map();
  rows.forEach(r => map.set(r._id, { ...r, replies: [] }));
  const roots = [];
  map.forEach(c => {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId).replies.push(c);
    } else {
      roots.push(c);
    }
  });
  const sortFn = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  roots.sort(sortFn);
  map.forEach(c => c.replies.sort(sortFn));
  return roots;
}

function publicComment(row) {
  return {
    _id: row._id,
    path: row.path,
    nick: row.nick || '访客',
    contentHtml: row.contentHtml,
    parentId: row.parentId || null,
    createdAt: row.createdAt,
    createdAtIso: row.createdAtIso,
  };
}

async function handleGet(event) {
  const path = String(event.path || '').trim();
  if (!path) return jsonErr('缺少 path');
  const limit = Math.min(Math.max(Number(event.limit) || 50, 1), 200);
  const res = await db.collection(COLLECTION)
    .where({ path })
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();
  const rows = (res.data || []).filter(r => {
    const s = r.status || 'visible';
    return s === 'visible';
  });
  return jsonOk({ comments: nestComments(rows.map(publicComment)) });
}

async function handlePost(event, context) {
  const path = String(event.path || '').trim();
  const contentHtml = sanitizeHtml(event.contentHtml);
  const plain = stripPlain(contentHtml);
  if (!path) return jsonErr('缺少 path');
  if (!plain) return jsonErr('评论内容不能为空');
  if (plain.length > MAX_PLAIN_HINT) return jsonErr('评论内容过长');

  const ip = context?.requestContext?.sourceIp || context?.CLIENTIP || '';
  const ipHash = hashIp(ip);
  if (!(await checkRate(ipHash))) return jsonErr('操作过于频繁，请稍后再试', 429);

  const moderation = String(process.env.COMMENT_MODERATION || '0') === '1';
  const now = Date.now();
  const doc = {
    path,
    nick: String(event.nick || '').trim().slice(0, 40) || '访客',
    email: String(event.email || '').trim().slice(0, 120),
    contentHtml,
    parentId: event.parentId ? String(event.parentId).trim() : null,
    pageTitle: String(event.pageTitle || '').slice(0, 200),
    pageUrl: String(event.pageUrl || '').slice(0, 500),
    status: moderation ? 'pending' : 'visible',
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    ipHash,
    ua: String(context?.requestContext?.userAgent || '').slice(0, 300),
  };

  const addRes = await db.collection(COLLECTION).add(doc);
  return jsonOk({ id: addRes.id, status: doc.status });
}

async function handleUpload(event, context) {
  const path = String(event.path || '').trim();
  if (!path) return jsonErr('缺少 path');
  const ip = context?.requestContext?.sourceIp || '';
  if (!(await checkRate(hashIp(ip)))) return jsonErr('上传过于频繁', 429);

  const mime = String(event.mime || 'image/jpeg');
  if (!/^image\//i.test(mime)) return jsonErr('仅支持图片');
  const buf = Buffer.from(String(event.base64 || ''), 'base64');
  if (!buf.length || buf.length > UPLOAD_MAX_BYTES) return jsonErr('图片过大（最大 2MB）');

  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
  const cloudPath = `comments/${path.replace(/[^\w\-./]/g, '_')}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

  const uploadRes = await app.uploadFile({
    cloudPath,
    fileContent: buf,
  });
  const fileId = uploadRes.fileID;
  let url = fileId;
  try {
    const temp = await app.getTempFileURL({ fileList: [fileId] });
    url = temp?.fileList?.[0]?.tempFileURL || fileId;
  } catch (_) { /* use fileID */ }

  return jsonOk({ url, fileId });
}

exports.main = async (event, context) => {
  try {
    await ensureCollections();
    const action = String(event?.action || '').toUpperCase();
    if (action === 'GET') return await handleGet(event);
    if (action === 'POST') return await handlePost(event, context);
    if (action === 'UPLOAD') return await handleUpload(event, context);
    return jsonErr('未知 action');
  } catch (err) {
    console.error(err);
    return jsonErr(err.message || '服务器错误', 500);
  }
};
