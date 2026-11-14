// Verify the generated site, without a browser, JavaScript execution or network.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { load } from 'cheerio';
import { CONFIG } from '../assets/js/config.js';

const root = process.cwd();
const home = new URL(CONFIG.site.url.replace(/\/+$/, '') + '/');
const posts = JSON.parse(readFileSync('data/posts.json', 'utf8')).posts.filter(post => !post.draft);
const expected = new Set(posts.map(post => new URL(`post/${encodeURIComponent(post.urlKey)}/`, home).href));
function readPage(url) {
  const relative = decodeURIComponent(url.pathname.slice(home.pathname.length));
  const filename = resolve(root, relative + (url.pathname.endsWith('/') ? 'index.html' : ''));
  if (!filename.startsWith(root + sep) || !existsSync(filename) || !filename.endsWith('.html')) return null;
  return load(readFileSync(filename, 'utf8'));
}

const visited = new Set();
const queue = [home.href];
while (queue.length) {
  const href = queue.shift();
  if (visited.has(href)) continue;
  visited.add(href);
  const current = new URL(href);
  const $ = readPage(current);
  if (!$ || /noindex/i.test($('meta[name="robots"]').attr('content') || '')) continue;
  for (const link of $('a[href]').toArray()) {
    let url;
    try { url = new URL($(link).attr('href'), current); }
    catch { continue; } // Some migrated articles contain malformed external URLs.
    if (url.origin !== home.origin || !url.pathname.startsWith(home.pathname)) continue;
    url.hash = '';
    url.search = '';
    if (!visited.has(url.href)) queue.push(url.href);
  }
}
const missing = [...expected].filter(url => !visited.has(url));
assert.deepEqual(missing, [], `Articles unreachable through static HTML links: ${missing.join(', ')}`);

const archive = load(readFileSync('archives.html', 'utf8'));
assert.equal(archive('main > h1').length, 1, 'Archive must have one main heading');
assert.equal(archive('#archiveList').length, 1, 'Archive must have one list container');
assert.equal(archive('.archive-item').length, posts.length, 'Archive must list each public article once');
const archiveUrls = archive('.archive-item a.title[href]').toArray()
  .map(link => new URL(archive(link).attr('href'), home).href);
assert.equal(new Set(archiveUrls).size, posts.length, 'Archive must not duplicate article links');
assert.deepEqual(new Set(archiveUrls), expected, 'Archive must include every canonical public article');

for (const href of expected) {
  const $ = readPage(new URL(href));
  assert.ok($, `Missing generated article: ${href}`);
  assert.equal($('#article > .article-header .article-title').length, 1, `Duplicate article title: ${href}`);
  assert.equal($('#article > .article-body').length, 1, `Duplicate article body: ${href}`);
  assert.equal($('link[rel="canonical"]').length, 1, `Duplicate canonical: ${href}`);
  assert.equal($('link[rel="canonical"]').attr('href'), href, `Incorrect canonical: ${href}`);
  assert.match($('meta[name="robots"]').attr('content') || '', /^index, follow$/, `Article not indexable: ${href}`);
  assert.equal($('#site-nav > nav').length, 1, `Missing or duplicate navigation: ${href}`);
  assert.equal($('#article > .post-neighbors').length, posts.length > 1 ? 1 : 0, `Missing or duplicate neighbors: ${href}`);
  assert.ok($('#article > .post-related').length <= 1, `Duplicate related list: ${href}`);
}

const adminFiles = readdirSync('admin').filter(name => name.endsWith('.html'));
for (const filename of adminFiles) {
  const $ = load(readFileSync(`admin/${filename}`, 'utf8'));
  assert.equal($('meta[name="robots"]').length, 1, `Duplicate admin robots: ${filename}`);
  assert.equal($('meta[name="robots"]').attr('content'), 'noindex, follow', `Admin page must not be indexed: ${filename}`);
}
console.log(`Static discovery verified: ${expected.size}/${expected.size} public articles reachable; archive, article markup/canonicals and ${adminFiles.length} admin exclusions passed.`);
