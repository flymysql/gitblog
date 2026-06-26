// 构建期加载 CloudBase 统计：优先在线拉取，失败则读本地 latest.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fetchCloudbaseBackupPayload,
  hasCloudbaseFetchCredentials,
} from './cloudbase-fetch-backup.mjs';
import { indexCloudbaseBackup } from './cloudbase-stats-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const BACKUP_DIR = join(ROOT, 'data/cloudbase-backup');
const LATEST_PATH = join(BACKUP_DIR, 'latest.json');

function readLocalBackup() {
  if (!existsSync(LATEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(LATEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeLocalBackup(payload) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  writeFileSync(LATEST_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

/**
 * @returns {Promise<{ source: 'live'|'file'|'none', payload: object|null, index: ReturnType<typeof indexCloudbaseBackup> }>}
 */
export async function loadBuildStats({ preferLive = true } = {}) {
  let payload = null;
  let source = 'none';

  const shouldFetch = preferLive && (
    process.env.GITHUB_ACTIONS === 'true'
    || process.env.CLOUDBASE_BUILD_FETCH === '1'
    || hasCloudbaseFetchCredentials()
  );

  if (shouldFetch) {
    try {
      payload = await fetchCloudbaseBackupPayload();
      writeLocalBackup(payload);
      source = 'live';
      console.log(`[build-stats] 已从 CloudBase 拉取：评论 ${payload.comments.total} 条，页面 PV ${payload.pageviews.total} 条`);
    } catch (err) {
      console.warn(`[build-stats] CloudBase 在线拉取失败，尝试本地备份：${err.message || err}`);
    }
  }

  if (!payload) {
    payload = readLocalBackup();
    if (payload) source = 'file';
  }

  const index = indexCloudbaseBackup(payload);
  if (source !== 'none') {
    console.log(`[build-stats] 数据来源 ${source}，站点 PV ${index.sitePv}`);
  } else {
    console.warn('[build-stats] 无 CloudBase 数据，统计将显示占位符');
  }

  return { source, payload, index };
}
