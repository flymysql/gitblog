// SEO 构建辅助：站长验证 meta、结构化数据、IndexNow / 百度推送
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export function parseSeoFromConfig(cfgRaw = '') {
  const raw = String(cfgRaw || '');
  function nestedStr(...keys) {
    let block = raw;
    for (let i = 0; i < keys.length - 1; i++) {
      const re = new RegExp(`${keys[i]}\\s*:\\s*\\{`);
      const m = block.match(re);
      if (!m) return '';
      block = block.slice(m.index);
    }
    const last = keys[keys.length - 1];
    const re = new RegExp(`${last}\\s*:\\s*"([^"]*)"`);
    const m = block.match(re);
    return m ? m[1] : '';
  }
  function nestedBool(keys, fallback = false) {
    let block = raw;
    for (let i = 0; i < keys.length - 1; i++) {
      const re = new RegExp(`${keys[i]}\\s*:\\s*\\{`);
      const m = block.match(re);
      if (!m) return fallback;
      block = block.slice(m.index);
    }
    const last = keys[keys.length - 1];
    const re = new RegExp(`${last}\\s*:\\s*(true|false)`);
    const m = block.match(re);
    if (!m) return fallback;
    return m[1] === 'true';
  }
  return {
    baiduSiteVerification: nestedStr('seo', 'baiduSiteVerification'),
    googleSiteVerification: nestedStr('seo', 'googleSiteVerification'),
    bingSiteVerification: nestedStr('seo', 'bingSiteVerification'),
    indexNowEnabled: nestedBool(['seo', 'indexNow', 'enabled'], false),
    indexNowKey: nestedStr('seo', 'indexNow', 'key'),
    indexNowPushOnBuild: nestedBool(['seo', 'indexNow', 'pushOnBuild'], true),
    baiduPushEnabled: nestedBool(['seo', 'baiduPush', 'enabled'], false),
    baiduPushSite: nestedStr('seo', 'baiduPush', 'site'),
    baiduPushToken: nestedStr('seo', 'baiduPush', 'token'),
  };
}

export function buildVerificationMetaHtml(seo = {}) {
  const lines = [];
  const baidu = String(seo.baiduSiteVerification || '').trim();
  const google = String(seo.googleSiteVerification || '').trim();
  const bing = String(seo.bingSiteVerification || '').trim();
  if (baidu) lines.push(`<meta name="baidu-site-verification" content="${xmlEsc(baidu)}">`);
  if (google) lines.push(`<meta name="google-site-verification" content="${xmlEsc(google)}">`);
  if (bing) lines.push(`<meta name="msvalidate.01" content="${xmlEsc(bing)}">`);
  return lines.join('\n  ');
}

export function buildWebsiteJsonLd({
  siteTitle,
  siteDesc,
  homeUrl,
  siteLocale,
  siteAuthor,
  siteLogo,
  siteAvatar,
}) {
  const publisher = siteAuthor
    ? { '@type': 'Person', name: siteAuthor, image: siteAvatar || undefined }
    : { '@type': 'Organization', name: siteTitle, logo: siteLogo || undefined };
  return stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteTitle,
    description: siteDesc || undefined,
    url: homeUrl,
    inLanguage: siteLocale || 'zh-CN',
    publisher,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${homeUrl}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

export function ensureIndexNowKeyFile(seo, baseUrl) {
  if (!seo.indexNowEnabled) return null;
  let key = String(seo.indexNowKey || '').trim();
  if (!key) {
    key = randomBytes(16).toString('hex');
    console.warn('[seo] IndexNow 已启用但未配置 key，本次使用临时 key（请写入 config.js 后重新 build）：', key);
  }
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    console.warn('[seo] IndexNow key 格式无效（8–128 位字母数字或连字符），已跳过 key 文件');
    return null;
  }
  const fileName = `${key}.txt`;
  writeFileSync(fileName, key, 'utf8');
  console.log(`IndexNow 密钥文件已生成：${fileName}`);
  return { key, keyLocation: `${baseUrl.replace(/\/$/, '')}/${fileName}` };
}

export async function pushIndexNow({ host, key, keyLocation, urlList }) {
  const urls = [...new Set((urlList || []).map(u => String(u || '').trim()).filter(Boolean))];
  if (!host || !key || !keyLocation || !urls.length) {
    return { ok: false, skipped: true, reason: 'missing config or urls' };
  }
  const body = { host, key, keyLocation, urlList: urls.slice(0, 10000) };
  const endpoints = [
    'https://api.indexnow.org/indexnow',
    'https://www.bing.com/indexnow',
  ];
  const results = [];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      results.push({ endpoint, status: res.status, ok: res.ok || res.status === 202 });
    } catch (e) {
      results.push({ endpoint, ok: false, error: e.message });
    }
  }
  const ok = results.some(r => r.ok);
  return { ok, results, count: urls.length };
}

export async function pushBaiduUrls({ site, token, urlList }) {
  const urls = [...new Set((urlList || []).map(u => String(u || '').trim()).filter(Boolean))];
  if (!site || !token || !urls.length) {
    return { ok: false, skipped: true, reason: 'missing site/token or urls' };
  }
  const endpoint = `https://data.zz.baidu.com/urls?site=${encodeURIComponent(site)}&token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: urls.slice(0, 2000).join('\n'),
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    const ok = res.ok && (!parsed || parsed.success !== 0);
    return { ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined).filter(v => v !== undefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || v === '') continue;
      out[k] = stripUndefined(v);
    }
    return out;
  }
  return value;
}

function xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function readConfigRaw() {
  return readFileSync('assets/js/config.js', 'utf8');
}

export function collectPublicUrls({ baseUrl, visiblePosts, toolPaths = [] }) {
  const origin = baseUrl.replace(/\/$/, '');
  const urls = [
    `${origin}/`,
    `${origin}/archives.html`,
    `${origin}/tags.html`,
    `${origin}/series.html`,
    `${origin}/notes.html`,
    `${origin}/tools/`,
  ];
  for (const p of visiblePosts || []) {
    if (p && p.slug) urls.push(postAbsUrl(origin, p));
  }
  for (const t of toolPaths || []) urls.push(`${origin}/${String(t).replace(/^\//, '')}`);
  return [...new Set(urls)];
}

function postAbsUrl(origin, entry) {
  const slug = String(entry.slug || '').trim();
  const k = String(entry.urlKey || '').trim();
  if (/^\d{8}(-\d+)?$/.test(k)) return `${origin}/post/${k}/`;
  if (k === 'welcome' || k === 'about') return `${origin}/post/${encodeURIComponent(k)}/`;
  if (slug) return `${origin}/post.html?slug=${encodeURIComponent(slug)}`;
  return `${origin}/post.html`;
}

export function loadVisiblePostsFromIndex() {
  if (!existsSync('data/posts.json')) return [];
  try {
    const data = JSON.parse(readFileSync('data/posts.json', 'utf8'));
    return (data.posts || []).filter(p => !p.draft);
  } catch {
    return [];
  }
}
