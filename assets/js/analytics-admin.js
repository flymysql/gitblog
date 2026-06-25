// ============================================================================
// 后台「访问数据」：CloudBase 自建统计 或 Saobby 控制面板嵌入
// ============================================================================

import { CONFIG } from './config.js';
import { mountAdminShell, escapeHtml } from './admin-shell.js';
import { isSaobbyOn } from './pageviews.js';
import {
  isCloudBasePvEnabled,
  getSiteViewStats,
  getAdminTopPages,
  formatCount,
} from './cloudbase-pv.js';
import {
  getStoredAdminSecret,
  clearAdminSecret,
  verifyAdminSecret,
} from './cloudbase-admin-secret.js';

const $ = sel => document.querySelector(sel);

function pvCfg() {
  return CONFIG.pageviews || {};
}

function saobbyCfg() {
  return pvCfg().saobby || {};
}

function listCounters() {
  const cfg = pvCfg();
  if (cfg.enabled === false) return [];
  const sb = saobbyCfg();
  const items = [];
  const site = sb.site || {};
  if (site.img || site.dashboard) {
    items.push({ id: 'site', name: '站点总计数器', img: site.img, dashboard: site.dashboard, kind: 'site' });
  }
  (sb.extra || []).forEach((it, i) => {
    if (!it) return;
    if (it.img || it.dashboard) {
      items.push({ id: `extra-${i}`, name: it.name || `额外计数器 ${i + 1}`, img: it.img, dashboard: it.dashboard, kind: 'extra' });
    }
  });
  return items;
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pageLink(path) {
  const p = String(path || '').trim();
  if (!p || p === '/') return CONFIG.site?.url || './';
  if (/^https?:\/\//i.test(p)) return p;
  const base = String(CONFIG.site?.url || '').replace(/\/+$/, '');
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}

function secretGateHtml() {
  return `
    <section class="admin-empty-card" id="pvSecretGate">
      <h2>输入管理密钥</h2>
      <p class="settings-hint">查看阅读排行需验证云函数环境变量 <code>COMMENT_ADMIN_SECRET</code>（与评论管理相同）。密钥仅保存在本浏览器。</p>
      <form id="pvSecretForm" style="max-width:420px;margin-top:16px">
        <label class="settings-hint" style="display:block;margin-bottom:6px">管理密钥</label>
        <input type="password" id="pvSecretInput" placeholder="COMMENT_ADMIN_SECRET" required autocomplete="off">
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary" id="pvSecretSubmit">验证并加载</button>
        </div>
        <div id="pvSecretError" class="settings-hint" style="color:var(--danger);margin-top:12px" hidden></div>
      </form>
    </section>
  `;
}

function cloudbaseStatsHtml({ site, top }) {
  const siteLabel = String(pvCfg().siteLabel || '人来过').trim() || '人来过';
  const pageLabel = String(pvCfg().label || '阅读').trim() || '阅读';
  return `
    <div class="analytics-shell">
      <p class="settings-help" style="margin:0 0 12px 0">
        访问统计由 CloudBase 数据库记录。站点 <b>${escapeHtml(siteLabel)}</b> 与文章 <b>${escapeHtml(pageLabel)}</b> 均走自建通道，不再依赖第三方脚本。
      </p>
      <div class="dashboard-grid" style="margin-bottom:16px">
        <div class="dashboard-card"><div class="dashboard-num">${escapeHtml(formatCount(site.pv))}</div><div class="dashboard-label">站点 PV</div></div>
        <div class="dashboard-card"><div class="dashboard-num">${escapeHtml(formatCount(site.uv))}</div><div class="dashboard-label">站点 UV</div></div>
        <div class="dashboard-card"><div class="dashboard-num">${escapeHtml(String(top.length))}</div><div class="dashboard-label">已记录页面</div></div>
      </div>
      <div class="analytics-panel-head" style="margin-bottom:8px">
        <div>
          <h3 style="margin:0">阅读排行</h3>
          <p class="settings-hint" style="margin:4px 0 0">按页面 PV 降序；导入历史数据后可能与第三方略有偏差。</p>
        </div>
        <div class="analytics-panel-actions">
          <button type="button" class="btn btn-secondary" id="pvReloadBtn">刷新</button>
          <button type="button" class="btn btn-secondary" id="pvClearSecretBtn">更换密钥</button>
        </div>
      </div>
      ${top.length
        ? `<div class="admin-list">
            <div class="admin-list-head analytics-pv-head">
              <span>页面</span><span>PV</span><span>最近访问</span>
            </div>
            ${top.map(row => `
              <a class="admin-list-row analytics-pv-row" href="${escapeHtml(pageLink(row.path))}" target="_blank" rel="noopener">
                <span class="analytics-pv-path">
                  <strong>${escapeHtml(row.title || row.slug || row.path)}</strong>
                  <em>${escapeHtml(row.path)}</em>
                </span>
                <span class="analytics-pv-num">${escapeHtml(formatCount(row.pv))}</span>
                <span class="analytics-pv-time">${escapeHtml(fmtTime(row.lastAt))}</span>
              </a>
            `).join('')}
          </div>`
        : '<div class="analytics-frame-empty"><p>暂无页面阅读记录。发布文章并有人访问后会出现数据。</p></div>'
      }
    </div>
  `;
}

async function loadCloudBaseAnalytics(ctx, secret) {
  const siteStats = await getSiteViewStats();
  const adminData = await getAdminTopPages(secret, 50);
  const site = adminData.site || { pv: siteStats.sitePv, uv: siteStats.siteUv };
  const top = adminData.top || [];
  ctx.content.innerHTML = cloudbaseStatsHtml({ site, top });

  $('#pvReloadBtn')?.addEventListener('click', () => {
    loadCloudBaseAnalytics(ctx, secret).catch(err => {
      ctx.content.innerHTML = `<div class="admin-empty-card"><p>加载失败：${escapeHtml(err.message)}</p></div>`;
    });
  });
  $('#pvClearSecretBtn')?.addEventListener('click', () => {
    clearAdminSecret();
    renderCloudBase(ctx);
  });
}

function bindSecretGate(ctx) {
  $('#pvSecretForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#pvSecretSubmit');
    const errEl = $('#pvSecretError');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = '验证中…';
    const secret = $('#pvSecretInput').value.trim();
    try {
      await verifyAdminSecret(secret);
      await loadCloudBaseAnalytics(ctx, secret);
    } catch (err) {
      errEl.textContent = err.message || '验证失败';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = '验证并加载';
    }
  });
}

