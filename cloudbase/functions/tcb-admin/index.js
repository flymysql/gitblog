'use strict';
/**
 * tcb-admin —— 淘宝证书上传插件 · 云端后台管理云函数
 *
 * 功能：
 *  - POST /report       插件上报统计数据（订单完成/失败、证书上传数）
 *  - GET  /stats        汇总统计（各店铺上传证书数/正常/异常）
 *  - GET  /recent       最近事件列表
 *  - POST /login        后台登录（账号+密码 → token）
 *  - GET  /logs         列出已上传的日志包
 *  - GET  /builds       列出最新发包
 *  - GET/POST /whitelist 白名单管理（在线增删查）
 *  - POST /heartbeat    插件心跳（记录在线状态，按店铺 upsert）
 *  - POST /alert        异常上报（触发邮件告警）
 *
 * 数据模型（CloudBase 数据库）：
 *  - collection tcb_stats       统计事件（每条：type/shopName/certXxx/ts）
 *  - collection tcb_shops       店铺汇总（按店铺聚合）
 *  - collection tcb_admin_users 后台账号（登录用）
 *  - collection tcb_heartbeats  插件在线心跳
 *
 * 部署：tcb fn deploy tcb-admin -e <envId>
 * 创建 HTTP 服务：tcb service create -p tcb-admin -f tcb-admin
 */
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

const ENV_ID = String(process.env.TCB_ENV_ID || '').trim() || 'gitbolg-d7gmnsrw46e011706';
const STORAGE_BUCKET_ID = `6769-${ENV_ID}-1256429518`;

// 动态生成 COS 临时下载 URL（每次请求重新签名，避免存储的旧 sign 过期失效）
async function freshFileUrl(cloudPath) {
  if (!cloudPath) return '';
  try {
    const fileId = `cloud://${ENV_ID}.${STORAGE_BUCKET_ID}/${cloudPath}`;
    const res = await app.getTempFileURL({ fileList: [fileId] });
    const item = res.fileList && res.fileList[0];
    if (item && item.code === 'SUCCESS') {
      return item.download_url || item.tempFileURL || '';
    }
    return '';
  } catch (e) {
    return '';
  }
}

// 后台管理员账号（必须从 CloudBase 控制台环境变量配置，不提供弱密码兜底）
const ADMIN_USER = String(process.env.ADMIN_USER || 'admin').trim();
const ADMIN_PASS = String(process.env.ADMIN_PASS || '').trim();
const REPORT_TOKEN = String(process.env.REPORT_TOKEN || '').trim();
const TOKEN_SECRET = String(process.env.TOKEN_SECRET || '').trim();

// 未配置管理员密码时拒绝启动（防止部署后无密码/弱密码暴露）
if (!ADMIN_PASS) {
  console.error('❌ 未配置 ADMIN_PASS 环境变量，云函数拒绝启动。请在 CloudBase 控制台配置后再部署。');
  throw new Error('ADMIN_PASS 未配置');
}

const COLL_STATS = 'tcb_stats';
const COLL_SHOPS = 'tcb_shops';
const COLL_USERS = 'tcb_admin_users';
const COLL_HEART = 'tcb_heartbeats';
const COLL_WHITELIST = 'tcb_whitelist';
const COLL_LOG_FILES = 'tcb_log_files';
const COLL_FEEDBACK = 'tcb_feedback';

// —— 邮件告警（异常通知） ——
const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.SMTP_PASS || '').trim();
const SMTP_FROM = String(process.env.SMTP_FROM || SMTP_USER).trim();
const ALERT_EMAIL = String(process.env.ALERT_EMAIL || '').trim(); // 告警接收邮箱
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 同一店铺同类异常 5 分钟冷却

let alertCooldown = new Map(); // key -> lastAlertAt

function emailEnabled() {
  return !!(SMTP_HOST && SMTP_USER && ALERT_EMAIL);
}

