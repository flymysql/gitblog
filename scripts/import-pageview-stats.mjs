#!/usr/bin/env node
/**
 * 从 Vercount 拉取历史文章阅读量，导入 CloudBase gitblog_pageviews。
 *
 * 用法：
 *   COMMENT_ADMIN_SECRET=xxx node scripts/import-pageview-stats.mjs
 *   COMMENT_ADMIN_SECRET=xxx node scripts/import-pageview-stats.mjs --dry
 *
 * 环境变量：
 *   COMMENT_ADMIN_SECRET — 与云函数 COMMENT_ADMIN_SECRET 一致（见 cloudbase/secrets.env）
 *   CLOUDBASE_HTTP_URL — 可选；仅当已开启 HTTP 网关且 tcb invoke 不可用时
 *   CLOUDBASE_INVOKE_MODE — 设为 http 可强制走 HTTP
 *
 * 说明：本站评论/PV 前台走 embed + SDK，HTTP 网关可能未开启；导入默认用 tcb fn invoke（需 tcb login）。
 */
import { readFileSync } from 'node:fs';
import { callCloudFunction, readCloudbaseConfig } from './cloudbase-fn-invoke.mjs';

const DRY = process.argv.includes('--dry');
const DELAY_MS = 220;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function readConfig() {
  return readCloudbaseConfig();
}

function loadPosts() {
  return JSON.parse(readFileSync('data/posts.json', 'utf8')).posts || [];
}

function canonicalPostPath(post) {
  const k = String(post.urlKey || '').trim();
  if (k && /^[a-z0-9-]+$/i.test(k)) return `/post/${k}`;
  const slug = String(post.slug || '').trim();
  if (slug) return `/post/${encodeURIComponent(slug)}`;
  return '';
}

function postPublicPath(siteUrl, post) {
  const k = String(post.urlKey || '').trim();
  const slug = String(post.slug || '').trim();
  const paths = [];
  if (k && /^[a-z0-9]+$/i.test(k)) paths.push(`/post/${encodeURIComponent(k)}`);
  if (slug) paths.push(`/post/${encodeURIComponent(slug)}`);
  paths.push(`/post.html?slug=${encodeURIComponent(slug)}`);
  return [...new Set(paths.map(p => `${siteUrl}${p.startsWith('/') ? p : `/${p}`}`))];
}

async function fetchVercountForUrl(url) {
  const res = await fetch('https://events.vercount.one/api/v2/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, isNewUv: false }),
  });
  if (!res.ok) throw new Error(`Vercount HTTP ${res.status} for ${url}`);
  const data = await res.json();
  const row = data?.data || data;
  return {
    pagePv: Number(row?.page_pv) || 0,
    sitePv: Number(row?.site_pv) || 0,
    siteUv: Number(row?.site_uv) || 0,
  };
}

async function callCloudImport(cfg, secret, payload) {
  return callCloudFunction(cfg, {
    action: 'PV_IMPORT',
    adminSecret: secret,
    ...payload,
  });
}

async function main() {
  const secret = String(process.env.COMMENT_ADMIN_SECRET || '').trim();
  if (!secret) {
    console.error('请设置环境变量 COMMENT_ADMIN_SECRET（与 cloudbase/secrets.env 一致）');
    process.exit(1);
  }

  const cfg = readConfig();
  if (!cfg.envId) {
    console.error('缺少 cloudbase envId（cloudbase/cloudbaserc.json 或 assets/js/config.js）');
    process.exit(1);
  }

  console.log(`CloudBase 环境: ${cfg.envId}（导入走 tcb fn invoke，需已 tcb login）`);

  const posts = loadPosts().filter(p => !p.draft);
  const pages = [];
  let vercountSiteUv = 0;
  let vercountSitePv = 0;

  console.log(`\n从 Vercount 拉取 ${posts.length} 篇文章阅读量（每篇可能 +1 误差）…`);
  for (const post of posts) {
    const urls = postPublicPath(cfg.siteUrl, post);
    let best = { pv: 0, url: '', source: 'vercount' };
    for (const url of urls) {
      try {
        const row = await fetchVercountForUrl(url);
        vercountSiteUv = Math.max(vercountSiteUv, row.siteUv);
        vercountSitePv = Math.max(vercountSitePv, row.sitePv);
        if (row.pagePv > best.pv) best = { pv: row.pagePv, url, source: 'vercount' };
      } catch (err) {
        console.warn(`  [skip] ${url}: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
    if (best.pv > 0) {
      const path = canonicalPostPath(post) || new URL(best.url).pathname.replace(/\/+$/, '') || '/';
      pages.push({
        path,
        slug: post.slug,
        title: post.title || post.slug,
        pv: best.pv,
        source: 'vercount',
      });
      console.log(`  ${post.slug}: ${best.pv} (${path})`);
    }
  }

  const site = {
    pv: vercountSitePv || 0,
    uv: vercountSiteUv || 0,
    source: 'vercount',
  };

  console.log('\n汇总:');
  console.log(`  站点 PV (Vercount): ${site.pv}`);
  console.log(`  站点 UV (Vercount): ${site.uv}`);
  console.log(`  文章条目: ${pages.length}`);

  if (DRY) {
    console.log('\n(DRY-RUN：未写入 CloudBase)');
    return;
  }

  console.log('\n写入 CloudBase（tcb fn invoke）…');
  const result = await callCloudImport(cfg, secret, {
    site,
    pages,
    source: 'import-vercount',
  });
  console.log('完成:', result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
