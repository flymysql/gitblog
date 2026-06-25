/**
 * 封面插画共享视觉层：大气渐变、景深、柔光、装饰元素
 */
export const W = 1200;
export const H = 630;

export const PALETTES = {
  warm: {
    skyTop: '#fff8f2', skyMid: '#ffe8dc', skyBot: '#ffd4c4',
    accent: '#e86f5a', accent2: '#f4a574', ground: '#c8e0b8', mist: '#fff0e8',
  },
  cool: {
    skyTop: '#f4f8ff', skyMid: '#dce8f8', skyBot: '#b8d4f0',
    accent: '#4a8fe8', accent2: '#7eb8f0', ground: '#8ab0c8', mist: '#eef4ff',
  },
  green: {
    skyTop: '#f6fcf4', skyMid: '#dff0d8', skyBot: '#b8ddb0',
    accent: '#3d9e6a', accent2: '#6bc48a', ground: '#7ab86a', mist: '#f0faf0',
  },
  dusk: {
    skyTop: '#3a2858', skyMid: '#5a4078', skyBot: '#8a6098',
    accent: '#f0a878', accent2: '#e87898', ground: '#2a3848', mist: '#6a5088',
  },
  gold: {
    skyTop: '#fffaf0', skyMid: '#f8e8c0', skyBot: '#e8c888',
    accent: '#d49030', accent2: '#f0b850', ground: '#a8c080', mist: '#fff8e8',
  },
  snow: {
    skyTop: '#f4f8fc', skyMid: '#dce8f4', skyBot: '#b0c8e0',
    accent: '#68a8e0', accent2: '#98c8f0', ground: '#e8f0f8', mist: '#f8fcff',
  },
};

function svgDefs(p) {
  const { skyTop, skyMid, skyBot, accent, accent2, mist } = p;
  return `
    <linearGradient id="sky" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="${skyTop}"/>
      <stop offset="45%" stop-color="${skyMid}"/>
      <stop offset="100%" stop-color="${skyBot}"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent2}" stop-opacity="0.55"/>
      <stop offset="70%" stop-color="${accent}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="groundFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${mist}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${mist}" stop-opacity="0.65"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="72%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#1a1020" stop-opacity="0.22"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0.72"/>
    </linearGradient>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#2a2030" flood-opacity="0.16"/>
    </filter>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#304050" flood-opacity="0.14"/>
    </filter>
    <filter id="blur4"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="blur20"><feGaussianBlur stdDeviation="20"/></filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.035"/></feComponentTransfer>
    </filter>
  `;
}

export function wrap(svgBody, palette) {
  const p = { ...PALETTES.warm, ...palette };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${svgDefs(p)}</defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${ambientLayer(p)}
  ${svgBody}
  <rect width="${W}" height="${H}" fill="url(#vignette)" pointer-events="none"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.45" pointer-events="none"/>
</svg>`;
}

function ambientLayer(p) {
  return `
  <ellipse cx="1020" cy="110" rx="300" ry="200" fill="url(#orbGlow)"/>
  <ellipse cx="120" cy="520" rx="220" ry="140" fill="url(#orbGlow)" opacity="0.5"/>
  <rect x="0" y="${H - 120}" width="${W}" height="120" fill="url(#groundFade)"/>
  `;
}

/** 多层远山剪影 */
export function layeredHills(layers, baseY = 380) {
  return layers.map((layer, i) => {
    const y = baseY - i * 35;
    const op = 0.25 + (layers.length - i) * 0.12;
    const pts = layer.points || `0,${y + 60} 300,${y - 20} 600,${y + 40} 900,${y - 10} 1200,${y + 30} 1200,${H} 0,${H}`;
    return `<path d="M${pts}Z" fill="${layer.color}" opacity="${op}"/>`;
  }).join('');
}

/** 柔和太阳光晕 */
export function softSun(cx, cy, r, color = '#ffe8a0') {
  return `
  <circle cx="${cx}" cy="${cy}" r="${r * 2.2}" fill="${color}" opacity="0.18" filter="url(#blur20)"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 1.4}" fill="${color}" opacity="0.35" filter="url(#blur8)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.92"/>
  `;
}

/** 蓬松云朵 */
export function cloud(cx, cy, scale = 1, opacity = 0.85) {
  const s = scale;
  return `<g opacity="${opacity}" filter="url(#blur4)">
    <ellipse cx="${cx}" cy="${cy}" rx="${55 * s}" ry="${28 * s}" fill="#fff"/>
    <ellipse cx="${cx - 35 * s}" cy="${cy + 8 * s}" rx="${38 * s}" ry="${22 * s}" fill="#fff"/>
    <ellipse cx="${cx + 40 * s}" cy="${cy + 5 * s}" rx="${42 * s}" ry="${24 * s}" fill="#fff"/>
  </g>`;
}

/** 散景光点 */
export function bokeh(seed, count = 18) {
  let h = seed || 1;
  const rnd = () => { h = (h * 16807 + 0) % 2147483647; return h / 2147483647; };
  return Array.from({ length: count }, (_, i) => {
    const x = rnd() * W;
    const y = rnd() * H * 0.75;
    const r = 3 + rnd() * 12;
    const op = 0.08 + rnd() * 0.18;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="${op.toFixed(2)}"/>`;
  }).join('');
}

