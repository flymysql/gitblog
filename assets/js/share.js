// ============================================================================
// 分享 / 打赏 / 二维码
// 文章页底部插入一个分享卡，包括：
//   - 复制链接
//   - 微博 / Twitter / Telegram / 知乎卡片（直接跳转分享 URL）
//   - 一个 SVG 二维码（指向当前页面 URL）— 用 qrcode CDN 懒加载
//   - 可选打赏区（微信 / 支付宝 / PayPal）
//
// 二维码生成：用 qrcodejs2（CDN，纯前端、约 14KB），失败时降级为 text 显示
// ============================================================================

import { CONFIG } from './config.js';

const QRCODE_CDN = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';
let qrLoaded = null;
function loadQrcode() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrLoaded) return qrLoaded;
  qrLoaded = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = QRCODE_CDN;
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => reject(new Error('qrcode lib failed'));
    document.head.appendChild(s);
  });
  return qrLoaded;
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shareUrl() {
  return location.href.split('#')[0];
}
function shareTitle(post) {
  return (post && post.title) || document.title || CONFIG.site.title;
}

const PROVIDERS = [
  {
    id: 'weibo',
    label: '微博',
    href: (u, t) => `https://service.weibo.com/share/share.php?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t)}`,
  },
  {
    id: 'twitter',
    label: 'Twitter',
    href: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}`,
  },
  {
    id: 'douban',
    label: '豆瓣',
    href: (u, t) => `https://www.douban.com/share/service?href=${encodeURIComponent(u)}&name=${encodeURIComponent(t)}`,
  },
];

// 把 qrcode-generator 输出的 SVG 字符串嵌入指定容器
async function renderQrInto(container, text) {
  if (!container) return;
  try {
    await loadQrcode();
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    // 用 svg：尺寸 156，cellSize=4 ≈ 144 + 边距，与 PC 阅读距离扫描舒适
    const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    container.innerHTML = svg;
    const inner = container.querySelector('svg');
    if (inner) {
      inner.setAttribute('width', '148');
      inner.setAttribute('height', '148');
      inner.style.background = '#fff';
    }
  } catch (e) {
    container.textContent = text;
    container.style.fontSize = '11px';
    container.style.color = '#888';
  }
}

export function shareCardHtml(post) {
  const cfg = CONFIG.share || {};
  if (!cfg.enabled) return '';
  const isPage = post && post.page;
  if (isPage && !cfg.showInPages) return '';
  if (!isPage && cfg.showInPosts === false) return '';

  const title = shareTitle(post);
  const url = shareUrl();
  const providers = PROVIDERS.map(p => `
    <a class="article-share-btn" target="_blank" rel="noopener" href="${escapeAttr(p.href(url, title))}">
      ${escapeAttr(p.label)}
    </a>
  `).join('');

  const donate = CONFIG.donate || {};
  const donateBlocks = [];
  if (donate.enabled) {
    if (donate.wechat) donateBlocks.push({ label: '微信', src: donate.wechat });
    if (donate.alipay) donateBlocks.push({ label: '支付宝', src: donate.alipay });
  }
  const donateRow = donate.enabled ? `
    <div class="article-share-row" style="margin-top:14px;align-items:flex-start;">
      <span class="article-share-label">${escapeAttr(donate.title || '请作者一杯咖啡')}：</span>
      ${donateBlocks.map(b => `
        <figure style="margin:0;text-align:center;">
          <img src="${escapeAttr(b.src)}" alt="${escapeAttr(b.label)}" style="width:140px;height:140px;object-fit:contain;border:1px solid var(--border);border-radius:8px;background:#fff;padding:6px;">
          <figcaption style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">${escapeAttr(b.label)}</figcaption>
        </figure>
      `).join('')}
      ${donate.paypal ? `<a class="article-share-btn is-primary" target="_blank" rel="noopener" href="${escapeAttr(donate.paypal)}">PayPal 打赏</a>` : ''}
    </div>
  ` : '';

  const qrBlock = (cfg.qrcodeOfPage !== false) ? `
    <div class="article-share-qr">
      <div class="article-share-qr-canvas" data-qr-target></div>
      <div class="article-share-qr-info">
        扫码用手机继续阅读 / 转发本文<br>
        <code>${escapeAttr(url)}</code>
      </div>
    </div>
  ` : '';

  return `
    <section class="article-share">
      <div class="article-share-row">
        <span class="article-share-label">分享：</span>
        <button class="article-share-btn is-primary" type="button" data-share-copy>复制链接</button>
        ${navigator.share ? '<button class="article-share-btn" type="button" data-share-system>系统分享</button>' : ''}
        ${providers}
      </div>
      ${qrBlock}
      ${donateRow}
    </section>
  `;
}

export function bindShareCard(scope, post) {
  const card = (scope || document).querySelector('.article-share');
  if (!card) return;

  const url = shareUrl();
  const title = shareTitle(post);

  const copy = card.querySelector('[data-share-copy]');
  if (copy) {
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        copy.textContent = '已复制 ✓';
        setTimeout(() => { copy.textContent = '复制链接'; }, 1600);
      } catch {
        copy.textContent = '复制失败';
        setTimeout(() => { copy.textContent = '复制链接'; }, 1600);
      }
    });
  }
  const sys = card.querySelector('[data-share-system]');
  if (sys && navigator.share) {
    sys.addEventListener('click', () => {
      navigator.share({ title, url, text: title }).catch(() => {});
    });
  }
  const qr = card.querySelector('[data-qr-target]');
  if (qr) renderQrInto(qr, url);
}
