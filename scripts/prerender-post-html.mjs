// 构建期生成可爬取的文章 HTML（正文 + head 内 SEO 元数据）
import { load as loadHtml } from 'cheerio';
import { renderMarkdown, escapeHtml } from './markdown-render.mjs';
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { thumbPathFor, normalizeLocalImagePath } from './thumbnail-lib.mjs';

const TAG_PALETTE = [
  { bg: '#FFE8E3', text: '#C44732', border: '#F7C5BA', darkBg: '#3A211D', darkText: '#FFB2A3', darkBorder: '#6F3B32' },
  { bg: '#E8F1FF', text: '#1E5AA8', border: '#BFD6FA', darkBg: '#152842', darkText: '#9EC8FF', darkBorder: '#31537A' },
  { bg: '#E8F8EE', text: '#1E7A43', border: '#BDE8CC', darkBg: '#153321', darkText: '#91E4AE', darkBorder: '#2F6A43' },
  { bg: '#FFF4D8', text: '#936018', border: '#F2D38A', darkBg: '#382A12', darkText: '#F4C76F', darkBorder: '#735421' },
  { bg: '#F0E9FF', text: '#6843B5', border: '#D7C6F6', darkBg: '#271E3F', darkText: '#C5B2FF', darkBorder: '#55427F' },
  { bg: '#E6FAFA', text: '#167A7F', border: '#B8E7E8', darkBg: '#123638', darkText: '#8EE2E5', darkBorder: '#2B6E72' },
  { bg: '#FCE8F3', text: '#A33B72', border: '#F2B9D8', darkBg: '#381B2C', darkText: '#F7A6CE', darkBorder: '#753858' },
  { bg: '#EEF0F3', text: '#4B5563', border: '#D5DAE1', darkBg: '#252A33', darkText: '#CBD5E1', darkBorder: '#47515F' },
];

function tagHash(tag) {
  let h = 0;
  const s = String(tag || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function tagStyle(tag) {
  const c = TAG_PALETTE[tagHash(tag) % TAG_PALETTE.length];
  return `--tag-bg:${c.bg};--tag-text:${c.text};--tag-border:${c.border};--tag-dark-bg:${c.darkBg};--tag-dark-text:${c.darkText};--tag-dark-border:${c.darkBorder};`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readingMinutes(text) {
  const s = String(text || '');
  const cn = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
  const en = (s.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_]+/g) || []).length;
  return Math.max(1, Math.round(cn / 350 + en / 250));
}

function rootHref(sitePathPrefix, relPath) {
  const p = String(relPath || '').replace(/^\/+/, '');
  if (!sitePathPrefix) return `/${p}`;
  return `${sitePathPrefix.replace(/\/+$/, '')}/${p}`.replace(/\/{2,}/g, '/');
}

function publicImageUrl(url, sitePathPrefix, siteOrigin) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('//')) return s;
  if (s.startsWith('data:') || s.startsWith('blob:')) return s;
  let rel = s.replace(/^\.\//, '').replace(/^\/+/, '');
  while (rel.startsWith('../')) rel = rel.slice(3);
  if (rel.startsWith('assets/') || rel.startsWith('posts/')) {
    return rootHref(sitePathPrefix, rel);
  }
  return s;
}

/** 微信 / OG 爬虫需要绝对 HTTPS 地址，相对路径会退化为默认链接图标 */
function absolutePublicUrl(url, sitePathPrefix, siteOrigin) {
  const path = publicImageUrl(url, sitePathPrefix, siteOrigin);
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('//')) return path;
  const origin = String(siteOrigin || '').replace(/\/+$/, '');
  if (!origin) return path;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function tagHtml(tag, href, sitePathPrefix) {
  const body = escapeHtml(tag);
  const attrs = `class="tag tag-colored" style="${tagStyle(tag)}"`;
  if (href) return `<a ${attrs} href="${escapeHtml(href)}">${body}</a>`;
  return `<span ${attrs}>${body}</span>`;
}

