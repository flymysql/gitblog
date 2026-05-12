import { initSite } from './site.js';
import { setMeta, setJsonLd } from './seo.js';
import { CONFIG } from './config.js';

initSite({ active: 'tools.html' });

setMeta({
  title: '工具',
  description: '一些轻量、有趣、实用的小网页工具。',
  type: 'website',
});

setJsonLd({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: '小网页工具',
  description: '一些轻量、有趣、实用的小网页工具。',
  url: `${CONFIG.site.url || location.origin}/tools.html`,
});
