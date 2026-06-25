#!/usr/bin/env node
/**
 * 从 Saobby / Vercount 拉取历史访问数据，导入 CloudBase gitblog_pageviews。
 *
 * 用法：
 *   COMMENT_ADMIN_SECRET=xxx node scripts/import-pageview-stats.mjs
 *   COMMENT_ADMIN_SECRET=xxx node scripts/import-pageview-stats.mjs --dry
 *
 * 环境变量：
 *   COMMENT_ADMIN_SECRET — 与云函数 COMMENT_ADMIN_SECRET 一致（见 cloudbase/secrets.env）
 *   CLOUDBASE_HTTP_URL — 可选，默认从 config.js 推导
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const DELAY_MS = 220;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function readConfig() {
  const raw = readFileSync('assets/js/config.js', 'utf8');
  const pick = key => (raw.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`)) || [])[1] || '';
  return {
    siteUrl: pick('url').replace(/\/+$/, '') || 'https://gitpull.cn',
    envId: pick('envId'),
    region: pick('region') || 'ap-shanghai',
    functionName: pick('functionName') || 'gitblog-comments',
    saobbyImg: (raw.match(/img:\s*["']([^"']*saobby[^"']*)["']/) || [])[1] || '',
  };
}

function loadPosts() {
  return JSON.parse(readFileSync('data/posts.json', 'utf8')).posts || [];
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

async function fetchSaobbyTotal(imgUrl) {
  if (!imgUrl) return null;
  const res = await fetch(imgUrl, { headers: { 'User-Agent': 'gitblog-import/1.0' } });
  if (!res.ok) throw new Error(`Saobby HTTP ${res.status}`);
  const svg = await res.text();
  const m = svg.match(/<text[^>]*>\s*(\d+)\s*<\/text>/i);
  return m ? Number(m[1]) : null;
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
  const url = process.env.CLOUDBASE_HTTP_URL
    || `https://${cfg.envId}.${cfg.region}.app.tcloudbase.com/${cfg.functionName}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'PV_IMPORT', adminSecret: secret, ...payload }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`CloudBase 响应非 JSON: ${text.slice(0, 200)}`); }
  if (!json?.ok) throw new Error(json?.message || `CloudBase HTTP ${res.status}`);
  return json;
}

async function main() {
  const secret = String(process.env.COMMENT_ADMIN_SECRET || '').trim();
  if (!secret) {
    console.error('请设置环境变量 COMMENT_ADMIN_SECRET（与 cloudbase/secrets.env 一致）');
    process.exit(1);
  }

  const cfg = readConfig();
  if (!cfg.envId) {
    console.error('config.js 缺少 cloudbase.envId');
    process.exit(1);
  }

  console.log('读取 Saobby 站点总计…');
  let saobbyTotal = null;
  try {
    saobbyTotal = await fetchSaobbyTotal(cfg.saobbyImg);
    console.log(`  Saobby 站点计数: ${saobbyTotal ?? '未解析'}`);
  } catch (err) {
    console.warn(`  Saobby 读取失败: ${err.message}`);
  }

  const posts = loadPosts().filter(p => !p.draft);
  const pages = [];
  let vercountSiteUv = 0;

  console.log(`\n从 Vercount 拉取 ${posts.length} 篇文章阅读量（每篇可能 +1 误差）…`);
  for (const post of posts) {
    const urls = postPublicPath(cfg.siteUrl, post);
    let best = { pv: 0, url: '', source: 'vercount' };
    for (const url of urls) {
      try {
        const row = await fetchVercountForUrl(url);
        vercountSiteUv = Math.max(vercountSiteUv, row.siteUv);
        if (row.pagePv > best.pv) best = { pv: row.pagePv, url, source: 'vercount' };
      } catch (err) {
        console.warn(`  [skip] ${url}: ${err.message}`);
      }
      await sleep(DELAY_MS);
    }
    if (best.pv > 0) {
      const path = new URL(best.url).pathname.replace(/\/+$/, '') || '/';
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
    pv: saobbyTotal || 0,
    uv: vercountSiteUv || 0,
    source: saobbyTotal ? 'saobby+vercount' : 'vercount',
  };

  console.log('\n汇总:');
  console.log(`  站点 PV (Saobby): ${site.pv}`);
  console.log(`  站点 UV (Vercount): ${site.uv}`);
  console.log(`  文章条目: ${pages.length}`);

  if (DRY) {
    console.log('\n(DRY-RUN：未写入 CloudBase)');
    return;
  }

  console.log('\n写入 CloudBase…');
  const result = await callCloudImport(cfg, secret, {
    site,
    pages,
    source: 'import-saobby-vercount',
  });
  console.log('完成:', result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
