import { readFileSync } from 'node:fs';

function getSectionBool(cfgRaw, section, key, fallback = false) {
  const re = new RegExp(`${section}\\s*:\\s*\\{[\\s\\S]*?${key}\\s*:\\s*(true|false)`);
  const m = cfgRaw.match(re);
  if (!m) return fallback;
  return m[1] === 'true';
}

function getNestedStr(cfgRaw, section, key) {
  const re = new RegExp(`${section}\\s*:\\s*\\{[\\s\\S]*?${key}\\s*:\\s*"([^"]*)"`);
  const m = cfgRaw.match(re);
  return m ? m[1] : '';
}

function xmlEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

/** CloudBase PV beacon 预连接 / 预取（构建期注入 head） */
export function buildPvBeaconHeadTags(cfgRaw = readFileSync('assets/js/config.js', 'utf8')) {
  if (!getSectionBool(cfgRaw, 'pageviews', 'enabled', true)) return '';
  if (!getSectionBool(cfgRaw, 'cloudbase', 'enabled', true)) return '';
  const embed = (cfgRaw.match(/embedBaseUrl\s*:\s*"([^"]*)"/) || [])[1]?.trim() || '';
  if (!embed) return '';
  let origin = '';
  try { origin = new URL(embed).origin; } catch { return ''; }
  const envId = getNestedStr(cfgRaw, 'cloudbase', 'envId')
    || (cfgRaw.match(/envId\s*:\s*"([^"]*)"/) || [])[1] || '';
  const region = getNestedStr(cfgRaw, 'cloudbase', 'region') || 'ap-shanghai';
  const fn = getNestedStr(cfgRaw, 'cloudbase', 'functionName') || 'gitblog-comments';
  const v = (cfgRaw.match(/embedAssetVersion\s*:\s*"([^"]*)"/) || [])[1] || '';
  const u = new URL(`${embed.replace(/\/+$/, '')}/pv-beacon.html`);
  if (envId) u.searchParams.set('env', envId);
  u.searchParams.set('region', region);
  u.searchParams.set('fn', fn);
  if (v) u.searchParams.set('v', v);
  return [
    `<link rel="dns-prefetch" href="${xmlEsc(origin)}">`,
    `<link rel="preconnect" href="${xmlEsc(origin)}" crossorigin>`,
    `<link rel="prefetch" href="${xmlEsc(u.toString())}" as="document">`,
  ].join('\n  ');
}
