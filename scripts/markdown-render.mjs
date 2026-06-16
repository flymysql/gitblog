// 构建期 Markdown 渲染（与 assets/js/markdown.js 扩展保持一致）
import { marked } from 'marked';

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function buildMathExtensions() {
  const mathBlock = {
    name: 'mathBlock',
    level: 'block',
    start(src) { return src.indexOf('\n$$'); },
    tokenizer(src) {
      const m = /^\s*\$\$([\s\S]+?)\$\$\s*(?:\n|$)/.exec(src);
      if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
    },
    renderer(token) {
      return `<div class="math math-block" data-tex="${escapeHtml(token.text)}" data-display="1"></div>`;
    },
  };
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

function patchMermaidRenderer(baseRenderer) {
  const renderer = baseRenderer || new marked.Renderer();
  const original = renderer.code.bind(renderer);
  renderer.code = function(code, infostring, escaped) {
    const lang = (infostring || '').match(/^\S*/)[0].toLowerCase();
    if (lang === 'mermaid') {
      return `<div class="mermaid" data-mermaid="${escapeHtml(code)}">${escapeHtml(code)}</div>`;
    }
    return original(code, infostring, escaped);
  };
  return renderer;
}

const renderer = patchMermaidRenderer(new marked.Renderer());
marked.setOptions({ gfm: true, breaks: false, renderer });
marked.use({ extensions: buildMathExtensions() });

export function renderMarkdown(md) {
  return marked.parse(md || '');
}
