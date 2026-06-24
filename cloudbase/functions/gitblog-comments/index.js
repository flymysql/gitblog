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

const TEMP_URL_MAX_AGE = 86400 * 7;

function parseCloudPathFromFileId(fileId) {
  const m = String(fileId || '').match(/^cloud:\/\/[^/]+\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : '';
}

function pickHtmlAttr(attrs, name) {
  const m = String(attrs || '').match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] || m[3] || '') : '';
}

function guessFileIdFromImageSrc(src, fileIdAttr = '') {
  const fid = String(fileIdAttr || '').trim();
  if (fid.startsWith('cloud://')) return fid;
  const raw = String(src || '').trim();
  if (raw.startsWith('cloud://')) return raw;
  try {
    const u = new URL(raw);
    if (/\.tcb\.qcloud\.la$/i.test(u.hostname) && u.pathname.includes('/comments/')) {
      const cloudPath = u.pathname.replace(/^\//, '');
      const envId = String(process.env.TCB_ENV || process.env.SCF_NAMESPACE || u.hostname.split('.')[0]).trim();
      if (envId && cloudPath) return `cloud://${envId}/${cloudPath}`;
    }
  } catch { /* ignore */ }
  return '';
}

async function resolveTempUrls(fileIds) {
  const unique = [...new Set((fileIds || []).filter(id => String(id).startsWith('cloud://')))];
  const urlMap = new Map();
  if (!unique.length) return urlMap;
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const res = await app.getTempFileURL({
      fileList: chunk.map(fileID => ({ fileID, maxAge: TEMP_URL_MAX_AGE })),
    });
    (res.fileList || []).forEach(item => {
      if (item.code === 'SUCCESS' && item.tempFileURL) {
        urlMap.set(item.fileID, item.tempFileURL);
      }
    });
  }
  return urlMap;
}