async function renderCloudBase(ctx) {
  if (!isCloudBasePvEnabled()) {
    ctx.content.innerHTML = `
      <section class="admin-empty-card">
        <h2>CloudBase 访问统计未启用</h2>
        <p>请在站点设置中将访问计数来源设为 CloudBase，并确认 CloudBase 评论已配置 embedBaseUrl。</p>
        <p style="margin-top:18px"><a class="btn btn-primary" href="settings.html">前往站点设置 →</a></p>
      </section>
    `;
    return;
  }

  const secret = getStoredAdminSecret();
  if (!secret) {
    ctx.content.innerHTML = secretGateHtml();
    bindSecretGate(ctx);
    return;
  }

  try {
    await loadCloudBaseAnalytics(ctx, secret);
  } catch (err) {
    if (/无权限|403|密钥/i.test(String(err.message))) {
      clearAdminSecret();
      ctx.content.innerHTML = secretGateHtml();
      bindSecretGate(ctx);
      return;
    }
    ctx.content.innerHTML = `<div class="admin-empty-card"><p>加载失败：${escapeHtml(err.message)}</p></div>`;
  }
}

function emptyHtml() {
  return `
    <section class="admin-empty-card">
      <h2>暂时没有可嵌入的 Saobby 控制面板</h2>
      ${isSaobbyOn()
        ? '<p>已启用计数，但尚未配置「站点」或「额外」计数器的控制面板 URL。</p>'
        : '<p>尚未在站点设置中配置 Saobby 站点计数图片 URL。</p>'
      }
      <ol style="margin:14px 0 0 18px;color:var(--text-secondary);line-height:1.9;">
        <li>到 <a href="https://www.saobby.com/create_webcounter" target="_blank" rel="noopener">saobby.com</a> 创建站点计数器。</li>
        <li>在「站点设置」里填写图片 URL 与控制面板 URL 并保存。</li>
        <li>单篇阅读量请在 <a href="https://vercount.one" target="_blank" rel="noopener">vercount.one</a> 查看（本站文章页使用 Vercount）。</li>
      </ol>
      <p style="margin-top:18px"><a class="btn btn-primary" href="settings.html">前往站点设置 →</a></p>
    </section>
  `;
}

function counterTabsHtml(items) {
  const firstId = items[0] ? items[0].id : '';
  return `
    <div class="analytics-tabs" role="tablist">
      ${items.map(it => `
        <button type="button" class="analytics-tab${it.id === firstId ? ' active' : ''}" data-tab-id="${escapeHtml(it.id)}" role="tab">
          ${escapeHtml(it.name)}
        </button>
      `).join('')}
    </div>
  `;
}

