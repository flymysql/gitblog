/** 生成独立工具页 HTML 壳（构建脚本 / 手工维护共用模板） */
function htmlEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toolOgMetaHtml({ title, description, path, ogSlug, siteUrl }) {
  if (!ogSlug || !siteUrl) return '';
  const pageUrl = `${siteUrl.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
  const image = `${siteUrl.replace(/\/$/, '')}/assets/og/${ogSlug}.png`;
  return `
  <meta property="og:title" content="${htmlEsc(title)}">
  <meta property="og:description" content="${htmlEsc(description)}">
  <meta property="og:image" content="${htmlEsc(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${htmlEsc(pageUrl)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${htmlEsc(title)}">
  <meta name="twitter:description" content="${htmlEsc(description)}">
  <meta name="twitter:image" content="${htmlEsc(image)}">`;
}

export function toolPageHtml({ title, description, eyebrow, h1, lead, body, script, commentsHint, hideGlobalComments = false, hideToolActions = false, ogSlug = '', siteUrl = '', pagePath = '' }) {
  const v = '20260622140000';
  const giscusTerm = String(script || '').replace(/\.js$/i, '');
  const hint = commentsHint || '使用体验、bug 反馈或建议，欢迎留言。';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="referrer" content="no-referrer-when-downgrade">
  <title>${title} · 加载中…</title>
  <meta name="description" content="${description}">${toolOgMetaHtml({ title, description, path: pagePath || `tools/${String(script || '').replace(/\.js$/i, '')}.html`, ogSlug, siteUrl })}
  <link rel="alternate" type="application/rss+xml" title="RSS" href="/rss.xml">
  <link rel="stylesheet" href="/assets/css/common.css?v=${v}">
  <link rel="stylesheet" href="/assets/css/tools.css?v=${v}">
  <script>(function(){var s=localStorage;var t=s.getItem('blog_theme')||'auto';var d=t==='auto'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var p=s.getItem('blog_preset')||'jianshu';var h=document.documentElement;h.setAttribute('data-preset',p);h.setAttribute('data-mode',d);h.setAttribute('data-theme',d);h.dataset.themeChoice=t;})();</script>
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#ea6f5a">
  <link rel="apple-touch-icon" href="/assets/icon.svg">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
</head>
<body>
  <div id="site-nav"></div>
  <main class="tool-kit-page tool-single-page">
    <section class="tool-kit-hero">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${h1}</h1>
      <p>${lead}</p>
    </section>
    <div class="tool-kit-panels">
      ${body}
    </div>
    ${hideGlobalComments ? '' : `<section class="tool-comments" id="toolComments">
      <h2>评论</h2>
      <p>${hint}</p>
      <div id="toolGiscus"></div>
    </section>`}
    ${hideToolActions ? '' : `<section class="tool-actions">
      <a class="btn-home" href="/">返回首页</a>
      <a class="btn-ghost" href="/tools/">查看工具箱</a>
    </section>`}
  </main>
  <script type="application/json" id="toolPageMeta">${JSON.stringify({ giscusTerm })}</script>
  <div id="site-footer"></div>
  <div id="site-overlays"></div>
  <script type="module" src="/assets/js/${script}?v=${v}"></script>
</body>
</html>
`;
};