const _imgMetaCache = new Map();
async function localImageMeta(src) {
  // src: markdown 原始图片地址。仅本地图片（assets/ 或 posts/）能读到尺寸，远程图跳过。
  let rel = String(src || '').trim().split('?')[0].split('#')[0];
  if (!rel || /^https?:\/\//i.test(rel) || rel.startsWith('//') || rel.startsWith('data:') || rel.startsWith('blob:')) return null;
  rel = rel.replace(/^\.\//, '').replace(/^\/+/, '');
  while (rel.startsWith('../')) rel = rel.slice(3);
  if (!rel.startsWith('assets/') && !rel.startsWith('posts/')) return null;
  if (_imgMetaCache.has(rel)) return _imgMetaCache.get(rel);
  let result = null;
  try {
    const meta = await sharp(rel).metadata();
    if (meta.width && meta.height) result = { width: meta.width, height: meta.height };
  } catch {}
  _imgMetaCache.set(rel, result);
  return result;
}

async function fixContentAssetUrls(html, sitePathPrefix, siteOrigin) {
  const $ = loadHtml(`<div id="wrap">${html}</div>`, null, false);
  const root = $('#wrap');
  const imgEls = [];
  root.find('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    const fixed = publicImageUrl(src, sitePathPrefix, siteOrigin);
    if (fixed) $(el).attr('src', fixed);
    imgEls.push({ el, src });
  });
  for (const { el, src } of imgEls) {
    const meta = await localImageMeta(src);
    if (meta) {
      $(el).attr('width', String(meta.width));
      $(el).attr('height', String(meta.height));
    }
    if (!$(el).attr('loading')) $(el).attr('loading', 'lazy');
    if (!$(el).attr('decoding')) $(el).attr('decoding', 'async');
    const fixedFull = publicImageUrl(src, sitePathPrefix, siteOrigin);
    if (fixedFull) {
      $(el).attr('data-full-src', fixedFull);
      const local = normalizeLocalImagePath(src);
      const thumbLocal = local && existsSync(thumbPathFor(local)) ? thumbPathFor(local) : null;
      if (thumbLocal) {
        const thumbUrl = publicImageUrl(thumbLocal, sitePathPrefix, siteOrigin);
        $(el).attr('data-thumb', thumbUrl);
        $(el).attr('src', thumbUrl);
      } else {
        $(el).attr('src', fixedFull);
      }
      $(el).addClass('progressive-img');
    }
  }
  root.find('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || /^https?:\/\//i.test(href)) return;
    let rel = href.replace(/^\.\//, '').replace(/^\/+/, '');
    while (rel.startsWith('../')) rel = rel.slice(3);
    if (rel.startsWith('assets/') || rel.startsWith('posts/')) {
      $(el).attr('href', rootHref(sitePathPrefix, rel));
    }
  });
  return root.html() || '';
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

function buildMetaHead({
  title,
  description,
  image,
  canonical,
  author,
  date,
  updated,
  tags,
  site,
  ogImageWidth,
  ogImageHeight,
  homeUrl,
}) {
  const lines = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="author" content="${escapeHtml(author)}">`,
    `<meta name="robots" content="index, follow">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="${escapeHtml(site.title)}">`,
    `<meta property="og:locale" content="${escapeHtml(site.locale || 'zh-CN')}">`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
  ];
  if (ogImageWidth) lines.push(`<meta property="og:image:width" content="${ogImageWidth}">`);
  if (ogImageHeight) lines.push(`<meta property="og:image:height" content="${ogImageHeight}">`);
  if (date) lines.push(`<meta property="article:published_time" content="${escapeHtml(date)}">`);
  if (updated) lines.push(`<meta property="article:modified_time" content="${escapeHtml(updated)}">`);
  if (author) lines.push(`<meta property="article:author" content="${escapeHtml(author)}">`);
  (tags || []).forEach(t => {
    lines.push(`<meta property="article:tag" content="${escapeHtml(t)}">`);
  });
  const jsonLd = stripUndefined({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    image,
    datePublished: date,
    dateModified: updated || date,
    author: { '@type': 'Person', name: author },
    publisher: {
      '@type': 'Organization',
      name: site.title,
      logo: site.logo || site.avatar ? { '@type': 'ImageObject', url: site.logo || site.avatar } : undefined,
    },
    mainEntityOfPage: canonical,
    keywords: (tags || []).join(','),
  });
  lines.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);
  if (homeUrl) {
    const crumbs = [{ '@type': 'ListItem', position: 1, name: '首页', item: homeUrl }];
    const firstTag = (tags || [])[0];
    if (firstTag) crumbs.push({ '@type': 'ListItem', position: 2, name: firstTag, item: `${homeUrl}tags.html#${encodeURIComponent(firstTag)}` });
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: title, item: canonical });
    const breadcrumb = stripUndefined({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs });
    lines.push(`<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`);
  }
  return lines.join('\n  ');
}

