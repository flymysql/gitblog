/**
 * 文章封面 OG 卡片：SVG 模板 + WebP 编码（目标 < maxBytes）
 */
import sharp from 'sharp';

export function svgEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function wrapText(text, max = 18, lines = 3) {
  const chars = [...String(text || '')];
  const out = [];
  for (let i = 0; i < chars.length && out.length < lines; i += max) {
    out.push(chars.slice(i, i + max).join(''));
  }
  if (chars.length > max * lines && out.length) {
    out[out.length - 1] = out[out.length - 1].replace(/.{1,2}$/, '…');
  }
  return out;
}

export function postCoverOgSvg(post, { siteTitle, siteDesc, siteAuthor } = {}) {
  const title = siteTitle || 'Blog';
  const desc = siteDesc || '';
  const author = siteAuthor || '';
  const titleLines = wrapText(post.title || title, 18, 3);
  const tags = (post.tags || []).slice(0, 3).map(t => `#${t}`).join('  ');
  const subtitle = tags || desc || title;
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
  <text x="120" y="142" fill="#ea6f5a" font-size="30" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(title)}</text>
  ${titleLines.map((line, i) => `<text x="120" y="${240 + i * 78}" fill="#222" font-size="58" font-weight="800" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(line)}</text>`).join('\n  ')}
  <text x="120" y="500" fill="#777" font-size="28" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(subtitle)}</text>
  <text x="1080" y="500" text-anchor="end" fill="#999" font-size="24" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(author)}</text>
</svg>`;
}

/** 将 OG SVG 编码为 WebP，尽量保持质量且不超过 maxBytes */
export async function encodeCoverWebp(svg, { maxBytes = 30 * 1024, width = 1200, height = 630 } = {}) {
  const input = Buffer.from(svg);
  for (let quality = 85; quality >= 40; quality -= 5) {
    const buf = await sharp(input)
      .resize(width, height, { fit: 'cover' })
      .webp({ quality, effort: 4 })
      .toBuffer();
    if (buf.length <= maxBytes) return { buf, quality, bytes: buf.length };
  }
  const buf = await sharp(input)
    .resize(Math.round(width * 0.75), Math.round(height * 0.75), { fit: 'cover' })
    .webp({ quality: 60, effort: 4 })
    .toBuffer();
  if (buf.length > maxBytes) {
    throw new Error(`无法将封面压缩到 ${maxBytes} 字节以内（当前 ${buf.length}）`);
  }
  return { buf, quality: 60, bytes: buf.length };
}
