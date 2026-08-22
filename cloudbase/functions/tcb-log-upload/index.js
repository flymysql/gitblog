'use strict';
/**
 * tcb-log-upload —— 淘宝证书自动上传插件的日志包/发包上传云函数
 *
 * 功能：
 *   POST /upload  接收日志包 zip（multipart 或裸二进制）→ 存云存储 tcb-logs/
 *   POST /list    列出 tcb-logs/ 下的文件（返回名称+临时URL）
 *   POST /url     为指定文件生成临时下载 URL
 *   POST /delete  删除指定文件
 *   POST /builds  上传 CRX 发包 → 存云存储 tcb-builds/
 *
 * 部署：
 *   tcb fn deploy tcb-log-upload -e <envId>
 * 需要给函数开启 HTTP 访问（CloudBase 控制台/CLI：函数 → HTTP 访问服务）
 */
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });

// 当前环境 ID（SYMBOL_CURRENT_ENV 是 Symbol，不能拼字符串，用 process.env 读取）
const ENV_ID = String(process.env.TCB_ENV_ID || process.env.SCF_NAMESPACE || process.env.TENCENTCLOUD_ENV || '').trim()
  || 'gitbolg-d7gmnsrw46e011706';
const STORAGE_BUCKET_ID = `6769-${ENV_ID}-1256429518`;

// 上传校验令牌（环境变量配置；扩展内置，用于阻止匿名刷量）
const UPLOAD_TOKEN = String(process.env.UPLOAD_TOKEN || '').trim();
const LOG_PREFIX = 'tcb-logs/';
const BUILD_PREFIX = 'tcb-builds/';
const MAX_BODY = 50 * 1024 * 1024; // 50MB

function jsonOk(data = {}) {
  return { ok: true, ...data };
}

function jsonErr(message, code = 400) {
  return { ok: false, message: String(message || 'error'), code };
}

function corsHeaders(origin) {
  const allow = origin || '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Upload-Token',
  };
}

