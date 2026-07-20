// 校验 + 重新生成 sitemap.xml 与 rss.xml
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import sharp from 'sharp';
import { buildPrerenderedPostHtml } from './prerender-post-html.mjs';
import { TOOL_HTML_FILES } from './generate-tool-pages.mjs';
import {
  parseNavItems,
  buildNavShell,
  buildHeroShell,
  buildPostItemShell,
  pickCarouselItems,
  buildCarouselShell,
  buildCriticalHomeCss,
  postHrefFromEntry,
  sortPostsForHomeList,
} from './home-shell-html.mjs';
import { bundleAssets } from './bundle-assets.mjs';
import { buildAllThumbnails, thumbPathFor } from './thumbnail-lib.mjs';
import { majorQuizOgSvg } from './tool-og.mjs';
import {
  parseSeoFromConfig,
  buildWebsiteJsonLd,
  ensureIndexNowKeyFile,
  pushIndexNow,
  pushBaiduUrls,
  collectPublicUrls,
} from './seo-build.mjs';
import { buildPvBeaconHeadTags } from './pv-beacon-head.mjs';
import { loadBuildStats } from './cloudbase-build-stats.mjs';
import {
  lookupPostCommentCount,
  lookupPostPv,
} from './cloudbase-stats-lib.mjs';

