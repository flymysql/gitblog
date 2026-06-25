/**
 * 文章主题插画封面：根据标题/摘要/标签匹配场景，生成无大段文字的 SVG 插画
 */
const W = 1200;
const H = 630;

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

function wrap(svgBody, palette) {
  const { skyTop, skyBot, accent } = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyTop}"/>
      <stop offset="100%" stop-color="${skyBot}"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <ellipse cx="980" cy="120" rx="280" ry="180" fill="url(#glow)"/>
  ${svgBody}
</svg>`;
}

const PALETTES = {
  warm: { skyTop: '#fff4ee', skyBot: '#ffd9cc', accent: '#ea6f5a' },
  cool: { skyTop: '#eef6ff', skyBot: '#c8dff5', accent: '#5b8def' },
  green: { skyTop: '#f0faf0', skyBot: '#c8e8c8', accent: '#4caf7a' },
  dusk: { skyTop: '#2a2040', skyBot: '#5a3d6e', accent: '#e8a87c' },
  gold: { skyTop: '#fff8e8', skyBot: '#f5d9a0', accent: '#d4a03c' },
  snow: { skyTop: '#e8f0f8', skyBot: '#b8cce0', accent: '#7eb8e8' },
};

function sceneRecommendation() {
  return wrap(`
  <g opacity="0.15"><circle cx="200" cy="150" r="80" fill="#ea6f5a"/><circle cx="1000" cy="480" r="120" fill="#ea6f5a"/></g>
  <g transform="translate(180,120)">
    ${[0, 1, 2, 3].map(i => `<circle cx="${i * 110}" cy="0" r="28" fill="#fff" stroke="#ea6f5a" stroke-width="3"/>`).join('')}
    ${[0, 1, 2].map(i => `<rect x="${i * 130 + 20}" y="180" width="56" height="56" rx="8" fill="#fff" stroke="#5b8def" stroke-width="3"/>`).join('')}
    ${[0, 1, 2, 3].flatMap(ui => [0, 1, 2].map(ii => {
      const x1 = ui * 110, y1 = 0, x2 = ii * 130 + 48, y2 = 208;
      const opacity = 0.15 + ((ui + ii) % 3) * 0.12;
      return `<line x1="${x1}" y1="${y1 + 28}" x2="${x2}" y2="${y2}" stroke="#ea6f5a" stroke-width="2" opacity="${opacity}"/>`;
    })).join('')}
    <text x="220" y="320" fill="#888" font-size="22" font-family="monospace">U2I · Matrix Factorization</text>
  </g>
  <g transform="translate(700,80)">
    <rect x="0" y="0" width="380" height="380" rx="20" fill="#fff" opacity="0.85"/>
    ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => {
      const v = (r * 5 + c) % 7;
      const colors = ['#ea6f5a', '#5b8def', '#4caf7a', '#f5c842', '#c77dff'];
      return `<rect x="${20 + c * 68}" y="${20 + r * 68}" width="56" height="56" rx="6" fill="${colors[v]}" opacity="${0.3 + v * 0.08}"/>`;
    }).join('')).join('')}
  </g>
  `, PALETTES.warm);
}

function sceneCampusSummer(seed) {
  const treeX = [80, 200, 340, 480, 620, 760, 900, 1050];
  return wrap(`
  <rect x="0" y="420" width="${W}" height="210" fill="#8bc96a"/>
  <path d="M0,420 Q300,390 600,420 T1200,420 L1200,630 L0,630Z" fill="#6aad4e"/>
  ${treeX.map((x, i) => `
    <rect x="${x + 15}" y="${300 + (i % 3) * 10}" width="12" height="130" fill="#7a5c3a"/>
    <ellipse cx="${x + 21}" cy="${270 + (i % 3) * 10}" rx="45" ry="55" fill="#${i % 2 ? '5a9e42' : '4a8e32'}"/>
    <ellipse cx="${x + 5}" cy="${285 + (i % 3) * 10}" rx="30" ry="38" fill="#6aad4e" opacity="0.8"/>
  `).join('')}
  <path d="M100,420 Q400,400 700,415 T1100,405" fill="none" stroke="#c8deb0" stroke-width="40" stroke-linecap="round" opacity="0.5"/>
  <g transform="translate(520,360)">
    <rect x="0" y="30" width="80" height="90" rx="4" fill="#e8d5b5"/>
    <polygon points="0,30 40,0 80,30" fill="#c0392b"/>
    <rect x="25" y="55" width="30" height="40" fill="#8b6914" opacity="0.5"/>
  </g>
  <g transform="translate(380,440)">
    <circle cx="20" cy="15" r="14" fill="#f5c6a0"/>
    <rect x="8" y="28" width="24" height="40" rx="6" fill="#5b8def"/>
    <line x1="20" y1="68" x2="12" y2="90" stroke="#333" stroke-width="3"/>
    <line x1="20" y1="68" x2="28" y2="90" stroke="#333" stroke-width="3"/>
  </g>
  <circle cx="950" cy="100" r="55" fill="#ffe08a" opacity="0.9"/>
  `, PALETTES.green);
}

function sceneLifeSeasons() {
  return wrap(`
  <rect x="0" y="0" width="600" height="${H}" fill="#fff0e8"/>
  <rect x="600" y="0" width="600" height="${H}" fill="#f5ebe0"/>
  <line x1="600" y1="0" x2="600" y2="${H}" stroke="#ccc" stroke-width="2" stroke-dasharray="8 6"/>
  <g transform="translate(80,80)">
    ${[0, 1, 2, 3, 4].map(i => `<ellipse cx="${60 + i * 90}" cy="${200 - (i % 3) * 30}" rx="35" ry="50" fill="#${['e84393', 'fd79a8', 'e17055', 'fdcb6e', 'e84393'][i]}" opacity="0.85"/>`).join('')}
    ${[0, 1, 2, 3, 4].map(i => `<line x1="${60 + i * 90}" y1="250" x2="${60 + i * 90}" y2="350" stroke="#4a7a3a" stroke-width="3"/>`).join('')}
    <text x="200" y="420" text-anchor="middle" fill="#c0392b" font-size="28" font-style="italic" opacity="0.6">夏花</text>
  </g>
  <g transform="translate(680,60)">
    ${[0, 1, 2, 3, 4, 5].map(i => {
      const rot = -30 + i * 15;
      return `<g transform="translate(${80 + (i % 3) * 100},${120 + Math.floor(i / 3) * 100}) rotate(${rot})">
        <ellipse cx="0" cy="0" rx="18" ry="28" fill="#${['c0392b', 'd35400', 'e67e22', 'f39c12', 'd35400', 'c0392b'][i]}" opacity="0.8"/>
        <line x1="0" y1="28" x2="0" y2="55" stroke="#8b6914" stroke-width="2"/>
      </g>`;
    }).join('')}
    <text x="200" y="420" text-anchor="middle" fill="#8b6914" font-size="28" font-style="italic" opacity="0.6">秋叶</text>
  </g>
  `, PALETTES.gold);
}

function sceneNordicAutumn() {
  return wrap(`
  <polygon points="0,350 200,200 400,280 600,180 800,250 1000,150 1200,220 1200,630 0,630" fill="#5a7a9a" opacity="0.5"/>
  <polygon points="0,400 300,300 600,380 900,280 1200,350 1200,630 0,630" fill="#3a5a7a"/>
  <rect x="0" y="480" width="${W}" height="150" fill="#2a4a6a"/>
  <ellipse cx="600" cy="500" rx="500" ry="40" fill="#4a8ab0" opacity="0.6"/>
  <ellipse cx="600" cy="510" rx="450" ry="25" fill="#6ab0d0" opacity="0.4"/>
  ${[120, 280, 450, 620, 800, 980, 1100].map((x, i) => `
    <rect x="${x}" y="${340 - (i % 3) * 40}" width="14" height="${150 + (i % 3) * 40}" fill="#5a4030"/>
    <circle cx="${x + 7}" cy="${300 - (i % 3) * 40}" r="${40 + (i % 2) * 15}" fill="#${['c0392b', 'd35400', 'e67e22'][i % 3]}" opacity="0.85"/>
  `).join('')}
  <polygon points="900,200 1050,120 1100,250" fill="#f0f4f8" opacity="0.9"/>
  <polygon points="950,180 1150,100 1180,220" fill="#e8ecf0" opacity="0.7"/>
  <circle cx="150" cy="100" r="50" fill="#f5d78a" opacity="0.8"/>
  `, PALETTES.dusk);
}

function sceneNordicWinter() {
  return wrap(`
  <rect x="0" y="380" width="${W}" height="250" fill="#e8eef5"/>
  ${[100, 250, 400, 550, 700, 850, 1000].map((x, i) => `
    <rect x="${x}" y="${280 + (i % 2) * 20}" width="${90 + (i % 3) * 20}" height="${100 + (i % 2) * 30}" fill="#d0dae8" stroke="#b0c0d0" stroke-width="1"/>
    <polygon points="${x},${280 + (i % 2) * 20} ${x + 45 + (i % 3) * 10},${240 + (i % 2) * 20} ${x + 90 + (i % 3) * 20},${280 + (i % 2) * 20}" fill="#c0392b" opacity="0.7"/>
    <rect x="${x + 30}" y="${330 + (i % 2) * 20}" width="25" height="30" fill="#ffe08a" opacity="0.9"/>
  `).join('')}
  <ellipse cx="600" cy="420" rx="500" ry="30" fill="#fff" opacity="0.8"/>
  ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 97 + 30) % 1200}" cy="${(i * 53 + 20) % 350}" r="${1.5 + (i % 3)}" fill="#fff" opacity="${0.5 + (i % 5) * 0.1}"/>`).join('')}
  <g transform="translate(480,300)">
    <rect x="0" y="40" width="120" height="80" rx="4" fill="#8b6914"/>
    <rect x="10" y="50" width="100" height="60" fill="#ffe08a" opacity="0.85"/>
    <rect x="0" y="30" width="120" height="15" fill="#6a4a20"/>
    <text x="60" y="78" text-anchor="middle" fill="#8b6914" font-size="14" font-weight="bold">SHOP</text>
  </g>
  `, PALETTES.snow);
}

function sceneAnfengRoad() {
  return wrap(`
  <path d="M0,500 Q400,350 800,420 T1200,380 L1200,630 L0,630Z" fill="#7a9a5a"/>
  <path d="M0,520 Q300,440 600,480 T1200,450" fill="none" stroke="#c8b888" stroke-width="50" stroke-linecap="round" opacity="0.7"/>
  <path d="M0,530 Q300,460 600,490 T1200,465" fill="none" stroke="#a09060" stroke-width="4" stroke-dasharray="12 8" opacity="0.4"/>
  ${[80, 200, 350, 500, 650, 800, 950, 1100].map((x, i) => `
    <circle cx="${x}" cy="${430 + (i % 4) * 15}" r="8" fill="#${['e84393', 'e17055', 'fdcb6e', '6c5ce7'][i % 4]}" opacity="0.8"/>
    <line x1="${x}" y1="${438 + (i % 4) * 15}" x2="${x}" y2="${460 + (i % 4) * 15}" stroke="#4a7a3a" stroke-width="2"/>
  `).join('')}
  <g transform="translate(200,320)">
    <rect x="0" y="60" width="280" height="100" rx="20" fill="#f5c842" opacity="0.9"/>
    <rect x="20" y="30" width="240" height="80" rx="16" fill="#ffe08a"/>
    ${[0, 1, 2, 3, 4].map(i => `<rect x="${35 + i * 42}" y="45" width="30" height="35" rx="4" fill="#87ceeb" opacity="0.6"/>`).join('')}
    <rect x="0" y="130" width="280" height="20" rx="4" fill="#555"/>
    <circle cx="50" cy="155" r="18" fill="#333"/>
    <circle cx="230" cy="155" r="18" fill="#333"/>
  </g>
  <ellipse cx="1000" cy="200" rx="120" ry="60" fill="#b0d0e8" opacity="0.5"/>
  `, PALETTES.green);
}

function sceneCompiler() {
  return wrap(`
  <g transform="translate(100,100)">
    <rect x="0" y="0" width="200" height="380" rx="16" fill="#3776ab"/>
    <text x="100" y="60" text-anchor="middle" fill="#fff" font-size="48" font-weight="bold">Py</text>
    <text x="100" y="200" text-anchor="middle" fill="#ffd43b" font-size="20" font-family="monospace">def compile():</text>
    <text x="100" y="230" text-anchor="middle" fill="#fff" font-size="16" font-family="monospace">  parse()</text>
    <text x="100" y="255" text-anchor="middle" fill="#fff" font-size="16" font-family="monospace">  emit()</text>
  </g>
  <g transform="translate(480,200)">
    ${[0, 1, 2].map(i => `<rect x="${i * 30}" y="${i * 20}" width="80" height="50" rx="8" fill="#ea6f5a" opacity="${0.5 + i * 0.15}" transform="rotate(${i * 15} 40 25)"/>`).join('')}
    <text x="60" y="120" text-anchor="middle" fill="#888" font-size="18">LEX → AST → ASM</text>
  </g>
  <g transform="translate(800,100)">
    <rect x="0" y="0" width="200" height="380" rx="16" fill="#555"/>
    <text x="100" y="60" text-anchor="middle" fill="#5b8def" font-size="48" font-weight="bold">C</text>
    <text x="100" y="200" text-anchor="middle" fill="#0f0" font-size="16" font-family="monospace">mov eax, 1</text>
    <text x="100" y="225" text-anchor="middle" fill="#0f0" font-size="16" font-family="monospace">call printf</text>
    <text x="100" y="250" text-anchor="middle" fill="#0f0" font-size="16" font-family="monospace">ret</text>
  </g>
  <path d="M300,290 L480,290" stroke="#ea6f5a" stroke-width="3" marker-end="url(#arrow)"/>
  <path d="M680,290 L800,290" stroke="#ea6f5a" stroke-width="3"/>
  <defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ea6f5a"/></marker></defs>
  `, PALETTES.warm);
}

function sceneSqlDb() {
  return wrap(`
  <g transform="translate(350,80)">
    <ellipse cx="200" cy="60" rx="160" ry="40" fill="#5b8def"/>
    <rect x="40" y="60" width="320" height="200" fill="#4a7ad0"/>
    <ellipse cx="200" cy="260" rx="160" ry="40" fill="#3a6ac0"/>
    <ellipse cx="200" cy="120" rx="160" ry="40" fill="#6a9ae8" opacity="0.5"/>
    <ellipse cx="200" cy="180" rx="160" ry="40" fill="#6a9ae8" opacity="0.3"/>
    <text x="200" y="170" text-anchor="middle" fill="#fff" font-size="36" font-weight="bold">SQL</text>
  </g>
  <g transform="translate(100,200)" opacity="0.8">
    <rect x="0" y="0" width="180" height="120" rx="8" fill="#fff" stroke="#5b8def" stroke-width="2"/>
    ${[0, 1, 2, 3].map(r => `<line x1="10" y1="${25 + r * 25}" x2="170" y2="${25 + r * 25}" stroke="#ddd" stroke-width="1"/>`).join('')}
    ${[0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<rect x="${15 + c * 55}" y="${8 + r * 25}" width="45" height="18" rx="3" fill="#${['e8f0ff', 'd0e4ff', 'e8f0ff'][c]}" opacity="0.8"/>`).join('')).join('')}
  </g>
  <g transform="translate(750,180)" opacity="0.8">
    <rect x="0" y="0" width="280" height="160" rx="8" fill="#1e1e2e"/>
    <text x="20" y="35" fill="#c678dd" font-size="16" font-family="monospace">SELECT * FROM</text>
    <text x="20" y="60" fill="#98c379" font-size="16" font-family="monospace">  users WHERE id=1;</text>
    <text x="20" y="100" fill="#61afef" font-size="16" font-family="monospace">JOIN orders ON ...</text>
  </g>
  `, PALETTES.cool);
}

