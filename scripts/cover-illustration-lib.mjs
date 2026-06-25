/**
 * 文章主题插画封面：根据标题/摘要/标签匹配场景，生成无大段文字的 SVG 插画
 */
import {
  W, H, PALETTES, wrap, layeredHills, softSun, cloud, bokeh,
  glassCard, tree, waterReflection, openBook, fountainPen,
} from './cover-illustration-helpers.mjs';

/** @typedef {{ slug?: string, title?: string, summary?: string, tags?: string[], series?: string }} PostMeta */

const THEME_RULES = [
  { id: 'recommendation', score: 10, patterns: [/推荐召回|向量召回|u2i|u2u|矩阵分解|协同过滤/i] },
  { id: 'farm-game', score: 12, patterns: [/农场|收菜|偷菜|种菜|挂机/i] },
  { id: 'compiler', score: 10, patterns: [/编译器|pcc|汇编|词法|语法分析/i] },
  { id: 'sql-db', score: 8, patterns: [/sql学习|sql语言|mysql|查询语句/i] },
  { id: 'miniprogram', score: 11, patterns: [/小程序|微信背单词|小鸡单词|bmob/i] },
  { id: 'wordpress-blog', score: 9, patterns: [/wordpress|hexo|建站|公众号.*爬|博客建站/i] },
  { id: 'cloud-server', score: 12, patterns: [/阿里云|云服务器|web服务器/i] },
  { id: 'vim-editor', score: 10, patterns: [/vim/i] },
  { id: 'vue-frontend', score: 9, patterns: [/vue|carousel|跑马灯|ssr/i] },
  { id: 'graph-db', score: 10, patterns: [/nebula|图数据库|图计算|validator|executor/i] },
  { id: 'distributed-ai', score: 10, patterns: [/mooncake|peercache|大模型|rdma|kv缓存|pd分离|分布式存储|ai基础设施/i] },
  { id: 'algorithm-pat', score: 9, patterns: [/pat|算法题|oj|推理题|暴力破解/i] },
  { id: 'nordic-autumn', score: 12, patterns: [/记忆的种子·一|峡湾|挪威.*秋|北欧.*秋|枫林/i] },
  { id: 'nordic-winter', score: 12, patterns: [/记忆的种子·二|挪威.*冬|下雪|小店|贼鸥/i] },
  { id: 'life-seasons', score: 12, patterns: [/生如夏花|秋叶般静美|葬礼/i] },
  { id: 'island-memoir', score: 10, patterns: [/海门回声|南风岛|轮渡船|黑鬼/i] },
  { id: 'anfeng-road', score: 9, patterns: [/谙风|小城中学|小城青旅|大巴车.*乡间|野花.*山坡/i] },
  { id: 'travel-lake', score: 10, patterns: [/青海湖|十月不远/i] },
  { id: 'campus-summer', score: 10, patterns: [/随笔杂谈|毕业照|图书馆|林荫|校园|夏风|假期最后/i] },
  { id: 'love-emotion', score: 11, patterns: [/喜欢一个人|爱而不得|青梅|竹马|重逢|温暖你们/i] },
  { id: 'life-reflection', score: 8, patterns: [/桃李春风|考研|大学生|挣钱|苦难|青春|如春梦|兰州时间/i] },
  { id: 'link-card', score: 10, patterns: [/链接卡片|知乎/i] },
  { id: 'comment-system', score: 10, patterns: [/来必力|评论系统/i] },
  { id: 'childhood', score: 9, patterns: [/发小|童年/i] },
  { id: 'literary-default', score: 1, patterns: [/随想|杂七杂八|随笔/i] },
];

function corpusParts(post) {
  const title = post.title || '';
  const summary = post.summary || '';
  const series = post.series || '';
  const tags = (post.tags || []).join(' ');
  const slug = post.slug || '';
  return { title, summary, series, tags, slug, all: [title, summary, series, tags, slug].join(' ') };
}

/** @param {PostMeta} post */
export function pickCoverTheme(post) {
  const parts = corpusParts(post);
  let best = { id: 'literary-default', score: 0 };
  for (const rule of THEME_RULES) {
    let hits = 0;
    for (const p of rule.patterns) {
      if (p.test(parts.title)) hits += 3;
      else if (p.test(parts.series) || p.test(parts.slug)) hits += 2;
      else if (p.test(parts.tags)) hits += 1.5;
      else if (p.test(parts.summary)) hits += 1;
      else if (p.test(parts.all)) hits += 0.5;
    }
    if (hits > 0) {
      const score = rule.score * hits;
      if (score > best.score) best = { id: rule.id, score };
    }
  }
  const seed = [...String(post.slug || post.title || '')].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { theme: best.id, seed };
}

