// ============================================================================
// 阅读端内容增强器：数学公式 / Mermaid / 代码块行号 + 折叠
// 这些增强对 marked 输出的 HTML 节点进行后处理，互不依赖，按需调用即可。
// 资源（KaTeX / Mermaid）使用懒加载：页面里没有对应内容就不引入。
// ============================================================================

const KATEX_VERSION = '0.16.9';
const KATEX_CSS = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`;
const KATEX_JS  = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`;

const MERMAID_VERSION = '11.2.1';
const MERMAID_JS = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;

const FOLD_THRESHOLD = 22;  // 超过这么多行的代码块默认折叠

// -------------- 工具：懒加载脚本 / 样式 --------------
const loaded = new Map();
function loadScript(src) {
  if (loaded.has(src)) return loaded.get(src);
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load failed: ' + src));
    document.head.appendChild(s);
  });
  loaded.set(src, p);
  return p;
}
function loadStyle(href) {
  if (loaded.has(href)) return loaded.get(href);
  const p = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('load failed: ' + href));
    document.head.appendChild(link);
  });
  loaded.set(href, p);
  return p;
}

// -------------- KaTeX --------------
export async function enhanceMath(article) {
  const nodes = [...article.querySelectorAll('.math[data-tex]')];
  if (!nodes.length) return;
  try {
    await Promise.all([loadStyle(KATEX_CSS), loadScript(KATEX_JS)]);
  } catch (e) {
    console.warn('[math] KaTeX failed to load', e);
    return;
  }
  const katex = window.katex;
  if (!katex) return;
  for (const el of nodes) {
    const tex = el.dataset.tex || '';
    const display = el.dataset.display === '1' || el.classList.contains('math-block');
    try {
      katex.render(tex, el, { displayMode: display, throwOnError: false, output: 'html' });
    } catch (e) {
      el.textContent = (display ? '$$' : '$') + tex + (display ? '$$' : '$');
      console.warn('[math] render fail', e);
    }
  }
}

// -------------- Mermaid --------------
export async function enhanceMermaid(article) {
  const nodes = [...article.querySelectorAll('.mermaid[data-mermaid]')];
  if (!nodes.length) return;
  try {
    await loadScript(MERMAID_JS);
  } catch (e) {
    console.warn('[mermaid] failed to load', e);
    return;
  }
  const mermaid = window.mermaid;
  if (!mermaid) return;
  const dark = document.documentElement.getAttribute('data-mode') === 'dark';
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'inherit',
    });
  } catch (_) {}
  // 用 textContent 当源码渲染（避免 marked 把里面的 < > 转义后被 mermaid 误读）
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const code = el.dataset.mermaid || el.textContent || '';
    const id = `mermaid-${Date.now()}-${i}`;
    try {
      const { svg } = await mermaid.render(id, code);
      el.innerHTML = svg;
      el.classList.add('mermaid-rendered');
    } catch (e) {
      el.classList.add('mermaid-error');
      el.innerHTML = `<pre style="color:#b00;">Mermaid 解析失败：\n${(e && e.message) || e}</pre>`;
    }
  }
}

// -------------- 代码块：行号 + 长代码折叠 --------------
export function enhanceCodeAdvanced(article) {
  article.querySelectorAll('pre > code').forEach(code => {
    const pre = code.parentElement;
    if (!pre || pre.classList.contains('code-enhanced')) return;
    pre.classList.add('code-enhanced');

    // 推断语言
    const langMatch = (code.className || '').match(/language-([\w-]+)/i);
    const lang = (langMatch && langMatch[1]) || '';
    if (lang) pre.dataset.lang = lang;

    const text = code.textContent || '';
    const lines = text.replace(/\n$/, '').split('\n');
    const lineCount = lines.length;

    // 1) 行号列：用一个 .code-line-numbers 兄弟元素 absolute 定位
    if (lineCount > 1) {
      const gutter = document.createElement('span');
      gutter.className = 'code-line-numbers';
      gutter.setAttribute('aria-hidden', 'true');
      gutter.textContent = lines.map((_, i) => i + 1).join('\n');
      pre.appendChild(gutter);
      pre.classList.add('has-line-numbers');
    }

    // 2) 顶部 meta 条（语言徽标）
    if (lang) {
      const tag = document.createElement('span');
      tag.className = 'code-lang';
      tag.textContent = lang;
      pre.appendChild(tag);
    }

    // 3) 长代码折叠
    if (lineCount > FOLD_THRESHOLD) {
      pre.classList.add('code-foldable', 'code-folded');
      pre.dataset.lineCount = String(lineCount);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'code-fold-toggle';
      toggle.textContent = `展开全部 ${lineCount} 行`;
      toggle.addEventListener('click', () => {
        const folded = pre.classList.toggle('code-folded');
        toggle.textContent = folded ? `展开全部 ${lineCount} 行` : '收起';
      });
      pre.appendChild(toggle);
    }
  });
}
