#!/usr/bin/env node
/**
 * 从 CloudBase 拉取评论 + 访问统计，写入 data/cloudbase-backup/latest.json
 *
 * 用法：
 *   COMMENT_ADMIN_SECRET=xxx node scripts/backup-cloudbase-data.mjs
 *   COMMENT_ADMIN_SECRET=xxx node scripts/backup-cloudbase-data.mjs --dry
 *
 * 环境变量：
 *   COMMENT_ADMIN_SECRET — 与云函数 COMMENT_ADMIN_SECRET 一致（推荐 GitHub Environment secret）
 *   CLOUDBASE_HTTP_URL — 可选；无 TCB 密钥时 CI 走 HTTP 网关
 *   CLOUDBASE_INVOKE_MODE — 设为 http 可强制走 HTTP
 *   TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY — CI 推荐，用于 tcb fn invoke
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { callCloudFunction, readCloudbaseConfig } from './cloudbase-fn-invoke.mjs';

const DRY = process.argv.includes('--dry');
const ROOT = new URL('..', import.meta.url).pathname;
const BACKUP_DIR = join(ROOT, 'data/cloudbase-backup');
const PAGE_SIZE = 200;

function todayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d);
}

function resolveAdminSecret() {
  const fromSecret = String(process.env.COMMENT_ADMIN_SECRET || '').trim();
  const fromVar = String(process.env.COMMENT_ADMIN_SECRET_VAR || '').trim();
  const secret = fromSecret || fromVar;
  if (!secret) return { secret: '', fromVar: false };
  return { secret, fromVar: !fromSecret && !!fromVar };
}

function resolveInvokeOpts(cfg) {
  if (process.env.CLOUDBASE_INVOKE_MODE === 'http') return { prefer: 'http' };
  if (process.env.TENCENTCLOUD_SECRETID && process.env.TENCENTCLOUD_SECRETKEY) {
    return { prefer: 'tcb' };
  }
  if (process.env.GITHUB_ACTIONS === 'true' && (process.env.CLOUDBASE_HTTP_URL || cfg.httpUrl)) {
    return { prefer: 'http' };
  }
  return {};
}

function describeInvokeMode(cfg, invokeOpts) {
  if (invokeOpts.prefer === 'http') {
    const url = process.env.CLOUDBASE_HTTP_URL || cfg.httpUrl || `https://${cfg.envId}.${cfg.region}.app.tcloudbase.com/${cfg.functionName}`;
    return `HTTP (${url})`;
  }
  return `tcb fn invoke (${cfg.functionName} @ ${cfg.envId})`;
}

async function fetchAllComments(cfg, secret, invokeOpts) {
  const items = [];
  let skip = 0;
  for (;;) {
    const res = await callCloudFunction(cfg, {
      action: 'ADMIN_EXPORT',
      adminSecret: secret,
      status: 'all',
      limit: PAGE_SIZE,
      skip,
    }, invokeOpts);
    if (res?.ok === false) throw new Error(res.message || 'ADMIN_EXPORT 失败');
    const batch = res.comments || [];
    items.push(...batch);
    if (!res.hasMore || batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return items;
}

async function fetchAllPageviews(cfg, secret, invokeOpts) {
  const pages = [];
  let site = null;
  let skip = 0;
  for (;;) {
    const res = await callCloudFunction(cfg, {
      action: 'PV_ADMIN_EXPORT',
      adminSecret: secret,
      limit: PAGE_SIZE,
      skip,
    }, invokeOpts);
    if (res?.ok === false) throw new Error(res.message || 'PV_ADMIN_EXPORT 失败');
    if (res.site && !site) site = res.site;
    const batch = res.pages || [];
    pages.push(...batch);
    if (!res.hasMore || batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return { site: site || { pv: 0, uv: 0, updatedAt: 0 }, pages };
}

async function probePublicPv(cfg, invokeOpts) {
  const res = await callCloudFunction(cfg, { action: 'PV_SITE' }, invokeOpts);
  if (res?.ok === false) throw new Error(res.message || 'PV_SITE 探测失败');
  return {
    sitePv: Number(res.sitePv) || 0,
    siteUv: Number(res.siteUv) || 0,
  };
}

async function probePvAdminTop(cfg, secret, invokeOpts) {
  const res = await callCloudFunction(cfg, {
    action: 'PV_ADMIN_TOP',
    adminSecret: secret,
    limit: 5,
  }, invokeOpts);
  if (res?.ok === false) throw new Error(res.message || 'PV_ADMIN_TOP 探测失败');
  return {
    site: res.site || { pv: 0, uv: 0, updatedAt: 0 },
    top: res.top || [],
  };
}

function failEmptyPageviews(probe, pageviews, topProbe) {
  const lines = [
    '访问统计备份为空，但线上 PV_SITE 显示有数据（sitePv=%s）。',
    '',
    '常见原因：',
    '1. 云函数未重新部署 — 缺少 PV_ADMIN_EXPORT 或仍是旧版 orderBy(lastAt)，请执行：',
    '   npm run cloudbase:deploy-comments',
    '2. COMMENT_ADMIN_SECRET 与云函数环境变量不一致（应放在 GitHub Environment secrets）',
    '3. CI 调用了错误的 CloudBase 环境或 HTTP 网关地址',
  ];
  if (topProbe?.top?.length) {
    lines.push('', `PV_ADMIN_TOP 能读到 ${topProbe.top.length} 条（例如 ${topProbe.top[0]?.path} pv=${topProbe.top[0]?.pv}），说明密钥有效但 PV_ADMIN_EXPORT 需重新部署。`);
  }
  throw new Error(lines.join('\n').replace('%s', String(probe.sitePv)));
}

async function main() {
  const { secret, fromVar } = resolveAdminSecret();
  if (!secret) {
    console.error('请设置环境变量 COMMENT_ADMIN_SECRET');
    console.error('GitHub Actions：需在 job 上声明 environment: github-pages，并把密钥放在');
    console.error('  Settings → Environments → github-pages → Environment secrets（不是 Variables）');
    console.error('或放在 Settings → Secrets and variables → Actions → Repository secrets');
    process.exit(1);
  }
  if (fromVar) {
    console.warn('警告：COMMENT_ADMIN_SECRET 未在 secrets 中配置，当前使用的是 Environment Variable。');
    console.warn('请将密钥移到 Settings → Environments → github-pages → Environment secrets。');
  }

  const cfg = readCloudbaseConfig();
  if (!cfg.envId) {
    console.error('缺少 cloudbase envId');
    process.exit(1);
  }

  const invokeOpts = resolveInvokeOpts(cfg);
  console.log(`CloudBase 环境: ${cfg.envId}`);
  console.log(`调用方式: ${describeInvokeMode(cfg, invokeOpts)}`);

  console.log('探测 PV_SITE…');
  const probe = await probePublicPv(cfg, invokeOpts);
  console.log(`  站点 PV ${probe.sitePv} / UV ${probe.siteUv}`);

  console.log('拉取评论…');
  const comments = await fetchAllComments(cfg, secret, invokeOpts);
  console.log(`  评论 ${comments.length} 条`);

  console.log('拉取访问统计…');
  let pageviews = await fetchAllPageviews(cfg, secret, invokeOpts);
  console.log(`  页面 ${pageviews.pages.length} 条，站点 PV ${pageviews.site.pv} / UV ${pageviews.site.uv}`);

  if (probe.sitePv > 0 && pageviews.pages.length === 0) {
    console.log('导出为空，用 PV_ADMIN_TOP 交叉验证…');
    const topProbe = await probePvAdminTop(cfg, secret, invokeOpts);
    failEmptyPageviews(probe, pageviews, topProbe);
  }

  if (probe.sitePv > 0 && pageviews.site.pv === 0) {
    pageviews = {
      ...pageviews,
      site: {
        pv: probe.sitePv,
        uv: Math.max(pageviews.site.uv, probe.siteUv),
        updatedAt: Date.now(),
      },
    };
  }

  const now = new Date();
  const payload = {
    version: 1,
    generatedAt: now.toISOString(),
    date: todayKey(now),
    envId: cfg.envId,
    siteUrl: cfg.siteUrl,
    comments: {
      total: comments.length,
      items: comments,
    },
    pageviews: {
      site: pageviews.site,
      total: pageviews.pages.length,
      pages: pageviews.pages,
    },
  };

  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const latestPath = join(BACKUP_DIR, 'latest.json');

  if (DRY) {
    console.log(`\n(DRY-RUN：将写入 ${latestPath}，共 ${text.length} 字节)`);
    return;
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(latestPath, text, 'utf8');
  console.log(`\n已写入:\n  ${latestPath}`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