function sceneRecommendation() {
  const p = PALETTES.warm;
  return wrap(`
  ${bokeh(42, 22)}
  <g opacity="0.12"><circle cx="180" cy="140" r="100" fill="${p.accent}"/><circle cx="1000" cy="460" r="140" fill="${p.accent2}"/></g>
  <g transform="translate(120,100)" filter="url(#softShadow)">
    ${[0, 1, 2, 3].map(i => `<circle cx="${i * 130 + 40}" cy="60" r="34" fill="#fff" stroke="${p.accent}" stroke-width="2.5" opacity="0.95"/>`).join('')}
    ${[0, 1, 2].map(i => `<rect x="${i * 150 + 20}" y="220" width="64" height="64" rx="14" fill="#fff" stroke="${p.accent2}" stroke-width="2" opacity="0.9"/>`).join('')}
    ${[0, 1, 2, 3].flatMap(ui => [0, 1, 2].map(ii => {
      const x1 = ui * 130 + 40, y1 = 94, x2 = ii * 150 + 52, y2 = 220;
      const op = 0.1 + ((ui + ii) % 4) * 0.08;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${p.accent}" stroke-width="2.5" opacity="${op}" stroke-linecap="round"/>`;
    })).join('')}
  </g>
  ${glassCard(680, 90, 400, 400, 24, `
    ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (_, c) => {
      const v = (r * 6 + c) % 8;
      const colors = ['#e86f5a', '#5b9ef0', '#4caf7a', '#f0c040', '#b070e8', '#f080a0'];
      return `<rect x="${24 + c * 58}" y="${24 + r * 58}" width="48" height="48" rx="10" fill="${colors[v]}" opacity="${0.22 + v * 0.06}"/>`;
    }).join('')).join('')}
    <circle cx="200" cy="200" r="80" fill="${p.accent}" opacity="0.08" filter="url(#blur20)"/>
  `)}
  `, p);
}

function sceneCampusSummer(seed) {
  const p = PALETTES.green;
  const treeXs = [60, 180, 310, 450, 590, 730, 870, 1010];
  return wrap(`
  ${softSun(980, 95, 48)}
  ${cloud(200, 80, 1.1, 0.7)}
  ${cloud(750, 60, 0.9, 0.55)}
  ${layeredHills([
    { color: '#8ac878' },
    { color: '#6aad5a' },
    { color: '#4a8e42' },
  ], 400)}
  <path d="M0,430 Q280,400 520,418 T900,405 T1200,420 L1200,${H} L0,${H}Z" fill="${p.ground}" opacity="0.85"/>
  <path d="M80,430 Q400,395 700,415 T1150,400" fill="none" stroke="#fff" stroke-width="48" stroke-linecap="round" opacity="0.35"/>
  ${treeXs.map((x, i) => tree(x, 430, 0.85 + (i % 3) * 0.12, ['#4a9e42', '#5aae4a', '#3d8e38'][i % 3])).join('')}
  <g transform="translate(500,310)" filter="url(#softShadow)">
    <rect x="0" y="50" width="200" height="120" rx="6" fill="#f0e0c8"/>
    <polygon points="0,50 100,0 200,50" fill="#c84838"/>
    <rect x="75" y="85" width="50" height="65" rx="3" fill="#8b6020" opacity="0.45"/>
    <rect x="30" y="75" width="35" height="28" rx="2" fill="#87ceeb" opacity="0.5"/>
    <rect x="135" y="75" width="35" height="28" rx="2" fill="#87ceeb" opacity="0.5"/>
  </g>
  <g transform="translate(360,400)" opacity="0.9">
    <circle cx="18" cy="12" r="16" fill="#f5c8a0"/>
    <rect x="4" y="28" width="28" height="42" rx="8" fill="#5b8def"/>
    <line x1="18" y1="70" x2="10" y2="95" stroke="#3a3848" stroke-width="3" stroke-linecap="round"/>
    <line x1="18" y1="70" x2="26" y2="95" stroke="#3a3848" stroke-width="3" stroke-linecap="round"/>
  </g>
  ${bokeh(seed, 14)}
  `, p);
}

function sceneLifeSeasons() {
  const p = PALETTES.gold;
  return wrap(`
  <rect x="0" y="0" width="580" height="${H}" fill="#fff5ee" opacity="0.6"/>
  <rect x="620" y="0" width="580" height="${H}" fill="#f8f0e4" opacity="0.6"/>
  <line x1="600" y1="40" x2="600" y2="${H - 40}" stroke="#d8c8b8" stroke-width="1.5" opacity="0.5"/>
  <g transform="translate(60,70)">
    ${[0, 1, 2, 3, 4].map(i => `
      <line x1="${80 + i * 85}" y1="280" x2="${80 + i * 85}" y2="380" stroke="#5a8a48" stroke-width="3" opacity="0.7"/>
      <ellipse cx="${80 + i * 85}" cy="${240 - (i % 3) * 25}" rx="32" ry="48" fill="${['#e84888', '#f878a8', '#e86848', '#f0b040', '#e84888'][i]}" opacity="0.82"/>
      <ellipse cx="${65 + i * 85}" cy="${255 - (i % 3) * 25}" rx="22" ry="32" fill="${['#f878a8', '#e86848', '#f0b040', '#e84888', '#f878a8'][i]}" opacity="0.55"/>
    `).join('')}
    <ellipse cx="280" cy="420" rx="200" ry="30" fill="${p.accent}" opacity="0.12"/>
  </g>
  <g transform="translate(660,50)">
    ${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const rot = -35 + i * 12;
      const colors = ['#c83828', '#d85820', '#e07828', '#d0a030', '#c83828', '#b05018', '#d85820'];
      return `<g transform="translate(${60 + (i % 4) * 105},${100 + Math.floor(i / 4) * 110}) rotate(${rot})">
        <ellipse cx="0" cy="0" rx="16" ry="26" fill="${colors[i]}" opacity="0.82"/>
        <line x1="0" y1="26" x2="0" y2="50" stroke="#8b7020" stroke-width="2"/>
      </g>`;
    }).join('')}
    <path d="M80,380 Q280,340 480,370" fill="none" stroke="#a08050" stroke-width="2" opacity="0.25"/>
  </g>
  ${softSun(520, 120, 35, '#ffe8b0')}
  `, p);
}

function sceneNordicAutumn() {
  const p = PALETTES.dusk;
  return wrap(`
  ${softSun(140, 110, 42, '#f0c878')}
  ${layeredHills([
    { color: '#4a6888', points: `0,320 250,200 500,260 750,170 1000,230 1200,190 1200,${H} 0,${H}` },
    { color: '#3a5878', points: `0,380 350,280 650,340 950,260 1200,320 1200,${H} 0,${H}` },
    { color: '#2a4868' },
  ], 420)}
  <rect x="0" y="470" width="${W}" height="160" fill="#1a3858"/>
  ${waterReflection(478, '#4a90b8', 0.45)}
  ${[100, 260, 420, 580, 740, 900, 1060].map((x, i) => `
    <rect x="${x}" y="${360 - (i % 3) * 35}" width="12" height="${130 + (i % 3) * 35}" fill="#4a3828" opacity="0.85"/>
    <circle cx="${x + 6}" cy="${320 - (i % 3) * 35}" r="${38 + (i % 2) * 14}" fill="${['#d84820', '#e07828', '#c83818'][i % 3]}" opacity="0.88"/>
    <circle cx="${x - 12}" cy="${330 - (i % 3) * 35}" r="${22}" fill="${['#e07828', '#d84820'][i % 2]}" opacity="0.6"/>
  `).join('')}
  <polygon points="880,180 1080,90 1120,210" fill="#f0f4f8" opacity="0.92"/>
  <polygon points="940,160 1160,70 1180,200" fill="#e8ecf4" opacity="0.65"/>
  ${bokeh(77, 16)}
  `, p);
}

function sceneNordicWinter() {
  const p = PALETTES.snow;
  return wrap(`
  ${cloud(300, 70, 1.2, 0.5)}
  ${cloud(850, 50, 1, 0.4)}
  <rect x="0" y="400" width="${W}" height="230" fill="#eef4fa"/>
  ${[90, 240, 390, 540, 690, 840, 990].map((x, i) => `
    <g filter="url(#cardShadow)">
      <rect x="${x}" y="${300 + (i % 2) * 18}" width="${95 + (i % 3) * 18}" height="${105 + (i % 2) * 28}" fill="#e8f0f8" stroke="#c0d4e8" stroke-width="1"/>
      <polygon points="${x},${300 + (i % 2) * 18} ${x + 47 + (i % 3) * 9},${258 + (i % 2) * 18} ${x + 95 + (i % 3) * 18},${300 + (i % 2) * 18}" fill="#c84838" opacity="0.75"/>
      <rect x="${x + 32}" y="${350 + (i % 2) * 18}" width="28" height="32" fill="#ffe8a0" opacity="0.85" rx="2"/>
    </g>
  `).join('')}
  <ellipse cx="600" cy="430" rx="520" ry="28" fill="#fff" opacity="0.85"/>
  ${Array.from({ length: 50 }, (_, i) => `<circle cx="${(i * 97 + 30) % 1200}" cy="${(i * 53 + 15) % 320}" r="${1.2 + (i % 3) * 0.8}" fill="#fff" opacity="${0.45 + (i % 5) * 0.1}"/>`).join('')}
  <g transform="translate(470,280)" filter="url(#softShadow)">
    <rect x="0" y="50" width="140" height="90" rx="6" fill="#8b6028"/>
    <rect x="12" y="62" width="116" height="68" fill="#ffe8a8" opacity="0.9" rx="3"/>
    <rect x="0" y="40" width="140" height="18" fill="#5a4020" rx="3"/>
    <rect x="55" y="95" width="30" height="40" fill="#4a3020" rx="2"/>
  </g>
  `, p);
}

function sceneAnfengRoad() {
  const p = PALETTES.green;
  return wrap(`
  ${softSun(1050, 130, 38)}
  ${cloud(180, 90, 0.8)}
  ${layeredHills([{ color: '#98c878' }, { color: '#78a858' }], 360)}
  <path d="M0,480 Q350,360 650,420 T1200,380 L1200,${H} L0,${H}Z" fill="#88b868" opacity="0.9"/>
  <path d="M0,500 Q280,430 580,470 T1200,440" fill="none" stroke="#e8d8a8" stroke-width="55" stroke-linecap="round" opacity="0.65"/>
  <path d="M0,510 Q280,450 580,480 T1200,455" fill="none" stroke="#a89868" stroke-width="3" stroke-dasharray="14 10" opacity="0.3"/>
  ${[70, 190, 320, 460, 600, 740, 880, 1020].map((x, i) => `
    <circle cx="${x}" cy="${410 + (i % 4) * 12}" r="9" fill="${['#e84888', '#e87848', '#f0c848', '#8868d8'][i % 4]}" opacity="0.75"/>
    <line x1="${x}" y1="${419 + (i % 4) * 12}" x2="${x}" y2="${440 + (i % 4) * 12}" stroke="#5a8a40" stroke-width="2"/>
  `).join('')}
  <g transform="translate(180,280)" filter="url(#softShadow)">
    <rect x="0" y="70" width="300" height="110" rx="22" fill="#f0c040"/>
    <rect x="18" y="38" width="264" height="88" rx="18" fill="#ffe898"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${32 + i * 46}" y="52" width="34" height="38" rx="5" fill="#98d0f0" opacity="0.55"/>`).join('')}
    <rect x="0" y="150" width="300" height="22" rx="5" fill="#484848"/>
    <circle cx="55" cy="175" r="20" fill="#303030"/><circle cx="245" cy="175" r="20" fill="#303030"/>
  </g>
  `, p);
}

function sceneCompiler() {
  const p = PALETTES.warm;
  return wrap(`
  ${bokeh(11, 16)}
  <g transform="translate(80,80)" filter="url(#softShadow)">
    <rect x="0" y="0" width="220" height="400" rx="20" fill="#3a7ab0"/>
  <text x="110" y="70" text-anchor="middle" fill="#fff" font-size="52" font-weight="bold" font-family="system-ui,sans-serif">Py</text>
    <rect x="30" y="120" width="160" height="200" rx="12" fill="#2a5a88" opacity="0.5"/>
    <rect x="45" y="140" width="90" height="10" rx="3" fill="#ffd858" opacity="0.8"/>
    <rect x="45" y="165" width="120" height="8" rx="2" fill="#fff" opacity="0.5"/>
    <rect x="45" y="185" width="100" height="8" rx="2" fill="#fff" opacity="0.4"/>
    <rect x="45" y="205" width="110" height="8" rx="2" fill="#fff" opacity="0.4"/>
  </g>
  <g transform="translate(470,180)">
    ${[0, 1, 2].map(i => `<rect x="${i * 28}" y="${i * 18}" width="90" height="55" rx="12" fill="${p.accent}" opacity="${0.35 + i * 0.18}" transform="rotate(${i * 12} 45 27)"/>`).join('')}
    <circle cx="80" cy="130" r="6" fill="${p.accent2}" opacity="0.6"/><circle cx="130" cy="130" r="6" fill="${p.accent2}" opacity="0.6"/>
    <line x1="86" y1="130" x2="124" y2="130" stroke="${p.accent}" stroke-width="2" opacity="0.5"/>
  </g>
  <g transform="translate(780,80)" filter="url(#softShadow)">
    <rect x="0" y="0" width="220" height="400" rx="20" fill="#3a3a48"/>
    <text x="110" y="70" text-anchor="middle" fill="#5b9ef0" font-size="52" font-weight="bold" font-family="system-ui,sans-serif">C</text>
    <rect x="30" y="120" width="160" height="200" rx="12" fill="#1a1a28" opacity="0.6"/>
    <rect x="45" y="150" width="100" height="8" rx="2" fill="#68e878" opacity="0.7"/>
    <rect x="45" y="175" width="80" height="8" rx="2" fill="#68e878" opacity="0.55"/>
    <rect x="45" y="200" width="90" height="8" rx="2" fill="#68e878" opacity="0.55"/>
  </g>
  <path d="M300,280 L470,280" stroke="${p.accent}" stroke-width="3" opacity="0.6" marker-end="url(#arrow)"/>
  <path d="M680,280 L780,280" stroke="${p.accent}" stroke-width="3" opacity="0.6"/>
  <defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${p.accent}"/></marker></defs>
  `, p);
}

function sceneSqlDb() {
  const p = PALETTES.cool;
  return wrap(`
  ${bokeh(33, 18)}
  <g transform="translate(380,70)" filter="url(#softShadow)">
    <ellipse cx="200" cy="55" rx="170" ry="42" fill="#4a88e8"/>
    <rect x="30" y="55" width="340" height="210" fill="#3a78d8"/>
    <ellipse cx="200" cy="265" rx="170" ry="42" fill="#2a68c8"/>
    <ellipse cx="200" cy="115" rx="170" ry="42" fill="#5a98f0" opacity="0.35"/>
    <ellipse cx="200" cy="175" rx="170" ry="42" fill="#5a98f0" opacity="0.2"/>
    <text x="200" y="175" text-anchor="middle" fill="#fff" font-size="42" font-weight="bold" font-family="system-ui,sans-serif" opacity="0.95">SQL</text>
  </g>
  ${glassCard(90, 170, 200, 140, 14, `
    ${[0, 1, 2, 3].map(r => `<line x1="16" y1="${28 + r * 26}" x2="184" y2="${28 + r * 26}" stroke="#d8e8f8" stroke-width="1"/>`).join('')}
    ${[0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<rect x="${18 + c * 58}" y="${12 + r * 26}" width="48" height="16" rx="4" fill="${['#e8f2ff', '#d0e8ff', '#e8f2ff'][c]}" opacity="0.85"/>`).join('')).join('')}
  `)}
  ${glassCard(720, 150, 320, 200, 14, `
    <rect x="20" y="28" width="120" height="10" rx="3" fill="#c878e8" opacity="0.7"/>
    <rect x="20" y="52" width="200" height="8" rx="2" fill="#88c878" opacity="0.6"/>
    <rect x="20" y="72" width="180" height="8" rx="2" fill="#88c878" opacity="0.5"/>
    <rect x="20" y="110" width="160" height="8" rx="2" fill="#78b8f0" opacity="0.6"/>
    <rect x="20" y="130" width="140" height="8" rx="2" fill="#78b8f0" opacity="0.5"/>
  `)}
  `, p);
}

