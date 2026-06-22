import { initToolPage, $, copyText, setStatus } from './tool-kit-common.js';

initToolPage({
  title: 'JSON 格式化',
  description: '在线 JSON 格式化、压缩、校验与复制，浏览器本地处理。',
  path: 'tool-json.html',
});

const statusEl = $('jsonStatus');

$('jsonFormat').addEventListener('click', () => {
  try {
    $('jsonInput').value = JSON.stringify(JSON.parse($('jsonInput').value), null, 2);
    setStatus(statusEl, '格式化成功');
  } catch (e) {
    setStatus(statusEl, `JSON 无效：${e.message}`, false);
  }
});

$('jsonMinify').addEventListener('click', () => {
  try {
    $('jsonInput').value = JSON.stringify(JSON.parse($('jsonInput').value));
    setStatus(statusEl, '压缩成功');
  } catch (e) {
    setStatus(statusEl, `JSON 无效：${e.message}`, false);
  }
});

$('jsonClear').addEventListener('click', () => {
  $('jsonInput').value = '';
  setStatus(statusEl, '');
});

$('jsonCopy').addEventListener('click', async () => {
  await copyText($('jsonInput').value);
  setStatus(statusEl, '已复制');
});