// 从 config.js 中提取 site.url / site.title 等（粗暴正则即可，不引入打包器）
const cfgRaw = readFileSync('assets/js/config.js', 'utf8');
function getStr(key) {
  const m = cfgRaw.match(new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`));
  return m ? m[1] : '';
}
const SITE_URL = (getStr('url') || '').replace(/\/$/, '');
const SITE_TITLE = getStr('title') || 'Blog';
const SITE_DESC = getStr('description') || '';
const SITE_AUTHOR = getStr('author') || '';
const SITE_LOCALE = getStr('locale') || 'zh-CN';
const SITE_AVATAR = getStr('avatar') || '';
const SITE_LOGO = getStr('logo') || '';
const SITE_SUBTITLE = getStr('subtitle') || '';
const BUILD_VERSION = (cfgRaw.match(/VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '20260514040000';

function getSectionBool(section, key, fallback = false) {
  const re = new RegExp(`${section}\\s*:\\s*\\{[\\s\\S]*?${key}\\s*:\\s*(true|false)`);
  const m = cfgRaw.match(re);
  if (!m) return fallback;
  return m[1] === 'true';
}

function getNestedStr(section, key) {
  const re = new RegExp(`${section}\\s*:\\s*\\{[\\s\\S]*?${key}\\s*:\\s*"([^"]*)"`);
  const m = cfgRaw.match(re);
  return m ? m[1] : '';
}

function getPageviewsSiteLabel() {
  const m = cfgRaw.match(/pageviews\s*:\s*\{[\s\S]*?siteLabel\s*:\s*"([^"]*)"/);
  return m ? m[1] : '人来过';
}

const SHOW_HOME_STATS = getSectionBool('pageviews', 'showHomeStats', true);
const SITE_STATS_LABEL = getPageviewsSiteLabel();

const POSTS_DIR = 'posts';
const INDEX_FILE = 'data/posts.json';
const OG_DIR = 'assets/og';

console.log('Site URL:', SITE_URL);

function sitePathPrefixFromBuild() {
  if (!SITE_URL) return '';
  try {
    const o = new URL(SITE_URL.endsWith('/') ? SITE_URL : `${SITE_URL}/`);
    const p = o.pathname.replace(/\/+$/, '');
    return p === '/' || !p ? '' : p;
  } catch {
    return '';
  }
}
const SITE_PATH_PREFIX = sitePathPrefixFromBuild();
function siteOriginFromBuild() {
  try {
    return new URL(SITE_URL || 'https://example.com').origin;
  } catch {
    return '';
  }
}
const SITE_ORIGIN = siteOriginFromBuild();

/** 固定用 /post/{slug}/ 的短文（不走日期 urlKey），须与 assets/js/site.js 中 POST_PATH_SLUGS 一致 */
const POST_PATH_BY_SLUG = new Set(['welcome', 'about']);

function postPublicAbsUrl(entry) {
  const slug = typeof entry === 'object' && entry && entry.slug ? String(entry.slug) : '';
  const k = typeof entry === 'string' ? String(entry).trim() : String((entry && entry.urlKey) || '').trim();
  if (!k) {
    if (slug) return `${SITE_ORIGIN}${SITE_PATH_PREFIX}/post.html?slug=${encodeURIComponent(slug)}`;
    return `${SITE_ORIGIN}${SITE_PATH_PREFIX}/post.html`;
  }
  if (/^\d{8}(-\d+)?$/.test(k)) {
    return `${SITE_ORIGIN}${SITE_PATH_PREFIX}/post/${k}/`;
  }
  if (POST_PATH_BY_SLUG.has(slug) && k === slug) {
    return `${SITE_ORIGIN}${SITE_PATH_PREFIX}/post/${encodeURIComponent(k)}/`;
  }
  if (slug) return `${SITE_ORIGIN}${SITE_PATH_PREFIX}/post.html?slug=${encodeURIComponent(slug)}`;
  return `${SITE_ORIGIN}${SITE_PATH_PREFIX}/post.html`;
}

function postPathFromSlugForPrerender(slug, bySlug) {
  const p = bySlug.get(String(slug || ''));
  if (!p) return '';
  const abs = postPublicAbsUrl(p);
  if (!abs) return '';
  try {
    return new URL(abs).pathname;
  } catch {
    return '';
  }
}

// ---------- 解析 frontmatter ----------
function coerceScalar(v) {
  if (v == null) return '';
  v = String(v).replace(/\s+$/, '');
  // inline JSON 对象（编辑器写入 counter 字段时使用）
  if (v.startsWith('{') && v.endsWith('}')) {
    try { return JSON.parse(v); } catch { return v; }
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    if (/^\[\s*[\{"]/.test(v)) {
      try { return JSON.parse(v); } catch {}
    }
    return v.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === 'true' || v === 'false') return v === 'true';
  if (v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}

function parseFM(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { data: {}, content: text };
  const yaml = m[1];
  const content = text.slice(m[0].length);
  const data = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');
    if (!line || /^\s*#/.test(line)) { i++; continue; }
    const mm = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
    if (!mm) { i++; continue; }
    const key = mm[1];
    const value = mm[2];

    if (value === '') {
      // 多行：可能是 - 数组或缩进对象
      const arr = [];
      const obj = {};
      let mode = '';
      let j = i + 1;
      while (j < lines.length) {
        const sub = lines[j];
        if (!sub.trim()) { j++; continue; }
        const itemM = sub.match(/^\s+-\s+(.*)$/);
        const kvM = sub.match(/^\s+([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
        if (itemM && mode !== 'obj') {
          mode = 'arr';
          arr.push(coerceScalar(itemM[1]));
          j++;
        } else if (kvM && mode !== 'arr') {
          mode = 'obj';
          obj[kvM[1]] = coerceScalar(kvM[2]);
          j++;
        } else {
          break;
        }
      }
      if (mode === 'arr') data[key] = arr;
      else if (mode === 'obj') data[key] = obj;
      else data[key] = '';
      i = j;
      continue;
    }

    data[key] = coerceScalar(value);
    i++;
  }
  return { data, content };
}

function extractSummary(content, max = 80) {
  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max) + '…' : plain;
}

// ---------- 扫描 posts/ 重建索引（同时校验 frontmatter） ----------
const errors = [];
const posts = [];
let existingIndex = { posts: [] };
try {
  existingIndex = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
} catch {}
const existingBySlug = new Map((existingIndex.posts || []).map(p => [p.slug, p]));
const pages = [];
if (existsSync(POSTS_DIR)) {
  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const slug = basename(f, '.md');
    const raw = readFileSync(join(POSTS_DIR, f), 'utf8');
    const { data, content } = parseFM(raw);
    const old = existingBySlug.get(slug) || {};
    if (!data.title) errors.push(`[${f}] frontmatter 缺少 title`);
    if (!data.date) errors.push(`[${f}] frontmatter 缺少 date`);
    const item = {
      slug,
      title: data.title || slug,
      date: data.date || '',
      updated: data.updated || data.date || '',
      author: data.author || SITE_AUTHOR,
      summary: data.summary || extractSummary(content),
      tags: Array.isArray(data.tags) ? data.tags : [],
      cover: data.cover || undefined,
      draft: !!data.draft,
      pinned: !!data.pinned,
      pinnedOrder: data.pinnedOrder || old.pinnedOrder || undefined,
      carousel: !!data.carousel,
      series: data.series || undefined,
      seriesOrder: data.seriesOrder != null ? Number(data.seriesOrder) : undefined,
      path: `${POSTS_DIR}/${f}`,
      content,
    };
    // page: true 是独立页面（如 关于 / 友链），不进入文章流（首页 / 归档 / 标签 / RSS）
    // 但仍对外可访问、进 sitemap、生成 OG 图
    if (data.page) {
      item.page = true;
      pages.push(item);
    } else if (data.type === 'note') {
      // 随笔改为仅走 giscus 讨论，不进入站点文章索引 / RSS / search
      continue;
    } else {
      posts.push(item);
    }
  }
}

if (errors.length) {
  console.log('Frontmatter 校验警告：');
  for (const e of errors) console.log('  -', e);
}

// ---------- 对外 URL 用 YYYYMMDD（同日多篇：第二篇起 YYYYMMDD-2、-3 …）----------
function calendarKeyFromDate(iso) {
  const s = String(iso || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + m[2] + m[3];
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}${mo}${da}`;
}

function assignPostUrlKeys(entries) {
  const dated = entries.filter(p => !POST_PATH_BY_SLUG.has(p.slug));
  const byDay = new Map();
  for (const p of dated) {
    const day = calendarKeyFromDate(p.date);
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(p);
  }
  for (const [day, arr] of byDay) {
    arr.sort((a, b) => {
      const ta = new Date(a.date || 0).getTime();
      const tb = new Date(b.date || 0).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.slug).localeCompare(String(b.slug));
    });
    arr.forEach((p, i) => {
      p.urlKey = i === 0 ? day : `${day}-${i + 1}`;
    });
  }
  for (const p of entries) {
    if (POST_PATH_BY_SLUG.has(p.slug)) p.urlKey = p.slug;
  }
}

assignPostUrlKeys([
  ...posts.filter(p => !p.draft),
  ...pages.filter(p => !p.draft),
]);

await buildAllThumbnails({ posts: [...posts, ...pages] });

// 同目录有 <basename>.thumb.webp 时给 cover 自动配上 thumbnail
function thumbnailFor(cover) {
  if (!cover) return undefined;
  const raw = String(cover);
  const local = raw.replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '').split('?')[0].split('#')[0];
  const ext = extname(local);
  if (!ext || ext.toLowerCase() === '.svg') return undefined;
  const thumbLocal = thumbPathFor(local);
  if (!existsSync(thumbLocal)) return undefined;
  const m = raw.match(/^((?:\.\.\/|\.\/|\/)+)/);
  const prefix = m ? m[1] : '';
  return prefix + thumbLocal;
}

// 重建索引（不包含 content 字段）
posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
const indexJson = {
  posts: posts.map(p => {
    const { content, ...rest } = p;
    if (rest.cover) {
      const t = thumbnailFor(rest.cover);
      if (t) rest.thumbnail = t;
    }
    if (!rest.cover) delete rest.cover;
    if (!rest.draft) delete rest.draft;
    if (!rest.pinned) delete rest.pinned;
    if (!rest.pinnedOrder) delete rest.pinnedOrder;
    if (!rest.carousel) delete rest.carousel;
    if (!rest.series) delete rest.series;
    if (rest.seriesOrder == null) delete rest.seriesOrder;
    if (!rest.counter || (!rest.counter.img && !rest.counter.dashboard)) delete rest.counter;
    if (!rest.urlKey) delete rest.urlKey;
    return rest;
  }),
};
writeFileSync(INDEX_FILE, JSON.stringify(indexJson, null, 2) + '\n');
console.log(`索引已重建：${indexJson.posts.length} 篇文章`);

function plainTextFor(content) {
  return String(content || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~`>\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- sitemap.xml ----------
const visiblePosts = posts.filter(p => !p.draft);

// ---------- 全文搜索索引 search.json（前端 site.js 使用） ----------
const searchDocs = [...visiblePosts, ...pages.filter(p => !p.draft)].map(p => {
  const text = plainTextFor(p.content);
  return {
    slug: p.slug,
    urlKey: p.urlKey || undefined,
    title: p.title,
    summary: p.summary,
    tags: p.tags || [],
    date: p.date,
    type: p.page ? 'page' : 'post',
    text: text.length > 500 ? text.slice(0, 500) : text,
  };
});
writeFileSync('data/search.json', JSON.stringify({
  generated: new Date().toISOString(),
  count: searchDocs.length,
  docs: searchDocs,
}, null, 2) + '\n');
console.log(`search.json 已生成（${searchDocs.length} 篇）`);

function xmlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- robots.txt / manifest 之前的 URL 列表等 ----------

const baseUrl = SITE_URL || '';
const today = new Date().toISOString();
// 首页 lastmod 取最新文章的更新时间（比构建时间戳更能反映内容变化）
const latestPostDate = visiblePosts.length
  ? new Date(visiblePosts[0].date || today).toISOString()
  : today;

const TOOL_SITEMAP_PAGES = [
  'tools/tool-age.html',
  'tools/tool-fortune.html',
  'tools/tool-json.html',
  'tools/tool-codec.html',
  'tools/tool-timestamp.html',
  'tools/tool-regex.html',
  'tools/tool-qrcode.html',
  'tools/tool-image.html',
  'tools/tool-network.html',
  'tools/tool-air-conditioner.html',
  'tools/tool-farm-seed.html',
  'tools/tool-major.html',
];

const urls = [
  { loc: baseUrl + '/', lastmod: latestPostDate, changefreq: 'daily', priority: '1.0' },
  { loc: baseUrl + '/tags.html', lastmod: today, changefreq: 'weekly', priority: '0.8' },
  { loc: baseUrl + '/archives.html', lastmod: today, changefreq: 'weekly', priority: '0.7' },
  { loc: baseUrl + '/series.html', lastmod: today, changefreq: 'weekly', priority: '0.7' },
  { loc: baseUrl + '/tools/', lastmod: today, changefreq: 'monthly', priority: '0.7' },
  ...TOOL_SITEMAP_PAGES.map(p => ({
    loc: baseUrl + '/' + p,
    lastmod: today,
    changefreq: 'monthly',
    priority: '0.6',
  })),
  ...pages.filter(p => !p.draft).map(p => ({
    loc: postPublicAbsUrl(p),
    lastmod: new Date(p.updated || p.date || today).toISOString(),
    changefreq: 'monthly',
    priority: '0.7',
  })),
  ...visiblePosts.map(p => ({
    loc: postPublicAbsUrl(p),
    lastmod: new Date(p.updated || p.date || today).toISOString(),
    changefreq: 'monthly',
    priority: p.pinned ? '0.9' : '0.6',
  })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${xmlEsc(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync('sitemap.xml', sitemap);
console.log('sitemap.xml 已生成（' + urls.length + ' 个 URL）');

// ---------- robots.txt / manifest ----------
// 旧根路径工具页与 post.html?slug= 仅为兼容跳转，勿让爬虫当作可索引 URL
const LEGACY_REDIRECT_DISALLOWS = [
  '/post.html',
  '/tools.html',
  '/tool-kit.html',
  ...TOOL_SITEMAP_PAGES.map(p => `/${basename(p)}`),
];
writeFileSync('robots.txt', `User-agent: *
Allow: /
${LEGACY_REDIRECT_DISALLOWS.map(p => `Disallow: ${p}`).join('\n')}

Sitemap: ${baseUrl}/sitemap.xml
`);
console.log('robots.txt 已生成（Disallow ' + LEGACY_REDIRECT_DISALLOWS.length + ' 条兼容跳转）');

const manifest = {
  name: SITE_TITLE,
  short_name: SITE_TITLE.length > 8 ? SITE_TITLE.slice(0, 8) : SITE_TITLE,
  description: SITE_DESC,
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#ea6f5a',
  lang: SITE_LOCALE,
  icons: [
    {
      src: 'assets/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'assets/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: 'assets/icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    },
  ],
};

// 从 SVG 生成 PWA PNG 图标（iOS/macOS 不支持 SVG 应用图标）
(async () => {
  try {
    await sharp('assets/icon.svg').resize(192, 192).png().toFile('assets/icon-192.png');
    await sharp('assets/icon.svg').resize(512, 512).png().toFile('assets/icon-512.png');
    console.log('PWA PNG 图标已生成');
  } catch (e) {
    console.warn('PWA PNG 图标生成失败（无 sharp 或 SVG 不存在）:', e.message);
  }
})();

writeFileSync('manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest.webmanifest 已生成');

// ---------- rss.xml ----------
function escCdata(s) { return String(s == null ? '' : s).replace(/]]>/g, ']]]]><![CDATA[>'); }

const rssItems = visiblePosts.slice(0, 30).map(p => {
    const fullText = plainTextFor(p.content || '');
    const coverUrl = p.cover
      ? (p.cover.startsWith('http') ? p.cover : `${SITE_ORIGIN}${SITE_PATH_PREFIX}/${p.cover.replace(/^\//, '')}`)
      : '';
    return `    <item>
      <title>${xmlEsc(p.title)}</title>
      <link>${xmlEsc(postPublicAbsUrl(p))}</link>
      <guid isPermaLink="false">${xmlEsc(p.slug)}</guid>
      <pubDate>${new Date(p.date || today).toUTCString()}</pubDate>
      <author>${xmlEsc(p.author || SITE_AUTHOR)}</author>
      ${(p.tags || []).map(t => `<category>${xmlEsc(t)}</category>`).join('')}
      <description><![CDATA[${escCdata(p.summary || '')}]]></description>
      <content:encoded><![CDATA[${escCdata(fullText)}]]></content:encoded>${coverUrl ? `\n      <media:thumbnail url="${xmlEsc(coverUrl)}" />` : ''}
    </item>`;
  }).join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xmlEsc(SITE_TITLE)}</title>
    <link>${xmlEsc(baseUrl + '/')}</link>
    <description>${xmlEsc(SITE_DESC)}</description>
    <language>${xmlEsc(SITE_LOCALE)}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEsc(baseUrl + '/rss.xml')}" rel="self" type="application/rss+xml" />
${rssItems}
  </channel>
</rss>
`;
writeFileSync('rss.xml', rss);
console.log('rss.xml 已生成（' + Math.min(visiblePosts.length, 30) + ' 篇）');

// ---------- 自动生成 OG 分享图（SVG，适合 GitHub Pages 无依赖构建） ----------
mkdirSync(OG_DIR, { recursive: true });
function svgEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function wrapText(text, max = 18, lines = 3) {
  const chars = [...String(text || '')];
  const out = [];
  for (let i = 0; i < chars.length && out.length < lines; i += max) {
    out.push(chars.slice(i, i + max).join(''));
  }
  if (chars.length > max * lines && out.length) out[out.length - 1] = out[out.length - 1].replace(/.{1,2}$/, '…');
  return out;
}
function ogSvg(post) {
  const titleLines = wrapText(post.title || SITE_TITLE, 18, 3);
  const tags = (post.tags || []).slice(0, 3).map(t => `#${t}`).join('  ');
  const subtitle = tags || SITE_DESC || SITE_TITLE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fff7f4"/>
      <stop offset="52%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#ffe8e1"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#d35f4a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="80" r="170" fill="#ea6f5a" opacity="0.12"/>
  <circle cx="125" cy="540" r="210" fill="#ea6f5a" opacity="0.10"/>
  <rect x="74" y="74" width="1052" height="482" rx="34" fill="#fff" filter="url(#shadow)"/>
  <text x="120" y="142" fill="#ea6f5a" font-size="30" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(SITE_TITLE)}</text>
  ${titleLines.map((line, i) => `<text x="120" y="${240 + i * 78}" fill="#222" font-size="58" font-weight="800" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(line)}</text>`).join('\n  ')}
  <text x="120" y="500" fill="#777" font-size="28" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(subtitle)}</text>
  <text x="1080" y="500" text-anchor="end" fill="#999" font-size="24" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(SITE_AUTHOR)}</text>
</svg>`;
}
const ogEntries = [...visiblePosts, ...pages.filter(p => !p.draft)];
let ogPngCount = 0;
for (const post of ogEntries) {
  const svg = ogSvg(post);
  writeFileSync(join(OG_DIR, `${post.slug}.svg`), svg);
  // 社交平台（微信/QQ/Twitter/FB 等）大多不支持 SVG OG 图，需转 PNG（1200×630）
  try {
    await sharp(Buffer.from(svg)).resize(1200, 630, { fit: 'cover' }).png().toFile(join(OG_DIR, `${post.slug}.png`));
    ogPngCount++;
  } catch (e) {
    console.warn(`[og] PNG 转换失败 ${post.slug}:`, e.message);
  }
}
console.log(`OG 分享图已生成：${ogEntries.length} 张 SVG，${ogPngCount} 张 PNG`);

// 工具页 OG（学士帽主视觉，供微信分享抓取）
const TOOL_OG_PAGES = [
  {
    slug: 'tool-major',
    svg: () => majorQuizOgSvg({
      title: '大学专业倾向测评',
      subtitle: '兴趣、能力与规划问卷',
      siteTitle: SITE_TITLE,
      author: SITE_AUTHOR,
    }),
  },
];
for (const tool of TOOL_OG_PAGES) {
  const svg = tool.svg();
  writeFileSync(join(OG_DIR, `${tool.slug}.svg`), svg);
  try {
    await sharp(Buffer.from(svg)).resize(1200, 630, { fit: 'cover' }).png().toFile(join(OG_DIR, `${tool.slug}.png`));
    ogPngCount++;
  } catch (e) {
    console.warn(`[og] 工具页 PNG 转换失败 ${tool.slug}:`, e.message);
  }
}
if (TOOL_OG_PAGES.length) {
  console.log(`工具页 OG 分享图已生成：${TOOL_OG_PAGES.map(t => t.slug).join(', ')}`);
}

// ---------- post/{urlKey}/index.html（/post/YYYYMMDD/ 与 post.js 一致） ----------
/** 壳内 href/src 用站点根绝对路径，避免在 /post/xxx/ 下相对路径变成 /post/xxx/assets/… 或 SW 缓存旧壳错位 */
function postShellRootHref(relPath) {
  const p = String(relPath || '').replace(/^\/+/, '');
  if (!SITE_PATH_PREFIX) return `/${p}`;
  return `${SITE_PATH_PREFIX.replace(/\/+$/, '')}/${p}`.replace(/\/{2,}/g, '/');
}

function rewritePostShellHtml(html) {
  const a = postShellRootHref('assets');
  return html
    .replace(/\n?\s*<script data-post-slug-redirect>[\s\S]*?<\/script>/g, '')
    .replace(/\bhref="assets\//g, `href="${a}/`)
    .replace(/\bsrc="assets\//g, `src="${a}/`)
    .replace(/\bhref="manifest\.webmanifest"/g, `href="${postShellRootHref('manifest.webmanifest')}"`)
    .replace(/\bhref="rss\.xml"/g, `href="${postShellRootHref('rss.xml')}"`)
    .replace(/\blink rel="(?:icon|apple-touch-icon)" href="assets\//g, (m) => m.replace('href="assets/', `href="${a}/`));
}

function writeRootPostHtmlRedirect(entries) {
  const map = {};
  for (const p of entries) {
    const key = safePostUrlKeyDir(p);
    if (p.slug && key) map[p.slug] = key;
  }
  const bpJson = JSON.stringify(SITE_PATH_PREFIX.replace(/\/+$/, ''));
  const body = `(function(){try{var m=${JSON.stringify(map)};var s=new URLSearchParams(location.search).get('slug');if(!s||!/post\\.html$/i.test(location.pathname))return;var k=m[s];if(!k)return;var bp=${bpJson};location.replace((bp?bp:'')+'/post/'+encodeURIComponent(k)+'/');}catch(e){}})();`;
  let html = readFileSync('post.html', 'utf8');
  html = html.replace(
    /assets\/dist\/[a-z0-9.-]+\.min\.(?:js|css)\?v=[^"'\s>]+/gi,
    (m) => m.replace(/\?v=[^"'\s>]+/, `?v=${BUILD_VERSION}`),
  );
  html = html.replace(/\n?\s*<script data-post-slug-redirect>[\s\S]*?<\/script>/g, '');
  // 清理历史累积的 CloudBase beacon 标签，避免重复
  html = html.replace(/\s*<link rel="(?:dns-prefetch|preconnect|prefetch)" href="[^"]*tcloudbaseapp[^"]*"(?: crossorigin)?(?: as="[^"]*")?>\s*/gi, '\n');
  html = html.replace(
    /(<meta name="referrer" content="no-referrer-when-downgrade">)/,
    (m) => {
      const pvHints = buildPvBeaconHeadTags();
      const redirect = `\n  <script data-post-slug-redirect>${body}</script>`;
      return pvHints ? `${m}\n  ${pvHints}${redirect}` : `${m}${redirect}`;
    }
  );
  writeFileSync('post.html', html);
  console.log(`post.html 已写入 slug→urlKey 跳转（${Object.keys(map).length} 篇）`);
}

const postEntries = [...visiblePosts, ...pages.filter(x => !x.draft)];
writeRootPostHtmlRedirect(postEntries);
const POST_SHELL = rewritePostShellHtml(readFileSync('post.html', 'utf8'));
const POST_ROOT = 'post';
const SITE_FOR_PRERENDER = {
  title: SITE_TITLE,
  subtitle: SITE_SUBTITLE,
  author: SITE_AUTHOR,
  avatar: SITE_AVATAR,
  logo: SITE_LOGO,
  locale: SITE_LOCALE,
};
const SHARE_CFG = {
  enabled: getSectionBool('share', 'enabled', false),
  qrcodeOfPage: getSectionBool('share', 'qrcodeOfPage', true),
};
const DONATE_CFG = {
  enabled: getSectionBool('donate', 'enabled', false),
  title: getNestedStr('donate', 'title') || '如果这篇文章对你有帮助，欢迎请我喝杯咖啡 ☕️',
  wechat: '',
  alipay: '',
  paypal: '',
};
const PAGEVIEWS_CFG = {
  enabled: getSectionBool('pageviews', 'enabled', true),
  showPostViews: getSectionBool('pageviews', 'showPostViews', true),
  label: (() => {
    const m = cfgRaw.match(/pageviews\s*:\s*\{[\s\S]*?label\s*:\s*"([^"]*)"/);
    return m ? m[1] : '阅读';
  })(),
};
const { index: BUILD_STATS_INDEX } = await loadBuildStats();
function safePostUrlKeyDir(p) {
  const slug = String(p.slug || '');
  const k = String(p.urlKey || '').trim();
  if (/^\d{8}(-\d+)?$/.test(k)) return k;
  if (POST_PATH_BY_SLUG.has(slug) && k === slug) return k;
  return '';
}
if (existsSync(POST_ROOT)) rmSync(POST_ROOT, { recursive: true, force: true });
mkdirSync(POST_ROOT, { recursive: true });
const postsBySlug = new Map(postEntries.filter(p => p && p.slug).map(p => [p.slug, p]));
const resolvePostPath = (slug) => postPathFromSlugForPrerender(slug, postsBySlug);
let postShellCount = 0;
for (const p of postEntries) {
  const dirKey = safePostUrlKeyDir(p);
  if (!dirKey) {
    console.warn('[build] 跳过缺少或非法 urlKey，无法生成 post 目录：', p.slug);
    continue;
  }
  const dir = join(POST_ROOT, dirKey);
  mkdirSync(dir, { recursive: true });
  const raw = readFileSync(p.path, 'utf8');
  const { data: fmData, content } = parseFM(raw);
  const prerendered = await buildPrerenderedPostHtml({
    post: {
      ...p,
      canonical: postPublicAbsUrl(p),
    },
    fmData,
    content,
    sitePathPrefix: SITE_PATH_PREFIX,
    siteOrigin: SITE_ORIGIN,
    site: SITE_FOR_PRERENDER,
    shareCfg: SHARE_CFG,
    donateCfg: DONATE_CFG,
    pageviewsCfg: PAGEVIEWS_CFG,
    postShellTemplate: POST_SHELL,
    buildStatsIndex: BUILD_STATS_INDEX,
    resolvePostPath,
  });
  writeFileSync(join(dir, 'index.html'), prerendered);
  postShellCount++;
}
console.log(`post/{{urlKey}}/ 已生成（${postShellCount} 篇预渲染 HTML）`);

function stripUndefinedBuild(value) {
  if (Array.isArray(value)) return value.map(stripUndefinedBuild).filter(v => v !== undefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || v === '') continue;
      out[k] = stripUndefinedBuild(v);
    }
    return out;
  }
  return value;
}

// ---------- index.html：注入静态 SEO 元数据 + 预渲染首页文章列表（给爬虫可抓取内容） ----------
function injectHomeSeo() {
  if (!existsSync('index.html')) return;
  let html = readFileSync('index.html', 'utf8');
  const homeUrl = baseUrl + '/';
  const homeTitle = SITE_SUBTITLE ? `${SITE_TITLE} · ${SITE_SUBTITLE}` : SITE_TITLE;
  const ogImage = SITE_AVATAR || SITE_LOGO || '';
  const homeMeta = [
    `<meta name="description" content="${xmlEsc(SITE_DESC || SITE_SUBTITLE || SITE_TITLE)}">`,
    `<meta name="author" content="${xmlEsc(SITE_AUTHOR)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta property="og:title" content="${xmlEsc(SITE_TITLE)}">`,
    `<meta property="og:description" content="${xmlEsc(SITE_DESC || SITE_SUBTITLE || '')}">`,
    ogImage ? `<meta property="og:image" content="${xmlEsc(ogImage)}">` : '',
    `<meta property="og:url" content="${xmlEsc(homeUrl)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${xmlEsc(SITE_TITLE)}">`,
    `<meta property="og:locale" content="${xmlEsc(SITE_LOCALE)}">`,
    `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${xmlEsc(SITE_TITLE)}">`,
    `<meta name="twitter:description" content="${xmlEsc(SITE_DESC || SITE_SUBTITLE || '')}">`,
    ogImage ? `<meta name="twitter:image" content="${xmlEsc(ogImage)}">` : '',
    `<link rel="canonical" href="${xmlEsc(homeUrl)}">`,
  ].filter(Boolean).join('\n  ');
  const websiteLd = buildWebsiteJsonLd({
    siteTitle: SITE_TITLE,
    siteDesc: SITE_DESC,
    homeUrl,
    siteLocale: SITE_LOCALE,
    siteAuthor: SITE_AUTHOR,
    siteLogo: SITE_LOGO,
    siteAvatar: SITE_AVATAR,
  });
  const orgLd = stripUndefinedBuild({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_TITLE,
    url: homeUrl,
    logo: SITE_LOGO || SITE_AVATAR || undefined,
  });
  const jsonLd = `<script type="application/ld+json">${JSON.stringify(websiteLd)}</script>\n  <script type="application/ld+json">${JSON.stringify(orgLd)}</script>`;

  // 清理历史累积的 CloudBase beacon 标签，避免重复
  html = html.replace(/\s*<link rel="(?:dns-prefetch|preconnect|prefetch)" href="[^"]*tcloudbaseapp[^"]*"(?: crossorigin)?(?: as="[^"]*")?>\s*/gi, '\n');

  html = html.replace(/<meta name="referrer" content="no-referrer-when-downgrade">/, (m) => {
    const pvHints = buildPvBeaconHeadTags();
    return pvHints ? `${m}\n  ${pvHints}` : m;
  });

  // title / description
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${xmlEsc(homeTitle)}</title>`);
  html = html.replace(/<meta name="description" content="">/, homeMeta.split('\n')[0]);

  // 同步 CSS/JS 版本号 + 首屏关键样式（不再重复 preload，stylesheet 已在 head 顶部）
  const cssCommon = `assets/dist/common.min.css?v=${BUILD_VERSION}`;
  const cssHome = `assets/dist/home.min.css?v=${BUILD_VERSION}`;
  const jsHome = `assets/dist/home.min.js?v=${BUILD_VERSION}`;
  html = html.replace(/assets\/dist\/common\.min\.css\?v=[^"]+/g, cssCommon);
  html = html.replace(/assets\/dist\/home\.min\.css\?v=[^"]+/g, cssHome);
  html = html.replace(/assets\/css\/common\.css\?v=[^"]+/g, cssCommon);
  html = html.replace(/assets\/css\/home\.css\?v=[^"]+/g, cssHome);
  html = html.replace(/assets\/dist\/home\.min\.js\?v=[^"]+/g, jsHome);
  html = html.replace(/assets\/js\/home\.js\?v=[^"]+/g, jsHome);

  // 历史 build 会累积 preload（只删了 assets/css/ 路径），一并清掉
  html = html.replace(/\s*<link rel="preload" href="assets\/(?:dist\/(?:common|home)\.min|css\/(?:common|home))\.css[^"]*" as="style">\s*/gi, '\n');

  const headPerf = buildCriticalHomeCss();
  html = html.replace(/<style id="critical-home">[\s\S]*?<\/style>\s*/i, '');
  html = html.replace(
    /(<script>\(function\(\)\{var s=localStorage;[\s\S]*?\}\)\(\);<\/script>)/,
    `$1\n  ${headPerf}\n`
  );

  const navItems = parseNavItems(cfgRaw);
  const navShell = buildNavShell({
    siteTitle: SITE_TITLE,
    siteLogo: SITE_LOGO,
    navItems,
    pathPrefix: SITE_PATH_PREFIX,
    active: './',
  });
  html = html.replace(/<div id="site-nav">\s*<\/div>/, `<div id="site-nav">\n    ${navShell}\n  </div>`);

  const tagSet = new Set();
  visiblePosts.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
  const latestHomePost = sortPostsForHomeList(visiblePosts)[0];
  const heroShell = buildHeroShell({
    description: SITE_DESC || SITE_SUBTITLE,
    avatar: SITE_AVATAR,
    postCount: visiblePosts.length,
    tagCount: tagSet.size,
    recentDate: latestHomePost?.date || '',
    pathPrefix: SITE_PATH_PREFIX,
    showSiteStats: SHOW_HOME_STATS,
    siteStatsLabel: SITE_STATS_LABEL,
    sitePv: SHOW_HOME_STATS ? BUILD_STATS_INDEX.sitePv : null,
  });
  html = html.replace(
    /<section class="hero" id="hero"[^>]*>[\s\S]*?<\/section>/,
    `<section class="hero" id="hero" data-shell="prerender">\n    ${heroShell}\n  </section>`
  );

  const carouselItems = pickCarouselItems(visiblePosts);
  const carouselShell = buildCarouselShell(carouselItems, {
    postHrefFromEntry: p => postHrefFromEntry(p, postPublicAbsUrl),
  });
  if (carouselShell) {
    html = html.replace(
      /<section class="home-carousel" id="homeCarousel"[^>]*>[\s\S]*?<\/section>/,
      `<section class="home-carousel" id="homeCarousel" data-shell="prerender">\n    ${carouselShell}\n  </section>`
    );
  } else {
    html = html.replace(
      /<section class="home-carousel" id="homeCarousel"[^>]*>[\s\S]*?<\/section>/,
      `<section class="home-carousel" id="homeCarousel" hidden></section>`
    );
  }

  const hrefFn = p => postHrefFromEntry(p, postPublicAbsUrl);
  const latestForHome = sortPostsForHomeList(visiblePosts).slice(0, 15);
  let listHtml = '';
  if (latestForHome.length) {
    listHtml = latestForHome.map(p => buildPostItemShell(p, {
      author: SITE_AUTHOR,
      avatar: SITE_AVATAR,
      postHrefFromEntry: hrefFn,
      showListStats: PAGEVIEWS_CFG.enabled !== false,
      listPv: PAGEVIEWS_CFG.showPostViews !== false ? lookupPostPv(BUILD_STATS_INDEX, p) : null,
      listComments: lookupPostCommentCount(BUILD_STATS_INDEX, p),
    })).join('\n');
    if (visiblePosts.length > latestForHome.length) {
      listHtml += `\n      <li class="load-more-sentinel" id="loadMoreSentinel" aria-hidden="true">
           <span class="load-more-spinner"></span>
           <span class="load-more-text">加载更多</span>
         </li>`;
    } else {
      listHtml += `\n      <li class="load-more-end">已经到底啦 · 共 ${visiblePosts.length} 篇</li>`;
    }
  } else {
    listHtml = '      <li class="loading">加载中…</li>';
  }
  html = html.replace(
    /<ul id="postList" class="post-list">[\s\S]*?<\/ul>/,
    `<ul id="postList" class="post-list">\n${listHtml}\n    </ul>`
  );

  // 插入 SEO meta + JSON-LD（在 theme bootstrap 之后；重复构建时先替换旧块）
  const seoBlock = `${homeMeta.split('\n').slice(1).join('\n  ')}\n  ${jsonLd}`;
  if (/<meta name="apple-mobile-web-app-capable" content="yes">[\s\S]*?<\/head>/.test(html)) {
    html = html.replace(
      /<meta name="apple-mobile-web-app-capable" content="yes">[\s\S]*?(?=<\/head>)/,
      `<meta name="apple-mobile-web-app-capable" content="yes">\n  ${seoBlock}\n`
    );
  } else {
    html = html.replace(
      /(<meta name="apple-mobile-web-app-capable" content="yes">)/,
      `$1\n  ${seoBlock}`
    );
  }

  writeFileSync('index.html', html);
  console.log(`index.html 已注入首屏壳层 + SEO + 首页列表（${latestForHome.length} 篇）`);
}
injectHomeSeo();
await bundleAssets();
console.log(`tool/*.html 已就绪（${TOOL_HTML_FILES.length} 个工具页，含评论区）`);

async function pushSeoOnBuild() {
  const seo = parseSeoFromConfig(cfgRaw);
  if (!SITE_URL) return;
  let host;
  try { host = new URL(`${SITE_URL}/`).hostname; } catch { return; }

  if (seo.indexNowEnabled) {
    ensureIndexNowKeyFile(seo, SITE_URL);
  }

  if (!seo.indexNowEnabled && !seo.baiduPushEnabled) return;
  if (seo.indexNowEnabled && !seo.indexNowPushOnBuild) {
    console.log('IndexNow pushOnBuild=false，跳过自动推送（可运行 npm run seo:push）');
    if (!seo.baiduPushEnabled) return;
  }

  const toolPaths = TOOL_HTML_FILES.map(f => `tools/${f}`);
  const urlList = collectPublicUrls({ baseUrl: SITE_URL, visiblePosts, toolPaths });

  if (seo.indexNowEnabled && seo.indexNowPushOnBuild) {
    const key = String(seo.indexNowKey || '').trim();
    if (!key) {
      console.warn('[seo] IndexNow 已启用但缺少 key，请先在后台 SEO 设置中填写或运行 build 查看生成的 key 文件');
    } else {
      const keyLocation = `${SITE_URL.replace(/\/$/, '')}/${key}.txt`;
      const result = await pushIndexNow({ host, key, keyLocation, urlList: urlList.slice(0, 100) });
      if (result.ok) console.log(`IndexNow 自动推送：${Math.min(urlList.length, 100)} 个 URL`);
      else console.warn('IndexNow 自动推送未成功，可稍后运行 npm run seo:push');
    }
  }

  if (seo.baiduPushEnabled && seo.baiduPushToken) {
    const site = String(seo.baiduPushSite || host).trim();
    const result = await pushBaiduUrls({ site, token: seo.baiduPushToken, urlList: urlList.slice(0, 20) });
    if (result.ok) console.log('百度普通收录 API：已提交最近 URL');
    else console.warn('百度普通收录 API 未成功：', result.body || result.error);
  }
}

await pushSeoOnBuild();
