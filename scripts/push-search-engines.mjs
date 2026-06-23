#!/usr/bin/env node
// 主动推送 URL 到 IndexNow（Bing/Yandex 等）与百度普通收录 API
import { readFileSync, existsSync } from 'node:fs';
import { TOOL_HTML_FILES } from './generate-tool-pages.mjs';
import {
  parseSeoFromConfig,
  readConfigRaw,
  collectPublicUrls,
  loadVisiblePostsFromIndex,
  ensureIndexNowKeyFile,
  pushIndexNow,
  pushBaiduUrls,
} from './seo-build.mjs';

function getStr(key) {
  const m = cfgRaw.match(new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`));
  return m ? m[1] : '';
}

const cfgRaw = readConfigRaw();
const seo = parseSeoFromConfig(cfgRaw);
const baseUrl = (getStr('url') || '').replace(/\/$/, '');
const visiblePosts = loadVisiblePostsFromIndex();
const toolPaths = TOOL_HTML_FILES.map(f => `tools/${f}`);
const urlList = collectPublicUrls({ baseUrl, visiblePosts, toolPaths });

if (!baseUrl) {
  console.error('config.site.url 未配置，无法推送');
  process.exit(1);
}

let host;
try {
  host = new URL(`${baseUrl}/`).hostname;
} catch {
  console.error('config.site.url 无效');
  process.exit(1);
}

console.log(`准备推送 ${urlList.length} 个 URL（${baseUrl}）`);

let hadError = false;

if (seo.indexNowEnabled) {
  const keyInfo = ensureIndexNowKeyFile(seo, baseUrl);
  if (keyInfo) {
    const result = await pushIndexNow({
      host,
      key: keyInfo.key,
      keyLocation: keyInfo.keyLocation,
      urlList,
    });
    if (result.skipped) {
      console.log('IndexNow：跳过（', result.reason, '）');
    } else if (result.ok) {
      console.log(`IndexNow：已推送 ${result.count} 个 URL`);
      for (const r of result.results || []) {
        console.log(`  ${r.endpoint} → HTTP ${r.status}${r.ok ? ' ✓' : ''}`);
      }
    } else {
      hadError = true;
      console.warn('IndexNow：推送可能失败');
      console.warn(result.results);
    }
  }
} else {
  console.log('IndexNow：未启用（在 config.js → seo.indexNow.enabled 打开）');
}

if (seo.baiduPushEnabled) {
  const site = String(seo.baiduPushSite || host).trim();
  const token = String(seo.baiduPushToken || '').trim();
  if (!token) {
    console.warn('百度推送：已启用但未填写 token，请在百度搜索资源平台获取');
  } else {
    const recent = urlList.slice(0, 20);
    const result = await pushBaiduUrls({ site, token, urlList: recent });
    if (result.skipped) {
      console.log('百度推送：跳过');
    } else if (result.ok) {
      console.log(`百度推送：已提交 ${recent.length} 个 URL`, result.body);
    } else {
      hadError = true;
      console.warn('百度推送失败：', result.body || result.error);
    }
  }
} else {
  console.log('百度推送：未启用（在 config.js → seo.baiduPush 填写 token 后打开）');
}

console.log('\n说明：Google / 搜狗 / 360 等需在各自站长平台验证站点并提交 sitemap，无法通过此脚本代登录。');
console.log('IndexNow 覆盖 Bing、Yandex 等；百度需单独在 ziyuan.baidu.com 申请 token。');

process.exit(hadError ? 1 : 0);
