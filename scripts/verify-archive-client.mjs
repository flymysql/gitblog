// Exercise the archive entry and real public API with both fetch attempts failing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { load } from 'cheerio';
import { VERSION } from '../assets/js/config.js';

const { outputFiles } = await build({
  entryPoints: ['assets/js/archives.js'], bundle: true, write: false, format: 'iife',
  plugins: [{
    name: 'isolate-unrelated-site-controls',
    setup(plugin) {
      plugin.onResolve({ filter: /^\.\/site\.js$/ }, () => ({ path: 'site-controls', namespace: 'test' }));
      plugin.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
        export function initSite() {}
        export function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
        export function postPathFromPost(p) { return '/post/' + p.urlKey + '/'; }
      ` }));
    },
  }],
});
const source = outputFiles[0].text;
const html = readFileSync('archives.html', 'utf8');
const posts = JSON.parse(readFileSync('data/posts.json', 'utf8')).posts.filter(p => !p.draft);
for (const failure of ['network', 'http404', 'invalid-json', 'empty-index', 'invalid-dates', 'healthy']) {
  const $ = load(html);
  const originalList = $('#archiveList').html();
  const originalDescription = $('#archiveDesc').text();
  const pageUrl = 'https://gitpull.cn/archives.html?utm_source=archive-test';
  function wrap(node) {
    if (!node) return null;
    const element = $(node);
    return {
      raw: node,
      get href() { return new URL(element.attr('href'), pageUrl).href; },
      get innerHTML() { return element.html(); },
      set innerHTML(value) { element.html(value); },
      get textContent() { return element.text(); },
      set textContent(value) { element.text(value); },
      querySelector(selector) { return wrap(element.find(selector)[0]); },
      setAttribute(name, value) { element.attr(name, String(value)); },
      appendChild(child) { element.append(child.raw); },
    };
  }
  const requests = [];
  const document = {
    head: wrap($('head')[0]),
    querySelector: selector => wrap($(selector)[0]),
    createElement: tag => wrap($(`<${tag}>`)[0]),
    set title(value) { $('title').text(value); },
  };
  runInNewContext(source, {
    document, window: { location: new URL(pageUrl) }, URL, AbortController, setTimeout, clearTimeout, console,
    fetch: async url => {
      requests.push(url);
      if (failure === 'network') throw new Error('offline');
      if (failure === 'http404') return { ok: false, status: 404 };
      return { ok: true, json: async () => {
        if (failure === 'invalid-json') throw new SyntaxError('invalid JSON');
        if (failure === 'healthy') return { posts };
        if (failure === 'invalid-dates') return { posts: [{ slug: 'invalid', date: 'bad-date', tags: [] }] };
        return { posts: [] };
      } };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, ['network', 'http404', 'invalid-json'].includes(failure) ? 2 : 1, failure);
  assert.ok(requests.every(url => new URL(url).pathname === '/data/posts.json'), 'Must exercise the real API URL');
  if (failure !== 'healthy') {
    assert.equal($('#archiveList').html(), originalList, `${failure}: static links were replaced`);
    assert.equal($('#archiveDesc').text(), originalDescription, `${failure}: static description was replaced`);
  }
  assert.equal($('.archive-item').length, posts.length, `${failure}: lost or duplicate archive entries`);
  assert.equal($('link[rel="canonical"]').attr('href'), 'https://gitpull.cn/archives.html', `${failure}: tracking query entered canonical`);
}
console.log('Archive client verified: real API retries preserve static content on network/404/JSON/empty/invalid failures; healthy hydration and canonical without query passed.');

// An already installed old SW must miss its old query-keyed cached bundles.
const sw = readFileSync('sw.js', 'utf8');
assert.ok(sw.includes(`const SW_VERSION = '${VERSION}'`), 'SW cache version must follow release VERSION');
const archiveScript = load(html)('script[src*="archives.min.js"]').attr('src');
const scriptUrls = [new URL(archiveScript, 'https://gitpull.cn/archives.html')];
for (const post of posts) {
  const $ = load(readFileSync(`post/${post.urlKey}/index.html`, 'utf8'));
  const script = $('script[src*="post.min.js"]').attr('src');
  const url = new URL(script, `https://gitpull.cn/post/${post.urlKey}/`);
  assert.equal(url.searchParams.get('v'), VERSION, 'Every article must load the new bundle URL');
  if (scriptUrls.length < 2) scriptUrls.push(url);
}
for (const url of scriptUrls) {
  assert.equal(url.searchParams.get('v'), VERSION, 'Archive/article asset URL must use release VERSION');
  assert.ok(sw.includes(url.pathname.slice(1) + url.search), 'New SW must precache new archive/article URLs');
  const handlers = {};
  const oldUrl = new URL(url);
  oldUrl.searchParams.set('v', 'previous-release');
  const entries = new Map([[oldUrl.href, new Response('OLD_BUNDLE')]]);
  const oldSw = sw.replaceAll(VERSION, 'previous-release');
  const fetches = [];
  runInNewContext(oldSw, {
    self: { location: { origin: url.origin }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    URL, Request, console,
    caches: {
      match: async request => entries.get(request.url)?.clone(),
      open: async () => ({ put: async (request, response) => { entries.set(request.url, response); } }),
    },
    fetch: async request => { fetches.push(request.url); return new Response('NEW_BUNDLE'); },
  });
  let result;
  const pending = [];
  handlers.fetch({ request: new Request(url), respondWith: value => { result = value; }, waitUntil: value => pending.push(value) });
  assert.equal(await (await result).text(), 'NEW_BUNDLE', 'Old SW must not serve the previous cached bundle');
  await Promise.all(pending);
  assert.deepEqual(fetches, [url.href], 'Old SW must fetch the new query-keyed bundle URL');
}
console.log('Asset compatibility verified: every article/archive uses new release URLs; old installed SW fetches new bundles and new SW precaches them.');
