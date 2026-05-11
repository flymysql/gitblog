// ============================================================================
// 一次性清洗脚本：
//   1) 删除文章里"被多篇共用的本地图"（公众号 banner / 二维码 / 通用装饰图）
//   2) 删除明显的微信公众号引流段落（关键词匹配整段移除）
//   3) 砍掉文章首尾"只有图片或空白"的装饰段
//   4) tag 含『邻家酒肆』的文章作者改为「邻家酒肆」
//
// 用法：node scripts/strip-wechat.mjs [--dry]
// ============================================================================

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const POSTS_DIR = 'posts';
const DRY = process.argv.includes('--dry');

// ---------- frontmatter 工具 ----------
function splitFrontmatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { yaml: '', body: raw, prefix: '' };
  return { yaml: m[1], body: raw.slice(m[0].length), prefix: m[0] };
}

function parseTags(yaml) {
  const m = yaml.match(/^tags:\s*\n((?:\s*-\s+.+\n?)+)/m);
  if (!m) return [];
  return m[1].split(/\n/)
    .map(line => (line.match(/^\s*-\s+(?:["]([^"]*)["]|([^\s].*?))\s*$/) || [])[1] || (line.match(/^\s*-\s+([^\s].*?)\s*$/) || [])[1])
    .filter(Boolean);
}

function setAuthor(yaml, author) {
  if (/^author:\s*.+$/m.test(yaml)) {
    return yaml.replace(/^author:\s*.+$/m, `author: "${author}"`);
  }
  // 没有 author：插到 date 后
  if (/^(updated|date):.*$/m.test(yaml)) {
    return yaml.replace(/^((?:updated|date):.*)$/m, `$1\nauthor: "${author}"`);
  }
  return yaml.trimEnd() + `\nauthor: "${author}"`;
}

function setCover(yaml, cover) {
  if (/^cover:\s*.+$/m.test(yaml)) {
    return yaml.replace(/^cover:\s*.+$/m, `cover: ${cover}`);
  }
  return yaml;
}

function setDraft(yaml, draft) {
  if (/^draft:\s*.+$/m.test(yaml)) {
    return yaml.replace(/^draft:\s*.+$/m, `draft: ${draft ? 'true' : 'false'}`);
  }
  if (!draft) return yaml;
  return yaml.trimEnd() + '\ndraft: true';
}

function effectiveTextLength(body) {
  return body
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/[\s\*_#>\-`~]/g, '')
    .length;
}

function readCover(yaml) {
  const m = yaml.match(/^cover:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

function removeCoverField(yaml) {
  return yaml.replace(/^cover:\s*.+\n?/m, '');
}

// ---------- 第一遍：算所有本地图的内容 hash 共用次数 ----------
const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));

const urlToHash = new Map();
const hashCount = new Map();    // hash -> 共用篇数
const hashSize = new Map();     // hash -> 文件字节

function imageHash(localPath) {
  if (urlToHash.has(localPath)) return urlToHash.get(localPath);
  let h = '';
  try {
    if (existsSync(localPath)) {
      const buf = readFileSync(localPath);
      h = createHash('sha1').update(buf).digest('hex');
      hashSize.set(h, buf.length);
    }
  } catch {}
  urlToHash.set(localPath, h);
  return h;
}

function extractImageUrls(body) {
  const urls = [];
  for (const m of body.matchAll(/!\[[^\]]*]\(\s*([^)\s]+)/g)) urls.push(m[1]);
  for (const m of body.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)) urls.push(m[1]);
  return urls;
}

for (const f of files) {
  const { body } = splitFrontmatter(readFileSync(`${POSTS_DIR}/${f}`, 'utf8'));
  const seen = new Set();
  for (const u of extractImageUrls(body)) {
    if (!u.startsWith('assets/uploads/')) continue;
    const h = imageHash(u);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    hashCount.set(h, (hashCount.get(h) || 0) + 1);
  }
}

// 共用阈值：≥3 篇 共用 视为通用图（公众号 banner、二维码、装饰）
const SHARED_THRESHOLD = 3;
function isSharedDecor(localPath) {
  const h = imageHash(localPath);
  if (!h) return false;
  return (hashCount.get(h) || 0) >= SHARED_THRESHOLD;
}

// ---------- 公众号引流文案：关键词集合 ----------
// 整段任意位置匹配以下任一关键词 → 整段删除
const PROMO_PATTERNS = [
  // 邻家酒肆 公众号特征
  /GOODNIGHT/i,
  /我\s*相\s*信\s*这\s*么\s*好\s*看/,
  /已\s*经\s*置\s*顶\s*了\s*我/,
  /每\s*晚\s*睡\s*前\s*陪\s*你/,
  /陪\s*你\s*说\s*个\s*故\s*事/,
  /先\s*听\s*这\s*首\s*歌/,
  /^\s*\**\s*肆\s*主\s*\**\s*[:：]/m,
  /邻家酒肆[：:]\s*一个/,
  /微博\s*@\s*二肆/,
  /联系微信\s*[:：]\s*sinx/i,
  /投稿\s*[:：]\s*237199972/,
  /部分\s*言论\s*源自\s*网络/,
  // 通用公众号引流
  /长按二维码/,
  /扫码关注/,
  /扫一扫\s*[，,。]?\s*关注/,
  /关注我们的?(微信)?公众号/,
  /关注公众号[:：]/,
  /微信\s*公众号\s*[:：]\s*\S/,
  /长按识别(下方)?二维码/,
  /公众号\s*回复\s*关键?词?/,
  /回复\s*关键?词?\s*[:：]?\s*\S+\s*获取/,
  /搜索\s*微信公众号/,
];

function isPromoParagraph(p) {
  const text = p.replace(/!\[[^\]]*]\([^)]+\)/g, '').replace(/[*_#>~`-]/g, '').trim();
  if (!text) return false;
  return PROMO_PATTERNS.some(re => re.test(text));
}

// ---------- 段落清洗 ----------
// 装饰段：去掉图片/装饰符号/空白后还剩什么；剩 0 个有效字符即为装饰段
const DECOR_CHARS = /[\s\u00a0*_~`>#=\-\u2014\u2013·\.,。，、…\u25BD\u25BC\u25B3\u25B2\u25B6\u25C0\u25CF\u25CB\u25A0\u25A1\u25C6\u25C7\u2606\u2605\u2661\u2665\u2192\u2190\u2191\u2193\u21E0-\u21FF\u2500-\u259F]/g;
function paragraphIsImageOnly(p) {
  const stripped = p
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/&nbsp;/g, '')
    .replace(DECOR_CHARS, '');
  return stripped.length === 0;
}

function cleanBody(body, { stripWechatImages = true, stripPromoText = true, stripDecorEdges = true } = {}) {
  // 1) 删除「共享装饰图」的图片标记（不动文字）
  if (stripWechatImages) {
    body = body.replace(/!\[[^\]]*]\(\s*([^)\s]+?)(?:\s+"[^"]*")?\s*\)/g, (m, url) => {
      if (url.startsWith('assets/uploads/') && isSharedDecor(url)) return '';
      return m;
    });
    body = body.replace(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi, (m, url) => {
      if (url.startsWith('assets/uploads/') && isSharedDecor(url)) return '';
      return m;
    });
  }

  // 2) 段落级处理：split → filter → join
  let paragraphs = body.split(/\n{2,}/);

  // 引流段落整段删除（且联动删除其后紧邻的"只剩图片"装饰段）
  if (stripPromoText) {
    paragraphs = paragraphs.filter(p => !isPromoParagraph(p));
  }

  // 3) 砍掉首尾的"纯图片或空白"装饰段（连续）
  if (stripDecorEdges) {
    while (paragraphs.length && paragraphIsImageOnly(paragraphs[0])) paragraphs.shift();
    while (paragraphs.length && paragraphIsImageOnly(paragraphs[paragraphs.length - 1])) paragraphs.pop();
  }

  return paragraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------- 主循环 ----------
let touched = 0;
const log = [];

for (const f of files) {
  const path = `${POSTS_DIR}/${f}`;
  const raw = readFileSync(path, 'utf8');
  const { yaml: yamlOrig, body, prefix } = splitFrontmatter(raw);
  if (!prefix) continue;

  const tags = parseTags(yamlOrig);
  const isLinjia = tags.includes('邻家酒肆');

  let yaml = yamlOrig;
  let nextBody = cleanBody(body);
  const beforeImageCount = (body.match(/!\[/g) || []).length;
  const afterImageCount = (nextBody.match(/!\[/g) || []).length;
  const removedImages = beforeImageCount - afterImageCount;

  // 4) 邻家酒肆作者改名
  if (isLinjia) {
    const m = yaml.match(/^author:\s*"?([^"\n]+)"?$/m);
    if (m && m[1].trim() !== '邻家酒肆') {
      yaml = setAuthor(yaml, '邻家酒肆');
    }
  }

  // 5) 如果原 cover 指向的图被砍掉了 / 是共享图，把 cover 字段也清掉
  const oldCover = readCover(yaml);
  if (oldCover) {
    const localPath = oldCover.replace(/^\.\.\//, '');
    if (localPath.startsWith('assets/uploads/') && isSharedDecor(localPath)) {
      yaml = removeCoverField(yaml);
    }
  }

  // 6) 清洗后正文几乎为空 → 打成 draft，首页不显示但文件保留
  if (effectiveTextLength(nextBody) < 80 && isLinjia) {
    if (!/^draft:\s*true\s*$/m.test(yaml)) {
      yaml = setDraft(yaml, true);
    }
  }

  const changedBody = nextBody.trim() !== body.trim();
  const changedYaml = yaml !== yamlOrig;

  if (changedBody || changedYaml) {
    touched++;
    const tag = `[${f}]`;
    const parts = [];
    if (removedImages > 0) parts.push(`-${removedImages} img`);
    if (body.length - nextBody.length > 0) {
      const removedChars = body.length - nextBody.length;
      parts.push(`-${removedChars} chars`);
    }
    if (changedYaml) {
      const yamlDiff = [];
      if (/^author:/m.test(yaml) && yaml.match(/^author:\s*"?邻家酒肆"?$/m) && !yamlOrig.match(/^author:\s*"?邻家酒肆"?$/m)) {
        yamlDiff.push('author→邻家酒肆');
      }
      if (oldCover && !readCover(yaml)) yamlDiff.push('cover removed');
      if (yamlDiff.length) parts.push(yamlDiff.join(', '));
    }
    log.push(`${tag} ${parts.join('  |  ')}`);

    if (!DRY) {
      writeFileSync(path, `---\n${yaml}\n---\n\n${nextBody}`, 'utf8');
    }
  }
}

console.log(log.join('\n'));
console.log(`\n=== 清洗完成 ===`);
console.log(`处理文章: ${touched} / ${files.length}`);
console.log(`共享图阈值: ≥${SHARED_THRESHOLD} 篇 共用 视为通用图`);
if (DRY) console.log('(DRY-RUN：未写入)');
