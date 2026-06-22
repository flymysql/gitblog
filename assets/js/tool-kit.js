import { initSite } from './site.js';
import { setMeta, setJsonLd } from './seo.js';
import { CONFIG } from './config.js';

initSite({ active: 'tools.html' });
setMeta({
  title: '实用工具箱',
  description: '年龄计算器、今日运势、JSON 格式化、Base64/URL 编解码、时间戳转换、正则测试、二维码生成、图片压缩与 WebP 转换、网络与浏览器信息查询。',
  type: 'website',
});
setJsonLd({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '实用工具箱',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  url: `${CONFIG.site.url || location.origin}/tool-kit.html`,
});

// ---------- tabs ----------

const tabs = document.querySelectorAll('.tool-kit-tab');
const panels = document.querySelectorAll('.tool-kit-panel');

function switchTab(id) {
  tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === id));
  panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === id));
  if (id === 'network') loadNetworkInfo();
  if (id === 'fortune' && document.getElementById('fortuneResult').hidden) drawFortune();
  history.replaceState(null, '', `#${id}`);
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

const hash = location.hash.replace(/^#/, '');
if (hash && document.querySelector(`[data-panel="${hash}"]`)) switchTab(hash);

// ---------- helpers ----------

function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function copyText(text) {
  return navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

function dateSeed(extra = '') {
  const d = new Date();
  const base = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  let h = 0;
  for (const c of base + extra) h = (Math.imul(31, h) + c.charCodeAt(0)) >>> 0;
  return h;
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

// ---------- age ----------

function pad2(n) { return String(n).padStart(2, '0'); }

function calcAge() {
  const dateVal = $('ageBirth').value;
  const timeVal = $('ageTime').value || '00:00:00';
  const el = $('ageResult');
  if (!dateVal) {
    el.innerHTML = '<p class="tool-kit-placeholder">请选择出生日期</p>';
    return;
  }
  const birth = new Date(`${dateVal}T${timeVal.length === 5 ? timeVal + ':00' : timeVal}`);
  if (Number.isNaN(birth.getTime())) {
    el.innerHTML = '<p class="tool-kit-error">日期无效</p>';
    return;
  }
  const now = new Date();
  if (birth > now) {
    el.innerHTML = '<p class="tool-kit-error">出生日期不能晚于现在</p>';
    return;
  }

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const livedMs = now - birth;
  const livedDays = Math.floor(livedMs / 86400000);
  const livedHours = Math.floor(livedMs / 3600000);

  let nextBday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate(), birth.getHours(), birth.getMinutes(), birth.getSeconds());
  if (nextBday <= now) nextBday = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate(), birth.getHours(), birth.getMinutes(), birth.getSeconds());
  const daysToBday = Math.ceil((nextBday - now) / 86400000);

  el.innerHTML = `
    <div class="tool-kit-stat"><strong>${years}</strong><span>岁 ${months} 个月 ${days} 天</span></div>
    <div class="tool-kit-stat-grid">
      <div><strong>${livedDays.toLocaleString()}</strong><span>总天数</span></div>
      <div><strong>${livedHours.toLocaleString()}</strong><span>总小时</span></div>
      <div><strong>${daysToBday}</strong><span>天后生日</span></div>
      <div><strong>${Math.floor(livedMs / 1000).toLocaleString()}</strong><span>总秒数</span></div>
    </div>
  `;
}

$('ageBirth').addEventListener('change', calcAge);
$('ageTime').addEventListener('change', calcAge);

// ---------- fortune ----------

const FORTUNE_GRADES = ['大吉', '中吉', '小吉', '平', '小凶', '中凶'];
const FORTUNE_TEXTS = [
  '今日宜慢下来，把一件小事做完就好。',
  '意外的好消息可能在午后出现，留点空档。',
  '适合整理桌面、清理收藏夹，断舍离带来好运。',
  '别和键盘较劲，出门走两百步，思路会开。',
  '今天适合把想说的话写下来，不必立刻发出。',
  '可能会遇到旧友消息，回复前先看三遍。',
  '咖啡或茶比预期的好喝，这就是今日奖赏。',
  '适合读一篇长文，不适合刷短视频。',
  '小心误触发送，重要邮件发前再确认。',
  '晚上适合早睡，熬夜会放大小事。',
  '今天的手气一般，但心态可以赢。',
  '适合学一个新快捷键，效率加一点点。',
];
const FORTUNE_GOOD = ['散步', '写稿', '整理', '早睡', '喝热水', '看云', '听老歌', '擦桌子', '回复消息', '备份数据'];
const FORTUNE_BAD = ['冲动消费', '熬夜', '争口气', '空腹生气', '连点提交', '瞎承诺', '硬撑', '群发牢骚'];
const FORTUNE_COLORS = ['天青', '暖橙', '苔绿', '浅紫', '米白', '藏蓝', '杏色', '雾灰'];

function drawFortune() {
  const name = ($('fortuneName').value || '').trim();
  const seed = dateSeed(name);
  const grade = pick(FORTUNE_GRADES, seed);
  const card = $('fortuneResult');
  card.hidden = false;
  $('fortuneGrade').textContent = grade;
  $('fortuneGrade').dataset.level = grade.includes('吉') ? 'good' : grade === '平' ? 'mid' : 'bad';
  $('fortuneText').textContent = pick(FORTUNE_TEXTS, seed >> 3);
  $('fortuneGood').textContent = `${pick(FORTUNE_GOOD, seed >> 5)}、${pick(FORTUNE_GOOD, seed >> 7)}`;
  $('fortuneBad').textContent = `${pick(FORTUNE_BAD, seed >> 9)}、${pick(FORTUNE_BAD, seed >> 11)}`;
  $('fortuneColor').textContent = pick(FORTUNE_COLORS, seed >> 13);
  $('fortuneNum').textContent = String((seed % 9) + 1);
}

$('fortuneBtn').addEventListener('click', drawFortune);

// ---------- JSON ----------

function setJsonStatus(msg, ok = true) {
  const el = $('jsonStatus');
  el.textContent = msg;
  el.className = 'tool-kit-status' + (ok ? '' : ' is-error');
}

$('jsonFormat').addEventListener('click', () => {
  try {
    const v = JSON.parse($('jsonInput').value);
    $('jsonInput').value = JSON.stringify(v, null, 2);
    setJsonStatus('格式化成功');
  } catch (e) {
    setJsonStatus(`JSON 无效：${e.message}`, false);
  }
});

$('jsonMinify').addEventListener('click', () => {
  try {
    const v = JSON.parse($('jsonInput').value);
    $('jsonInput').value = JSON.stringify(v);
    setJsonStatus('压缩成功');
  } catch (e) {
    setJsonStatus(`JSON 无效：${e.message}`, false);
  }
});

$('jsonClear').addEventListener('click', () => {
  $('jsonInput').value = '';
  setJsonStatus('');
});

$('jsonCopy').addEventListener('click', async () => {
  await copyText($('jsonInput').value);
  setJsonStatus('已复制');
});

// ---------- codec ----------

let codecMode = 'base64';

document.querySelectorAll('.tool-kit-subtab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-kit-subtab').forEach(b => b.classList.toggle('is-active', b === btn));
    codecMode = btn.dataset.codec;
    $('codecStatus').textContent = '';
  });
});

