#!/usr/bin/env node
/**
 * 安全部署云函数（密码不入 git）
 *
 * 用法：
 *   node deploy-functions.mjs tcb-admin
 *   node deploy-functions.mjs tcb-log-upload
 *   node deploy-functions.mjs all
 *
 * 流程：
 *   1. 从 cloudbase/.env.private 读取密钥（该文件已被 gitignore，不入库）
 *   2. 临时合并密钥到 cloudbaserc.json 的 envVariables
 *   3. 部署代码 + 推送配置（含环境变量）
 *   4. 部署后还原 cloudbaserc.json（去掉密码明文）
 *
 * 前置：
 *   - cloudbase/.env.private 已存在（从 .env.private.example 复制填写）
 *   - 已执行 tcb login 登录
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const rcPath = path.join(__dir, 'cloudbaserc.json');
const privateEnvPath = path.join(__dir, '.env.private');
const ENV_ID = process.env.TCB_ENV_ID || 'gitbolg-d7gmnsrw46e011706';

function parseEnv(content) {
  const out = {};
  for (const line of String(content || '').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function readRc() {
  return JSON.parse(fs.readFileSync(rcPath, 'utf8'));
}

function main() {
  const target = process.argv[2] || 'all';
  if (!fs.existsSync(privateEnvPath)) {
    console.error('❌ 缺少 cloudbase/.env.private（密码文件）');
    console.error('  请创建该文件（已 gitignore），内容参考：');
    console.error('  ADMIN_PASS=你的后台密码');
    console.error('  TOKEN_SECRET=你的token密钥');
    console.error('  REPORT_TOKEN=...');
    console.error('  UPLOAD_TOKEN=...');
    process.exit(1);
  }
  const secrets = parseEnv(fs.readFileSync(privateEnvPath, 'utf8'));
  if (!secrets.ADMIN_PASS || secrets.ADMIN_PASS.includes('你的')) {
    console.error('❌ .env.private 中未配置 ADMIN_PASS');
    process.exit(1);
  }

  const rc = readRc();
  const originalText = JSON.stringify(rc, null, 2) + '\n';

  // 合并密钥到目标函数
  const targets = target === 'all'
    ? rc.functions.map((f) => f.name)
    : [target];
  const merged = [];
  for (const fn of rc.functions) {
    if (!targets.includes(fn.name)) continue;
    const env = { ...(fn.envVariables || {}) };
    if (fn.name === 'tcb-admin') {
      Object.assign(env, {
        ADMIN_USER: secrets.ADMIN_USER || env.ADMIN_USER || 'admin',
        ADMIN_PASS: secrets.ADMIN_PASS,
        TOKEN_SECRET: secrets.TOKEN_SECRET || secrets.ADMIN_PASS,
        REPORT_TOKEN: secrets.REPORT_TOKEN || secrets.ADMIN_PASS,
      });
    }
    if (fn.name === 'tcb-log-upload') {
      Object.assign(env, { UPLOAD_TOKEN: secrets.UPLOAD_TOKEN || secrets.ADMIN_PASS });
    }
    fn.envVariables = env;
    merged.push(fn.name);
  }

  if (!merged.length) {
    console.error('❌ 未找到目标函数:', target);
    process.exit(1);
  }

  try {
    // 写临时 cloudbaserc（含密码）用于部署
    fs.writeFileSync(rcPath, JSON.stringify(rc, null, 2) + '\n');
    console.log(`📦 部署函数: ${merged.join(', ')} → ${ENV_ID}`);
    for (const name of merged) {
      console.log(`  - 部署 ${name} 代码...`);
      const deployOut = execSync(`echo y | tcb fn deploy ${name} -e ${ENV_ID}`, {
        cwd: __dir, stdio: 'pipe', encoding: 'utf8',
      });
      console.log(`  - 推送 ${name} 配置(含环境变量)...`);
      const cfgOut = execSync(`tcb config update fn ${name} -e ${ENV_ID}`, {
        cwd: __dir, stdio: 'pipe', encoding: 'utf8',
      });
      console.log(`  ✅ ${name} 部署完成`);
    }
  } catch (err) {
    console.error('❌ 部署失败:', (err.stderr || err.message || '').slice(0, 500));
  } finally {
    // 还原 cloudbaserc（去掉密码明文）
    fs.writeFileSync(rcPath, originalText);
    console.log('♻️  cloudbaserc.json 已还原（不含密码）');
  }
}

main();