async function sendAlertEmail(subject, html) {
  if (!emailEnabled()) return { ok: false, error: '邮件未配置' };
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"淘宝证书插件" <${SMTP_FROM}>`,
      to: ALERT_EMAIL,
      subject,
      html,
    });
    return { ok: true };
  } catch (e) {
    console.error('邮件发送失败:', e.message);
    return { ok: false, error: e.message };
  }
}

/** 触发异常告警（带冷却，避免告警风暴） */
async function triggerAlert(shopName, reason, detail) {
  const key = `${shopName || '未知'}|${reason || 'unknown'}`;
  const last = alertCooldown.get(key) || 0;
  if (now() - last < ALERT_COOLDOWN_MS) return { ok: true, throttled: true };
  alertCooldown.set(key, now());

  const shop = String(shopName || '未知店铺');
  const subject = `⚠️ [淘宝证书] ${shop} 异常: ${reason || '未知'}`;
  const html = `
    <h3>淘宝证书插件异常告警</h3>
    <p><b>店铺:</b> ${shop}</p>
    <p><b>异常类型:</b> ${reason || '未知'}</p>
    <p><b>详情:</b> ${String(detail || '').slice(0, 500)}</p>
    <p><b>时间:</b> ${new Date().toLocaleString('zh-CN')}</p>
    <p><a href="https://gitbolg-d7gmnsrw46e011706-1256429518.tcloudbaseapp.com/admin.html">前往后台查看 →</a></p>
  `;
  return await sendAlertEmail(subject, html);
}

const LOG_PREFIX = 'tcb-logs/';
const BUILD_PREFIX = 'tcb-builds/';

// —— 基础工具 ——
function jsonOk(data = {}) {
  return { ok: true, ...data };
}
function jsonErr(message, code = 400) {
  return { ok: false, message: String(message || 'error'), code };
}
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token, X-Upload-Token',
  };
}
function httpResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}
function isHttpEvent(event) {
  return !!(event && (event.httpMethod || event.method));
}
function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}
function now() {
  return Date.now();
}
function parseBody(event) {
  if (event.body == null || event.body === '') return {};
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

// 登录 token —— 无状态签名 token（HMAC-SHA256），不依赖内存/数据库，
// 云函数冷启动或多实例下会话不丢失；密钥来自环境变量（无弱密码兜底）
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h
function signToken(payload) {
  return sha256(payload + ':' + TOKEN_SECRET);
}
function makeToken() {
  const payload = `${now()}.${crypto.randomBytes(12).toString('hex')}`;
  return `${payload}.${signToken(payload)}`;
}
function checkAdmin(event) {
  const token = event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token'] || '';
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const payload = parts.slice(0, 2).join('.');
  const sig = parts[2];
  const expected = signToken(payload);
  // 恒定时间比较
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return false;
  // 过期校验
  const ts = Number(parts[0]);
  if (!Number.isFinite(ts) || now() - ts > TOKEN_TTL_MS) return false;
  return true;
}
function loginAdmin(body) {
  const user = String(body.user || '').trim();
  const pass = String(body.pass || '').trim();
  if (user === ADMIN_USER && sha256(pass) === sha256(ADMIN_PASS)) {
    const token = makeToken();
    return { ok: true, token, expiresIn: Math.floor(TOKEN_TTL_MS / 1000) };
  }
  return { ok: false, message: '账号或密码错误', code: 401 };
}

// —— 数据库工具 ——
async function ensureCollections() {
  const names = [COLL_STATS, COLL_SHOPS, COLL_USERS, COLL_HEART, COLL_WHITELIST, COLL_LOG_FILES, COLL_FEEDBACK];
  for (const name of names) {
    try {
      await db.createCollection(name);
    } catch (e) { /* 已存在则忽略 */ }
  }
}

// 上报统计：写入 tcb_stats + 聚合到 tcb_shops
// history 事件带 orderKey，按 orderKey 去重（同一订单不重复累计）
async function handleReport(events, origin) {
  const list = Array.isArray(events) ? events : (events && events.events ? events.events : [events]);
  if (!list.length) return jsonErr('事件列表为空');

  const added = [];
  let deduped = 0;
  for (const ev of list) {
    const type = String(ev.type || 'ship_done');
    const shop = String(ev.shopName || '未知店铺').slice(0, 100);
    const ts = Number(ev.ts) || now();
    const orderKey = ev.orderKey ? String(ev.orderKey).slice(0, 200) : '';

    // 历史补报去重：有 orderKey 时查重
    if (orderKey) {
      const exist = await db.collection(COLL_STATS).where({ orderKey }).get().catch(() => null);
      if (exist && exist.data && exist.data.length) {
        deduped += 1;
        continue;
      }
    }

    // 写事件
    const doc = {
      type,
      shopName: shop,
      certTotal: Number(ev.certTotal) || 0,
      certUploaded: Number(ev.certUploaded) || 0,
      certSkipped: Number(ev.certSkipped) || 0,
      certFailed: Number(ev.certFailed) || 0,
      noCertButtons: !!ev.noCertButtons,
      orderOk: !!ev.orderOk,
      error: String(ev.error || '').slice(0, 300),
      shipUrl: String(ev.shipUrl || '').slice(0, 300),
      ts,
      date: new Date(ts).toISOString().slice(0, 10),
      history: !!ev.history,
    };
    if (orderKey) doc.orderKey = orderKey;
    await db.collection(COLL_STATS).add(doc).catch(() => null);
    added.push(doc);

    // 聚合到店铺（upsert）
    try {
      const exist = await db.collection(COLL_SHOPS).where({ shopName: shop }).get();
      const inc = {
        certUploaded: _.inc(doc.certUploaded),
        certSkipped: _.inc(doc.certSkipped),
        certFailed: _.inc(doc.certFailed),
        orderOk: _.inc(doc.orderOk ? 1 : 0),
        orderError: _.inc(type === 'ship_error' || !doc.orderOk ? 1 : 0),
        totalEvents: _.inc(1),
      };
      if (exist.data && exist.data.length) {
        await db.collection(COLL_SHOPS).doc(exist.data[0]._id).update({ ...inc, lastActiveAt: ts });
      } else {
        await db.collection(COLL_SHOPS).add({
          shopName: shop,
          certUploaded: doc.certUploaded,
          certSkipped: doc.certSkipped,
          certFailed: doc.certFailed,
          orderOk: doc.orderOk ? 1 : 0,
          orderError: type === 'ship_error' || !doc.orderOk ? 1 : 0,
          totalEvents: 1,
          createdAt: ts,
          lastActiveAt: ts,
        });
      }
    } catch (e) { /* 聚合失败不阻断 */ }
  }
  return jsonOk({ added: added.length, deduped });
}

// 汇总统计
async function handleStats() {
  const shops = await db.collection(COLL_SHOPS).orderBy('lastActiveAt', 'desc').limit(100).get();
  const events = await db.collection(COLL_STATS).orderBy('ts', 'desc').limit(500).get();
  // 在线状态（心跳）：最近 5 分钟内有心跳视为在线
  const ONLINE_WINDOW_MS = 5 * 60 * 1000;
  const hearts = await db.collection(COLL_HEART).limit(200).get().catch(() => null);
  const heartMap = {};
  (hearts && hearts.data || []).forEach((h) => {
    heartMap[h.shopName] = {
      online: now() - (h.ts || 0) < ONLINE_WINDOW_MS,
      lastSeen: h.ts || 0,
      version: h.version || '',
      status: h.status || '',
    };
  });

  let totalUploaded = 0, totalSkipped = 0, totalFailed = 0, totalOk = 0, totalErr = 0;
  (shops.data || []).forEach((s) => {
    totalUploaded += s.certUploaded || 0;
    totalSkipped += s.certSkipped || 0;
    totalFailed += s.certFailed || 0;
    totalOk += s.orderOk || 0;
    totalErr += s.orderError || 0;
  });

  // 分阶段统计（最近1天/7天/30天/全部）+ 每日趋势（近30天柱状数据）
  const nowTs = now();
  const DAY = 24 * 60 * 60 * 1000;
  const buckets = [1, 7, 30].map((days) => {
    const cutoff = nowTs - days * DAY;
    const evs = (events.data || []).filter((e) => Number(e.ts) >= cutoff);
    return {
      days,
      uploaded: evs.reduce((s, e) => s + (Number(e.certUploaded) || 0), 0),
      skipped: evs.reduce((s, e) => s + (Number(e.certSkipped) || 0), 0),
      failed: evs.reduce((s, e) => s + (Number(e.certFailed) || 0), 0),
      orderOk: evs.filter((e) => e.orderOk).length,
      orderError: evs.filter((e) => e.type === 'ship_error' || (!e.orderOk && e.type === 'ship_done')).length,
    };
  });

  // 每日趋势（近 30 天，按天聚合上传量）
  const dailyMap = {};
  (events.data || []).forEach((e) => {
    const d = new Date(Number(e.ts)).toISOString().slice(0, 10);
    if (!dailyMap[d]) dailyMap[d] = { date: d, uploaded: 0, skipped: 0, failed: 0, orderOk: 0, orderError: 0 };
    dailyMap[d].uploaded += Number(e.certUploaded) || 0;
    dailyMap[d].skipped += Number(e.certSkipped) || 0;
    dailyMap[d].failed += Number(e.certFailed) || 0;
    if (e.orderOk) dailyMap[d].orderOk += 1;
    if (e.type === 'ship_error' || (!e.orderOk && e.type === 'ship_done')) dailyMap[d].orderError += 1;
  });
  const daily = Object.values(dailyMap).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-30);

  // 分店铺分阶段
  const shopsDetailed = (shops.data || []).map((s) => {
    const shopEvents = (events.data || []).filter((e) => e.shopName === s.shopName);
    const bucketed = [1, 7, 30].map((days) => {
      const cutoff = nowTs - days * DAY;
      const evs = shopEvents.filter((e) => Number(e.ts) >= cutoff);
      return {
        days,
        uploaded: evs.reduce((x, e) => x + (Number(e.certUploaded) || 0), 0),
        failed: evs.reduce((x, e) => x + (Number(e.certFailed) || 0), 0),
      };
    });
    return { ...s, buckets: bucketed };
  });

  // 节省时间估算：平均每个证书 1 分钟人工操作
  const SAVE_MIN_PER_CERT = 1;
  const savedMinutes = totalUploaded * SAVE_MIN_PER_CERT;
  const savedHours = Math.floor(savedMinutes / 60);
  const savedMinRemain = Math.round(savedMinutes % 60);

  return jsonOk({
    shops: shops.data || [],
    shopsDetailed,
    heartbeats: heartMap,
    onlineCount: Object.values(heartMap).filter((h) => h.online).length,
    recent: (events.data || []).slice(0, 100),
    buckets,
    daily,
    totals: {
      uploaded: totalUploaded,
      skipped: totalSkipped,
      failed: totalFailed,
      orderOk: totalOk,
      orderError: totalErr,
      shopCount: (shops.data || []).length,
    },
    savedTime: {
      minutes: savedMinutes,
      hours: savedHours,
      remainMin: savedMinRemain,
      text: savedHours > 0 ? `${savedHours} 小时 ${savedMinRemain} 分` : `${savedMinRemain} 分钟`,
      perCertMinutes: SAVE_MIN_PER_CERT,
    },
  });
}

// 白名单管理（存云存储 json + 数据库）
async function handleWhitelist(action, body) {
  const COLL = COLL_WHITELIST;
  if (action === 'get') {
    const rows = await db.collection(COLL).limit(500).get();
    return jsonOk({ list: (rows.data || []).map((r) => r.shopName) });
  }
  if (action === 'add') {
    const name = String(body.shopName || '').trim();
    if (!name) return jsonErr('店铺名不能为空');
    const exist = await db.collection(COLL).where({ shopName: name }).get();
    if (exist.data && exist.data.length) return jsonErr('该店铺已在白名单');
    await db.collection(COLL).add({ shopName: name, createdAt: now() });
    return jsonOk({ added: name });
  }
  if (action === 'remove') {
    const name = String(body.shopName || '').trim();
    if (!name) return jsonErr('店铺名不能为空');
    await db.collection(COLL).where({ shopName: name }).remove();
    return jsonOk({ removed: name });
  }
  return jsonErr('未知白名单操作');
}

// 日志包列表（COS 云存储；CloudBase 无法直接 list bucket，用数据库索引 tcb_log_files）
async function handleLogs(action) {
  const COLL = COLL_LOG_FILES;
  if (action === 'list') {
    // 只显示日志包（kind=log 或无 kind），排除 build(安装包)
    let rows;
    try {
      rows = await db.collection(COLL).where({ kind: _.in(['log', null]) }).orderBy('ts', 'desc').limit(100).get();
    } catch (e) {
      // 部分环境不支持 null 匹配,回退为全量再过滤
      rows = await db.collection(COLL).orderBy('ts', 'desc').limit(200).get();
      const filtered = { data: (rows.data || []).filter((f) => f.kind !== 'build') };
      rows = filtered;
    }
    return jsonOk({ files: rows.data || [] });
  }
  if (action === 'builds') {
    const rows = await db.collection(COLL).where({ kind: 'build' }).orderBy('ts', 'desc').limit(20).get();
    return jsonOk({ files: rows.data || [] });
  }
  return jsonErr('未知日志操作');
}

// —— 用户反馈 ——
// 提交反馈（公开，免登录；带简单频率限制）
async function submitFeedback(body, ip) {
  const content = String(body.content || '').trim();
  const contact = String(body.contact || '').trim().slice(0, 100);
  const version = String(body.version || '').slice(0, 40);
  const shop = String(body.shop || '').slice(0, 100);
  if (!content) return jsonErr('反馈内容不能为空');
  if (content.length < 2) return jsonErr('反馈内容太短');
  if (content.length > 2000) return jsonErr('反馈内容过长（最多 2000 字）');

  // 频率限制：同一 IP 1 分钟内最多 3 条
  const ipHash = sha256(String(ip || '') + ':tcb-feedback');
  const minAgo = now() - 60 * 1000;
  const recent = await db.collection(COLL_FEEDBACK).where({ ipHash, ts: _.gt(minAgo) }).get().catch(() => null);
  if (recent && recent.data && recent.data.length >= 3) {
    return jsonErr('提交过于频繁，请 1 分钟后再试', 429);
  }

  const doc = {
    content,
    contact,
    version,
    shop,
    ipHash,
    ts: now(),
    date: new Date().toISOString().slice(0, 10),
    status: 'new', // new | processing | done
    replied: '',
  };
  await db.collection(COLL_FEEDBACK).add(doc);
  return jsonOk({ id: doc._id || '', submitted: true });
}

// 反馈列表（后台登录后查看）
async function listFeedback(publicOnly) {
  const rows = await db.collection(COLL_FEEDBACK).orderBy('ts', 'desc').limit(200).get();
  const mapped = (rows.data || []).map((f) => ({
    id: f._id,
    content: f.content,
    contact: f.contact || '',
    version: f.version || '',
    shop: f.shop || '',
    type: f.type || '',
    ts: f.ts,
    status: f.status || 'new',
    replied: f.replied || '',
    public: !!f.public,
  }));
  if (publicOnly) {
    return jsonOk({ feedback: mapped.filter((f) => f.replied && f.public) });
  }
  return jsonOk({ feedback: mapped });
}

// 反馈状态更新（后台：标记处理中/已完成、回复）
async function updateFeedback(body) {
  const id = String(body.id || '').trim();
  if (!id) return jsonErr('缺少反馈 id');
  const patch = {};
  if (body.status) patch.status = String(body.status).slice(0, 20);
  if (body.replied !== undefined) patch.replied = String(body.replied).slice(0, 500);
  // 回复后默认公开展示（可在后台取消勾选 public=false）
  if (body.public !== undefined) patch.public = !!body.public;
  else if (body.replied !== undefined && body.replied.trim()) patch.public = true;
  if (!Object.keys(patch).length) return jsonErr('无更新内容');
  try {
    await db.collection(COLL_FEEDBACK).doc(id).update({ ...patch, updatedAt: now() });
    return jsonOk({ updated: id });
  } catch (e) {
    return jsonErr('更新失败: ' + e.message);
  }
}

exports.main = async (event, context) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (isHttpEvent(event)) {
    const method = String(event.httpMethod || event.method || '').toUpperCase();
    if (method === 'OPTIONS') {
      return httpResponse(204, '', origin);
    }

    const path = String(event.path || event.url || '').replace(/\/+$/, '') || '';
    const action = String(event.queryStringParameters?.action || '').toLowerCase();
    const body = parseBody(event);

    // 登录（无需 token）
    if (method === 'POST' && (path.endsWith('/login') || action === 'login')) {
      const r = loginAdmin(body);
      return httpResponse(r.ok ? 200 : 401, r, origin);
    }

    // 统计上报（REPORT_TOKEN 鉴权）
    if (method === 'POST' && (path.endsWith('/report') || action === 'report')) {
      const token = event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token'] || '';
      if (REPORT_TOKEN && token !== REPORT_TOKEN) {
        return httpResponse(403, jsonErr('上报令牌无效'), origin);
      }
      await ensureCollections();
      const r = await handleReport(body, origin);
      return httpResponse(r.ok ? 200 : 400, r, origin);
    }

    // 心跳（插件在线状态，按店铺 upsert）
    if (method === 'POST' && (path.endsWith('/heartbeat') || action === 'heartbeat')) {
      await ensureCollections();
      const shop = String(body.shopName || '未知店铺').slice(0, 100);
      const ts = now();
      const version = String(body.version || '').slice(0, 30);
      const status = String(body.status || 'idle').slice(0, 30);
      try {
        const exist = await db.collection(COLL_HEART).where({ shopName: shop }).get();
        if (exist.data && exist.data.length) {
          await db.collection(COLL_HEART).doc(exist.data[0]._id).update({ ts, version, status, updatedAt: ts });
        } else {
          await db.collection(COLL_HEART).add({ shopName: shop, ts, version, status, updatedAt: ts });
        }
      } catch (e) { /* 心跳失败不阻断 */ }
      return httpResponse(200, jsonOk(), origin);
    }

    // 异常告警上报（插件检测到异常时调用，云函数发邮件）
    if (method === 'POST' && (path.endsWith('/alert') || action === 'alert')) {
      const token = event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token'] || '';
      if (REPORT_TOKEN && token !== REPORT_TOKEN) {
        return httpResponse(403, jsonErr('上报令牌无效'), origin);
      }
      const r = await triggerAlert(body.shopName, body.reason, body.detail);
      return httpResponse(r.ok ? 200 : 500, r, origin);
    }

    // 公开发包列表（无需登录，供下载页使用；只暴露已发布的 build 元数据）
    if (method === 'GET' && (path.includes('/public-builds') || action === 'public-builds')) {
      try {
        const rows = await db.collection(COLL_LOG_FILES).where({ kind: 'build', published: true }).orderBy('ts', 'desc').limit(50).get();
        const files = [];
        for (const f of (rows.data || [])) {
          // 每次动态生成新鲜签名 URL（数据库里的旧 url 会过期）
          const cloudPath = f.cloudPath || ('tcb-builds/' + (f.filename || ''));
          const url = await freshFileUrl(cloudPath);
          files.push({
            filename: f.filename || cloudPath.split('/').pop() || '',
            version: f.version || '',
            ts: f.ts,
            size: f.size || 0,
            url,
            note: f.note || '',
          });
        }
        return httpResponse(200, jsonOk({ files }), origin);
      } catch (e) {
        return httpResponse(200, jsonOk({ files: [], hint: e.message }), origin);
      }
    }

    // 最新版本信息（供插件自动更新检查；返回最新版本号 + 各浏览器包 URL）
    if (method === 'GET' && (path.includes('/public-latest') || action === 'public-latest')) {
      try {
        const rows = await db.collection(COLL_LOG_FILES).where({ kind: 'build', published: true }).orderBy('ts', 'desc').limit(50).get();
        const files = (rows.data || []);
        // 按版本分组，取版本号最大的一组
        const byVer = {};
        files.forEach((f) => {
          const v = String(f.version || '').trim() || '0';
          (byVer[v] = byVer[v] || []).push(f);
        });
        const versionList = Object.keys(byVer).sort((a, b) => {
          // 语义化版本比较
          const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
          const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
          for (let i = 0; i < 3; i++) {
            const da = pa[i] || 0, db2 = pb[i] || 0;
            if (da !== db2) return db2 - da;
          }
          return 0;
        });
        const latestVer = versionList[0] || '';
        const latestFiles = byVer[latestVer] || [];
        const chromeFile = latestFiles.find((f) => /\.zip$/i.test(f.filename || ''));
        const crxFile = latestFiles.find((f) => /\.crx$/i.test(f.filename || ''));
        // 动态生成新鲜签名 URL（不用数据库里过期的）
        const chromeUrl = chromeFile ? await freshFileUrl(chromeFile.cloudPath || ('tcb-builds/' + chromeFile.filename)) : '';
        const crxUrl = crxFile ? await freshFileUrl(crxFile.cloudPath || ('tcb-builds/' + crxFile.filename)) : '';
        return httpResponse(200, jsonOk({
          latestVersion: latestVer,
          latestTs: latestFiles[0] ? latestFiles[0].ts : 0,
          chrome: chromeFile ? { filename: chromeFile.filename, url: chromeUrl, size: chromeFile.size, ts: chromeFile.ts } : null,
          crx: crxFile ? { filename: crxFile.filename, url: crxUrl, size: crxFile.size, ts: crxFile.ts } : null,
        }), origin);
      } catch (e) {
        return httpResponse(200, jsonOk({ latestVersion: '', chrome: null, crx: null, hint: e.message }), origin);
      }
    }

    // 公开白名单（免登录，供插件内容脚本拉取）
    if (method === 'GET' && (path.includes('/public-whitelist') || action === 'public-whitelist')) {
      try {
        await ensureCollections();
        const rows = await db.collection(COLL_WHITELIST).limit(500).get();
        return httpResponse(200, jsonOk({ list: (rows.data || []).map((r) => r.shopName) }), origin);
      } catch (e) {
        return httpResponse(200, jsonOk({ list: [], hint: e.message }), origin);
      }
    }

    // 提交用户反馈（公开，免登录）
    if (method === 'POST' && action === 'feedback-submit') {
      await ensureCollections();
      const ip = event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'] || (event.clientIP || '') || '';
      const r = await submitFeedback(body, ip);
      return httpResponse(r.ok ? 200 : (r.code || 400), r, origin);
    }

    // 公开已回复反馈列表（免登录，只暴露 replied+public）
    if (method === 'GET' && action === 'feedback-public') {
      await ensureCollections();
      const r = await listFeedback(true);
      return httpResponse(200, r, origin);
    }

    // 以下需要后台登录
    if (!checkAdmin(event)) {
      return httpResponse(401, jsonErr('未登录或会话过期', 401), origin);
    }
    await ensureCollections();

    // 汇总
    if (method === 'GET' && (path.endsWith('/stats') || action === 'stats')) {
      const r = await handleStats();
      return httpResponse(200, r, origin);
    }
    // 白名单
    if ((path.includes('/whitelist') || action.startsWith('whitelist'))) {
      const op = action.replace('whitelist-', '').replace('whitelist_', '') || 'get';
      const r = await handleWhitelist(op, body);
      return httpResponse(r.ok ? 200 : 400, r, origin);
    }
    // 日志/发包列表
    if (path.includes('/logs') || action === 'logs') {
      const r = await handleLogs('list');
      return httpResponse(200, r, origin);
    }
    if (path.includes('/builds') || action === 'builds') {
      const r = await handleLogs('builds');
      return httpResponse(200, r, origin);
    }
    // 反馈列表 / 状态更新
    if (path.includes('/feedback') || action === 'feedback-list' || action === 'feedback-update') {
      if (method === 'GET') {
        const r = await listFeedback();
        return httpResponse(200, r, origin);
      }
      if (method === 'POST') {
        const r = await updateFeedback(body);
        return httpResponse(r.ok ? 200 : 400, r, origin);
      }
    }

    return httpResponse(404, jsonErr('未知接口: ' + path), origin);
  }

  return jsonErr('请通过 HTTP 访问', 400);
};