function sceneMiniprogram() {
  const p = PALETTES.green;
  return wrap(`
  <circle cx="200" cy="280" r="100" fill="#07c160" opacity="0.12"/>
  <circle cx="1020" cy="180" r="80" fill="#07c160" opacity="0.1"/>
  <g transform="translate(370,50)" filter="url(#softShadow)">
    <rect x="0" y="0" width="460" height="540" rx="44" fill="#1a1a2e" stroke="#3a3a50" stroke-width="3"/>
    <rect x="18" y="38" width="424" height="480" rx="12" fill="#fff"/>
    <rect x="18" y="38" width="424" height="54" fill="#07c160" rx="12"/>
    <rect x="18" y="68" width="424" height="24" fill="#07c160"/>
    <g transform="translate(38,110)">
      ${[0, 1, 2].map(r => [0, 1, 2].map(c => `
        <rect x="${c * 128}" y="${r * 118}" width="108" height="98" rx="14" fill="${['#fff5f2', '#f2f8ff', '#f2fff5'][c]}" stroke="#e8e8e8" stroke-width="1"/>
        <circle cx="${c * 128 + 54}" cy="${r * 118 + 38}" r="22" fill="${['#e86f5a', '#5b9ef0', '#4caf7a'][c]}" opacity="0.85"/>
        <rect x="${c * 128 + 22}" y="${r * 118 + 68}" width="64" height="8" rx="4" fill="#e0e0e0"/>
      `).join('')).join('')}
    </g>
  </g>
  `, p);
}

