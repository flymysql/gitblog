// 摸鱼工具分享图：Canvas 合成 + 右下角工具页二维码
import { CONFIG } from './config.js';

let QRCodeLib = null;

async function loadQR() {
  if (QRCodeLib) return QRCodeLib;
  QRCodeLib = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
  return QRCodeLib;
}

export function toolPageUrl(path, query = '') {
  const base = String(CONFIG.site.url || location.origin).replace(/\/+$/, '');
  const q = query ? (query.startsWith('?') ? query : `?${query}`) : '';
  return `${base}/${path.replace(/^\//, '')}${q}`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 6) {
  const chars = String(text || '').split('');
  let line = '';
  let cy = y;
  let lines = 0;
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = chars[i];
      cy += lineHeight;
      lines += 1;
      if (lines >= maxLines - 1) {
        line = line.slice(0, -1) + '…';
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy + lineHeight;
}

async function drawQr(ctx, url, x, y, size) {
  const QRCode = await loadQR();
  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });
  ctx.drawImage(qrCanvas, x, y, size, size);
}

async function drawQrBlock(ctx, url, label, W, H, qrSize = 132) {
  const pad = 40;
  const blockW = qrSize + 24;
  const blockH = qrSize + 52;
  const bx = W - blockW - pad;
  const by = H - blockH - pad;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, bx, by, blockW, blockH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();
  await drawQr(ctx, url, bx + 12, by + 12, qrSize);
  ctx.fillStyle = '#888';
  ctx.font = '18px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, bx + blockW / 2, by + qrSize + 36);
  ctx.textAlign = 'left';
}

export function downloadCanvas(canvas, filename) {
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

const FONT = 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

/** 今日运势分享图 */
export async function drawFortuneShareImage({ grade, level, text, good, bad, color, num, name, pageUrl }) {
  const W = 750;
  const H = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#fff8f6');
  grad.addColorStop(0.5, '#fff0eb');
  grad.addColorStop(1, '#ffe4dc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ea6f5a';
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText('今日运势', 48, 72);

  const d = new Date();
  const dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  ctx.fillStyle = '#888';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(name ? `${dateStr} · ${name}` : dateStr, 48, 112);

  const palettes = {
    good: ['#e8f8ee', '#1e7a43'],
    mid: ['#fff4d8', '#936018'],
    bad: ['#fce8f3', '#a33b72'],
  };
  const [bg, fg] = palettes[level] || palettes.mid;
  ctx.fillStyle = bg;
  roundRect(ctx, 48, 140, Math.max(100, ctx.measureText(grade).width + 40), 52, 26);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `bold 28px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(grade, 48 + Math.max(100, ctx.measureText(grade).width + 40) / 2, 176);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#222';
  ctx.font = `32px ${FONT}`;
  wrapText(ctx, text, 48, 240, W - 96, 48, 5);

  const meta = [
    ['宜', good],
    ['忌', bad],
    ['幸运色', color],
    ['幸运数字', String(num)],
  ];
  let y = 480;
  ctx.font = `26px ${FONT}`;
  for (const [label, val] of meta) {
    ctx.fillStyle = '#aaa';
    ctx.fillText(label, 48, y);
    ctx.fillStyle = '#333';
    ctx.fillText(val, 110, y);
    y += 48;
  }

  ctx.fillStyle = '#bbb';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('仅供娱乐，请勿当真', 48, H - 200);

  await drawQrBlock(ctx, pageUrl, '扫码抽签', W, H);
  return canvas;
}

/** 年龄计算器分享图 */
export async function drawAgeShareImage({ birthLabel, ageLine, livedDays, livedHours, daysToBday, pageUrl }) {
  const W = 750;
  const H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#f6fbff');
  grad.addColorStop(1, '#e8f1ff');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1e5aa8';
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText('年龄计算器', 48, 72);

  ctx.fillStyle = '#888';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`出生：${birthLabel}`, 48, 112);

  ctx.fillStyle = '#222';
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillText(ageLine, 48, 200);

  const stats = [
    ['总天数', livedDays],
    ['总小时', livedHours],
    ['距下次生日', `${daysToBday} 天`],
  ];
  let y = 280;
  for (const [label, val] of stats) {
    ctx.fillStyle = '#fff';
    roundRect(ctx, 48, y, W - 96, 100, 16);
    ctx.fill();
    ctx.fillStyle = '#888';
    ctx.font = `22px ${FONT}`;
    ctx.fillText(label, 72, y + 38);
    ctx.fillStyle = '#1e5aa8';
    ctx.font = `bold 36px ${FONT}`;
    ctx.fillText(String(val), 72, y + 78);
    y += 120;
  }

  ctx.fillStyle = '#bbb';
  ctx.font = `20px ${FONT}`;
  ctx.fillText('gitpull.cn 工具箱', 48, H - 200);

  await drawQrBlock(ctx, pageUrl, '扫码计算', W, H);
  return canvas;
}
