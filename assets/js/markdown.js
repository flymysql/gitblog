// ============================================================================
// Markdown 与 frontmatter 工具
// 使用 CDN 上的 marked 进行渲染（编辑器和阅读页都会用到）
// ============================================================================

const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.umd.min.js';

let markedReady = null;

export function loadMarked() {
  if (window.marked) return Promise.resolve(window.marked);
  if (markedReady) return markedReady;
  markedReady = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = MARKED_CDN;
    s.onload = () => {
      try {
        window.marked.setOptions({ gfm: true, breaks: false });
      } catch {}
      resolve(window.marked);
    };
    s.onerror = () => reject(new Error('Failed to load marked'));
    document.head.appendChild(s);
  });
  return markedReady;
}

export async function renderMarkdown(md) {
  const marked = await loadMarked();
  return marked.parse(md || '');
}

// ---------- frontmatter 解析 ----------
// 支持简单 YAML 子集：key: value、key: [a, b, c]、字符串带引号
const FM_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

export function parseFrontmatter(text) {
  const m = text.match(FM_RE);
  if (!m) return { data: {}, content: text };
  const yaml = m[1];
  const content = text.slice(m[0].length);
  const data = parseYamlLite(yaml);
  return { data, content };
}

export function stringifyFrontmatter(data, content) {
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      const items = value.map(v => formatScalar(v)).join(', ');
      lines.push(`${key}: [${items}]`);
    } else if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${formatScalar(value)}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n\n${content || ''}`;
}

function formatScalar(v) {
  if (typeof v === 'string') {
    if (/[:#\[\],&*?|<>='"%@`{}]/.test(v) || /^\s|\s$/.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  return String(v);
}

function parseYamlLite(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line || /^\s*#/.test(line)) continue;
    const m = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (value === '') {
      out[key] = '';
      continue;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
      out[key] = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(stripQuote);
    } else if ((value.startsWith('"') && value.endsWith('"')) ||
               (value.startsWith("'") && value.endsWith("'"))) {
      out[key] = stripQuote(value);
    } else if (value === 'true' || value === 'false') {
      out[key] = value === 'true';
    } else if (!isNaN(Number(value)) && value.trim() !== '') {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function stripQuote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// ---------- 工具：从正文提取摘要 ----------
export function extractSummary(content, max = 80) {
  const plain = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max) + '…' : plain;
}

export function slugify(title) {
  const base = title
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5\-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'untitled';
}
