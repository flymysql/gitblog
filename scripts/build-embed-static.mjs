#!/usr/bin/env node
/**
 * 将 cloudbase/static 的评论嵌入资源打包到 cloudbase/.deploy-static/ 再部署。
 * comment-avatars.js 会打进 comments-embed.js，运行时不再单独请求该模块，
 * 避免 CloudBase CDN 上无 ?v= 的旧 comment-avatars.js 被命中。
 */
import esbuild from 'esbuild';
import {
  cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const srcDir = join(root, 'cloudbase/static');
const outDir = join(root, 'cloudbase/.deploy-static');

function readEmbedAssetVersion() {
  const cfg = readFileSync(join(root, 'assets/js/config.js'), 'utf8');
  return (cfg.match(/embedAssetVersion:\s*["']([^"']+)["']/) || [])[1] || '';
}

function copyTree(relPath) {
  const from = join(srcDir, relPath);
  const to = join(outDir, relPath);
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

const embedAssetVersion = readEmbedAssetVersion();
if (!embedAssetVersion) {
  console.warn('build-embed-static: 未读到 embedAssetVersion，继续打包');
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const name of [
  'comments-embed.html',
  'comments-list-embed.html',
  'comments-compose-embed.html',
  'comments-admin-embed.html',
  'comments-embed.css',
  'comments-admin-embed.css',
]) {
  copyTree(name);
}

copyTree('comment-avatars');

await esbuild.build({
  entryPoints: [join(srcDir, 'comments-embed.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: join(outDir, 'comments-embed.js'),
  legalComments: 'none',
  logLevel: 'info',
});

await esbuild.build({
  entryPoints: [join(srcDir, 'comments-admin-embed.js')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: join(outDir, 'comments-admin-embed.js'),
  legalComments: 'none',
  logLevel: 'info',
});

// 覆盖 CDN 上可能仍被缓存的旧 comment-avatars.js（jsDelivr 版），避免其它入口误加载
copyTree('comment-avatars.js');

const marker = join(outDir, '.embed-build.json');
writeFileSync(marker, JSON.stringify({
  embedAssetVersion,
  builtAt: new Date().toISOString(),
}, null, 2));

console.log(`build-embed-static: → cloudbase/.deploy-static/ (embedAssetVersion=${embedAssetVersion})`);
