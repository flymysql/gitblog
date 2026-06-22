import { initToolPage, $, setStatus } from './tool-kit-common.js';

initToolPage({
  title: '二维码生成',
  description: '文本或链接一键生成二维码 PNG，支持下载。',
  path: 'tools/tool-qrcode.html',
});

let QRCodeLib = null;

async function loadQR() {
  if (QRCodeLib) return QRCodeLib;
  QRCodeLib = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
  return QRCodeLib;
}

const statusEl = $('qrStatus');

$('qrSize').addEventListener('input', () => {
  $('qrSizeVal').textContent = $('qrSize').value;
});

$('qrGen').addEventListener('click', async () => {
  const text = $('qrText').value.trim();
  if (!text) {
    setStatus(statusEl, '请输入内容', false);
    return;
  }
  try {
    const QRCode = await loadQR();
    const size = Number($('qrSize').value) || 256;
    const canvas = $('qrCanvas');
    await QRCode.toCanvas(canvas, text, { width: size, margin: 2, errorCorrectionLevel: 'M' });
    const dl = $('qrDownload');
    dl.href = canvas.toDataURL('image/png');
    dl.hidden = false;
    setStatus(statusEl, '生成成功');
  } catch (e) {
    setStatus(statusEl, `生成失败：${e.message}`, false);
  }
});