function sceneMiniprogram() {
  return wrap(`
  <rect x="380" y="60" width="440" height="520" rx="40" fill="#1a1a2e" stroke="#333" stroke-width="4"/>
  <rect x="400" y="100" width="400" height="460" rx="8" fill="#fff"/>
  <rect x="400" y="100" width="400" height="50" fill="#07c160"/>
  <text x="600" y="133" text-anchor="middle" fill="#fff" font-size="20">微信小程序</text>
  <g transform="translate(430,180)">
    ${[0, 1, 2].map(r => [0, 1, 2].map(c => `
      <rect x="${c * 120}" y="${r * 110}" width="100" height="90" rx="12" fill="#${['fff0ee', 'eef6ff', 'f0fff0'][c]}" stroke="#ddd" stroke-width="1"/>
      <circle cx="${c * 120 + 50}" cy="${r * 110 + 35}" r="20" fill="#${['ea6f5a', '5b8def', '4caf7a'][c]}"/>
      <rect x="${c * 120 + 20}" y="${r * 110 + 65}" width="60" height="8" rx="4" fill="#ddd"/>
    `).join('')).join('')}
  </g>
  <circle cx="200" cy="300" r="80" fill="#07c160" opacity="0.2"/>
  <circle cx="1000" cy="200" r="60" fill="#07c160" opacity="0.15"/>
  `, PALETTES.green);
}

