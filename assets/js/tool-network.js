import { initToolPage, $, escapeHtml, copyText, renderKv } from './tool-kit-common.js';

initToolPage({
  title: '网络与浏览器信息',
  description: '查看公网 IP、运营商、城市与浏览器、屏幕、UA 等信息。',
  path: 'tool-network.html',
});

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
  } catch {
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      const { ip } = await ipRes.json();
      renderKv(el, [['IP', ip], ['备注', '详细位置查询失败，仅显示 IP']]);
    } catch (e) {
      el.innerHTML = `<p class="tool-kit-error">无法获取公网 IP：${escapeHtml(e.message)}</p>`;
    }
  }
}

async function loadNetworkInfo() {
  loadClientInfo();
  await fetchIpInfo();
}

$('netRefresh').addEventListener('click', loadNetworkInfo);

$('netCopy').addEventListener('click', async () => {
  const lines = [];
  document.querySelectorAll('#netClient div, #netIp div').forEach(row => {
    lines.push(`${row.querySelector('dt').textContent}: ${row.querySelector('dd').textContent}`);
  });
  await copyText(lines.join('\n'));
});

loadNetworkInfo();