function setCodecStatus(msg, ok = true) {
  const el = $('codecStatus');
  el.textContent = msg;
  el.className = 'tool-kit-status' + (ok ? '' : ' is-error');
}

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function b64Decode(str) {
  const bin = atob(str.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

$('codecEncode').addEventListener('click', () => {
  try {
    const raw = $('codecIn').value;
    $('codecOut').value = codecMode === 'base64' ? b64Encode(raw) : encodeURIComponent(raw);
    setCodecStatus('编码成功');
  } catch (e) {
    setCodecStatus(String(e.message), false);
  }
});

$('codecDecode').addEventListener('click', () => {
  try {
    const raw = $('codecIn').value;
    $('codecOut').value = codecMode === 'base64' ? b64Decode(raw) : decodeURIComponent(raw);
    setCodecStatus('解码成功');
  } catch (e) {
    setCodecStatus(`解码失败：${e.message}`, false);
  }
});

$('codecSwap').addEventListener('click', () => {
  const tmp = $('codecIn').value;
  $('codecIn').value = $('codecOut').value;
  $('codecOut').value = tmp;
});

$('codecCopy').addEventListener('click', async () => {
  await copyText($('codecOut').value);
  setCodecStatus('已复制结果');
});

// ---------- timestamp ----------

function toLocalInput(d) {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 19);
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
  else if (unit === 'auto' && n >= 1e12) { /* ms */ }
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
  const d = new Date(v);
  const ms = d.getTime();
  $('tsUnix').value = String(ms);
  showTsResult(`<p>毫秒：<code>${ms}</code></p><p>秒：<code>${Math.floor(ms / 1000)}</code></p>`);
});

// ---------- regex ----------

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

  if (!matches.length) {
    matchesEl.innerHTML = '<p class="tool-kit-placeholder">无匹配</p>';
    return;
  }
  matchesEl.innerHTML = `<p>共 ${matches.length} 处匹配</p><ol class="tool-kit-match-list">${matches.map(m =>
    `<li><code>${escapeHtml(m[0])}</code> @ ${m.index}${m.groups ? ` · groups: ${escapeHtml(JSON.stringify(m.groups))}` : ''}</li>`
  ).join('')}</ol>`;
}

['input', 'change'].forEach(ev => {
  $('regexPattern').addEventListener(ev, runRegex);
  $('regexFlags').addEventListener(ev, runRegex);
  $('regexText').addEventListener(ev, runRegex);
});

// ---------- QR code ----------

let QRCodeLib = null;

async function loadQR() {
  if (QRCodeLib) return QRCodeLib;
  QRCodeLib = await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm');
  return QRCodeLib;
}

$('qrSize').addEventListener('input', () => {
  $('qrSizeVal').textContent = $('qrSize').value;
});

