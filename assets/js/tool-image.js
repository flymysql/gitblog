import { initToolPage, $, formatBytes, setStatus } from './tool-kit-common.js';

initToolPage({
  title: '图片压缩 / WebP 转换',
  description: '浏览器本地压缩图片，输出 WebP、JPEG 或 PNG，可调质量与最大宽度。',
  path: 'tool-image.html',
});

const statusEl = $('imgStatus');

$('imgQuality').addEventListener('input', () => {
  $('imgQualityVal').textContent = `${Math.round(Number($('imgQuality').value) * 100)}%`;
});

$('imgConvert').addEventListener('click', async () => {
  const file = $('imgFile').files?.[0];
  if (!file) {
    setStatus(statusEl, '请先选择图片', false);
    return;
  }
  setStatus(statusEl, '处理中…');

  const format = $('imgFormat').value;
  const quality = Number($('imgQuality').value);
  const maxW = Number($('imgMaxW').value) || 0;

  const img = new Image();
  const blobUrl = URL.createObjectURL(file);
  img.src = blobUrl;
  try {
    await img.decode();
  } catch {
    setStatus(statusEl, '无法读取图片', false);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (maxW > 0 && w > maxW) {
    h = Math.round(h * maxW / w);
    w = maxW;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('转换失败'))), format, quality);
  });

  const ext = format === 'image/webp' ? 'webp' : format === 'image/jpeg' ? 'jpg' : 'png';
  const dl = $('imgDownload');
  dl.href = URL.createObjectURL(blob);
  dl.download = `output.${ext}`;
  dl.hidden = false;

  $('imgCompare').hidden = false;
  $('imgOrigPreview').src = blobUrl;
  $('imgOutPreview').src = dl.href;
  $('imgSizeInfo').textContent = `${formatBytes(file.size)} → ${formatBytes(blob.size)}（${Math.round(blob.size / file.size * 100)}%）`;
  setStatus(statusEl, `完成：${w}×${h}，${formatBytes(blob.size)}`);
});
