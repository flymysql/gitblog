#!/usr/bin/env node
/**
 * 部署评论嵌入页到 CloudBase 静态网站托管。
 * 评论 UI（编辑框样式等）在 cloudbase/static/，改完后必须执行本脚本，博客 rebuild 不会更新 iframe 内容。
 *
 * 部署前会先执行 scripts/build-embed-static.mjs：
 * - comment-avatars.js 打进 comments-embed.js，嵌入页不再单独请求该模块
 * - 同时上传新版 comment-avatars.js，覆盖 CDN 上无 ?v= 的旧 jsDelivr 缓存
 *
 * 用法：
 *   node cloudbase/deploy-static-embed.mjs
 *   node cloudbase/deploy-static-embed.mjs -e gitbolg-d7gmnsrw46e011706
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dir, '..');
const rcPath = path.join(__dir, 'cloudbaserc.json');
const deployDir = path.join(__dir, '.deploy-static');
const buildScript = path.join(root, 'scripts/build-embed-static.mjs');

const envArg = process.argv.find((a, i) => process.argv[i - 1] === '-e');
let envId = envArg;
if (!envId && fs.existsSync(rcPath)) {
  try {
    envId = JSON.parse(fs.readFileSync(rcPath, 'utf8')).envId;
  } catch { /* ignore */ }
}
if (!envId) {
  console.error('请指定环境 ID：node deploy-static-embed.mjs -e <envId>');
  process.exit(1);
}

console.log('打包嵌入页静态资源…');
execSync(`node "${buildScript}"`, { cwd: root, stdio: 'inherit' });

if (!fs.existsSync(deployDir)) {
  console.error('打包失败：缺少 cloudbase/.deploy-static/');
  process.exit(1);
}

console.log(`\n部署评论嵌入页 → ${envId}`);
console.log('目录：cloudbase/.deploy-static/（已打包 comments-embed.js + comment-avatars/）\n');

try {
  execSync(`npx tcb hosting deploy "${deployDir}" -e ${envId}`, {
    cwd: __dir,
    stdio: 'inherit',
  });
  console.log('\n部署成功。请在浏览器无痕窗口打开嵌入页验证。');
  console.log('comments-embed.html 会从 URL 参数 ?v= 加载 JS/CSS，请确保站点 config 中 embedAssetVersion 已更新并重新 build。');
  console.log('若博客页仍显示旧 UI，请重新 build 站点并硬刷新（Ctrl+Shift+R）。');
} catch (err) {
  console.error('\n部署失败，请确认已安装并登录 CloudBase CLI：npm i -g @cloudbase/cli && tcb login');
  process.exit(err.status || 1);
}