function sceneWordpressBlog() {
  const p = PALETTES.warm;
  return wrap(`
  ${glassCard(180, 90, 540, 380, 18, `
    <rect x="0" y="0" width="540" height="42" fill="#f4f4f4" rx="18"/>
    <circle cx="28" cy="21" r="7" fill="#e86f5a"/><circle cx="50" cy="21" r="7" fill="#f0c040"/><circle cx="72" cy="21" r="7" fill="#4caf7a"/>
    <rect x="28" y="68" width="220" height="12" rx="4" fill="#d8d8d8"/>
    <rect x="28" y="92" width="460" height="8" rx="3" fill="#ececec"/>
    <rect x="28" y="110" width="420" height="8" rx="3" fill="#ececec"/>
    <rect x="28" y="128" width="440" height="8" rx="3" fill="#ececec"/>
    <rect x="28" y="170" width="200" height="120" rx="10" fill="#ffd8cc"/>
    <rect x="250" y="175" width="260" height="8" rx="3" fill="#ececec"/>
    <rect x="250" y="195" width="220" height="8" rx="3" fill="#ececec"/>
    <rect x="250" y="215" width="240" height="8" rx="3" fill="#ececec"/>
  `)}
  <g transform="translate(800,130)" filter="url(#softShadow)">
    <circle cx="90" cy="90" r="78" fill="#21759b"/>
    <text x="90" y="108" text-anchor="middle" fill="#fff" font-size="54" font-weight="bold" font-family="Georgia,serif">W</text>
  </g>
  ${glassCard(840, 340, 140, 160, 10, `
    <line x1="18" y1="28" x2="122" y2="28" stroke="${p.accent}" stroke-width="2.5"/>
    <line x1="18" y1="50" x2="100" y2="50" stroke="#ccc" stroke-width="2"/>
    <line x1="18" y1="72" x2="110" y2="72" stroke="#ccc" stroke-width="2"/>
    <line x1="18" y1="94" x2="90" y2="94" stroke="#ccc" stroke-width="2"/>
  `)}
  `, p);
}

