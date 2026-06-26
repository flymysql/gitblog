/**
 * 本地 / CI 调用已部署的 CloudBase 云函数
 * 优先级：Node SDK（CI 密钥）> HTTP 网关 > tcb fn invoke（本地 tcb login）
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cloudbase from '@cloudbase/node-sdk';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const CLOUDBASE_DIR = join(ROOT, 'cloudbase');

function pickInBlock(block, key) {
  const m = String(block || '').match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
  return m ? m[1] : '';
}

export function readCloudbaseConfig() {
  let envId = '';
  let region = 'ap-shanghai';
  let functionName = 'gitblog-comments';
  let httpUrl = '';

  if (existsSync(join(CLOUDBASE_DIR, 'cloudbaserc.json'))) {
    try {
      const rc = JSON.parse(readFileSync(join(CLOUDBASE_DIR, 'cloudbaserc.json'), 'utf8'));
      envId = String(rc.envId || '').trim();
    } catch { /* ignore */ }
  }

  if (existsSync(join(ROOT, 'assets/js/config.js'))) {
    const raw = readFileSync(join(ROOT, 'assets/js/config.js'), 'utf8');
    const block = raw.match(/cloudbase\s*:\s*\{([\s\S]*?)\n\s*\},/)?.[1] || '';
    envId = envId || pickInBlock(block, 'envId');
    region = pickInBlock(block, 'region') || region;
    functionName = pickInBlock(block, 'functionName') || functionName;
    httpUrl = pickInBlock(block, 'httpUrl');
    const siteUrl = (raw.match(/site\s*:\s*\{[\s\S]*?url\s*:\s*["']([^"']+)["']/) || [])[1] || '';
    return {
      envId,
      region,
      functionName,
      httpUrl: String(httpUrl || '').trim(),
      siteUrl: String(siteUrl || 'https://gitpull.cn').replace(/\/+$/, ''),
    };
  }

  return { envId, region, functionName, httpUrl, siteUrl: 'https://gitpull.cn' };
}

function extractJsonText(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  try {
    JSON.parse(s);
    return s;
  } catch { /* continue */ }

  const start = s.indexOf('{');
  if (start < 0) return s;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return s.slice(start);
}

function tryParseJsonString(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  const text = String(value).trim();
  if (!text) return null;
  return tryParseJsonString(text) ?? text;
}

function unwrapCloudResult(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (obj.ok !== undefined) return obj;
  if (obj.result?.ok !== undefined) return obj.result;

  const ret = obj.RetMsg ?? obj.retMsg ?? obj.data?.RetMsg ?? obj.data?.retMsg;
  const parsedRet = parseMaybeJson(ret);
  if (parsedRet && typeof parsedRet === 'object' && parsedRet.ok !== undefined) {
    return parsedRet;
  }

  if (obj.response?.data?.ok !== undefined) return obj.response.data;
  if (obj.data?.ok !== undefined) return obj.data;

  const responseData = parseMaybeJson(obj.data?.response_data ?? obj.response_data);
  if (responseData && typeof responseData === 'object' && responseData.ok !== undefined) {
    return responseData;
  }

  const data = obj.data && typeof obj.data === 'object' ? obj.data : null;
  if (data) {
    const invokeResult = data.InvokeResult ?? data.invokeResult;
    const log = String(data.Log ?? data.log ?? '').trim();
    if (invokeResult !== undefined && invokeResult !== 0) {
      throw new Error(log || `云函数执行失败（InvokeResult=${invokeResult}）`);
    }
    if (log && /error|失败|缺少依赖|Error/i.test(log)) {
      throw new Error(log.split('\n').slice(0, 6).join('\n'));
    }
    const innerRet = parseMaybeJson(data.RetMsg ?? data.retMsg);
    if (innerRet && typeof innerRet === 'object' && innerRet.ok !== undefined) {
      return innerRet;
    }
  }

  const topRet = parseMaybeJson(obj.RetMsg ?? obj.retMsg);
  if (topRet && typeof topRet === 'object' && topRet.ok !== undefined) {
    return topRet;
  }

  if (typeof parsedRet === 'string' && parsedRet) {
    return { ok: false, message: parsedRet };
  }

  return obj;
}

function parseInvokeJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) throw new Error('tcb fn invoke 无输出');

  const raw = extractJsonText(text);
  const parsed = tryParseJsonString(raw);
  if (!parsed) {
    throw new Error(`tcb 输出无法解析为 JSON：${text.slice(0, 500)}`);
  }

  const result = unwrapCloudResult(parsed);
  if (result?.ok === false) throw new Error(result.message || '云函数返回失败');
  return result;
}

export function normalizeCloudResult(result, action = '') {
  let data = result;
  if (typeof data === 'string') {
    data = parseMaybeJson(data);
  }
  data = unwrapCloudResult(data);
  if (!data || typeof data !== 'object') {
    throw new Error(`${action || '云函数'} 响应非对象：${String(result).slice(0, 200)}`);
  }
  if (data.ok === false) throw new Error(data.message || `${action || '云函数'} 返回失败`);
  if (data.ok !== true) {
    throw new Error(
      `${action || '云函数'} 响应缺少 ok:true，可能 tcb 输出未正确解析：${JSON.stringify(data).slice(0, 240)}`
    );
  }
  return data;
}