function httpResponse(statusCode, body, origin, contentType = 'application/json; charset=utf-8') {
  return {
    statusCode,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': contentType,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function isHttpEvent(event) {
  return !!(event && (event.httpMethod || event.method));
}

function checkToken(event) {
  if (!UPLOAD_TOKEN) return true; // 未配置令牌则放行（部署时建议配置）
  const token =
    event.headers?.['x-upload-token'] ||
    event.headers?.['X-Upload-Token'] ||
    (event.body && typeof event.body === 'object' ? event.body.token : '') ||
    '';
  return token === UPLOAD_TOKEN;
}

function safeName(name) {
  // 只保留安全的文件名
  const base = String(name || 'tcb-upload.zip').split('/').pop().replace(/[\\:*?"<>|]/g, '_');
  if (!base || base.length > 200) return `tcb-upload-${Date.now()}.zip`;
  return base;
}

function parseMultipartBody(bodyBuffer, contentType) {
  // 解析 multipart/form-data，提取第一个文件的 filename 和内容
  const boundaryMatch = String(contentType || '').match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return null;
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  if (!boundary) return null;

  const sep = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = bodyBuffer.indexOf(sep);
  while (start !== -1) {
    const next = bodyBuffer.indexOf(sep, start + sep.length);
    if (next === -1) break;
    parts.push(bodyBuffer.slice(start + sep.length, next));
    start = next;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const head = part.slice(0, headerEnd).toString('utf8');
    const fileMatch = head.match(/filename="?([^";\r\n]+)"?/i);
    if (!fileMatch) continue;
    let content = part.slice(headerEnd + 4);
    // 去掉结尾的 \r\n
    content = content.slice(0, content.length - 2 >= 0 && content[content.length - 2] === 13 && content[content.length - 1] === 10 ? content.length - 2 : content.length);
    return { filename: safeName(fileMatch[1]), content };
  }
  return null;
}

async function uploadToStorage(cloudPath, buffer) {
  const res = await app.uploadFile({ cloudPath, fileContent: buffer });
  return res;
}

async function getTempUrl(cloudPath) {
  const fileId = `cloud://${ENV_ID}.${STORAGE_BUCKET_ID}/${cloudPath}`;
  const res = await app.getTempFileURL({ fileList: [fileId] });
  const item = res.fileList && res.fileList[0];
  if (item && item.code === 'SUCCESS') {
    return item.download_url || item.tempFileURL || '';
  }
  return '';
}

exports.main = async (event, context) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';

  if (isHttpEvent(event)) {
    const method = String(event.httpMethod || event.method || '').toUpperCase();
    if (method === 'OPTIONS') {
      return httpResponse(204, '', origin);
    }
    if (!checkToken(event)) {
      return httpResponse(403, jsonErr('令牌无效'), origin);
    }

    // event.body 可能是 base64 字符串（CloudBase HTTP 网关会把二进制转 base64）
    let bodyBuffer = null;
    const rawBody = event.body;
    if (rawBody != null && rawBody !== '') {
      if (typeof rawBody === 'string') {
        // 判断是否 base64（CloudBase 网关通常传 base64）
        try {
          bodyBuffer = Buffer.from(rawBody, 'base64');
        } catch {
          bodyBuffer = Buffer.from(rawBody, 'utf8');
        }
      } else if (Buffer.isBuffer(rawBody)) {
        bodyBuffer = rawBody;
      } else if (rawBody instanceof Uint8Array) {
        bodyBuffer = Buffer.from(rawBody);
      }
    }

    const path = String(event.path || event.url || '').replace(/\/+$/, '') || '';
    const action = String(event.queryStringParameters?.action || event.queryStringParameters?.Action || '').toLowerCase();

    // 上传日志包 / 发包
    if (method === 'POST' && (path.endsWith('/upload') || action === 'upload')) {
      if (!bodyBuffer || !bodyBuffer.length) {
        return httpResponse(400, jsonErr('请求体为空'), origin);
      }
      const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
      const targetPrefix = (path.includes('builds') || action === 'upload-build') ? BUILD_PREFIX : LOG_PREFIX;

      // 尝试 multipart 解析；失败则按裸二进制处理
      let filename = safeName((event.queryStringParameters?.filename) || `tcb-log-${Date.now()}.zip`);
      let content = bodyBuffer;
      if (contentType.includes('multipart/form-data')) {
        const parsed = parseMultipartBody(bodyBuffer, contentType);
        if (parsed) {
          filename = parsed.filename;
          content = parsed.content;
        }
      }

      if (!filename.endsWith('.zip') && !filename.endsWith('.crx')) {
        filename += '.zip';
      }
      const cloudPath = targetPrefix + filename;

      try {
        const res = await uploadToStorage(cloudPath, content);
        const url = await getTempUrl(cloudPath);
        return httpResponse(200, jsonOk({
          filename,
          cloudPath,
          size: content.length,
          sha256: crypto.createHash('sha256').update(content).digest('hex').slice(0, 16),
          fileID: res.fileID,
          url,
        }), origin);
      } catch (err) {
        console.error('上传失败:', err);
        return httpResponse(500, jsonErr('上传失败: ' + err.message, 500), origin);
      }
    }

    // 列表
    if (method === 'GET' && (path.endsWith('/list') || action === 'list')) {
      try {
        // 云存储列表需要拿到 bucket；通过 SDK listFiles
        // @cloudbase/node-sdk 没有直接 list，用 COS 原生 SDK 或 cloudbase 管理端
        // 这里用 getUploadMetadata 探测或返回空列表提示
        return httpResponse(200, jsonOk({
          hint: '列表需要 COS API，暂返回空；请直接使用 /url 获取指定文件临时链接',
          files: [],
        }), origin);
      } catch (err) {
        return httpResponse(500, jsonErr('列表失败: ' + err.message, 500), origin);
      }
    }

    // 生成下载 URL
    if (method === 'GET' && (path.endsWith('/url') || action === 'url')) {
      const file = String(event.queryStringParameters?.file || '').trim();
      if (!file) return httpResponse(400, jsonErr('缺少 file 参数'), origin);
      const cloudPath = file.startsWith('tcb-logs/') || file.startsWith('tcb-builds/') ? file : LOG_PREFIX + safeName(file);
      const url = await getTempUrl(cloudPath);
      if (!url) return httpResponse(404, jsonErr('文件不存在'), origin);
      return httpResponse(200, jsonOk({ file: cloudPath, url }), origin);
    }

    return httpResponse(404, jsonErr('未知接口'), origin);
  }

  // 非 HTTP 调用（SDK invoke）
  return jsonErr('请通过 HTTP 访问', 400);
};
