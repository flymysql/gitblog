// 从 CloudBase 拉取评论 + 访问统计（backup / build 共用）
import {
  callCloudFunction,
  callCloudFunctionWithFallback,
  readCloudbaseConfig,
} from './cloudbase-fn-invoke.mjs';

const PAGE_SIZE = 200;

export function resolveAdminSecret() {
  const fromSecret = String(process.env.COMMENT_ADMIN_SECRET || '').trim();
  const fromVar = String(process.env.COMMENT_ADMIN_SECRET_VAR || '').trim();
  const secret = fromSecret || fromVar;
  if (!secret) return { secret: '', fromVar: false };
  return { secret, fromVar: !fromSecret && !!fromVar };
}

export function hasCloudbaseFetchCredentials() {
  const { secret } = resolveAdminSecret();
  if (secret) return true;
  return !!(process.env.TENCENTCLOUD_SECRETID && process.env.TENCENTCLOUD_SECRETKEY);
}

export function resolveInvokeOpts(cfg) {
  if (process.env.CLOUDBASE_INVOKE_MODE === 'http') return { prefer: 'http' };
  if (process.env.CLOUDBASE_INVOKE_MODE === 'sdk') return { prefer: 'sdk' };
  if (process.env.TENCENTCLOUD_SECRETID && process.env.TENCENTCLOUD_SECRETKEY) {
    return { prefer: 'sdk' };
  }
  if (process.env.GITHUB_ACTIONS === 'true' && (process.env.CLOUDBASE_HTTP_URL || cfg.httpUrl)) {
    return { prefer: 'http' };
  }
  return {};
}

function todayKey(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(d);
}

function assertActionShape(res, action) {
  if (!res || typeof res !== 'object' || res.ok !== true) {
    throw new Error(`${action} 响应无效`);
  }
  if (action === 'PV_SITE') {
    if (!('sitePv' in res) || !('siteUv' in res)) {
      throw new Error(`PV_SITE 响应缺少 sitePv/siteUv：${JSON.stringify(res).slice(0, 240)}`);
    }
  }
  if (action === 'ADMIN_EXPORT' && !Array.isArray(res.comments)) {
    throw new Error(`ADMIN_EXPORT 响应缺少 comments 数组：${JSON.stringify(res).slice(0, 240)}`);
  }
  if (action === 'PV_ADMIN_EXPORT' && !Array.isArray(res.pages)) {
    throw new Error(`PV_ADMIN_EXPORT 响应缺少 pages 数组：${JSON.stringify(res).slice(0, 240)}`);
  }
  if (action === 'PV_ADMIN_TOP' && !Array.isArray(res.top)) {
    throw new Error(`PV_ADMIN_TOP 响应缺少 top 数组：${JSON.stringify(res).slice(0, 240)}`);
  }
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
    assertActionShape(res, 'ADMIN_EXPORT');
    const batch = res.comments;
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
    assertActionShape(res, 'PV_ADMIN_EXPORT');
    if (res.site && !site) site = res.site;
    const batch = res.pages;
    pages.push(...batch);
    if (!res.hasMore || batch.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return { site: site || { pv: 0, uv: 0, updatedAt: 0 }, pages };
}

async function probePublicPv(cfg, invokeOpts) {
  const res = await callCloudFunction(cfg, { action: 'PV_SITE' }, invokeOpts);
  assertActionShape(res, 'PV_SITE');
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
  assertActionShape(res, 'PV_ADMIN_TOP');
  return {
    site: res.site || { pv: 0, uv: 0, updatedAt: 0 },
    top: res.top,
  };
}

function isBackupEmpty(comments, pageviews, probe) {
  return comments.length === 0
    && pageviews.pages.length === 0
    && (probe.sitePv || 0) === 0
    && (pageviews.site?.pv || 0) === 0;
}

function failEmptyPageviews(probe, pageviews, topProbe) {
  const lines = [
    '访问统计备份为空，但 PV_SITE / PV_ADMIN_TOP 显示线上有数据。',
    `  PV_SITE sitePv=${probe.sitePv}`,
    '',
    '常见原因：',
    '1. CI 的 TENCENTCLOUD_SECRETID/KEY 与本地 tcb login 不是同一腾讯云账号',
    '2. COMMENT_ADMIN_SECRET 与云函数环境变量不一致',
    '3. 云函数未重新部署（npm run cloudbase:deploy-comments）',
  ];
  if (topProbe?.top?.length) {
    lines.push('', `PV_ADMIN_TOP 示例：${topProbe.top[0]?.path} pv=${topProbe.top[0]?.pv}`);
  }
  throw new Error(lines.join('\n'));
}

async function retryIfEmpty(cfg, secret, invokeOpts, comments, pageviews, probe) {
  if (!isBackupEmpty(comments, pageviews, probe)) {
    return { invokeOpts, comments, pageviews, probe };
  }

  const { res: siteRes, mode } = await callCloudFunctionWithFallback(cfg, { action: 'PV_SITE' });
  assertActionShape(siteRes, 'PV_SITE');
  const retryProbe = {
    sitePv: Number(siteRes.sitePv) || 0,
    siteUv: Number(siteRes.siteUv) || 0,
  };

  if (retryProbe.sitePv === 0 && (siteRes.sitePv || 0) === 0) {
    const topProbe = await callCloudFunction(cfg, {
      action: 'PV_ADMIN_TOP',
      adminSecret: secret,
      limit: 5,
    }, { prefer: mode });
    assertActionShape(topProbe, 'PV_ADMIN_TOP');
    if ((topProbe.top || []).length === 0) {
      return { invokeOpts: { prefer: mode }, comments, pageviews, probe: retryProbe };
    }
    failEmptyPageviews(retryProbe, pageviews, topProbe);
  }

  const nextOpts = { prefer: mode };
  const nextProbe = await probePublicPv(cfg, nextOpts);
  const nextComments = await fetchAllComments(cfg, secret, nextOpts);
  const nextPageviews = await fetchAllPageviews(cfg, secret, nextOpts);
  return {
    invokeOpts: nextOpts,
    comments: nextComments,
    pageviews: nextPageviews,
    probe: nextProbe,
  };
}

/** 拉取 CloudBase 评论 + 访问统计，返回与 latest.json 相同结构 */
export async function fetchCloudbaseBackupPayload() {
  const { secret } = resolveAdminSecret();
  if (!secret) {
    throw new Error('请设置环境变量 COMMENT_ADMIN_SECRET');
  }

  const cfg = readCloudbaseConfig();
  if (!cfg.envId) {
    throw new Error('缺少 cloudbase envId');
  }

  let invokeOpts = resolveInvokeOpts(cfg);
  let probe = await probePublicPv(cfg, invokeOpts);
  let comments = await fetchAllComments(cfg, secret, invokeOpts);
  let pageviews = await fetchAllPageviews(cfg, secret, invokeOpts);

  ({ invokeOpts, comments, pageviews, probe } = await retryIfEmpty(
    cfg, secret, invokeOpts, comments, pageviews, probe,
  ));

  if (probe.sitePv > 0 && pageviews.pages.length === 0) {
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
  return {
    version: 1,
    generatedAt: now.toISOString(),
    date: todayKey(now),
    envId: cfg.envId,
    siteUrl: cfg.siteUrl,
    invokeMode: invokeOpts.prefer || 'auto',
    comments: { total: comments.length, items: comments },
    pageviews: {
      site: pageviews.site,
      total: pageviews.pages.length,
      pages: pageviews.pages,
    },
  };
}