function sceneWordpressBlog() {
  return wrap(`
  <g transform="translate(200,100)">
    <rect x="0" y="80" width="500" height="350" rx="12" fill="#fff" stroke="#ddd" stroke-width="2"/>
    <rect x="0" y="80" width="500" height="40" fill="#f0f0f0"/>
    <circle cx="25" cy="100" r="8" fill="#ea6f5a"/><circle cx="50" cy="100" r="8" fill="#f5c842"/><circle cx="75" cy="100" r="8" fill="#4caf7a"/>
    <rect x="30" y="150" width="200" height="12" rx="4" fill="#ddd"/>
    <rect x="30" y="175" width="440" height="8" rx="3" fill="#eee"/>
    <rect x="30" y="195" width="400" height="8" rx="3" fill="#eee"/>
    <rect x="30" y="215" width="420" height="8" rx="3" fill="#eee"/>
    <rect x="30" y="260" width="180" height="100" rx="8" fill="#ffd9cc"/>
    <rect x="230" y="260" width="240" height="8" rx="3" fill="#eee"/>
    <rect x="230" y="280" width="200" height="8" rx="3" fill="#eee"/>
  </g>
  <g transform="translate(780,150)">
    <circle cx="80" cy="80" r="70" fill="#21759b"/>
    <text x="80" y="95" text-anchor="middle" fill="#fff" font-size="48" font-weight="bold">W</text>
  </g>
  <g transform="translate(820,350)">
    <rect x="0" y="0" width="120" height="140" rx="6" fill="#fff" stroke="#ea6f5a" stroke-width="2"/>
    <line x1="15" y1="25" x2="105" y2="25" stroke="#ea6f5a" stroke-width="2"/>
    <line x1="15" y1="45" x2="90" y2="45" stroke="#ccc" stroke-width="2"/>
    <line x1="15" y1="65" x2="100" y2="65" stroke="#ccc" stroke-width="2"/>
  </g>
  `, PALETTES.warm);
}

