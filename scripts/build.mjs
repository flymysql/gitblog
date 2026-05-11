// 校验 + 重新生成 sitemap.xml 与 rss.xml
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

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

console.log('Site URL:', SITE_URL);

// ---------- 解析 frontmatter ----------
function parseFM(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { data: {}, content: text };
  const yaml = m[1];
  const content = text.slice(m[0].length);
  const data = {};
  for (const raw of yaml.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line || /^\s*#/.test(line)) continue;
    const mm = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
    if (!mm) continue;
    let v = mm[2];
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else if (v === 'true' || v === 'false') {
      v = v === 'true';
    } else if (!isNaN(Number(v)) && v.trim() !== '') {
      v = Number(v);
    }
    data[mm[1]] = v;
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
if (existsSync(POSTS_DIR)) {
  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const slug = basename(f, '.md');
    const raw = readFileSync(join(POSTS_DIR, f), 'utf8');
    const { data, content } = parseFM(raw);
    if (!data.title) errors.push(`[${f}] frontmatter 缺少 title`);
    if (!data.date) errors.push(`[${f}] frontmatter 缺少 date`);
    posts.push({
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
      path: `${POSTS_DIR}/${f}`,
      content,
    });
  }
}

if (errors.length) {
  console.log('Frontmatter 校验警告：');
  for (const e of errors) console.log('  -', e);
}

// 重建索引（不包含 content 字段）
posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
const indexJson = {
  posts: posts.map(p => {
    const { content, ...rest } = p;
    if (!rest.cover) delete rest.cover;
    if (!rest.draft) delete rest.draft;
    if (!rest.pinned) delete rest.pinned;
    return rest;
  }),
};
writeFileSync(INDEX_FILE, JSON.stringify(indexJson, null, 2) + '\n');
console.log(`索引已重建：${indexJson.posts.length} 篇文章`);

// ---------- sitemap.xml ----------
const visiblePosts = posts.filter(p => !p.draft);
function xmlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const baseUrl = SITE_URL || '';
const today = new Date().toISOString();

const urls = [
  { loc: baseUrl + '/', lastmod: today, changefreq: 'daily', priority: '1.0' },
  { loc: baseUrl + '/tags.html', lastmod: today, changefreq: 'weekly', priority: '0.8' },
  { loc: baseUrl + '/archives.html', lastmod: today, changefreq: 'weekly', priority: '0.7' },
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