function buildShareCardHtml({ canonical, title, shareCfg, donateCfg, sitePathPrefix }) {
  if (!shareCfg || !shareCfg.enabled) return '';
  const providers = [
    { label: '微博', href: `https://service.weibo.com/share/share.php?url=${encodeURIComponent(canonical)}&title=${encodeURIComponent(title)}` },
    { label: 'Twitter', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(title)}` },
    { label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(canonical)}&text=${encodeURIComponent(title)}` },
    { label: '豆瓣', href: `https://www.douban.com/share/service?href=${encodeURIComponent(canonical)}&name=${encodeURIComponent(title)}` },
  ];
  const providerBtns = providers.map(p =>
    `<a class="article-share-btn" target="_blank" rel="noopener" href="${escapeHtml(p.href)}">${escapeHtml(p.label)}</a>`
  ).join('');
  const qrBlock = shareCfg.qrcodeOfPage !== false ? `
    <div class="article-share-qr">
      <div class="article-share-qr-canvas" data-qr-target></div>
      <div class="article-share-qr-info">
        扫码用手机继续阅读 / 转发本文<br>
        <code>${escapeHtml(canonical)}</code>
      </div>
    </div>
  ` : '';
  let donateRow = '';
  if (donateCfg && donateCfg.enabled) {
    const blocks = [];
    if (donateCfg.wechat) blocks.push({ label: '微信', src: donateCfg.wechat });
    if (donateCfg.alipay) blocks.push({ label: '支付宝', src: donateCfg.alipay });
    donateRow = `
      <div class="article-share-row" style="margin-top:14px;align-items:flex-start;">
        <span class="article-share-label">${escapeHtml(donateCfg.title || '请作者一杯咖啡')}：</span>
        ${blocks.map(b => `
          <figure style="margin:0;text-align:center;">
            <img src="${escapeHtml(publicImageUrl(b.src, sitePathPrefix))}" alt="${escapeHtml(b.label)}" style="width:140px;height:140px;object-fit:contain;border:1px solid var(--border);border-radius:8px;background:#fff;padding:6px;">
            <figcaption style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">${escapeHtml(b.label)}</figcaption>
          </figure>
        `).join('')}
        ${donateCfg.paypal ? `<a class="article-share-btn is-primary" target="_blank" rel="noopener" href="${escapeHtml(donateCfg.paypal)}">PayPal 打赏</a>` : ''}
      </div>
    `;
  }
  return `
    <section class="article-share">
      <div class="article-share-row">
        <span class="article-share-label">分享：</span>
        <button class="article-share-btn is-primary" type="button" data-share-copy>复制链接</button>
        ${providerBtns}
      </div>
      ${qrBlock}
      ${donateRow}
    </section>
  `;
}

function buildPagePvHtml(pageviewsCfg) {
  const cfg = pageviewsCfg || {};
  if (cfg.enabled === false || cfg.showPostViews === false) return '';
  const provider = String(cfg.provider || 'third-party').trim().toLowerCase();
  const label = String(cfg.label || (cfg.vercount || {}).label || '阅读').trim() || '阅读';
  if (provider === 'cloudbase') {
    return `<span class="dot"></span><span class="gitblog-pv-inline"><span class="gitblog-pv-prefix">${escapeHtml(label)} </span><span id="gitblog_page_pv">…</span><span class="gitblog-pv-suffix"> 次</span></span>`;
  }
  return `<span class="dot"></span><span class="vercount-inline"><span class="vercount-prefix">${escapeHtml(label)} </span><span id="vercount_value_page_pv">…</span><span class="vercount-suffix"> 次</span></span>`;
}