function buildCommentImgTag(attrs, url, fileId) {
  const alt = (pickHtmlAttr(attrs, 'alt') || '评论图片').replace(/"/g, '&quot;');
  const safeUrl = String(url || '').replace(/"/g, '&quot;');
  const fid = String(fileId || '').startsWith('cloud://')
    ? ` data-cb-fileid="${String(fileId).replace(/"/g, '&quot;')}"`
    : '';
  return `<img src="${safeUrl}" alt="${alt}" loading="lazy"${fid}>`;
}

async function resolveCommentImageUrls(html) {
  const raw = String(html || '');
  if (!/<img\b/i.test(raw)) return raw;

  const tags = [];
  raw.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    tags.push({ full, attrs });
    return full;
  });
  if (!tags.length) return raw;

  const fileIds = tags.map(t => guessFileIdFromImageSrc(
    pickHtmlAttr(t.attrs, 'src'),
    pickHtmlAttr(t.attrs, 'data-cb-fileid'),
  )).filter(Boolean);
  const urlMap = await resolveTempUrls(fileIds);

  let result = raw;
  tags.forEach(tag => {
    const fileId = guessFileIdFromImageSrc(
      pickHtmlAttr(tag.attrs, 'src'),
      pickHtmlAttr(tag.attrs, 'data-cb-fileid'),
    );
    const url = fileId ? urlMap.get(fileId) : '';
    if (!url) return;
    result = result.replace(tag.full, buildCommentImgTag(tag.attrs, url, fileId));
  });
  return result;
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
      const fileId = pick('data-cb-fileid');
      if (!/^https?:\/\//i.test(src) && !src.startsWith('cloud://') && !fileId.startsWith('cloud://')) return '';
      const alt = pick('alt').replace(/"/g, '&quot;');
      const fid = fileId.startsWith('cloud://')
        ? ` data-cb-fileid="${fileId.replace(/"/g, '&quot;')}"`
        : '';
      return `<img src="${src.replace(/"/g, '&quot;')}" alt="${alt}" loading="lazy"${fid}>`;
    }
    if (t === 'span') {
      const cls = pick('class');
      if (cls === 'cb-uploading' || cls === 'cb-mention') {
        return cls === 'cb-mention' ? '<span class="cb-mention">' : '<span class="cb-uploading">';
      }
      return '<span>';
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

  function findRootId(row) {
    let id = row.parentId;
    const seen = new Set();
    while (id && map.has(id) && !seen.has(id)) {
      seen.add(id);
      const p = map.get(id);
      if (!p?.parentId) return id;
      id = p.parentId;
    }
    return row.parentId;
  }

  const roots = [];
  map.forEach(c => {
    if (!c.parentId) {
      roots.push(c);
      return;
    }
    const rootId = findRootId(c);
    const root = rootId ? map.get(rootId) : null;
    if (root && root._id !== c._id) {
      root.replies.push(c);
    } else {
      roots.push(c);
    }
  });

  const sortNewest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  const sortOldest = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  roots.sort(sortNewest);
  map.forEach(c => {
    if (c.replies?.length) c.replies.sort(sortOldest);
  });
  return roots;
}

function stripMentionHtml(html) {
  return String(html || '')
    .replace(/<span class="cb-mention">@[^<]*<\/span>\s*/gi, '')
    .trim();
}

async function publicComment(row) {
  return {
    _id: row._id,
    path: row.path,
    nick: row.nick || '访客',
    contentHtml: await resolveCommentImageUrls(stripMentionHtml(row.contentHtml)),
    parentId: row.parentId || null,
    replyToNick: row.replyToNick || null,
    createdAt: row.createdAt,
    createdAtIso: row.createdAtIso,
  };
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function isReplyNotifyEnabled() {
  return String(process.env.REPLY_NOTIFY_ENABLED || '0') === '1'
    && String(process.env.SMTP_HOST || '').trim()
    && String(process.env.SMTP_USER || '').trim();
}

function escapeHtmlText(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveNotifyPageUrl(pageUrl, path) {
  const u = String(pageUrl || '').trim();
  if (/^https?:\/\//i.test(u)) return u;
  const base = String(process.env.SITE_URL || 'https://gitpull.cn').replace(/\/+$/, '');
  const p = String(path || '').trim();
  if (!p) return base;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith('/')) return `${base}${p}`;
  if (p.includes('/')) return `${base}/${p}`;
  return `${base}/post/${p}/`;
}

async function sendReplyNotifyEmail({ to, parentNick, replyNick, excerpt, pageTitle, pageUrl, path }) {
  if (!isValidEmail(to) || !isReplyNotifyEnabled()) return;
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT) || 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port !== 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || '',
    },
  });
  const title = escapeHtmlText(String(pageTitle || '博客').slice(0, 80));
  const link = resolveNotifyPageUrl(pageUrl, path);
  const safeLink = escapeHtmlText(link);
  const safeReply = escapeHtmlText(replyNick);
  const safeParent = escapeHtmlText(parentNick);
  const safeExcerpt = escapeHtmlText(excerpt);
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER).trim();
  await transporter.sendMail({
    from,
    to,
    subject: `【${String(pageTitle || '博客').slice(0, 80)}】${replyNick} 回复了你的评论`,
    text: `${replyNick} 在《${pageTitle || '博客'}》回复了 @${parentNick}：\n\n${excerpt}\n\n查看原文：${link}`,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333;">
<p><strong>${safeReply}</strong> 在《${title}》回复了 <strong>@${safeParent}</strong>：</p>
<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #ea6c5c;background:#f7f7f7;">${safeExcerpt}</blockquote>
<p><a href="${safeLink}" style="color:#ea6c5c;text-decoration:underline;" target="_blank" rel="noopener">查看原文</a></p>
<p style="font-size:12px;color:#999;">${safeLink}</p>
</div>`,
  });
}

async function handleGet(event) {
  const path = String(event.path || '').trim();
  if (!path) return jsonErr('缺少 path');
  const limit = Math.min(Math.max(Number(event.limit) || 50, 1), 200);
  const res = await db.collection(COLLECTION)
    .where({ path })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  const rows = (res.data || []).filter(r => {
    const s = r.status || 'visible';
    return s === 'visible';
  });
  const comments = await Promise.all(rows.map(publicComment));
  return jsonOk({ comments: nestComments(comments) });
}

async function handlePost(event, context) {
  const path = String(event.path || '').trim();
  let contentHtml = await resolveCommentImageUrls(sanitizeHtml(event.contentHtml));
  const plain = stripPlain(contentHtml);
  if (!path) return jsonErr('缺少 path');
  if (!plain) return jsonErr('评论内容不能为空');
  if (plain.length > MAX_PLAIN_HINT) return jsonErr('评论内容过长');

  const ip = context?.requestContext?.sourceIp || context?.CLIENTIP || '';
  const ipHash = hashIp(ip);
  if (!(await checkRate(ipHash))) return jsonErr('操作过于频繁，请稍后再试', 429);

  const parentIdRaw = event.parentId ? String(event.parentId).trim() : null;
  let parentId = parentIdRaw;
  let parentDoc = null;
  let replyToNick = null;
  if (parentId) {
    const got = await db.collection(COLLECTION).doc(parentId).get();
    parentDoc = got?.data?.[0] || null;
    if (!parentDoc || parentDoc.path !== path) return jsonErr('回复目标不存在');
    if ((parentDoc.status || 'visible') !== 'visible') return jsonErr('无法回复该评论');
    replyToNick = String(parentDoc.nick || '访客').trim() || '访客';
    if (parentDoc.parentId) {
      parentId = String(parentDoc.parentId).trim();
    }
  }

  const moderation = String(process.env.COMMENT_MODERATION || '0') === '1';
  const now = Date.now();
  const pageTitle = String(event.pageTitle || '').slice(0, 200);
  const pageUrl = String(event.pageUrl || '').slice(0, 500);
  const nick = String(event.nick || '').trim().slice(0, 40) || '访客';
  const doc = {
    path,
    nick,
    email: String(event.email || '').trim().slice(0, 120),
    contentHtml,
    parentId,
    replyToNick,
    pageTitle,
    pageUrl,
    status: moderation ? 'pending' : 'visible',
    createdAt: now,
    createdAtIso: new Date(now).toISOString(),
    ipHash,
    ua: String(context?.requestContext?.userAgent || '').slice(0, 300),
  };

  const addRes = await db.collection(COLLECTION).add(doc);

  if (parentDoc && isValidEmail(parentDoc.email) && !moderation) {
    const excerpt = stripPlain(contentHtml).slice(0, 200);
    sendReplyNotifyEmail({
      to: parentDoc.email,
      parentNick: replyToNick,
      replyNick: nick,
      excerpt,
      pageTitle,
      pageUrl,
      path,
    }).catch(err => console.error('reply notify failed', err));
  }

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
  const tempRes = await app.getTempFileURL({
    fileList: [{ fileID: fileId, maxAge: TEMP_URL_MAX_AGE }],
  });
  const url = tempRes.fileList?.[0]?.tempFileURL || '';
  if (!url) return jsonErr('获取图片链接失败');

  return jsonOk({ url, fileId });
}

async function dispatch(event, context) {
  const action = String(event?.action || '').toUpperCase();
  if (action === 'GET') return await handleGet(event);
  if (action === 'POST') return await handlePost(event, context);
  if (action === 'UPLOAD') return await handleUpload(event, context);
  return jsonErr('未知 action');
}

function getAllowedOrigins() {
  return String(process.env.ALLOWED_ORIGINS || 'https://gitpull.cn,https://www.gitpull.cn,http://127.0.0.1:8788,http://localhost:8788')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function pickOrigin(requestOrigin) {
  if (requestOrigin) {
    try {
      const host = new URL(requestOrigin).hostname.toLowerCase();
      if (host.endsWith('.tcloudbaseapp.com')) return requestOrigin;
    } catch (_) { /* ignore */ }
  }
  const allowed = getAllowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || 'https://gitpull.cn';
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': pickOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function isHttpEvent(event) {
  return !!(event && (event.httpMethod || event.method));
}

function httpResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function buildHttpContext(event, context) {
  const headers = event.headers || {};
  const ip = context?.requestContext?.sourceIp
    || event.requestContext?.sourceIp
    || String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '').split(',')[0]?.trim()
    || '';
  return {
    ...context,
    requestContext: {
      ...(context?.requestContext || {}),
      sourceIp: ip,
      userAgent: String(headers['user-agent'] || headers['User-Agent'] || '').slice(0, 300),
    },
  };
}

exports.main = async (event, context) => {
  try {
    await ensureCollections();

    if (isHttpEvent(event)) {
      const origin = event.headers?.origin || event.headers?.Origin || '';
      const method = String(event.httpMethod || event.method || '').toUpperCase();
      if (method === 'OPTIONS') {
        return httpResponse(204, '', origin);
      }
      let payload = event;
      if (event.body != null && event.body !== '') {
        try {
          payload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } catch {
          return httpResponse(400, jsonErr('JSON 解析失败'), origin);
        }
      }
      const result = await dispatch(payload, buildHttpContext(event, context));
      const code = result.ok === false ? Number(result.code) || 400 : 200;
      return httpResponse(code, result, origin);
    }

    return await dispatch(event, context);
  } catch (err) {
    console.error(err);
    if (isHttpEvent(event)) {
      const origin = event.headers?.origin || event.headers?.Origin || '';
      return httpResponse(500, jsonErr(err.message || '服务器错误', 500), origin);
    }
    return jsonErr(err.message || '服务器错误', 500);
  }
};