function sceneVimEditor() {
  return wrap(`
  <rect x="150" y="60" width="900" height="510" rx="12" fill="#1e1e2e" stroke="#444" stroke-width="3"/>
  <rect x="150" y="60" width="900" height="35" fill="#2d2d3d"/>
  <text x="180" y="84" fill="#888" font-size="16" font-family="monospace">vim — config</text>
  <text x="180" y="130" fill="#61afef" font-size="18" font-family="monospace">set number</text>
  <text x="180" y="160" fill="#98c379" font-size="18" font-family="monospace">syntax on</text>
  <text x="180" y="190" fill="#c678dd" font-size="18" font-family="monospace">colorscheme desert</text>
  <text x="180" y="220" fill="#e5c07b" font-size="18" font-family="monospace">set tabstop=4</text>
  <text x="180" y="250" fill="#61afef" font-size="18" font-family="monospace">nnoremap &lt;leader&gt;w :w&lt;CR&gt;</text>
  <rect x="150" y="535" width="900" height="35" fill="#2d2d3d"/>
  <text x="180" y="558" fill="#4caf7a" font-size="16" font-family="monospace">-- NORMAL --</text>
  <text x="950" y="558" text-anchor="end" fill="#888" font-size="16" font-family="monospace">Vim 8.2</text>
  <g transform="translate(920,120)">
    <rect x="0" y="0" width="80" height="380" rx="4" fill="#019833" opacity="0.85"/>
    <text x="40" y="200" text-anchor="middle" fill="#fff" font-size="36" font-weight="bold" transform="rotate(90 40 200)">VIM</text>
  </g>
  `, PALETTES.dusk);
}

