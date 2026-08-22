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
 *  - GET  /heartbeat    插件心跳（记录在线状态）
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

// 后台管理员账号（环境变量配置；默认 admin / 请在控制台修改）
const ADMIN_USER = String(process.env.ADMIN_USER || 'admin').trim();
const ADMIN_PASS = String(process.env.ADMIN_PASS || 'CHANGE_ME').trim();
const REPORT_TOKEN = String(process.env.REPORT_TOKEN || 'CHANGE_ME').trim();

const COLL_STATS = 'tcb_stats';
const COLL_SHOPS = 'tcb_shops';
const COLL_USERS = 'tcb_admin_users';
const COLL_HEART = 'tcb_heartbeats';
const COLL_WHITELIST = 'tcb_whitelist';
const COLL_LOG_FILES = 'tcb_log_files';

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

// 登录 token（内存 + 时间戳；云函数冷启动会重置，但后台会话短可接受）
let adminTokens = new Map(); // token -> expiry
function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}
function checkAdmin(event) {
  const token = event.headers?.['x-admin-token'] || event.headers?.['X-Admin-Token'] || '';
  if (!token) return false;
  const exp = adminTokens.get(token);
  if (!exp || exp < now()) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}
function loginAdmin(body) {
  const user = String(body.user || '').trim();
  const pass = String(body.pass || '').trim();
  if (user === ADMIN_USER && sha256(pass) === sha256(ADMIN_PASS)) {
    const token = makeToken();
    adminTokens.set(token, now() + 12 * 60 * 60 * 1000); // 12h
    return { ok: true, token, expiresIn: 12 * 3600 };
  }
  return { ok: false, message: '账号或密码错误', code: 401 };
}

// —— 数据库工具 ——
async function ensureCollections() {
  const names = [COLL_STATS, COLL_SHOPS, COLL_USERS, COLL_HEART, COLL_WHITELIST, COLL_LOG_FILES];
  for (const name of names) {
    try {
      await db.createCollection(name);
    } catch (e) { /* 已存在则忽略 */ }
  }
}

// 上报统计：写入 tcb_stats + 聚合到 tcb_shops
async function handleReport(events, origin) {
  const list = Array.isArray(events) ? events : (events && events.events ? events.events : [events]);
  if (!list.length) return jsonErr('事件列表为空');

  const added = [];
  for (const ev of list) {
    const type = String(ev.type || 'ship_done');
    const shop = String(ev.shopName || '未知店铺').slice(0, 100);
    const ts = Number(ev.ts) || now();

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
    };
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
  return jsonOk({ added: added.length });
}

// 汇总统计
async function handleStats() {
  const shops = await db.collection(COLL_SHOPS).orderBy('lastActiveAt', 'desc').limit(100).get();
  const events = await db.collection(COLL_STATS).orderBy('ts', 'desc').limit(500).get();

  let totalUploaded = 0, totalSkipped = 0, totalFailed = 0, totalOk = 0, totalErr = 0;
  (shops.data || []).forEach((s) => {
    totalUploaded += s.certUploaded || 0;
    totalSkipped += s.certSkipped || 0;
    totalFailed += s.certFailed || 0;
    totalOk += s.orderOk || 0;
    totalErr += s.orderError || 0;
  });
  return jsonOk({
    shops: shops.data || [],
    recent: (events.data || []).slice(0, 100),
    totals: {
      uploaded: totalUploaded,
      skipped: totalSkipped,
      failed: totalFailed,
      orderOk: totalOk,
      orderError: totalErr,
      shopCount: (shops.data || []).length,
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
    const rows = await db.collection(COLL).orderBy('ts', 'desc').limit(100).get();
    return jsonOk({ files: rows.data || [] });
  }
  if (action === 'builds') {
    const rows = await db.collection(COLL).where({ kind: 'build' }).orderBy('ts', 'desc').limit(20).get();
    return jsonOk({ files: rows.data || [] });
  }
  return jsonErr('未知日志操作');
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

    // 心跳（插件在线状态）
    if (method === 'POST' && (path.endsWith('/heartbeat') || action === 'heartbeat')) {
      await db.collection(COLL_HEART).add({ ...body, ts: now() }).catch(() => null);
      return httpResponse(200, jsonOk(), origin);
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

    return httpResponse(404, jsonErr('未知接口: ' + path), origin);
  }

  return jsonErr('请通过 HTTP 访问', 400);
};
