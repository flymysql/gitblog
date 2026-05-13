// ============================================================================
// 后台「访问数据」：嵌入已配置的 Saobby 控制面板
//   - 站点级 + 额外计数器；单篇阅读请在 vercount.one 查看（前台用 Vercount）
// ============================================================================

import { CONFIG } from './config.js';
import { mountAdminShell, escapeHtml } from './admin-shell.js';
import { isSaobbyOn } from './pageviews.js';

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
  // 大部分浏览器在跨域 iframe 被 X-Frame-Options 拒绝时不会触发 error；
  // 只能给出主动「在新页面打开」按钮。这里仍尝试在 onload 之后探测 contentWindow；
  // 跨域时访问会抛错（可观察到，但内容仍可能加载成功），所以仅做轻量提示。
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

(async function init() {
  const ctx = await mountAdminShell({ active: 'analytics', title: '访问数据', actions: topActions() });
  if (!ctx) return;
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
})();
