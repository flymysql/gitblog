#!/usr/bin/env node
/**
 * 从 CloudBase 拉取评论 + 访问统计，写入 data/cloudbase-backup/latest.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readCloudbaseConfig } from './cloudbase-fn-invoke.mjs';
import {
  fetchCloudbaseBackupPayload,
  resolveAdminSecret,
  resolveInvokeOpts,
} from './cloudbase-fetch-backup.mjs';

const DRY = process.argv.includes('--dry');
const ROOT = new URL('..', import.meta.url).pathname;
const BACKUP_DIR = join(ROOT, 'data/cloudbase-backup');

function describeInvokeMode(cfg, invokeOpts) {
  if (invokeOpts.prefer === 'sdk') {
    return `Node SDK (${cfg.functionName} @ ${cfg.envId}, region=${cfg.region})`;
  }
  if (invokeOpts.prefer === 'http') {
    const url = process.env.CLOUDBASE_HTTP_URL || cfg.httpUrl || `https://${cfg.envId}.${cfg.region}.app.tcloudbase.com/${cfg.functionName}`;
    return `HTTP (${url})`;
  }
  return `tcb fn invoke (${cfg.functionName} @ ${cfg.envId}, region=${cfg.region})`;
}

async function main() {
  const { secret, fromVar } = resolveAdminSecret();
  if (!secret) {
    console.error('请设置环境变量 COMMENT_ADMIN_SECRET');
    console.error('GitHub Actions：需在 job 上声明 environment: github-pages，并把密钥放在');
    console.error('  Settings → Environments → github-pages → Environment secrets（不是 Variables）');
    process.exit(1);
  }
  if (fromVar) {
    console.warn('警告：COMMENT_ADMIN_SECRET 未在 secrets 中配置，当前使用的是 Environment Variable。');
  }

  const cfg = readCloudbaseConfig();
  if (!cfg.envId) {
    console.error('缺少 cloudbase envId');
    process.exit(1);
  }

  const invokeOpts = resolveInvokeOpts(cfg);
  console.log(`CloudBase 环境: ${cfg.envId}`);
  console.log(`调用方式: ${describeInvokeMode(cfg, invokeOpts)}`);

  console.log('拉取 CloudBase 数据…');
  const payload = await fetchCloudbaseBackupPayload();
  console.log(`  评论 ${payload.comments.total} 条`);
  console.log(`  页面 ${payload.pageviews.total} 条，站点 PV ${payload.pageviews.site.pv} / UV ${payload.pageviews.site.uv}`);

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
