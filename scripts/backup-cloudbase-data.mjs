#!/usr/bin/env node
/**
 * 从 CloudBase 拉取评论 + 访问统计，写入站点目录 data/cloudbase-backup/
 *
 * 用法：
 *   COMMENT_ADMIN_SECRET=xxx node scripts/backup-cloudbase-data.mjs
 *   COMMENT_ADMIN_SECRET=xxx node scripts/backup-cloudbase-data.mjs --dry
 *
 * 环境变量：
 *   COMMENT_ADMIN_SECRET — 与云函数 COMMENT_ADMIN_SECRET 一致
 *   CLOUDBASE_HTTP_URL — 可选；CI 推荐配置 HTTP 网关地址
 *   CLOUDBASE_INVOKE_MODE — 设为 http 可强制走 HTTP
 *
 * 输出：
 *   data/cloudbase-backup/latest.json
 *   data/cloudbase-backup/daily/YYYY-MM-DD.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { callCloudFunction, readCloudbaseConfig } from './cloudbase-fn-invoke.mjs';

const DRY = process.argv.includes('--dry');
const ROOT = new URL('..', import.meta.url).pathname;
const BACKUP_DIR = join(ROOT, 'data/cloudbase-backup');
const DAILY_DIR = join(BACKUP_DIR, 'daily');
const PAGE_SIZE = 200;

function todayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d);
}

async function fetchAllComments(cfg, secret, invokeOpts = {}) {
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
    const batch = res.comments || [];
    items.push(...batch);
    if (!res.hasMore || batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return items;
}

async function fetchAllPageviews(cfg, secret, invokeOpts = {}) {
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
    if (res.site && !site) site = res.site;
    const batch = res.pages || [];
    pages.push(...batch);
    if (!res.hasMore || batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return { site: site || { pv: 0, uv: 0, updatedAt: 0 }, pages };
}

async function main() {
  const secret = String(process.env.COMMENT_ADMIN_SECRET || '').trim();
  if (!secret) {
    console.error('请设置环境变量 COMMENT_ADMIN_SECRET');
    process.exit(1);
  }

  const cfg = readCloudbaseConfig();
  if (!cfg.envId) {
    console.error('缺少 cloudbase envId');
    process.exit(1);
  }

  const invokeOpts = {};
  if (
    process.env.CLOUDBASE_INVOKE_MODE === 'http'
    || (process.env.GITHUB_ACTIONS === 'true' && (process.env.CLOUDBASE_HTTP_URL || cfg.httpUrl))
  ) {
    invokeOpts.prefer = 'http';
  }

  console.log(`CloudBase 环境: ${cfg.envId}`);
  console.log('拉取评论…');
  const comments = await fetchAllComments(cfg, secret, invokeOpts);
  console.log(`  评论 ${comments.length} 条`);

  console.log('拉取访问统计…');
  const pageviews = await fetchAllPageviews(cfg, secret, invokeOpts);
  console.log(`  页面 ${pageviews.pages.length} 条，站点 PV ${pageviews.site.pv} / UV ${pageviews.site.uv}`);

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
  const dailyPath = join(DAILY_DIR, `${payload.date}.json`);
  const latestPath = join(BACKUP_DIR, 'latest.json');

  if (DRY) {
    console.log(`\n(DRY-RUN：将写入 ${latestPath} 与 ${dailyPath}，共 ${text.length} 字节)`);
    return;
  }

  mkdirSync(DAILY_DIR, { recursive: true });
  writeFileSync(latestPath, text, 'utf8');
  writeFileSync(dailyPath, text, 'utf8');
  console.log(`\n已写入:\n  ${latestPath}\n  ${dailyPath}`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
