import { initToolPage, $ } from './tool-kit-common.js';

initToolPage({
  title: '时间戳转换',
  description: 'Unix 时间戳（秒/毫秒）与本地日期时间互转，支持一键取当前时间。',
  path: 'tools/tool-timestamp.html',
});

function toLocalInput(d) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 19);
}

function showTsResult(html) {
  $('tsResult').innerHTML = html;
}

$('tsNow').addEventListener('click', () => {
  const now = new Date();
  $('tsUnix').value = String(now.getTime());
  $('tsDate').value = toLocalInput(now);
  showTsResult(`
    <p><strong>当前</strong> ${now.toLocaleString()}（${Intl.DateTimeFormat().resolvedOptions().timeZone}）</p>
    <p>秒：<code>${Math.floor(now.getTime() / 1000)}</code> · 毫秒：<code>${now.getTime()}</code></p>
  `);
});

$('tsToDate').addEventListener('click', () => {
  let n = Number(String($('tsUnix').value).trim());
  if (!Number.isFinite(n)) {
    showTsResult('<p class="tool-kit-error">请输入有效数字</p>');
    return;
  }
  const unit = $('tsUnit').value;
  if (unit === 's' || (unit === 'auto' && n < 1e12)) n *= 1000;
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) {
    showTsResult('<p class="tool-kit-error">无法解析</p>');
    return;
  }
  $('tsDate').value = toLocalInput(d);
  showTsResult(`<p><strong>本地时间</strong> ${d.toLocaleString()}</p><p><strong>ISO</strong> <code>${d.toISOString()}</code></p>`);
});

$('tsToUnix').addEventListener('click', () => {
  const v = $('tsDate').value;
  if (!v) {
    showTsResult('<p class="tool-kit-error">请选择日期时间</p>');
    return;
  }
  const ms = new Date(v).getTime();
  $('tsUnix').value = String(ms);
  showTsResult(`<p>毫秒：<code>${ms}</code></p><p>秒：<code>${Math.floor(ms / 1000)}</code></p>`);
});