function sceneVueFrontend() {
  return wrap(`
  <g transform="translate(300,80)">
    <rect x="0" y="0" width="600" height="400" rx="16" fill="#fff" stroke="#ddd" stroke-width="2"/>
    <rect x="0" y="0" width="600" height="50" fill="#42b883" rx="16"/>
    <rect x="0" y="25" width="600" height="25" fill="#42b883"/>
    <text x="300" y="35" text-anchor="middle" fill="#fff" font-size="20" font-weight="bold">Vue Component</text>
    <g transform="translate(30,80)">
      <rect x="0" y="0" width="160" height="280" rx="8" fill="#f0faf5" stroke="#42b883" stroke-width="2"/>
      <rect x="20" y="30" width="120" height="60" rx="6" fill="#42b883" opacity="0.3"/>
      <rect x="20" y="110" width="120" height="60" rx="6" fill="#35495e" opacity="0.2"/>
      <rect x="20" y="190" width="120" height="60" rx="6" fill="#42b883" opacity="0.3"/>
    </g>
    <g transform="translate(220,80)">
      <rect x="0" y="100" width="340" height="180" rx="8" fill="#fff5f0" stroke="#ea6f5a" stroke-width="2"/>
      <rect x="20" y="30" width="300" height="120" rx="8" fill="#ffd9cc" opacity="0.5"/>
      <circle cx="60" cy="180" r="8" fill="#ea6f5a"/><circle cx="90" cy="180" r="8" fill="#ddd"/><circle cx="120" cy="180" r="8" fill="#ddd"/>
    </g>
  </g>
  <polygon points="150,300 220,260 220,340" fill="#42b883" opacity="0.6"/>
  <polygon points="1050,300 980,260 980,340" fill="#42b883" opacity="0.6"/>
  `, PALETTES.green);
}

function sceneAlgorithmPat() {
  return wrap(`
  <g transform="translate(150,80)">
    <rect x="0" y="0" width="900" height="420" rx="16" fill="#fff" stroke="#5b8def" stroke-width="2"/>
    <text x="450" y="50" text-anchor="middle" fill="#5b8def" font-size="24" font-weight="bold">Algorithm</text>
    ${[0, 1, 2, 3, 4].map(i => `
      <g transform="translate(${80 + i * 160}, 100)">
        <rect x="0" y="0" width="120" height="80" rx="8" fill="#${['e8f0ff', 'd0e4ff', 'e8f0ff', 'd0e4ff', 'e8f0ff'][i]}" stroke="#5b8def" stroke-width="1"/>
        <text x="60" y="48" text-anchor="middle" fill="#5b8def" font-size="28" font-weight="bold">${['A', 'B', 'C', 'D', 'E'][i]}</text>
        ${i < 4 ? `<line x1="120" y1="40" x2="160" y2="40" stroke="#ea6f5a" stroke-width="2"/>` : ''}
      </g>
    `).join('')}
    <g transform="translate(80, 240)">
      <rect x="0" y="0" width="740" height="120" rx="8" fill="#1e1e2e"/>
      <text x="30" y="40" fill="#98c379" font-size="18" font-family="monospace">for (int i = 0; i &lt; n; i++) {</text>
      <text x="50" y="70" fill="#61afef" font-size="18" font-family="monospace">  dp[i] = max(dp[i-1], dp[i-2] + a[i]);</text>
      <text x="30" y="100" fill="#98c379" font-size="18" font-family="monospace">}</text>
    </g>
  </g>
  `, PALETTES.cool);
}

