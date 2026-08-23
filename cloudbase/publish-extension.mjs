#!/usr/bin/env node
/**
 * 发布新版本插件包
 *
 * 流程：
 *   1. 打包插件为 chrome zip + 360 crx（含版本号）
 *   2. 上传到 COS tcb-builds/（含 DB 记录）
 *   3. 部署到 CloudBase 静态托管 packages/（永久下载 URL）
 *   4. 下载页/更新检查自动指向新版本
 *
 * 用法：
 *   node publish-extension.mjs                # 打包当前目录并发布
 *   node publish-extension.mjs --version 1.4.0  # 指定版本号（默认读 manifest）
 *
 * 前置：
 *   - 在插件项目根目录运行（含 manifest.json / dist/）
 *   - 已配置 tcb login 或 TENCENTCLOUD_SECRETID/KEY
 *   - cloudbase/.env.private 已配置 UPLOAD_TOKEN
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dir); // 插件项目根
const DIST = path.join(ROOT, 'dist');
const HOSTING_STATIC = path.join(__dir, 'static', 'packages');
const CLOUDBASE_DIR = __dir;
const ENV_ID = process.env.TCB_ENV_ID || 'gitbolg-d7gmnsrw46e011706';
const UPLOAD_API = 'https://gitbolg-d7gmnsrw46e011706-1256429518.ap-shanghai.app.tcloudbase.com/tcb-upload';

function getVersion() {
  const argIdx = process.argv.indexOf('--version');
  if (argIdx !== -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1];
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  return m.version;
}

function run(cmd, cwd) {
  return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

async function main() {
  const version = getVersion();
  console.log(`📦 发布 v${version}`);

  // 1. 打包
  console.log('1/4 打包中...');
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  const pkgDir = path.join(DIST, 'pkg');
  fs.mkdirSync(pkgDir, { recursive: true });
  for (const item of ['manifest.json', 'background.js', 'popup.html', 'popup.js', 'README.md', 'content', 'styles', 'utils']) {
    const src = path.join(ROOT, item);
    fs.cpSync(src, path.join(pkgDir, item), { recursive: true });
  }
  run(`cd ${pkgDir} && zip -r ../taobao-cert-uploader-v${version}-chrome.zip . > /dev/null`, pkgDir);
  // 生成无签名 crx
  const zipBuf = fs.readFileSync(path.join(DIST, `taobao-cert-uploader-v${version}-chrome.zip`));
  const crx = Buffer.concat([Buffer.from('Cr24'), Buffer.from([2,0,0,0,0,0,0,0]), zipBuf]);
  fs.writeFileSync(path.join(DIST, `taobao-cert-uploader-v${version}-360.crx`), crx);
  console.log('   打包完成:', fs.readdirSync(DIST).filter((f) => f.endsWith('.zip') || f.endsWith('.crx')).join(', '));

  // 2. 上传 COS
  console.log('2/4 上传 COS...');
  const files = [
    path.join(DIST, `taobao-cert-uploader-v${version}-chrome.zip`),
    path.join(DIST, `taobao-cert-uploader-v${version}-360.crx`),
  ];
  for (const f of files) {
    const name = path.basename(f);
    const out = run(`curl -s --max-time 60 -F "file=@${f}" -H "X-Upload-Token: tcb-upload-2026" "${UPLOAD_API}/upload?action=upload-build&version=${version}"`, ROOT);
    const resp = JSON.parse(out);
    if (resp.ok) console.log(`   ✅ ${name} → ${resp.cloudPath}`);
    else console.error(`   ❌ ${name} 上传失败:`, resp.error || out.slice(0, 100));
  }

  // 3. 部署静态托管（永久 URL）
  console.log('3/4 部署静态托管 packages/...');
  fs.mkdirSync(HOSTING_STATIC, { recursive: true });
  fs.copyFileSync(files[0], path.join(HOSTING_STATIC, path.basename(files[0])));
  fs.copyFileSync(files[1], path.join(HOSTING_STATIC, path.basename(files[1])));
  run(`tcb hosting deploy ./static/packages/ packages/ -e ${ENV_ID}`, CLOUDBASE_DIR);
  console.log('   静态托管已更新');

  // 4. 清理旧版本静态托管文件（保留当前版本）
  console.log('4/4 清理旧包...');
  const keep = new Set(files.map((f) => path.basename(f)));
  for (const f of fs.readdirSync(HOSTING_STATIC)) {
    if (!keep.has(f)) fs.rmSync(path.join(HOSTING_STATIC, f), { force: true });
  }
  console.log('   旧包已清理');

  console.log(`\n🎉 发布完成 v${version}`);
  console.log(`下载页: https://gitbolg-d7gmnsrw46e011706-1256429518.tcloudbaseapp.com/downloads.html`);
  console.log(`最新接口: /tcb-admin/public-latest → v${version}`);
}

main().catch((e) => {
  console.error('❌ 发布失败:', e.message);
  process.exit(1);
});
