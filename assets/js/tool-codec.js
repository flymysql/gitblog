import { initToolPage, $, copyText, setStatus } from './tool-kit-common.js';

initToolPage({
  title: 'Base64 / URL 编解码',
  description: 'Base64 与 URL 编码、解码，支持交换输入输出，浏览器本地处理。',
  path: 'tool-codec.html',
});

let codecMode = 'base64';
const statusEl = $('codecStatus');

document.querySelectorAll('.tool-kit-subtab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-kit-subtab').forEach(b => b.classList.toggle('is-active', b === btn));
    codecMode = btn.dataset.codec;
    statusEl.textContent = '';
  });
});

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function b64Decode(str) {
  const bin = atob(str.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

$('codecEncode').addEventListener('click', () => {
  try {
    const raw = $('codecIn').value;
    $('codecOut').value = codecMode === 'base64' ? b64Encode(raw) : encodeURIComponent(raw);
    setStatus(statusEl, '编码成功');
  } catch (e) {
    setStatus(statusEl, String(e.message), false);
  }
});

$('codecDecode').addEventListener('click', () => {
  try {
    const raw = $('codecIn').value;
    $('codecOut').value = codecMode === 'base64' ? b64Decode(raw) : decodeURIComponent(raw);
    setStatus(statusEl, '解码成功');
  } catch (e) {
    setStatus(statusEl, `解码失败：${e.message}`, false);
  }
});

$('codecSwap').addEventListener('click', () => {
  const tmp = $('codecIn').value;
  $('codecIn').value = $('codecOut').value;
  $('codecOut').value = tmp;
});

$('codecCopy').addEventListener('click', async () => {
  await copyText($('codecOut').value);
  setStatus(statusEl, '已复制结果');
});