export function invokeViaTcb(cfg, payload) {
  if (!cfg.envId) throw new Error('缺少 cloudbase envId（cloudbaserc.json 或 config.js）');
  const dir = mkdtempSync(join(tmpdir(), 'gitblog-tcb-'));
  const dataPath = join(dir, 'payload.json');
  writeFileSync(dataPath, JSON.stringify(payload), 'utf8');
  const atPath = dataPath.replace(/\\/g, '/');
  const regionFlag = cfg.region ? ` --region ${cfg.region}` : '';
  try {
    const cmd = [
      'npx', 'tcb', 'fn', 'invoke', cfg.functionName,
      '-e', cfg.envId,
      '-d', `@${atPath}`,
      '--json',
      regionFlag,
    ].filter(Boolean).join(' ');
    const stdout = execSync(cmd, {
      cwd: CLOUDBASE_DIR,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    const action = String(payload?.action || '').toUpperCase();
    return normalizeCloudResult(parseInvokeJson(stdout), action);
  } catch (err) {
    const stderr = String(err.stderr || err.message || '');
    if (/No valid identity|cli-auth|authorize/i.test(stderr)) {
      throw new Error('请先在本机执行 tcb login 登录 CloudBase CLI，然后重试导入脚本');
    }
    if (err.stdout) {
      try {
        const action = String(payload?.action || '').toUpperCase();
        return normalizeCloudResult(parseInvokeJson(err.stdout), action);
      } catch (inner) {
        if (inner.message && !/无法解析/.test(inner.message)) throw inner;
      }
    }
    throw new Error(stderr.trim() || err.message || 'tcb fn invoke 失败');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export async function invokeViaNodeSdk(cfg, payload) {
  const secretId = String(process.env.TENCENTCLOUD_SECRETID || '').trim();
  const secretKey = String(process.env.TENCENTCLOUD_SECRETKEY || '').trim();
  if (!secretId || !secretKey) {
    throw new Error('缺少 TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY');
  }
  if (!cfg.envId) throw new Error('缺少 cloudbase envId');

  const app = cloudbase.init({
    env: cfg.envId,
    region: cfg.region || 'ap-shanghai',
    secretId,
    secretKey,
  });
  const res = await app.callFunction({
    name: cfg.functionName,
    data: payload,
  });
  const action = String(payload?.action || '').toUpperCase();
  return normalizeCloudResult(res?.result ?? res, action);
}

export async function invokeViaHttp(cfg, payload, httpUrl) {
  const url = String(httpUrl || '').trim()
    || String(process.env.CLOUDBASE_HTTP_URL || '').trim()
    || `https://${cfg.envId}.${cfg.region}.app.tcloudbase.com/${cfg.functionName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`CloudBase 响应非 JSON: ${text.slice(0, 200)}`); }
  if (json?.code === 'INVALID_ENV') {
    throw new Error(
      'HTTP 网关返回 INVALID_ENV：当前环境可能未开启云函数 HTTP 访问。'
      + '请配置 TENCENTCLOUD_SECRETID/KEY 走 Node SDK，或在控制台开启 HTTP 后设置 CLOUDBASE_HTTP_URL。'
    );
  }
  const action = String(payload?.action || '').toUpperCase();
  return normalizeCloudResult(json, action);
}

/**
 * @param {object} cfg - readCloudbaseConfig()
 * @param {object} payload - 云函数 event
 * @param {{ prefer?: 'sdk'|'tcb'|'http' }} [opts]
 */
export async function callCloudFunction(cfg, payload, opts = {}) {
  const prefer = opts.prefer
    || (process.env.CLOUDBASE_INVOKE_MODE === 'http' ? 'http'
      : process.env.CLOUDBASE_INVOKE_MODE === 'sdk' ? 'sdk'
        : (process.env.TENCENTCLOUD_SECRETID && process.env.TENCENTCLOUD_SECRETKEY ? 'sdk' : 'tcb'));

  const action = String(payload?.action || '').toUpperCase();

  if (prefer === 'sdk') {
    return invokeViaNodeSdk(cfg, payload);
  }
  if (prefer === 'http') {
    return invokeViaHttp(cfg, payload, cfg.httpUrl);
  }
  try {
    return invokeViaTcb(cfg, payload);
  } catch (tcbErr) {
    if (process.env.TENCENTCLOUD_SECRETID && process.env.TENCENTCLOUD_SECRETKEY) {
      return invokeViaNodeSdk(cfg, payload);
    }
    if (process.env.CLOUDBASE_HTTP_URL || cfg.httpUrl) {
      return invokeViaHttp(cfg, payload, cfg.httpUrl || process.env.CLOUDBASE_HTTP_URL);
    }
    throw new Error(`${action || '云函数'} 调用失败：${tcbErr.message || tcbErr}`);
  }
}

/** 依次尝试 sdk / tcb / http，用于排查 CI 与本地差异 */
export async function callCloudFunctionWithFallback(cfg, payload) {
  const modes = [];
  if (process.env.TENCENTCLOUD_SECRETID && process.env.TENCENTCLOUD_SECRETKEY) modes.push('sdk');
  modes.push('tcb');
  if (process.env.CLOUDBASE_HTTP_URL || cfg.httpUrl) modes.push('http');

  let lastErr;
  for (const mode of [...new Set(modes)]) {
    try {
      const res = await callCloudFunction(cfg, payload, { prefer: mode });
      return { res, mode };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('云函数调用失败');
}
