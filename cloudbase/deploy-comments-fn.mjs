#!/usr/bin/env node
/**
 * 从 secrets.env 读取 SMTP 授权码，临时合并进 cloudbaserc 后部署云函数，
 * 部署完成后自动清除 cloudbaserc 中的 SMTP_PASS（避免误提交 Git）。
 *
 * 用法（在 cloudbase/ 目录）：
 *   node deploy-comments-fn.mjs
 *   node deploy-comments-fn.mjs -e gitbolg-d7gmnsrw46e011706
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const rcPath = path.join(__dir, 'cloudbaserc.json');
const secretsPath = path.join(__dir, 'secrets.env');

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

function mergeEnv(rc, secrets) {
  const fn = rc.functions?.find(f => f.name === 'gitblog-comments');
  if (!fn) throw new Error('cloudbaserc.json 中未找到 gitblog-comments');
  fn.envVariables = { ...fn.envVariables, ...secrets };
  return fn;
}

const envArg = process.argv.find((a, i) => process.argv[i - 1] === '-e');
const original = fs.readFileSync(rcPath, 'utf8');
const rc = JSON.parse(original);

if (!fs.existsSync(secretsPath)) {
  console.error('缺少 cloudbase/secrets.env');
  console.error('请执行：cp secrets.env.example secrets.env');
  console.error('然后编辑 secrets.env，填入 SMTP_PASS（QQ 邮箱授权码）');
  process.exit(1);
}

const secrets = parseEnvFile(fs.readFileSync(secretsPath, 'utf8'));
if (!secrets.SMTP_PASS || secrets.SMTP_PASS.includes('你的')) {
  console.error('请在 secrets.env 中填写真实的 SMTP_PASS（QQ 邮箱 SMTP 授权码）');
  process.exit(1);
}

const fn = mergeEnv(rc, secrets);
const envId = envArg || rc.envId;
if (!envId) {
  console.error('请指定环境 ID：node deploy-comments-fn.mjs -e <envId>');
  process.exit(1);
}

fs.writeFileSync(rcPath, `${JSON.stringify(rc, null, 2)}\n`);
console.log(`部署 gitblog-comments → ${envId}（已合并 secrets.env，含 SMTP 配置）`);

try {
  execSync(`tcb fn deploy gitblog-comments -e ${envId}`, {
    cwd: __dir,
    stdio: 'inherit',
  });
  console.log('\n部署成功。回复邮件通知已启用（被回复者须填写邮箱）。');
} catch (err) {
  console.error('\n部署失败，请确认已安装并登录 CloudBase CLI：npm i -g @cloudbase/cli && tcb login');
  process.exit(err.status || 1);
} finally {
  const restored = JSON.parse(original);
  fs.writeFileSync(rcPath, `${JSON.stringify(restored, null, 2)}\n`);
  console.log('已恢复 cloudbaserc.json（SMTP_PASS 未保留在仓库文件中）。');
}
