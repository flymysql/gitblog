import { initToolPage, $, escapeHtml } from './tool-kit-common.js';

initToolPage({
  title: '正则测试',
  description: '在线正则表达式测试，实时高亮匹配并列出所有 match。',
  path: 'tool-regex.html',
});

function runRegex() {
  const pattern = $('regexPattern').value;
  const flags = $('regexFlags').value;
  const text = $('regexText').value;
  const preview = $('regexPreview');
  const matchesEl = $('regexMatches');

  if (!pattern) {
    preview.innerHTML = '';
    matchesEl.innerHTML = '<p class="tool-kit-placeholder">输入正则表达式</p>';
    return;
  }

  let re;
  try {
    re = new RegExp(pattern, flags);
  } catch (e) {
    preview.innerHTML = '';
    matchesEl.innerHTML = `<p class="tool-kit-error">${escapeHtml(e.message)}</p>`;
    return;
  }

  const matches = [...text.matchAll(re)];
  let html = escapeHtml(text);
  if (matches.length) {
    const parts = [];
    let last = 0;
    matches.forEach(m => {
      if (m.index > last) parts.push(escapeHtml(text.slice(last, m.index)));
      parts.push(`<mark>${escapeHtml(m[0])}</mark>`);
      last = m.index + m[0].length;
    });
    if (last < text.length) parts.push(escapeHtml(text.slice(last)));
    html = parts.join('');
  }
  preview.innerHTML = `<pre class="tool-kit-pre">${html || '（空）'}</pre>`;
  matchesEl.innerHTML = matches.length
    ? `<p>共 ${matches.length} 处匹配</p><ol class="tool-kit-match-list">${matches.map(m =>
      `<li><code>${escapeHtml(m[0])}</code> @ ${m.index}${m.groups ? ` · groups: ${escapeHtml(JSON.stringify(m.groups))}` : ''}</li>`
    ).join('')}</ol>`
    : '<p class="tool-kit-placeholder">无匹配</p>';
}

['input', 'change'].forEach(ev => {
  $('regexPattern').addEventListener(ev, runRegex);
  $('regexFlags').addEventListener(ev, runRegex);
  $('regexText').addEventListener(ev, runRegex);
});
