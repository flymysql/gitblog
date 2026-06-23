// ============================================================================
// 构建期：JS 打包 + CSS/JS 压缩，并同步 HTML 中的资源引用
// 保留源码 assets/js|css 供开发/后台使用；读者页 HTML 指向 assets/dist/*.min.*
// ============================================================================
import esbuild from 'esbuild';
import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync,
} from 'node:fs';
import { join } from 'node:path';

const DIST = 'assets/dist';

const JS_ENTRIES = {
  'home.min.js': 'assets/js/home.js',
  'post.min.js': 'assets/js/post.js',
  'tags.min.js': 'assets/js/tags.js',
  'archives.min.js': 'assets/js/archives.js',
  'series.min.js': 'assets/js/series.js',
  'notes.min.js': 'assets/js/notes.js',
  'tools.min.js': 'assets/js/tools.js',
  'tool-age.min.js': 'assets/js/tool-age.js',
  'tool-fortune.min.js': 'assets/js/tool-fortune.js',
  'tool-json.min.js': 'assets/js/tool-json.js',
  'tool-codec.min.js': 'assets/js/tool-codec.js',
  'tool-timestamp.min.js': 'assets/js/tool-timestamp.js',
  'tool-regex.min.js': 'assets/js/tool-regex.js',
  'tool-qrcode.min.js': 'assets/js/tool-qrcode.js',
  'tool-image.min.js': 'assets/js/tool-image.js',
  'tool-network.min.js': 'assets/js/tool-network.js',
  'tool-farm-seed.min.js': 'assets/js/tool-farm-seed.js',
};

const CSS_ENTRIES = {
  'common.min.css': 'assets/css/common.css',
  'home.min.css': 'assets/css/home.css',
  'post.min.css': 'assets/css/post.css',
  'tools.min.css': 'assets/css/tools.css',
  'admin.min.css': 'assets/css/admin.css',
};

/** 读者页 JS：源码 → dist */
export const JS_DIST_MAP = Object.fromEntries(
  Object.entries(JS_ENTRIES).map(([out, src]) => [src, `${DIST}/${out}`]),
);

/** 读者页 CSS：源码 → dist */
export const CSS_DIST_MAP = Object.fromEntries(
  Object.entries(CSS_ENTRIES).map(([out, src]) => [src, `${DIST}/${out}`]),
);

function readVersion() {
  const raw = readFileSync('assets/js/config.js', 'utf8');
  return (raw.match(/VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '0';
}

function walkHtmlFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'admin') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtmlFiles(full, acc);
    else if (name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 将 HTML 中的 assets/js|css 引用替换为 dist 压缩版 */
export function rewriteHtmlAssetRefs(html, version) {
  let out = html;
  const v = version || readVersion();

  for (const [src, dist] of Object.entries(CSS_DIST_MAP)) {
    for (const prefix of ['', '/']) {
      const from = `${prefix}${src}`;
      const to = `${prefix}${dist}`;
      out = out.replace(
        new RegExp(`${escapeRe(from)}\\?v=[^"'\\s>]+`, 'g'),
        `${to}?v=${v}`,
      );
    }
  }

  for (const [src, dist] of Object.entries(JS_DIST_MAP)) {
    for (const prefix of ['', '/']) {
      const from = `${prefix}${src}`;
      const to = `${prefix}${dist}`;
      out = out.replace(
        new RegExp(`${escapeRe(from)}\\?v=[^"'\\s>]+`, 'g'),
        `${to}?v=${v}`,
      );
    }
  }

  return out;
}

function syncSwPrecache(version) {
  if (!existsSync('sw.js')) return;
  let sw = readFileSync('sw.js', 'utf8');
  sw = sw.replace(/const SW_VERSION = '[^']+';/, `const SW_VERSION = '${version}';`);

  const assetUrls = [
    ...Object.values(CSS_DIST_MAP),
    ...Object.values(JS_DIST_MAP),
  ].map(p => `'${p}?v=${version}'`);

  if (/const PRECACHE_ASSETS = \[[\s\S]*?\];/.test(sw)) {
    sw = sw.replace(
      /const PRECACHE_ASSETS = \[[\s\S]*?\];/,
      `const PRECACHE_ASSETS = [\n  ${assetUrls.join(',\n  ')},\n];`,
    );
  } else {
    sw = sw.replace(
      /const OFFLINE_URL = 'offline\.html';/,
      `const OFFLINE_URL = 'offline.html';\n\nconst PRECACHE_ASSETS = [\n  ${assetUrls.join(',\n  ')},\n];`,
    );
    sw = sw.replace(
      /cache\.addAll\(PRECACHE_URLS\.map/,
      'cache.addAll([...PRECACHE_URLS, ...PRECACHE_ASSETS].map',
    );
  }

  writeFileSync('sw.js', sw);
}

export async function bundleAssets() {
  mkdirSync(DIST, { recursive: true });
  const version = readVersion();

  for (const [out, src] of Object.entries(JS_ENTRIES)) {
    await esbuild.build({
      entryPoints: [src],
      outfile: join(DIST, out),
      bundle: true,
      minify: true,
      format: 'esm',
      target: ['es2020'],
      legalComments: 'none',
      logLevel: 'warning',
    });
  }

  for (const [out, src] of Object.entries(CSS_ENTRIES)) {
    await esbuild.build({
      entryPoints: [src],
      outfile: join(DIST, out),
      minify: true,
      logLevel: 'warning',
    });
  }

  const htmlFiles = [
    'index.html', 'post.html', 'tags.html', 'archives.html', 'series.html', 'notes.html',
    '404.html', 'offline.html',
    ...walkHtmlFiles('post'),
    ...walkHtmlFiles('tools'),
  ].filter(f => existsSync(f));

  let synced = 0;
  for (const file of htmlFiles) {
    const raw = readFileSync(file, 'utf8');
    const next = rewriteHtmlAssetRefs(raw, version);
    if (next !== raw) {
      writeFileSync(file, next);
      synced++;
    }
  }

  syncSwPrecache(version);

  console.log(
    `bundle: ${Object.keys(JS_ENTRIES).length} JS + ${Object.keys(CSS_ENTRIES).length} CSS → ${DIST}/ (html synced: ${synced})`
  );
  return { version, synced };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bundleAssets().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