function sceneIslandMemoir() {
  return wrap(`
  <ellipse cx="600" cy="520" rx="550" ry="60" fill="#4a8ab0" opacity="0.5"/>
  <path d="M0,480 Q200,440 400,460 T800,450 T1200,470 L1200,630 L0,630Z" fill="#c8a882"/>
  <path d="M100,480 Q250,420 400,460 Q550,500 700,440 Q850,380 1000,450" fill="#8b7355" opacity="0.6"/>
  <g transform="translate(400,280)">
    <rect x="0" y="80" width="400" height="120" rx="8" fill="#8b6914" opacity="0.8"/>
    <rect x="20" y="40" width="360" height="80" rx="6" fill="#a08050"/>
    <rect x="40" y="10" width="320" height="60" rx="4" fill="#c0a070"/>
    <rect x="0" y="200" width="400" height="30" fill="#555"/>
    <path d="M-20,200 Q200,150 420,200" fill="none" stroke="#666" stroke-width="3"/>
  </g>
  <circle cx="200" cy="120" r="45" fill="#ffe08a" opacity="0.7"/>
  <g transform="translate(150,350)">
    <rect x="0" y="0" width="60" height="80" rx="4" fill="#e8d5b5"/>
    <polygon points="0,0 30,-25 60,0" fill="#8b4513"/>
  </g>
  <g transform="translate(900,360)">
    <rect x="0" y="0" width="50" height="70" rx="4" fill="#d0c0a0"/>
    <polygon points="0,0 25,-20 50,0" fill="#6a4020"/>
  </g>
  `, PALETTES.gold);
}

function sceneTravelLake() {
  return wrap(`
  <polygon points="0,280 300,120 600,200 900,100 1200,180 1200,630 0,630" fill="#6a8a5a"/>
  <polygon points="0,320 400,200 800,280 1200,220 1200,630 0,630" fill="#5a7a4a"/>
  <ellipse cx="600" cy="450" rx="550" ry="80" fill="#4a9ac0" opacity="0.7"/>
  <ellipse cx="600" cy="470" rx="500" ry="50" fill="#6ab8d8" opacity="0.5"/>
  <circle cx="150" cy="100" r="50" fill="#ffe08a"/>
  <path d="M500,450 Q600,420 700,450" fill="none" stroke="#fff" stroke-width="2" opacity="0.4"/>
  <g transform="translate(750,300)">
  ${[0, 1, 2].map(i => `<polygon points="${i * 40},80 ${i * 40 + 30},0 ${i * 40 + 60},80" fill="#fff" opacity="${0.5 - i * 0.1}"/>`).join('')}
  </g>
  `, PALETTES.cool);
}

function sceneLoveEmotion() {
  return wrap(`
  <circle cx="600" cy="500" r="300" fill="#ffd9cc" opacity="0.4"/>
  <circle cx="500" cy="280" r="80" fill="#ea6f5a" opacity="0.85" transform="rotate(-30 500 280)"/>
  <circle cx="580" cy="240" r="80" fill="#ea6f5a" opacity="0.85" transform="rotate(30 580 240)"/>
  <polygon points="540,320 600,420 660,320" fill="#ea6f5a" opacity="0.85"/>
  <circle cx="900" cy="150" r="40" fill="#ffe08a" opacity="0.8"/>
  <circle cx="950" cy="130" r="30" fill="#ffd9cc" opacity="0.6"/>
  ${[0, 1, 2, 3, 4].map(i => `<circle cx="${200 + i * 80}" cy="${400 + (i % 2) * 30}" r="4" fill="#ea6f5a" opacity="0.5"/>`).join('')}
  <path d="M100,500 Q300,350 500,450 T900,400" fill="none" stroke="#ea6f5a" stroke-width="2" opacity="0.3" stroke-dasharray="6 4"/>
  `, PALETTES.warm);
}

function sceneLifeReflection() {
  return wrap(`
  <rect x="0" y="400" width="${W}" height="230" fill="#3a2a1a"/>
  <rect x="500" y="200" width="200" height="280" fill="#5a4030"/>
  <polygon points="500,200 600,120 700,200" fill="#4a3020"/>
  <rect x="560" y="280" width="30" height="50" fill="#ffe08a" opacity="0.7"/>
  <rect x="620" y="250" width="25" height="40" fill="#ffe08a" opacity="0.5"/>
  <circle cx="300" cy="350" r="8" fill="#ffe08a"/>
  <circle cx="900" cy="320" r="6" fill="#ffe08a" opacity="0.7"/>
  <ellipse cx="600" cy="430" rx="400" ry="30" fill="#2a1a0a" opacity="0.5"/>
  <g transform="translate(200,300)">
    <rect x="0" y="40" width="8" height="60" fill="#8b6914"/>
    <ellipse cx="4" cy="30" rx="50" ry="35" fill="#ea6f5a" opacity="0.7"/>
    <rect x="60" y="50" width="100" height="6" rx="2" fill="#c0a070"/>
    <rect x="60" y="65" width="80" height="6" rx="2" fill="#c0a070" opacity="0.6"/>
  </g>
  <circle cx="150" cy="120" r="45" fill="#f5d78a" opacity="0.6"/>
  `, PALETTES.dusk);
}

