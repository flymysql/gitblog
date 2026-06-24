/** 工具页 OG 分享图（SVG → build 转 PNG，供微信等平台抓取） */

function svgEsc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapText(text, max = 16, lines = 2) {
  const chars = [...String(text || '')];
  const out = [];
  for (let i = 0; i < chars.length && out.length < lines; i += max) {
    out.push(chars.slice(i, i + max).join(''));
  }
  if (chars.length > max * lines && out.length) {
    out[out.length - 1] = `${out[out.length - 1].slice(0, -1)}…`;
  }
  return out;
}

/** 学士帽矢量图（居中偏右，作为分享图主视觉） */
function graduationCapSvg(cx = 900, cy = 250, scale = 1) {
  const s = scale;
  return `<g transform="translate(${cx} ${cy}) scale(${s})" aria-hidden="true">
    <polygon points="0,-108 172,0 0,108 -172,0" fill="#242424"/>
    <polygon points="0,-96 150,0 0,96 -150,0" fill="#2f2f2f"/>
    <rect x="-86" y="92" width="172" height="40" rx="8" fill="#242424"/>
    <rect x="-78" y="100" width="156" height="24" rx="6" fill="#3a3a3a"/>
    <circle cx="118" cy="-18" r="9" fill="#ea6f5a"/>
    <path d="M118 -18 C132 36 128 96 122 148" stroke="#ea6f5a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="122" cy="154" r="16" fill="#ea6f5a"/>
    <circle cx="122" cy="154" r="9" fill="#ff8f7a"/>
  </g>`;
}

export function majorQuizOgSvg({
  title = '大学专业倾向测评',
  subtitle = '兴趣、能力与规划问卷',
  siteTitle = '',
  author = '',
} = {}) {
  const titleLines = wrapText(title, 14, 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f6f9ff"/>
      <stop offset="48%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#ffe8e0"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#d35f4a" flood-opacity="0.16"/>
    </filter>
    <filter id="capShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="90" r="150" fill="#ea6f5a" opacity="0.10"/>
  <circle cx="140" cy="540" r="190" fill="#7eb6ff" opacity="0.12"/>
  <rect x="74" y="74" width="1052" height="482" rx="34" fill="#fff" filter="url(#shadow)"/>
  <text x="120" y="142" fill="#ea6f5a" font-size="30" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(siteTitle)}</text>
  ${titleLines.map((line, i) => `<text x="120" y="${248 + i * 72}" fill="#222" font-size="52" font-weight="800" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(line)}</text>`).join('\n  ')}
  <text x="120" y="430" fill="#666" font-size="28" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(subtitle)}</text>
  <g filter="url(#capShadow)">${graduationCapSvg(960, 268, 1.22)}</g>
  <text x="1080" y="500" text-anchor="end" fill="#999" font-size="24" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans SC',sans-serif">${svgEsc(author)}</text>
</svg>`;
}