function sceneVimEditor() {
  const p = PALETTES.dusk;
  return wrap(`
  <g transform="translate(120,50)" filter="url(#softShadow)">
    <rect x="0" y="0" width="960" height="530" rx="14" fill="#1e1e2e" stroke="#3a3a50" stroke-width="2"/>
    <rect x="0" y="0" width="960" height="38" fill="#2d2d3d" rx="14"/>
    <rect x="0" y="20" width="960" height="18" fill="#2d2d3d"/>
    <rect x="0" y="492" width="960" height="38" fill="#2d2d3d" rx="14"/>
    <rect x="0" y="510" width="960" height="20" fill="#2d2d3d"/>
    ${[
      ['#78b8f0', 90], ['#98d878', 120], ['#d888e8', 150],
      ['#e8c878', 180], ['#78b8f0', 210], ['#98d878', 240],
    ].map(([color, y]) => `<rect x="36" y="${y}" width="${120 + (y % 60)}" height="10" rx="3" fill="${color}" opacity="0.65"/>`).join('')}
    <rect x="880" y="50" width="56" height="420" rx="6" fill="#019833" opacity="0.9"/>
    <text x="908" y="270" text-anchor="middle" fill="#fff" font-size="28" font-weight="bold" font-family="system-ui,sans-serif" transform="rotate(90 908 270)">VIM</text>
  </g>
  `, p);
}

function sceneVueFrontend() {
  const p = PALETTES.green;
  return wrap(`
  ${glassCard(280, 70, 640, 420, 20, `
    <rect x="0" y="0" width="640" height="52" fill="#42b883" rx="20"/>
    <rect x="0" y="26" width="640" height="26" fill="#42b883"/>
    <g transform="translate(28,78)">
      <rect x="0" y="0" width="170" height="290" rx="10" fill="#f0faf5" stroke="#42b883" stroke-width="1.5"/>
      <rect x="18" y="28" width="134" height="65" rx="8" fill="#42b883" opacity="0.28"/>
      <rect x="18" y="108" width="134" height="65" rx="8" fill="#35495e" opacity="0.15"/>
      <rect x="18" y="188" width="134" height="65" rx="8" fill="#42b883" opacity="0.28"/>
    </g>
    <g transform="translate(220,78)">
      <rect x="0" y="90" width="390" height="200" rx="10" fill="#fff8f5" stroke="#e86f5a" stroke-width="1.5"/>
      <rect x="18" y="18" width="354" height="130" rx="10" fill="#ffd8cc" opacity="0.45"/>
      <circle cx="48" cy="175" r="9" fill="#e86f5a"/><circle cx="82" cy="175" r="9" fill="#ddd"/><circle cx="116" cy="175" r="9" fill="#ddd"/>
    </g>
  `)}
  <polygon points="140,300 210,255 210,345" fill="#42b883" opacity="0.45"/>
  <polygon points="1060,300 990,255 990,345" fill="#42b883" opacity="0.45"/>
  `, p);
}