export async function buildArticleInnerHtml({
  post,
  fmData,
  content,
  sitePathPrefix,
  siteOrigin,
  site,
  shareCfg,
  donateCfg,
  pageviewsCfg,
}) {
  const slug = post.slug;
  const title = post.title || fmData.title || '无标题';
  const date = post.date || fmData.date || '';
  const updated = post.updated || fmData.updated || date;
  const author = post.author || fmData.author || site.author;
  const avatar = publicImageUrl(post.avatar || fmData.avatar || site.avatar, sitePathPrefix, siteOrigin);
  const cover = publicImageUrl(post.cover || fmData.cover || '', sitePathPrefix, siteOrigin);
  const tags = post.tags || fmData.tags || [];
  const canonical = post.canonical || '';
  const tagsBase = rootHref(sitePathPrefix, 'tags.html');

  let bodyHtml = await fixContentAssetUrls(renderMarkdown(content), sitePathPrefix, siteOrigin);
  const mins = readingMinutes(content);
  const tagTop = tags.length
    ? `<div class="article-tags-top">${tags.map(t => tagHtml(t, `${tagsBase}#${encodeURIComponent(t)}`, sitePathPrefix)).join('')}</div>`
    : '';
  const tagFoot = tags.length
    ? `<footer class="article-footer"><div class="article-tags">${tags.map(t => tagHtml(t, `${tagsBase}#${encodeURIComponent(t)}`, sitePathPrefix)).join('')}</div></footer>`
    : '';
  const share = buildShareCardHtml({ canonical, title, shareCfg, donateCfg, sitePathPrefix });
  const editHref = `${rootHref(sitePathPrefix, 'admin/editor.html')}?slug=${encodeURIComponent(slug)}`;

  return `
    <header class="article-header">
      ${tagTop}
      <h1 class="article-title">${escapeHtml(title)}</h1>
      <div class="article-author">
        <div class="avatar" style="background-image:url(${escapeHtml(avatar || '')})"></div>
        <div class="info">
          <div class="name">${escapeHtml(author)}</div>
          <div class="meta">
            <span>${fmtDate(date)}</span>
            ${updated && updated !== date ? `<span class="dot"></span><span>更新于 ${fmtDate(updated)}</span>` : ''}
            <span class="dot"></span>
            <span>${(content || '').length} 字</span>
            <span class="dot"></span>
            <span class="meta-read-mins">约 ${mins} 分钟</span>
            ${buildPagePvHtml(pageviewsCfg)}
          </div>
        </div>
        <a class="article-edit" href="${escapeHtml(editHref)}" title="编辑此文">编辑</a>
      </div>
    </header>
    <div class="article-body">${bodyHtml}</div>
    ${tagFoot}
    ${share}
  `.trim();
}

export async function buildPrerenderedPostHtml({
  post,
  fmData,
  content,
  sitePathPrefix,
  siteOrigin,
  site,
  shareCfg,
  donateCfg,
  pageviewsCfg,
  postShellTemplate,
}) {
  const slug = post.slug;
  const title = post.title || fmData.title || '无标题';
  const date = post.date || fmData.date || '';
  const updated = post.updated || fmData.updated || date;
  const author = post.author || fmData.author || site.author;
  const coverRaw = post.cover || fmData.cover || '';
  const coverAbs = absolutePublicUrl(coverRaw, sitePathPrefix, siteOrigin);
  const tags = post.tags || fmData.tags || [];
  const summary = post.summary || fmData.summary || '';
  const canonical = post.canonical || '';
  const ogAuto = `${siteOrigin}${rootHref(sitePathPrefix, `assets/og/${encodeURIComponent(slug)}.png`)}`;
  const image = coverAbs || ogAuto || absolutePublicUrl(site.avatar || '', sitePathPrefix, siteOrigin) || '';

  let ogImageWidth = 0;
  let ogImageHeight = 0;
  if (image === ogAuto) {
    ogImageWidth = 1200;
    ogImageHeight = 630;
  } else if (coverRaw) {
    const m = await localImageMeta(coverRaw);
    if (m) { ogImageWidth = m.width; ogImageHeight = m.height; }
  }
  const homeUrl = (siteOrigin + rootHref(sitePathPrefix, '')).replace(/\/$/, '') + '/';

  const metaHead = buildMetaHead({
    title,
    description: summary,
    image,
    canonical,
    author,
    date,
    updated,
    tags,
    site,
    ogImageWidth,
    ogImageHeight,
    homeUrl,
  });

  const articleInner = await buildArticleInnerHtml({
    post,
    fmData,
    content,
    sitePathPrefix,
    siteOrigin,
    site,
    shareCfg,
    donateCfg,
    pageviewsCfg,
  });

  const assets = rootHref(sitePathPrefix, 'assets');
  let html = postShellTemplate
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(`${title} · ${site.title}`)}</title>`)
    .replace(
      /<article class="article" id="article">[\s\S]*?<\/article>/,
      `<article class="article is-prerendered" id="article" data-prerendered="1" data-slug="${escapeHtml(slug)}">\n      ${articleInner}\n    </article>`
    );

  // 移除壳里的 noindex（post.html fallback 专用），预渲染产物用 buildMetaHead 的 index,follow
  html = html.replace(/<meta\s+name="robots"\s+content="noindex">\s*\n?\s*/g, '');

  // 在 theme bootstrap 之后插入 SEO 元数据
  html = html.replace(
    /(<meta name="apple-mobile-web-app-capable" content="yes">)/,
    `$1\n  ${metaHead}`
  );

  return html;
}
