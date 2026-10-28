#!/usr/bin/env node
/**
 * 一键发布「淘宝证书上传插件」到云静态托管 + 登记发包（版本号自动读插件 manifest.json）
 *
 *   node cloudbase/publish-tcb.mjs                # 干跑：只检查，不部署
 *   node cloudbase/publish-tcb.mjs --apply        # 真正执行
 *   node cloudbase/publish-tcb.mjs --version 1.4.2 --apply   # 指定版本
 *
 * 干活顺序：
 *  1. 校验 dist/ 里该版本的 zip + crx，crx 必须过 CRX3 验签（不过就拒绝发布）
 *  2. 同步 cloudbase/static/packages/：只留当前版本，旧包删掉
 *  2b. 生成 static/updates.xml（自托管更新清单，供受管安装/自动更新；也可以不用）
 *  3. 检查 tcb 登录态（部署/删除需要登录）
 *  4. tcb hosting deploy ./static -e <env>    ← 同时把官网首页、下载页、packages/ 一起更新
 *  5. 通过 tcb-upload 云函数登记 zip + crx（下载页/更新检查才会显示新版本；同一文件名不会重复登记）
 *  6. 删掉历史上签名坏掉的 crx（如果还在）
 *  7. 逐项校验线上结果
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyCrx } from './verify-crx.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const CLOUD_DIR = __dir;
const BLOG_ROOT = path.dirname(__dir);
const PLUGIN_ROOT = path.join(BLOG_ROOT, '..', 'dsh_work', 'taobao-cert-uploader');
const DIST = path.join(PLUGIN_ROOT, 'dist');
const STATIC_DIR = path.join(CLOUD_DIR, 'static');
const PACKAGES_DIR = path.join(STATIC_DIR, 'packages');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const MANIFEST_PATH = path.join(PLUGIN_ROOT, 'manifest.json');
const VERSION = arg('--version', JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')).version);
const ENV_ID = process.env.TCB_ENV_ID || 'slippery-iguana-d1fhb1xmd469ee8c';
const HOSTING = 'https://slippery-iguana-d1fhb1xmd469ee8c-1256429518.tcloudbaseapp.com';
const ADMIN_API = 'https://slippery-iguana-d1fhb1xmd469ee8c-1256429518.ap-shanghai.app.tcloudbase.com/tcb-admin';
const UPLOAD_API = 'https://slippery-iguana-d1fhb1xmd469ee8c-1256429518.ap-shanghai.app.tcloudbase.com/tcb-upload';
const UPLOAD_TOKEN = 'tcb-upload-2026';
// 历史上签名写坏、装不上的 crx，发版时顺手撤掉
const BAD_CRX_PATHS = ['/packages/taobao-cert-uploader-v1.3.1-360-signed-v2.crx'];

const APPLY = process.argv.includes('--apply');
const ZIP_NAME = `taobao-cert-uploader-v${VERSION}-chrome.zip`;
const CRX_NAME = `taobao-cert-uploader-v${VERSION}-360-signed.crx`;

function step(n, text) {
  console.log(`\n[${n}] ${text}`);
}
function sh(cmd) {
  console.log(`    $ ${cmd}`);
  return execSync(cmd, { cwd: CLOUD_DIR, stdio: 'inherit' });
}
async function head(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

async function main() {
  // 1) 本地产物
  step(1, `校验 dist 里的 v${VERSION} 产物`);
  const zipPath = path.join(DIST, ZIP_NAME);
  const crxPath = path.join(DIST, CRX_NAME);
  for (const p of [zipPath, crxPath]) {
    if (!fs.existsSync(p)) {
      throw new Error(`缺少产物：${p}（先跑 node tools/pack.mjs）`);
    }
    console.log(`    ✅ ${path.basename(p)} ${fs.statSync(p).size} B`);
  }
  const v = verifyCrx(crxPath);
  if (!v.ok) throw new Error(`CRX 验签未通过，拒绝发布：\n${v.problems.join('\n')}`);
  const EXT_ID = v.info.extensionId;
  console.log(`    ✅ CRX3 验签通过，扩展ID=${EXT_ID}`);

  // 2) 同步 packages/
  step(2, `同步 packages/（只保留 v${VERSION}）`);
  fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  for (const f of fs.readdirSync(PACKAGES_DIR)) {
    if (!/^taobao-cert-uploader-/.test(f)) continue;
    if (f === ZIP_NAME || f === CRX_NAME) continue;
    if (!APPLY) {
      console.log(`    (dry-run) 将删除 packages/${f}`);
      continue;
    }
    fs.rmSync(path.join(PACKAGES_DIR, f), { force: true });
    console.log(`    🗑 删除 packages/${f}`);
  }
  for (const [src, name] of [[zipPath, ZIP_NAME], [crxPath, CRX_NAME]]) {
    if (!APPLY) {
      console.log(`    (dry-run) 将复制 ${name}`);
      continue;
    }
    fs.copyFileSync(src, path.join(PACKAGES_DIR, name));
    console.log(`    ✅ 复制 ${name}`);
  }

  // 2b) 自托管更新清单
  step('2b', `生成 static/updates.xml → v${VERSION}`);
  const updatesXml = `<?xml version='1.0' encoding='UTF-8'?>
<!-- 由 cloudbase/publish-tcb.mjs 自动生成，请勿手工改版本号 -->
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${EXT_ID}'>
    <updatecheck codebase='${HOSTING}/packages/${CRX_NAME}' version='${VERSION}' />
  </app>
</gupdate>
`;
  if (!APPLY) {
    console.log('    (dry-run) 将写入 static/updates.xml');
  } else {
    fs.writeFileSync(path.join(STATIC_DIR, 'updates.xml'), updatesXml, 'utf8');
    console.log(`    ✅ static/updates.xml → v${VERSION} / ${CRX_NAME}`);
  }

  // 3) 登录态
  step(3, '检查 tcb 登录态');
  let loggedIn = false;
  try {
    const out = execSync('tcb env list', { cwd: CLOUD_DIR, encoding: 'utf8', stdio: 'pipe' });
    loggedIn = !/无有效身份信息|请使用 cloudbase login/.test(out);
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`;
    if (!/无有效身份信息|cloudbase login/.test(out)) throw e;
  }
  if (!loggedIn) {
    console.log('\n❌ CloudBase 未登录，无法部署静态托管。先执行： tcb login');
    process.exit(2);
  }
  console.log('    ✅ tcb 已登录');

  if (!APPLY) {
    console.log('\n(dry-run 结束，加 --apply 才会真的部署)');
    return;
  }

  // 4) 部署
  step(4, `tcb hosting deploy ./static -e ${ENV_ID}`);
  sh(`tcb hosting deploy ./static -e ${ENV_ID}`);

  // 5) 登记发包（同 filename 不重复登记）
  step(5, `登记发包 v${VERSION}`);
  let existing = new Set();
  try {
    const listed = await (await fetch(`${ADMIN_API}/public-builds`)).json();
    existing = new Set((listed.files || []).map((f) => f.filename));
  } catch (e) {
    console.log(`    ⚠️ 读取已登记列表失败（继续）：${e.message}`);
  }
  for (const [p, name] of [[zipPath, ZIP_NAME], [crxPath, CRX_NAME]]) {
    if (existing.has(name)) {
      console.log(`    ↷ ${name} 已登记，跳过`);
      continue;
    }
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(p)]), name);
    const resp = await fetch(`${UPLOAD_API}/upload?action=upload-build&version=${VERSION}`, {
      method: 'POST',
      headers: { 'X-Upload-Token': UPLOAD_TOKEN },
      body: fd,
    });
    const text = await resp.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {
      /* ignore */
    }
    console.log(`    ${json.ok ? '✅' : '❌'} ${name} → ${json.cloudPath || text.slice(0, 160)}`);
  }

  // 6) 清理坏的 crx
  step(6, '清理历史上签名坏掉的 crx');
  for (const p of BAD_CRX_PATHS) {
    if (p.includes(`v${VERSION}-`)) continue;
    try {
      sh(`tcb hosting delete ${p} -e ${ENV_ID}`);
    } catch (e) {
      console.log(`    ⚠️ ${p} 删除失败（可能本来就没有）：${e.message.split('\n')[0]}`);
    }
  }

  // 7) 线上校验
  step(7, '线上校验');
  const checks = [
    ['首页是官网（含「淘宝证书自动上传」）', `${HOSTING}/index.html`, 'text'],
    ['隐私政策页可访问', `${HOSTING}/privacy.html`, 'head'],
    [`v${VERSION} zip 可下载`, `${HOSTING}/packages/${ZIP_NAME}`, 'head'],
    [`v${VERSION} crx 可下载`, `${HOSTING}/packages/${CRX_NAME}`, 'head'],
    ['下载中心可访问', `${HOSTING}/downloads.html`, 'head'],
  ];
  for (const [label, url, kind] of checks) {
    if (kind === 'text') {
      const r = await fetch(url);
      const t = await r.text();
      const good = r.ok && t.includes('淘宝证书自动上传') && !t.includes('momo工具站');
      console.log(`    ${good ? '✅' : '❌'} ${label}`);
    } else {
      const r = await head(url);
      console.log(`    ${r.ok ? '✅' : '❌'} ${label}（HTTP ${r.status}）`);
    }
  }
  try {
    const latest = await (await fetch(`${ADMIN_API}/public-latest`)).json();
    console.log(
      `    ${latest.latestVersion === VERSION ? '✅' : '❌'} public-latest = ${latest.latestVersion}（期望 ${VERSION}）`
    );
  } catch (e) {
    console.log(`    ❌ public-latest 查询失败：${e.message}`);
  }
  try {
    const r = await fetch(`${HOSTING}/updates.xml`);
    const t = await r.text();
    const good = r.ok && t.includes(`version='${VERSION}'`) && t.includes(CRX_NAME) && t.includes(EXT_ID);
    console.log(`    ${good ? '✅' : '❌'} updates.xml 指向 v${VERSION}（HTTP ${r.status}）`);
  } catch (e) {
    console.log(`    ❌ updates.xml 校验失败：${e.message}`);
  }

  console.log(`\n🎉 发布完成 v${VERSION}`);
  console.log(`   CRX（360/Edge 拖拽安装）: ${HOSTING}/packages/${CRX_NAME}`);
  console.log(`   ZIP（Chrome 加载已解压） : ${HOSTING}/packages/${ZIP_NAME}`);
  console.log(`   下载页: ${HOSTING}/downloads.html`);
}

main().catch((e) => {
  console.error(`\n❌ 失败：${e.message}`);
  process.exit(1);
});
