// ============================================================================
// Markdown 与 frontmatter 工具
// 使用 CDN 上的 marked 进行渲染（编辑器和阅读页都会用到）
// 集成：
//   - 数学公式（$...$ 行内 / $$...$$ 块级，最终由 KaTeX 在 post.js 中渲染）
//   - mermaid 代码块（``` mermaid ）保留为 .mermaid 容器，由 post.js 渲染
// ============================================================================

const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.umd.min.js';

let markedReady = null;

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---------- marked 扩展：数学公式 + mermaid ----------
function buildMathExtensions() {
  // 块级公式：以 $$ 开头、$$ 结尾，独占行
  const mathBlock = {
    name: 'mathBlock',
    level: 'block',
    start(src) { return src.indexOf('\n$$'); },
    tokenizer(src) {
      const m = /^\s*\$\$([\s\S]+?)\$\$\s*(?:\n|$)/.exec(src);
      if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
    },
    renderer(token) {
      // 把原始 LaTeX 包到 data-tex，KaTeX 在文章渲染后读取并渲染
      return `<div class="math math-block" data-tex="${escapeHtml(token.text)}" data-display="1"></div>`;
    },
  };
  // 行内公式：单 $ ... $（要求两端紧贴非空白，避免 $5.99 这类被误判）
  const mathInline = {
    name: 'mathInline',
    level: 'inline',
    start(src) {
      const idx = src.indexOf('$');
      return idx < 0 ? undefined : idx;
    },
    tokenizer(src) {
      const m = /^\$([^\s$][^\n$]*?[^\s$]|[^\s$])\$(?!\d)/.exec(src);
      if (m) return { type: 'mathInline', raw: m[0], text: m[1] };
    },
    renderer(token) {
      return `<span class="math math-inline" data-tex="${escapeHtml(token.text)}"></span>`;
    },
  };
  return [mathBlock, mathInline];
}

// 让 ```mermaid``` 代码块直接渲染成 .mermaid 容器（marked 默认会包成 <pre><code class="language-mermaid">）
function patchMermaidRenderer(marked) {
  const renderer = new marked.Renderer();
  const original = renderer.code.bind(renderer);
  renderer.code = function(code, infostring, escaped) {
    const lang = (infostring || '').match(/^\S*/)[0].toLowerCase();
    if (lang === 'mermaid') {
      // 不要 escape，mermaid 自己会 parse 文本
      return `<div class="mermaid" data-mermaid="${escapeHtml(code)}">${escapeHtml(code)}</div>`;
    }
    return original(code, infostring, escaped);
  };
  return renderer;
}

export function loadMarked() {
  if (window.marked) return Promise.resolve(window.marked);
  if (markedReady) return markedReady;
  markedReady = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = MARKED_CDN;
    s.onload = () => {
      try {
        window.marked.setOptions({
          gfm: true,
          breaks: false,
          renderer: patchMermaidRenderer(window.marked),
        });
        window.marked.use({ extensions: buildMathExtensions() });
      } catch (e) {
        console.warn('[markdown] extension setup failed', e);
      }
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
    if (value.startsWith('{') && value.endsWith('}')) {
      // inline JSON 对象，写入侧用 JSON.stringify 序列化
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // 注意：tags 之类的 inline 数组用空格分隔成员里逗号即可，
      // 这里不进 JSON.parse，否则 [a, b] 会因为没引号失败
      try {
        if (/^\[\s*[\{"]/.test(value)) {
          out[key] = JSON.parse(value);
          continue;
        }
      } catch {}
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
