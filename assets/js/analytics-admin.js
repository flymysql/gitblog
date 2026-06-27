// ============================================================================
// 后台「访问数据」：CloudBase 自建访问统计
// ============================================================================

import { CONFIG } from './config.js';
import { mountAdminShell, escapeHtml } from './admin-shell.js';
import {
  isCloudBasePvEnabled,
  getSiteViewStats,
  getAdminTopPages,
  getAdminDailyStats,
  formatCount,
} from './cloudbase-pv.js';
import {
  getStoredAdminSecret,
  clearAdminSecret,
  verifyAdminSecret,
} from './cloudbase-admin-secret.js';

const $ = sel => document.querySelector(sel);
const DAILY_DAYS = 14;

function pvCfg() {
  return CONFIG.pageviews || {};
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

function dailyOverviewHtml({ daily, focusDate }) {
  if (!daily?.length) {
    return `
      <div class="analytics-frame-empty analytics-daily-empty">
        <p>暂无每日统计数据。云函数部署后产生的新访问会按天汇总。</p>
      </div>
    `;
  }
  return `
    <div class="admin-list analytics-daily-list">
      <div class="admin-list-head analytics-daily-head">
        <span>日期</span><span>新增 PV</span><span>访问人数</span><span>不同 IP</span>
      </div>
      ${daily.map(row => `
        <button type="button" class="admin-list-row analytics-daily-row${row.date === focusDate ? ' is-active' : ''}" data-date="${escapeHtml(row.date)}">
          <span class="analytics-daily-date">${escapeHtml(row.date)}</span>
          <span class="analytics-pv-num">${escapeHtml(formatCount(row.pv))}</span>
          <span class="analytics-pv-num">${escapeHtml(formatCount(row.uv))}</span>
          <span class="analytics-pv-num">${escapeHtml(formatCount(row.ips))}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function dailyPagesHtml({ pages, focusDate }) {
  if (!pages?.length) {
    return `<div class="analytics-frame-empty"><p>${escapeHtml(focusDate)} 暂无文章阅读增量。</p></div>`;
  }
  return `
    <div class="admin-list">
      <div class="admin-list-head analytics-pv-head analytics-daily-page-head">
        <span>页面</span><span>当日 PV</span><span></span>
      </div>
      ${pages.map(row => `
        <a class="admin-list-row analytics-pv-row analytics-daily-page-row" href="${escapeHtml(pageLink(row.path))}" target="_blank" rel="noopener">
          <span class="analytics-pv-path">
            <strong>${escapeHtml(row.title || row.slug || row.path)}</strong>
            <em>${escapeHtml(row.path)}</em>
          </span>
          <span class="analytics-pv-num">${escapeHtml(formatCount(row.pv))}</span>
          <span></span>
        </a>
      `).join('')}
    </div>
  `;
}

function cloudbaseStatsHtml({ site, top, daily, pages, focusDate }) {
  const siteLabel = String(pvCfg().siteLabel || '人来过').trim() || '人来过';
  const pageLabel = String(pvCfg().label || '阅读').trim() || '阅读';
  return `
    <div class="analytics-shell">
      <p class="settings-help" style="margin:0 0 12px 0">
        访问统计由 CloudBase 实时拉取（不参与备份）。站点 <b>${escapeHtml(siteLabel)}</b> 与文章 <b>${escapeHtml(pageLabel)}</b> 均走自建通道。
      </p>
      <div class="dashboard-grid" style="margin-bottom:16px">
        <div class="dashboard-card"><div class="dashboard-num">${escapeHtml(formatCount(site.pv))}</div><div class="dashboard-label">站点 PV（累计）</div></div>
        <div class="dashboard-card"><div class="dashboard-num">${escapeHtml(formatCount(site.uv))}</div><div class="dashboard-label">站点 UV（累计）</div></div>
        <div class="dashboard-card"><div class="dashboard-num">${escapeHtml(String(top.length))}</div><div class="dashboard-label">已记录页面</div></div>
      </div>

      <div class="analytics-panel-head" style="margin-bottom:8px">
        <div>
          <h3 style="margin:0">每日概览</h3>
          <p class="settings-hint" style="margin:4px 0 0">近 ${DAILY_DAYS} 天新增：PV、访问人数（去重访客）、不同 IP 数。点击日期查看各文章当日增量。</p>
        </div>
      </div>
      ${dailyOverviewHtml({ daily, focusDate })}

      <div class="analytics-panel-head" style="margin:24px 0 8px">
        <div>
          <h3 style="margin:0">文章每日新增 · ${escapeHtml(focusDate || '—')}</h3>
          <p class="settings-hint" style="margin:4px 0 0">所选日期各页面新增 PV，按当日增量降序。</p>
        </div>
      </div>
      ${dailyPagesHtml({ pages, focusDate })}

      <div class="analytics-panel-head" style="margin:24px 0 8px">
        <div>
          <h3 style="margin:0">阅读排行（累计）</h3>
          <p class="settings-hint" style="margin:4px 0 0">按页面累计 PV 降序；导入历史数据后可能与旧第三方统计略有偏差。</p>
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

function bindDailyDatePickers(ctx, secret, focusDate) {
  ctx.content.querySelectorAll('.analytics-daily-row[data-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      const date = btn.dataset.date;
      if (!date || date === focusDate) return;
      loadCloudBaseAnalytics(ctx, secret, date).catch(err => {
        ctx.content.innerHTML = `<div class="admin-empty-card"><p>加载失败：${escapeHtml(err.message)}</p></div>`;
      });
    });
  });
}

async function loadCloudBaseAnalytics(ctx, secret, focusDate = '') {
  const [siteStats, adminData, dailyData] = await Promise.all([
    getSiteViewStats(),
    getAdminTopPages(secret, 50),
    getAdminDailyStats(secret, { days: DAILY_DAYS, date: focusDate || undefined }),
  ]);
  const site = adminData.site || { pv: siteStats.sitePv, uv: siteStats.siteUv };
  const top = adminData.top || [];
  const daily = dailyData.daily || [];
  const pages = dailyData.pages || [];
  const selectedDate = dailyData.focusDate || focusDate || daily[0]?.date || '';

  ctx.content.innerHTML = cloudbaseStatsHtml({
    site,
    top,
    daily,
    pages,
    focusDate: selectedDate,
  });

  bindDailyDatePickers(ctx, secret, selectedDate);

  $('#pvReloadBtn')?.addEventListener('click', () => {
    loadCloudBaseAnalytics(ctx, secret, selectedDate).catch(err => {
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
        <p>请在站点设置中启用访问计数，并确认 CloudBase 评论已配置 embedBaseUrl。</p>
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

(async function init() {
  const ctx = await mountAdminShell({
    active: 'analytics',
    title: '访问数据',
    actions: '<a class="btn btn-primary" href="settings.html">站点设置</a>',
  });
  if (!ctx) return;
  await renderCloudBase(ctx);
})();
