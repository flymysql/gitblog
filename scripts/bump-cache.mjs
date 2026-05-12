// 一次性升级缓存版本号 + 注入 PWA head 标签
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const NEW = '20260512170800';

let cfg = readFileSync('assets/js/config.js', 'utf8');
cfg = cfg.replace(/(VERSION\s*=\s*')(\d+)(')/, `$1${NEW}$3`);
writeFileSync('assets/js/config.js', cfg);
console.log('assets/js/config.js -> VERSION', NEW);

if (existsSync('sw.js')) {
  let sw = readFileSync('sw.js', 'utf8');
  sw = sw.replace(/(SW_VERSION\s*=\s*')(\d+)(')/, `$1${NEW}$3`);
  writeFileSync('sw.js', sw);
  console.log('sw.js -> SW_VERSION', NEW);
}

const tpl = 'scripts/release-template/config.js';
if (existsSync(tpl)) {
  let t = readFileSync(tpl, 'utf8');
  t = t.replace(/(VERSION\s*=\s*')(\d+)(')/, `$1${NEW}$3`);
  writeFileSync(tpl, t);
}

function walk(dir) {
  const out = [];
  for (const it of readdirSync(dir, { withFileTypes: true })) {
    if (it.name === 'node_modules') continue;
    if (it.name.startsWith('.git')) continue;
    if (it.name === 'scripts' || it.name === 'data' || it.name === 'mcps' || it.name === 'agent-transcripts') continue;
    const p = join(dir, it.name);
    if (it.isDirectory()) out.push(...walk(p));
    else if (it.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const PWA_BLOCK = rel => [
  `<link rel="manifest" href="${rel}manifest.webmanifest">`,
  `<meta name="theme-color" content="#ea6f5a">`,
  `<link rel="apple-touch-icon" href="${rel}assets/icon.svg">`,
  `<meta name="apple-mobile-web-app-capable" content="yes">`,
].join('\n  ');

const htmls = walk('.');
let bumped = 0, injected = 0;
for (const f of htmls) {
  let s = readFileSync(f, 'utf8');
  const before = s;
  s = s.replace(/\?v=20260\d{9}/g, `?v=${NEW}`);
  if (!/rel="manifest"/.test(s)) {
    const isAdmin = f.includes(`admin${sep}`) || f.includes('admin/');
    const rel = isAdmin ? '../' : '';
    if (/<\/head>/.test(s)) {
      s = s.replace(/<\/head>/, `  ${PWA_BLOCK(rel)}\n</head>`);
      injected++;
    }
  }
  if (s !== before) {
    writeFileSync(f, s);
    bumped++;
  }
}
console.log(`html bumped: ${bumped}, pwa injected: ${injected}, total html: ${htmls.length}`);
