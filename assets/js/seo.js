// ============================================================================
// SEO / OG / Twitter Card 工具
// 用法：setMeta({ title, description, image, url, type, publishedTime, tags })
// ============================================================================

import { CONFIG } from './config.js';

function ensure(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(attrs.tag || 'meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'tag') continue;
    if (v == null || v === '') continue;
    el.setAttribute(k, v);
  }
  return el;
}

export function setMeta(opts = {}) {
  const site = CONFIG.site;
  const title = opts.title ? `${opts.title} · ${site.title}` : `${site.title} · ${site.subtitle || ''}`;
  const description = opts.description || site.description || '';
  const image = opts.image || site.avatar || '';
  const cleanHref = window.location.href.replace(/#.*$/, '');
  const url = opts.url || cleanHref;
  const type = opts.type || 'website';

  document.title = title;

  ensure('meta[name="description"]', { name: 'description', content: description });
  ensure('meta[name="author"]', { name: 'author', content: opts.author || site.author || '' });

  ensure('meta[property="og:title"]', { property: 'og:title', content: opts.title || site.title });
  ensure('meta[property="og:description"]', { property: 'og:description', content: description });
  ensure('meta[property="og:image"]', { property: 'og:image', content: image });
  ensure('meta[property="og:url"]', { property: 'og:url', content: url });
  ensure('meta[property="og:type"]', { property: 'og:type', content: type });
  ensure('meta[property="og:site_name"]', { property: 'og:site_name', content: site.title });
  ensure('meta[property="og:locale"]', { property: 'og:locale', content: site.locale || 'zh-CN' });

  ensure('meta[name="twitter:card"]', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
  ensure('meta[name="twitter:title"]', { name: 'twitter:title', content: opts.title || site.title });
  ensure('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  ensure('meta[name="twitter:image"]', { name: 'twitter:image', content: image });

  if (type === 'article') {
    if (opts.publishedTime) ensure('meta[property="article:published_time"]', { property: 'article:published_time', content: opts.publishedTime });
    if (opts.modifiedTime) ensure('meta[property="article:modified_time"]', { property: 'article:modified_time', content: opts.modifiedTime });
    if (opts.author) ensure('meta[property="article:author"]', { property: 'article:author', content: opts.author });
    (opts.tags || []).forEach((t, i) => {
      ensure(`meta[property="article:tag"][data-i="${i}"]`, { property: 'article:tag', content: t, 'data-i': i });
    });
  }

  ensure('link[rel="canonical"]', { tag: 'link', rel: 'canonical', href: url });
}

export function setJsonLd(data, id = 'jsonld-main') {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(stripUndefined(data), null, 2);
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