function sceneCloudServer() {
  return wrap(`
  <ellipse cx="400" cy="200" rx="120" ry="60" fill="#fff" opacity="0.9"/>
  <ellipse cx="500" cy="180" rx="100" ry="50" fill="#fff" opacity="0.85"/>
  <ellipse cx="350" cy="180" rx="80" ry="40" fill="#fff" opacity="0.8"/>
  <g transform="translate(650,120)">
    <rect x="0" y="0" width="120" height="200" rx="8" fill="#2d2d3d"/>
    <rect x="10" y="15" width="100" height="8" rx="2" fill="#4caf7a"/>
    <rect x="10" y="30" width="100" height="8" rx="2" fill="#4caf7a" opacity="0.7"/>
    <rect x="10" y="45" width="100" height="8" rx="2" fill="#f5c842" opacity="0.5"/>
    ${[0, 1, 2].map(i => `<circle cx="60" cy="${100 + i * 30}" r="4" fill="#4caf7a"/>`).join('')}
  </g>
  <g transform="translate(820,120)">
    <rect x="0" y="0" width="120" height="200" rx="8" fill="#2d2d3d"/>
    <rect x="10" y="15" width="100" height="8" rx="2" fill="#5b8def"/>
    <rect x="10" y="30" width="100" height="8" rx="2" fill="#5b8def" opacity="0.7"/>
    ${[0, 1, 2].map(i => `<circle cx="60" cy="${100 + i * 30}" r="4" fill="#5b8def"/>`).join('')}
  </g>
  <path d="M500,240 L650,180" stroke="#5b8def" stroke-width="2" stroke-dasharray="6 4" opacity="0.5"/>
  <path d="M500,240 L820,180" stroke="#5b8def" stroke-width="2" stroke-dasharray="6 4" opacity="0.5"/>
  <rect x="200" y="380" width="800" height="160" rx="12" fill="#1e1e2e"/>
  <text x="600" y="470" text-anchor="middle" fill="#4caf7a" font-size="20" font-family="monospace">$ deploy --production</text>
  `, PALETTES.cool);
}

function sceneFarmGame() {
  return wrap(`
  <rect x="0" y="350" width="${W}" height="280" fill="#8b6914"/>
  ${[0, 1, 2, 3, 4, 5].map(i => `
    <rect x="${80 + i * 180}" y="380" width="140" height="100" rx="4" fill="#${['8b7355', 'a08050', '8b7355', 'a08050', '8b7355', 'a08050'][i]}" stroke="#6a5030" stroke-width="1"/>
    <text x="${150 + i * 180}" y="445" text-anchor="middle" font-size="36">${['🥬', '🥕', '🌽', '🍅', '🍆', '🌻'][i]}</text>
  `).join('')}
  <g transform="translate(450,120)">
    <rect x="0" y="60" width="300" height="180" rx="12" fill="#c0392b" opacity="0.8"/>
    <polygon points="0,60 150,0 300,60" fill="#8b2020"/>
    <rect x="120" y="120" width="60" height="80" fill="#5a3010"/>
    <rect x="40" y="100" width="50" height="40" fill="#ffe08a" opacity="0.6"/>
    <rect x="210" y="100" width="50" height="40" fill="#ffe08a" opacity="0.6"/>
  </g>
  <circle cx="100" cy="80" r="45" fill="#ffe08a"/>
  `, PALETTES.green);
}

function sceneLinkCard() {
  return wrap(`
  <rect x="250" y="150" width="700" height="200" rx="12" fill="#fff" stroke="#ddd" stroke-width="2"/>
  <rect x="250" y="150" width="200" height="200" rx="12" fill="#e8f0ff"/>
  <rect x="280" y="200" width="140" height="100" rx="8" fill="#5b8def" opacity="0.3"/>
  <rect x="480" y="180" width="300" height="14" rx="4" fill="#333"/>
  <rect x="480" y="210" width="400" height="10" rx="3" fill="#ccc"/>
  <rect x="480" y="235" width="350" height="10" rx="3" fill="#ccc"/>
  <rect x="480" y="260" width="200" height="10" rx="3" fill="#ccc"/>
  <text x="480" y="310" fill="#0084ff" font-size="16">zhihu.com/question/...</text>
  <rect x="250" y="400" width="700" height="120" rx="12" fill="#fff" stroke="#ddd" stroke-width="2"/>
  <rect x="280" y="425" width="80" height="70" rx="8" fill="#ffd9cc"/>
  <rect x="380" y="430" width="250" height="12" rx="4" fill="#333"/>
  <rect x="380" y="455" width="400" height="8" rx="3" fill="#ccc"/>
  <rect x="380" y="475" width="300" height="8" rx="3" fill="#ccc"/>
  `, PALETTES.cool);
}