function counterPanelHtml(item, active) {
  const dashboard = String(item.dashboard || '').trim();
  const img = String(item.img || '').trim();
  const safeUrl = dashboard && /^https?:\/\//i.test(dashboard) ? dashboard : '';
  return `
    <section class="analytics-panel${active ? ' active' : ''}" data-panel-id="${escapeHtml(item.id)}">
      <header class="analytics-panel-head">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="settings-hint">
            ${img ? `图片 URL：<a href="${escapeHtml(img)}" target="_blank" rel="noopener">${escapeHtml(img)}</a>` : '<em>未配置图片 URL</em>'}
          </p>
        </div>
        <div class="analytics-panel-actions">
          ${img ? `<img class="saobby-counter-preview" src="${escapeHtml(img)}" alt="实时计数" referrerpolicy="no-referrer-when-downgrade">` : ''}
          ${safeUrl ? `<a class="btn btn-secondary" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">在新页面打开</a>` : ''}
        </div>
      </header>
      ${safeUrl
        ? `<div class="analytics-frame-wrap">
            <iframe class="analytics-frame" src="${escapeHtml(safeUrl)}" title="${escapeHtml(item.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allow="clipboard-read; clipboard-write"></iframe>
            <div class="analytics-frame-fallback" hidden>
              <p>当前控制面板拒绝被嵌入。可点上方「在新页面打开」直接查看。</p>
            </div>
          </div>`
        : `<div class="analytics-frame-empty">
            <p>该计数器还没有填写控制面板 URL。</p>
            <p><a class="btn btn-primary" href="settings.html">前往设置补全 →</a></p>
          </div>`
      }
    </section>
  `;
}

function topActions() {
  if (isCloudBasePvEnabled()) {
    return `<a class="btn btn-primary" href="settings.html">站点设置</a>`;
  }
  return `
    <a class="btn btn-secondary" href="https://www.saobby.com/create_webcounter" target="_blank" rel="noopener">+ 新建 saobby 计数器</a>
    <a class="btn btn-primary" href="settings.html">站点设置</a>
  `;
}

function activatePanel(id) {
  document.querySelectorAll('.analytics-tab').forEach(t => t.classList.toggle('active', t.dataset.tabId === id));
  document.querySelectorAll('.analytics-panel').forEach(p => p.classList.toggle('active', p.dataset.panelId === id));
}

function bindTabs() {
  document.querySelectorAll('.analytics-tab').forEach(tab => {
    tab.addEventListener('click', () => activatePanel(tab.dataset.tabId));
  });
}

function watchIframeLoadFailures() {
  document.querySelectorAll('iframe.analytics-frame').forEach(frame => {
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; });
    setTimeout(() => {
      if (!loaded) {
        const wrap = frame.closest('.analytics-frame-wrap');
        const fb = wrap && wrap.querySelector('.analytics-frame-fallback');
        if (fb) fb.hidden = false;
      }
    }, 8000);
  });
}

function vercountHintHtml() {
  return `
    <p class="settings-help" style="margin:12px 0 0">
      单篇阅读量由 <a href="https://vercount.one" target="_blank" rel="noopener">Vercount</a> 按页面 URL 统计，请到其控制台查看。
    </p>
  `;
}

async function renderSaobby(ctx) {
  const items = listCounters();
  if (!items.length) {
    ctx.content.innerHTML = emptyHtml();
    return;
  }
  ctx.content.innerHTML = `
    <div class="analytics-shell">
      <p class="settings-help" style="margin:0 0 12px 0">
        以下控制面板由 <a href="https://www.saobby.com" target="_blank" rel="noopener">saobby.com</a> 提供。每张图片即一个独立计数器；首屏数字延迟一两秒属于正常现象。
      </p>
      ${counterTabsHtml(items)}
      ${vercountHintHtml()}
      <div class="analytics-panels">
        ${items.map((it, i) => counterPanelHtml(it, i === 0)).join('')}
      </div>
    </div>
  `;
  bindTabs();
  watchIframeLoadFailures();
}

(async function init() {
  const ctx = await mountAdminShell({ active: 'analytics', title: '访问数据', actions: topActions() });
  if (!ctx) return;
  if (isCloudBasePvEnabled()) {
    await renderCloudBase(ctx);
    return;
  }
  await renderSaobby(ctx);
})();