$('qrGen').addEventListener('click', async () => {
  const text = $('qrText').value.trim();
  const status = $('qrStatus');
  if (!text) {
    status.textContent = '请输入内容';
    status.className = 'tool-kit-status is-error';
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
    status.textContent = '生成成功';
    status.className = 'tool-kit-status';
  } catch (e) {
    status.textContent = `生成失败：${e.message}`;
    status.className = 'tool-kit-status is-error';
  }
});

// ---------- image ----------

let imgBlobUrl = null;
let imgOutBlob = null;

$('imgQuality').addEventListener('input', () => {
  $('imgQualityVal').textContent = `${Math.round(Number($('imgQuality').value) * 100)}%`;
});

$('imgConvert').addEventListener('click', async () => {
  const file = $('imgFile').files?.[0];
  const status = $('imgStatus');
  if (!file) {
    status.textContent = '请先选择图片';
    status.className = 'tool-kit-status is-error';
    return;
  }
  status.textContent = '处理中…';
  status.className = 'tool-kit-status';

  const format = $('imgFormat').value;
  const quality = Number($('imgQuality').value);
  const maxW = Number($('imgMaxW').value) || 0;

  const img = new Image();
  imgBlobUrl = URL.createObjectURL(file);
  img.src = imgBlobUrl;
  await img.decode().catch(() => {
    throw new Error('无法读取图片');
  });

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (maxW > 0 && w > maxW) {
    h = Math.round(h * maxW / w);
    w = maxW;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('转换失败'))), format, quality);
  });

  imgOutBlob = blob;
  const ext = format === 'image/webp' ? 'webp' : format === 'image/jpeg' ? 'jpg' : 'png';
  const dl = $('imgDownload');
  dl.href = URL.createObjectURL(blob);
  dl.download = `output.${ext}`;
  dl.hidden = false;

  $('imgCompare').hidden = false;
  $('imgOrigPreview').src = imgBlobUrl;
  $('imgOutPreview').src = dl.href;
  $('imgSizeInfo').textContent = `${formatBytes(file.size)} → ${formatBytes(blob.size)}（${Math.round(blob.size / file.size * 100)}%）`;

  status.textContent = `完成：${w}×${h}，${formatBytes(blob.size)}`;
  status.className = 'tool-kit-status';
});

// ---------- network ----------

function parseUA() {
  const ua = navigator.userAgent;
  let browser = '未知';
  if (/Edg\//.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

  let os = '未知';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, os, ua };
}

function renderKv(target, rows) {
  target.innerHTML = rows.map(([k, v]) =>
    `<div><dt>${escapeHtml(k)}</dt><dd>${typeof v === 'string' && v.includes('<') ? v : escapeHtml(String(v ?? '—'))}</dd></div>`
  ).join('');
}

function loadClientInfo() {
  const { browser, os, ua } = parseUA();
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  renderKv($('netClient'), [
    ['浏览器', `${browser} ${ua.match(/(Chrome|Firefox|Version|Edg)\/([\d.]+)/)?.[2] || ''}`.trim()],
    ['操作系统', os],
    ['语言', navigator.language],
    ['时区', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['屏幕', `${screen.width}×${screen.height}（窗口 ${innerWidth}×${innerHeight}）`],
    ['像素比', String(window.devicePixelRatio || 1)],
    ['Online', navigator.onLine ? '是' : '否'],
    ['Cookie', navigator.cookieEnabled ? '启用' : '禁用'],
    ['网络类型', conn?.effectiveType || '—'],
    ['下行估算', conn?.downlink != null ? `${conn.downlink} Mbps` : '—'],
    ['User-Agent', ua],
  ]);
}

async function fetchIpInfo() {
  const el = $('netIp');
  el.innerHTML = '<p class="tool-kit-placeholder">查询中…</p>';
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    if (d.error) throw new Error(d.reason || d.error);
    renderKv(el, [
      ['IP', d.ip],
      ['城市', `${d.city || '—'}，${d.region || '—'}`],
      ['国家', `${d.country_name || '—'} (${d.country_code || ''})`],
      ['运营商 / ASN', d.org || '—'],
      ['经纬度', d.latitude != null ? `${d.latitude}, ${d.longitude}` : '—'],
      ['时区', d.timezone || '—'],
    ]);
    return d;
  } catch {
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      const { ip } = await ipRes.json();
      renderKv(el, [
        ['IP', ip],
        ['城市', '详细位置需备用 API，请稍后重试'],
      ]);
      return { ip };
    } catch (e) {
      el.innerHTML = `<p class="tool-kit-error">无法获取公网 IP：${escapeHtml(e.message)}</p>`;
      return null;
    }
  }
}

let lastNetData = {};

async function loadNetworkInfo() {
  loadClientInfo();
  lastNetData.ip = await fetchIpInfo();
}

$('netRefresh').addEventListener('click', loadNetworkInfo);

$('netCopy').addEventListener('click', async () => {
  const lines = [];
  $('netClient').querySelectorAll('div').forEach(row => {
    lines.push(`${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent}`);
  });
  $('netIp').querySelectorAll('div').forEach(row => {
    lines.push(`${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent}`);
  });
  await copyText(lines.join('\n'));
});

loadClientInfo();
if ($('ageBirth')) $('ageBirth').max = new Date().toISOString().slice(0, 10);