function sceneAlgorithmPat() {
  const p = PALETTES.cool;
  return wrap(`
  ${glassCard(120, 70, 960, 440, 20, `
    ${[0, 1, 2, 3, 4].map(i => `
      <g transform="translate(${70 + i * 170}, 80)">
        <rect x="0" y="0" width="130" height="88" rx="12" fill="${['#e8f2ff', '#d8e8ff', '#e8f2ff', '#d8e8ff', '#e8f2ff'][i]}" stroke="#5b9ef0" stroke-width="1.5"/>
        <circle cx="65" cy="44" r="22" fill="#5b9ef0" opacity="0.2"/>
        <text x="65" y="52" text-anchor="middle" fill="#4a80d8" font-size="30" font-weight="bold" font-family="system-ui,sans-serif">${['A', 'B', 'C', 'D', 'E'][i]}</text>
        ${i < 4 ? `<line x1="130" y1="44" x2="170" y2="44" stroke="${p.accent}" stroke-width="2.5" opacity="0.5"/>` : ''}
      </g>
    `).join('')}
    <rect x="60" y="220" width="840" height="140" rx="12" fill="#1e1e2e" opacity="0.92"/>
    <rect x="80" y="248" width="280" height="10" rx="3" fill="#98d878" opacity="0.7"/>
    <rect x="100" y="272" width="400" height="10" rx="3" fill="#78b8f0" opacity="0.65"/>
    <rect x="80" y="296" width="120" height="10" rx="3" fill="#98d878" opacity="0.7"/>
    <rect x="80" y="320" width="200" height="10" rx="3" fill="#d888e8" opacity="0.5"/>
  `)}
  `, p);
}

function sceneIslandMemoir() {
  const p = PALETTES.gold;
  return wrap(`
  ${softSun(190, 100, 40)}
  ${cloud(900, 80, 0.9, 0.5)}
  <ellipse cx="600" cy="530" rx="560" ry="55" fill="#5a98c0" opacity="0.45"/>
  <path d="M0,490 Q220,440 450,470 Q680,500 900,450 T1200,480 L1200,${H} L0,${H}Z" fill="#d8b888"/>
  <path d="M120,490 Q300,430 480,460 Q660,490 840,440 Q1020,390 1150,460" fill="#a88868" opacity="0.55"/>
  <g transform="translate(380,260)" filter="url(#softShadow)">
    <rect x="0" y="90" width="440" height="130" rx="10" fill="#8b6828" opacity="0.85"/>
    <rect x="20" y="48" width="400" height="88" rx="8" fill="#b09060"/>
    <rect x="40" y="18" width="360" height="68" rx="6" fill="#d0b080"/>
    <rect x="0" y="220" width="440" height="28" fill="#484848" rx="4"/>
    <path d="M-30,220 Q220,160 470,220" fill="none" stroke="#585858" stroke-width="3"/>
  </g>
  <g transform="translate(140,340)" filter="url(#cardShadow)">
    <rect x="0" y="0" width="65" height="85" rx="5" fill="#f0e0c8"/>
    <polygon points="0,0 32,-28 65,0" fill="#7a4820"/>
  </g>
  <g transform="translate(920,350)" filter="url(#cardShadow)">
    <rect x="0" y="0" width="55" height="75" rx="5" fill="#e0d0b0"/>
    <polygon points="0,0 27,-22 55,0" fill="#5a3818"/>
  </g>
  ${waterReflection(505, '#6ab0d0', 0.3)}
  `, p);
}

function sceneTravelLake() {
  const p = PALETTES.cool;
  return wrap(`
  ${softSun(130, 90, 50)}
  ${cloud(700, 60, 1.1, 0.55)}
  ${layeredHills([
    { color: '#7aaa5a', points: `0,300 280,160 560,220 840,140 1200,200 1200,${H} 0,${H}` },
    { color: '#5a8a42' },
  ], 340)}
  <ellipse cx="600" cy="460" rx="560" ry="75" fill="#4a98c8" opacity="0.65"/>
  <ellipse cx="600" cy="478" rx="500" ry="42" fill="#78c8e8" opacity="0.4"/>
  <path d="M480,460 Q600,430 720,460" fill="none" stroke="#fff" stroke-width="2" opacity="0.35"/>
  <g transform="translate(780,260)" opacity="0.6">
    ${[0, 1, 2].map(i => `<polygon points="${i * 42},90 ${i * 42 + 32},0 ${i * 42 + 64},90" fill="#fff" opacity="${0.55 - i * 0.12}"/>`).join('')}
  </g>
  ${bokeh(55, 12)}
  `, p);
}

function sceneLoveEmotion() {
  const p = PALETTES.warm;
  return wrap(`
  <circle cx="600" cy="480" r="320" fill="${p.accent}" opacity="0.1" filter="url(#blur20)"/>
  <g filter="url(#softShadow)">
    <circle cx="490" cy="260" r="85" fill="${p.accent}" opacity="0.88" transform="rotate(-32 490 260)"/>
    <circle cx="580" cy="215" r="85" fill="${p.accent}" opacity="0.88" transform="rotate(32 580 215)"/>
    <polygon points="535,310 600,430 665,310" fill="${p.accent}" opacity="0.88"/>
  </g>
  ${softSun(920, 140, 32, '#ffe8a8')}
  ${bokeh(88, 20)}
  <path d="M80,500 Q300,360 520,440 T920,390" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.2" stroke-dasharray="8 6"/>
  `, p);
}