function sceneCommentSystem() {
  return wrap(`
  <g transform="translate(200,100)">
    ${[0, 1, 2].map(i => `
      <g transform="translate(0, ${i * 150})">
        <circle cx="30" cy="30" r="25" fill="#${['ea6f5a', '5b8def', '4caf7a'][i]}"/>
        <rect x="70" y="10" width="500" height="80" rx="12" fill="#fff" stroke="#ddd" stroke-width="1"/>
        <rect x="90" y="25" width="300" height="8" rx="3" fill="#ddd"/>
        <rect x="90" y="45" width="400" height="8" rx="3" fill="#eee"/>
        <rect x="90" y="65" width="200" height="8" rx="3" fill="#eee"/>
      </g>
    `).join('')}
  </g>
  <g transform="translate(800,150)">
    <circle cx="80" cy="80" r="70" fill="none" stroke="#ea6f5a" stroke-width="6" opacity="0.3"/>
    <path d="M50,80 L70,100 L110,60" fill="none" stroke="#4caf7a" stroke-width="6" stroke-linecap="round"/>
  </g>
  `, PALETTES.warm);
}

function sceneChildhood() {
  return wrap(`
  <rect x="0" y="420" width="${W}" height="210" fill="#90c860"/>
  <g transform="translate(300,200)">
    <circle cx="60" cy="40" r="30" fill="#f5c6a0"/>
    <rect x="35" y="70" width="50" height="70" rx="8" fill="#5b8def"/>
    <line x1="60" y1="140" x2="40" y2="200" stroke="#333" stroke-width="4"/>
    <line x1="60" y1="140" x2="80" y2="200" stroke="#333" stroke-width="4"/>
  </g>
  <g transform="translate(550,210)">
    <circle cx="60" cy="40" r="30" fill="#f5c6a0"/>
    <rect x="35" y="70" width="50" height="70" rx="8" fill="#ea6f5a"/>
    <line x1="60" y1="140" x2="40" y2="200" stroke="#333" stroke-width="4"/>
    <line x1="60" y1="140" x2="80" y2="200" stroke="#333" stroke-width="4"/>
  </g>
  <rect x="450" y="350" width="300" height="15" rx="4" fill="#8b6914"/>
  <circle cx="200" cy="100" r="40" fill="#ffe08a" opacity="0.8"/>
  ${[0, 1, 2, 3].map(i => `<circle cx="${100 + i * 60}" cy="${380 + (i % 2) * 20}" r="5" fill="#fff" opacity="0.6"/>`).join('')}
  `, PALETTES.green);
}

function sceneLiteraryDefault(seed) {
  const hues = ['#ea6f5a', '#5b8def', '#4caf7a', '#f5c842', '#c77dff'];
  const accent = hues[seed % hues.length];
  return wrap(`
  <g opacity="0.12"><circle cx="150" cy="500" r="200" fill="${accent}"/><circle cx="1050" cy="130" r="160" fill="${accent}"/></g>
  <g transform="translate(350,120)">
    <rect x="0" y="0" width="500" height="360" rx="8" fill="#fff" opacity="0.9" stroke="${accent}" stroke-width="2"/>
    <line x1="60" y1="60" x2="440" y2="60" stroke="#ddd" stroke-width="2"/>
    <line x1="60" y1="100" x2="400" y2="100" stroke="#eee" stroke-width="2"/>
    <line x1="60" y1="130" x2="420" y2="130" stroke="#eee" stroke-width="2"/>
    <line x1="60" y1="160" x2="380" y2="160" stroke="#eee" stroke-width="2"/>
    <line x1="60" y1="190" x2="410" y2="190" stroke="#eee" stroke-width="2"/>
    <line x1="60" y1="220" x2="350" y2="220" stroke="#eee" stroke-width="2"/>
    <path d="M60,280 Q200,250 350,280" fill="none" stroke="${accent}" stroke-width="2" opacity="0.4"/>
    <circle cx="420" cy="300" r="30" fill="${accent}" opacity="0.2"/>
  </g>
  <g transform="translate(150,350)">
    <rect x="0" y="0" width="120" height="8" rx="3" fill="${accent}" opacity="0.5" transform="rotate(-15 60 4)"/>
    <rect x="20" y="20" width="80" height="6" rx="2" fill="${accent}" opacity="0.3" transform="rotate(-10 60 23)"/>
  </g>
  `, { ...PALETTES.warm, accent });
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