/** 毛玻璃卡片 */
export function glassCard(x, y, w, h, rx = 20, extra = '') {
  return `
  <g filter="url(#cardShadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#glass)" stroke="#fff" stroke-width="1.5" opacity="0.95"/>
    ${extra}
  </g>`;
}

/** 简约树木 */
export function tree(x, baseY, scale = 1, hue = '#4a9e42') {
  const s = scale;
  const trunk = `#${['6a5038', '7a6040', '5a4830'][Math.floor(x) % 3]}`;
  return `
  <rect x="${x + 10 * s}" y="${baseY - 70 * s}" width="${10 * s}" height="${75 * s}" rx="3" fill="${trunk}"/>
  <ellipse cx="${x + 15 * s}" cy="${baseY - 95 * s}" rx="${38 * s}" ry="${48 * s}" fill="${hue}"/>
  <ellipse cx="${x - 5 * s}" cy="${baseY - 75 * s}" rx="${26 * s}" ry="${32 * s}" fill="${hue}" opacity="0.75"/>
  <ellipse cx="${x + 32 * s}" cy="${baseY - 80 * s}" rx="${24 * s}" ry="${30 * s}" fill="${hue}" opacity="0.7"/>
  `;
}

/** 水面倒影（简化） */
export function waterReflection(baseY, color, opacity = 0.35) {
  return `
  <ellipse cx="600" cy="${baseY + 25}" rx="520" ry="35" fill="${color}" opacity="${opacity}"/>
  <ellipse cx="600" cy="${baseY + 40}" rx="460" ry="18" fill="#fff" opacity="${opacity * 0.4}"/>
  `;
}

/** 开放书本 */
export function openBook(cx, cy, scale = 1, accent = '#e86f5a') {
  const s = scale;
  return `
  <g transform="translate(${cx}, ${cy}) scale(${s})" filter="url(#softShadow)">
    <path d="M0,0 Q-80,-10 -120,60 L-120,200 Q-80,170 0,185Z" fill="#fff" stroke="${accent}" stroke-width="1.5" opacity="0.95"/>
    <path d="M0,0 Q80,-10 120,60 L120,200 Q80,170 0,185Z" fill="#fffaf5" stroke="${accent}" stroke-width="1.5" opacity="0.95"/>
    ${[0, 1, 2, 3, 4].map(i => `<line x1="${-90 + i * 8}" y1="${70 + i * 22}" x2="${-20}" y2="${65 + i * 22}" stroke="#e8dcd0" stroke-width="1.5" opacity="0.7"/>`).join('')}
    ${[0, 1, 2, 3].map(i => `<line x1="20" y1="${70 + i * 24}" x2="95" y2="${68 + i * 24}" stroke="#e8dcd0" stroke-width="1.5" opacity="0.7"/>`).join('')}
    <path d="M0,0 L0,185" stroke="${accent}" stroke-width="2" opacity="0.35"/>
  </g>`;
}

/** 钢笔 */
export function fountainPen(x, y, rot = -25, color = '#3a4858') {
  return `<g transform="translate(${x},${y}) rotate(${rot})">
    <rect x="0" y="0" width="8" height="70" rx="3" fill="${color}"/>
    <polygon points="4,70 0,95 8,95" fill="${color}"/>
    <rect x="1" y="-25" width="6" height="28" rx="2" fill="#c8a050"/>
  </g>`;
}