function sceneLifeReflection() {
  const p = PALETTES.dusk;
  return wrap(`
  ${softSun(140, 100, 38, '#f0d080')}
  <rect x="0" y="410" width="${W}" height="220" fill="#2a2018"/>
  <g filter="url(#softShadow)">
    <rect x="490" y="190" width="220" height="290" fill="#5a4030"/>
    <polygon points="490,190 600,95 710,190" fill="#3a2818"/>
    <rect x="555" y="280" width="35" height="55" fill="#ffe8a0" opacity="0.65" rx="2"/>
    <rect x="620" y="250" width="28" height="45" fill="#ffe8a0" opacity="0.45" rx="2"/>
  </g>
  <ellipse cx="600" cy="440" rx="420" ry="32" fill="#1a1008" opacity="0.45"/>
  <g transform="translate(190,290)">
    <rect x="0" y="45" width="10" height="65" fill="#8b6820"/>
    <ellipse cx="5" cy="32" rx="55" ry="38" fill="${p.accent}" opacity="0.65"/>
    <rect x="65" y="55" width="110" height="7" rx="2" fill="#c0a070" opacity="0.7"/>
    <rect x="65" y="72" width="90" height="7" rx="2" fill="#c0a070" opacity="0.5"/>
  </g>
  <circle cx="280" cy="350" r="7" fill="#ffe8a0" opacity="0.8"/>
  <circle cx="920" cy="330" r="5" fill="#ffe8a0" opacity="0.6"/>
  `, p);
}

function sceneCloudServer() {
  const p = PALETTES.cool;
  return wrap(`
  ${cloud(380, 150, 1.3, 0.88)}
  ${cloud(520, 130, 1.1, 0.75)}
  ${cloud(300, 170, 0.8, 0.6)}
  ${[640, 810].map((x, i) => `
    <g transform="translate(${x},110)" filter="url(#softShadow)">
      <rect x="0" y="0" width="130" height="210" rx="10" fill="#2a2a38"/>
      ${[0, 1, 2, 3].map(j => `<rect x="14" y="${18 + j * 18}" width="102" height="9" rx="2" fill="${i ? '#5b9ef0' : '#4caf7a'}" opacity="${0.85 - j * 0.12}"/>`).join('')}
      ${[0, 1, 2].map(j => `<circle cx="65" cy="${110 + j * 32}" r="5" fill="${i ? '#5b9ef0' : '#4caf7a'}"/>`).join('')}
    </g>
  `).join('')}
  <path d="M520,280 L640,200" stroke="#5b9ef0" stroke-width="2" stroke-dasharray="8 5" opacity="0.4"/>
  <path d="M520,280 L810,200" stroke="#5b9ef0" stroke-width="2" stroke-dasharray="8 5" opacity="0.4"/>
  ${glassCard(180, 360, 840, 150, 16, `
    <rect x="40" y="55" width="320" height="12" rx="4" fill="#4caf7a" opacity="0.55"/>
    <rect x="40" y="80" width="240" height="10" rx="3" fill="#78b8f0" opacity="0.45"/>
    <circle cx="720" cy="75" r="40" fill="#4caf7a" opacity="0.15"/>
  `)}
  `, p);
}

function sceneFarmGame() {
  const p = PALETTES.green;
  return wrap(`
  ${softSun(90, 75, 42)}
  ${cloud(500, 60, 0.8, 0.5)}
  <rect x="0" y="360" width="${W}" height="270" fill="#8b7028"/>
  ${[0, 1, 2, 3, 4, 5].map(i => `
    <rect x="${70 + i * 185}" y="390" width="150" height="110" rx="6" fill="${['#9a8060', '#b09070', '#9a8060', '#b09070', '#9a8060', '#b09070'][i]}" stroke="#7a5830" stroke-width="1.5"/>
    <text x="${145 + i * 185}" y="460" text-anchor="middle" font-size="40">${['🥬', '🥕', '🌽', '🍅', '🍆', '🌻'][i]}</text>
  `).join('')}
  <g transform="translate(430,100)" filter="url(#softShadow)">
    <rect x="0" y="70" width="340" height="200" rx="14" fill="#c83828" opacity="0.88"/>
    <polygon points="0,70 170,0 340,70" fill="#982018"/>
    <rect x="130" y="140" width="70" height="95" fill="#5a3010" rx="3"/>
    <rect x="40" y="115" width="55" height="45" fill="#ffe8a0" opacity="0.55" rx="3"/>
    <rect x="245" y="115" width="55" height="45" fill="#ffe8a0" opacity="0.55" rx="3"/>
  </g>
  `, p);
}

function sceneLinkCard() {
  const p = PALETTES.cool;
  return wrap(`
  ${glassCard(220, 120, 760, 210, 16, `
    <rect x="0" y="0" width="210" height="210" rx="16" fill="#e8f2ff"/>
    <rect x="35" y="55" width="140" height="100" rx="10" fill="#5b9ef0" opacity="0.25"/>
    <rect x="240" y="48" width="320" height="14" rx="5" fill="#333"/>
    <rect x="240" y="78" width="420" height="10" rx="4" fill="#ccc"/>
    <rect x="240" y="100" width="380" height="10" rx="4" fill="#ddd"/>
    <rect x="240" y="122" width="300" height="10" rx="4" fill="#ddd"/>
    <rect x="240" y="160" width="180" height="10" rx="4" fill="#5b9ef0" opacity="0.5"/>
  `)}
  ${glassCard(220, 370, 760, 130, 16, `
    <rect x="28" y="28" width="90" height="74" rx="10" fill="#ffd8cc"/>
    <rect x="140" y="38" width="280" height="12" rx="4" fill="#333"/>
    <rect x="140" y="62" width="420" height="8" rx="3" fill="#ccc"/>
    <rect x="140" y="82" width="340" height="8" rx="3" fill="#ddd"/>
  `)}
  `, p);
}

