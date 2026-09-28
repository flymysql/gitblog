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
import { verifyCrx } from './verify-crx.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(__dir); // 插件项目根
const DIST = path.join(ROOT, 'dist');
const HOSTING_STATIC = path.join(__dir, 'static', 'packages');
const CLOUDBASE_DIR = __dir;
const ENV_ID = process.env.TCB_ENV_ID || 'gitbolg-d7gmnsrw46e011706';
const UPLOAD_API = 'https://gitbolg-d7gmnsrw46e011706-1256429518.ap-shanghai.app.tcloudbase.com/tcb-upload';

/** 发布前门禁：crx 必须能被 Chromium 的规则验过，否则直接终止发布 */
function verifyCrxOrThrow(crxPath) {
  const r = verifyCrx(crxPath);
  if (r.ok) {
    console.log(`   ✅ CRX3 校验通过，扩展ID=${r.info.extensionId}，archive=${r.info.archiveLen}B`);
    return;
  }
  throw new Error(
    `CRX3 校验未通过，已终止发布（这种包用户装不上）:\n` +
      r.problems.map((p) => `   - ${p}`).join('\n')
  );
}

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
  // 生成签名 CRX3（用备份私钥）
  //
  // ⚠️ 血泪教训：这里以前在「签名失败 / 找不到私钥」时会回退成手工拼的头
  //      Buffer.from('Cr24') + [2,0,0,0,0,0,0,0] + zip
  //    那个文件的 CRX version = 2（key/signature 长度全 0），Chromium 校验第一步就
  //    ERROR_HEADER_INVALID，Chrome / 360 只会提示「无法安装」，
  //    用户侧表现就是「新版用不了」。所以现在：签不出来就**直接失败退出**，
  //    宁可这轮不发版，也绝不产出一个装不上的 crx。
  const zipBuf = fs.readFileSync(path.join(DIST, `taobao-cert-uploader-v${version}-chrome.zip`));
  const keyPath = process.env.TCB_SIGN_KEY || path.join(ROOT, '..', 'tcb-keys', 'taobao-cert-sign-key.pem');
  const crxOut = path.join(DIST, `taobao-cert-uploader-v${version}-360-signed.crx`);
  if (!fs.existsSync(keyPath)) {
    throw new Error(
      `未找到签名私钥: ${keyPath}\n` +
        '  签名私钥不进 git、也不随包分发；请放到 ../tcb-keys/ 或用 TCB_SIGN_KEY 指定。\n' +
        '  没有私钥时不要产出 crx：无签名/伪签名的 crx 用户根本装不上（只有解压 zip 才能装）。'
    );
  }
  {
    const vm = await import('node:vm');
    const { webcrypto } = await import('node:crypto');
    const sandbox = {
      crypto: webcrypto,
      TextEncoder,
      TextDecoder,
      Uint8Array,
      DataView,
      ArrayBuffer,
      atob,
      btoa,
      console,
    };
    sandbox.self = sandbox;
    const crxPackSrc = fs.readFileSync(path.join(ROOT, 'utils', 'crx-pack.js'), 'utf8');
    vm.runInNewContext(crxPackSrc, sandbox, { filename: 'utils/crx-pack.js' });
    const pem = fs.readFileSync(keyPath, 'utf8');
    const crx = await sandbox.TCBCrxPack.packCrx3(new Uint8Array(zipBuf), pem);
    fs.writeFileSync(crxOut, Buffer.from(crx));
    console.log('   已生成签名 CRX3:', path.basename(crxOut));
  }
  // 发布前门禁：把刚生成的 crx 按 Chromium 的规则重新解析 + 验签，不过就不许发
  verifyCrxOrThrow(crxOut);
  console.log('   打包完成:', fs.readdirSync(DIST).filter((f) => f.endsWith('.zip') || f.endsWith('.crx')).join(', '));

  // 2. 上传 COS
  console.log('2/4 上传 COS...');
  const files = [
    path.join(DIST, `taobao-cert-uploader-v${version}-chrome.zip`),
    crxOut,
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
