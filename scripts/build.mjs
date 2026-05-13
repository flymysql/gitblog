// 校验 + 重新生成 sitemap.xml 与 rss.xml
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

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
const POSTS_DIR = 'posts';
const INDEX_FILE = 'data/posts.json';
const OG_DIR = 'assets/og';

console.log('Site URL:', SITE_URL);

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
      type: data.type || undefined,        // post | note（短动态）
      counter: (data.counter && typeof data.counter === 'object') ? {
        img: String(data.counter.img || ''),
        dashboard: String(data.counter.dashboard || ''),
      } : undefined,
      path: `${POSTS_DIR}/${f}`,
      content,
    };
    // page: true 是独立页面（如 关于 / 友链），不进入文章流（首页 / 归档 / 标签 / RSS）
    // 但仍对外可访问、进 sitemap、生成 OG 图
    if (data.page) {
      item.page = true;
      pages.push(item);
    } else {
      posts.push(item);
    }
  }
}

if (errors.length) {
  console.log('Frontmatter 校验警告：');
  for (const e of errors) console.log('  -', e);
}

// 同目录有 <basename>.thumb.webp 时给 cover 自动配上 thumbnail
// 缩略图由 scripts/build-thumbnails.mjs 单独生成（首页文章列表会优先用它）
function thumbnailFor(cover) {
  if (!cover) return undefined;
  const raw = String(cover);
  const local = raw.replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '').split('?')[0].split('#')[0];
  const ext = extname(local);
  if (!ext || ext.toLowerCase() === '.svg') return undefined;
  const thumbLocal = local.slice(0, -ext.length) + '.thumb.webp';
  if (!existsSync(thumbLocal)) return undefined;
  // 保留原 cover 的相对前缀风格（../assets/... 或 assets/...）
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
    if (!rest.type) delete rest.type;
    if (!rest.counter || (!rest.counter.img && !rest.counter.dashboard)) delete rest.counter;
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
    title: p.title,
    summary: p.summary,
    tags: p.tags || [],
    date: p.date,
    type: p.page ? 'page' : 'post',
    text: text.length > 1500 ? text.slice(0, 1500) : text,
  };
});
writeFileSync('data/search.json', JSON.stringify({
  generated: new Date().toISOString(),
  count: searchDocs.length,
  docs: searchDocs,
}, null, 2) + '\n');
console.log(`search.json 已生成（${searchDocs.length} 篇）`);

// ---------- 短动态 notes.json（type: note 的文章独立流） ----------
const noteItems = posts
  .filter(p => p.type === 'note' && !p.draft)
  .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  .map(p => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    updated: p.updated,
    author: p.author,
    tags: p.tags || [],
    content: p.content,         // 短动态直接把正文打包进来，节省请求
  }));
writeFileSync('data/notes.json', JSON.stringify({
  generated: new Date().toISOString(),
  count: noteItems.length,
  notes: noteItems,
}, null, 2) + '\n');
console.log(`notes.json 已生成（${noteItems.length} 条）`);
function xmlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const baseUrl = SITE_URL || '';
const today = new Date().toISOString();

const urls = [
  { loc: baseUrl + '/', lastmod: today, changefreq: 'daily', priority: '1.0' },
  { loc: baseUrl + '/tags.html', lastmod: today, changefreq: 'weekly', priority: '0.8' },
  { loc: baseUrl + '/archives.html', lastmod: today, changefreq: 'weekly', priority: '0.7' },
  { loc: baseUrl + '/series.html', lastmod: today, changefreq: 'weekly', priority: '0.7' },
  { loc: baseUrl + '/tools.html', lastmod: today, changefreq: 'monthly', priority: '0.7' },
  { loc: baseUrl + '/tool-air-conditioner.html', lastmod: today, changefreq: 'monthly', priority: '0.6' },
  ...pages.filter(p => !p.draft).map(p => ({
    loc: `${baseUrl}/post.html?slug=${encodeURIComponent(p.slug)}`,
    lastmod: new Date(p.updated || p.date || today).toISOString(),
    changefreq: 'monthly',
    priority: '0.7',
  })),
  ...visiblePosts.map(p => ({
    loc: `${baseUrl}/post.html?slug=${encodeURIComponent(p.slug)}`,
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
writeFileSync('robots.txt', `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`);
console.log('robots.txt 已生成');

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
      src: 'assets/icon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    },
  ],
};
writeFileSync('manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest.webmanifest 已生成');

// ---------- rss.xml ----------
function escCdata(s) { return String(s == null ? '' : s).replace(/]]>/g, ']]]]><![CDATA[>'); }

const rssItems = visiblePosts.slice(0, 30).map(p => `    <item>
      <title>${xmlEsc(p.title)}</title>
      <link>${xmlEsc(`${baseUrl}/post.html?slug=${encodeURIComponent(p.slug)}`)}</link>
      <guid isPermaLink="false">${xmlEsc(p.slug)}</guid>
      <pubDate>${new Date(p.date || today).toUTCString()}</pubDate>
      <author>${xmlEsc(p.author || SITE_AUTHOR)}</author>
      ${(p.tags || []).map(t => `<category>${xmlEsc(t)}</category>`).join('')}
      <description><![CDATA[${escCdata(p.summary || '')}]]></description>
    </item>`).join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
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
for (const post of [...visiblePosts, ...pages.filter(p => !p.draft)]) {
  writeFileSync(join(OG_DIR, `${post.slug}.svg`), ogSvg(post));
}
console.log(`OG 分享图已生成：${visiblePosts.length + pages.filter(p => !p.draft).length} 张`);