function sceneCommentSystem() {
  const p = PALETTES.warm;
  return wrap(`
  <g transform="translate(180,90)">
    ${[0, 1, 2].map(i => `
      <g transform="translate(0, ${i * 155})" filter="url(#cardShadow)">
        <circle cx="35" cy="38" r="30" fill="${['#e86f5a', '#5b9ef0', '#4caf7a'][i]}"/>
        <rect x="78" y="8" width="520" height="88" rx="16" fill="#fff" stroke="#e8e8e8" stroke-width="1"/>
        <rect x="98" y="28" width="320" height="9" rx="3" fill="#e0e0e0"/>
        <rect x="98" y="48" width="420" height="9" rx="3" fill="#ececec"/>
        <rect x="98" y="68" width="220" height="9" rx="3" fill="#ececec"/>
      </g>
    `).join('')}
  </g>
  <g transform="translate(820,140)">
    <circle cx="85" cy="85" r="75" fill="none" stroke="${p.accent}" stroke-width="5" opacity="0.2"/>
    <path d="M50,85 L72,108 L120,58" fill="none" stroke="#4caf7a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  `, p);
}

function sceneChildhood() {
  const p = PALETTES.green;
  return wrap(`
  ${softSun(180, 90, 38)}
  ${cloud(800, 70, 0.7, 0.45)}
  <rect x="0" y="430" width="${W}" height="200" fill="#90d070"/>
  <path d="M0,430 Q400,400 800,420 T1200,410" fill="#78b858" opacity="0.5"/>
  ${[[300, 200], [540, 210]].map(([x, y], i) => `
    <g transform="translate(${x},${y})" filter="url(#softShadow)">
      <circle cx="55" cy="38" r="32" fill="#f5c8a0"/>
      <rect x="30" y="68" width="50" height="72" rx="10" fill="${['#5b9ef0', '#e86f5a'][i]}"/>
      <line x1="55" y1="140" x2="38" y2="200" stroke="#3a3848" stroke-width="4" stroke-linecap="round"/>
      <line x1="55" y1="140" x2="72" y2="200" stroke="#3a3848" stroke-width="4" stroke-linecap="round"/>
    </g>
  `).join('')}
  <rect x="430" y="360" width="340" height="18" rx="5" fill="#8b6820" opacity="0.8"/>
  ${bokeh(66, 14)}
  `, p);
}

function sceneLiteraryDefault(seed) {
  const hues = ['#e86f5a', '#5b9ef0', '#4caf7a', '#f0c040', '#b070e8'];
  const accent = hues[seed % hues.length];
  const p = { ...PALETTES.warm, accent, accent2: accent };
  return wrap(`
  ${softSun(900, 120, 55, '#ffe0c0')}
  ${bokeh(seed, 24)}
  <g opacity="0.1"><circle cx="140" cy="500" r="220" fill="${accent}"/><circle cx="1080" cy="100" r="180" fill="${accent}"/></g>
  ${openBook(600, 280, 1.35, accent)}
  ${fountainPen(820, 340, -20)}
  <g transform="translate(200,180)" opacity="0.75">
    <path d="M0,200 Q40,80 80,120 Q120,160 100,200 Q60,240 0,200Z" fill="${accent}" opacity="0.25"/>
    <path d="M20,200 Q50,100 70,130 Q90,160 80,190" fill="none" stroke="${accent}" stroke-width="2" opacity="0.35"/>
    <circle cx="75" cy="115" r="18" fill="${accent}" opacity="0.35"/>
    <circle cx="55" cy="95" r="14" fill="${accent}" opacity="0.25"/>
    <circle cx="95" cy="100" r="12" fill="${accent}" opacity="0.2"/>
  </g>
  <ellipse cx="600" cy="520" rx="280" ry="35" fill="${accent}" opacity="0.08"/>
  `, p);
}

const SCENE_BUILDERS = {
  recommendation: sceneRecommendation,
  'campus-summer': sceneCampusSummer,
  'life-seasons': sceneLifeSeasons,
  'nordic-autumn': sceneNordicAutumn,
  'nordic-winter': sceneNordicWinter,
  'anfeng-road': sceneAnfengRoad,
  compiler: sceneCompiler,
  'sql-db': sceneSqlDb,
  miniprogram: sceneMiniprogram,
  'wordpress-blog': sceneWordpressBlog,
  'vim-editor': sceneVimEditor,
  'vue-frontend': sceneVueFrontend,
  'graph-db': sceneAlgorithmPat,
  'distributed-ai': sceneCloudServer,
  'algorithm-pat': sceneAlgorithmPat,
  'cloud-server': sceneCloudServer,
  'island-memoir': sceneIslandMemoir,
  'travel-lake': sceneTravelLake,
  'love-emotion': sceneLoveEmotion,
  'life-reflection': sceneLifeReflection,
  'farm-game': sceneFarmGame,
  'link-card': sceneLinkCard,
  'comment-system': sceneCommentSystem,
  childhood: sceneChildhood,
  'literary-default': sceneLiteraryDefault,
};

/** @param {PostMeta} post */
export function postCoverIllustrationSvg(post) {
  const { theme, seed } = pickCoverTheme(post);
  const builder = SCENE_BUILDERS[theme] || sceneLiteraryDefault;
  return builder(seed);
}

export { pickCoverTheme as getCoverTheme };
