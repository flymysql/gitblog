import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import * as cheerio from 'cheerio';

const POSTS_DIR = 'posts';
const CODE_TABLE_RE = /<table><tbody><tr><td class="gutter">[\s\S]*?<\/td><td class="code">([\s\S]*?)<\/td><\/tr><\/tbody><\/table>/g;

function inferLang(markdown) {
  const fm = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  const text = (fm ? fm[1] : markdown).toLowerCase();
  if (/javascript|vue|微信小程序|前端|博客/.test(text)) return 'javascript';
  if (/c\+\+|cpp|算法|pat/.test(text)) return 'cpp';
  if (/sql/.test(text)) return 'sql';
  if (/css/.test(text)) return 'css';
  if (/html/.test(text)) return 'html';
  return '';
}

function markdownUnescapeCode(text) {
  return text
    .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/g, '');
}

function codeFromHtml(codeHtml) {
  const $ = cheerio.load(`<div id="code-root">${codeHtml}</div>`, { decodeEntities: true });
  const lines = $('#code-root .line').toArray().map(el => $(el).text());
  if (lines.length) return markdownUnescapeCode(lines.join('\n'));

  $('#code-root br').replaceWith('\n');
  return markdownUnescapeCode($('#code-root').text());
}

function escapeYamlString(text) {
  return JSON.stringify(text);
}

function extractSummary(markdown, max = 90) {
  const content = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

function rewriteBadSummary(markdown) {
  const fm = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!fm) return markdown;
  const yaml = fm[1];
  const hasBadSummary = /^summary:\s*.*(?:<table|<tbody|<td class=|<pre|\$1)/m.test(yaml);
  if (!hasBadSummary) return markdown;

  const summary = escapeYamlString(extractSummary(markdown));
  const nextYaml = /^summary:/m.test(yaml)
    ? yaml.replace(/^summary:\s*.*$/m, `summary: ${summary}`)
    : `${yaml}\nsummary: ${summary}`;
  return `---\n${nextYaml}\n---\n\n${markdown.slice(fm[0].length).replace(/^\n+/, '')}`;
}

let touchedFiles = 0;
let touchedBlocks = 0;
let touchedSummaries = 0;

for (const file of readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'))) {
  const path = `${POSTS_DIR}/${file}`;
  const raw = readFileSync(path, 'utf8');
  const hadCodeTable = CODE_TABLE_RE.test(raw);
  const hadBadSummary = /^---\s*\n[\s\S]*?^summary:\s*.*(?:<table|<tbody|<td class=|<pre|\$1)/m.test(raw);
  if (!hadCodeTable && !hadBadSummary) continue;

  const lang = inferLang(raw);
  let count = 0;
  CODE_TABLE_RE.lastIndex = 0;
  let next = raw.replace(CODE_TABLE_RE, (_, codeHtml) => {
    count++;
    const code = codeFromHtml(codeHtml);
    return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
  }).replace(/\n{4,}/g, '\n\n\n');
  const beforeSummary = next;
  next = rewriteBadSummary(next);

  writeFileSync(path, next, 'utf8');
  touchedFiles++;
  touchedBlocks += count;
  if (next !== beforeSummary) touchedSummaries++;
  console.log(`fixed ${file}: ${count} code block(s)${next !== beforeSummary ? ', summary' : ''}`);
}

console.log(`\nDone. fixed ${touchedBlocks} code block(s), ${touchedSummaries} summary field(s) in ${touchedFiles} file(s).`);
