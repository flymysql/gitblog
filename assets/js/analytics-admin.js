// ============================================================================
// 后台「访问数据」：把已配置的 saobby 计数器控制面板用 iframe 嵌入
//   - 站点级 / 文章页 / 自建额外计数器各占一个 tab
//   - 每篇带 frontmatter.counter 的文章也单独一个 tab
//   - 没有配置 saobby 时，引导用户去站点设置 / saobby.com
//   - 兼容 saobby 控制面板若禁止被 iframe 嵌入的情况：错误时给出"在新页面打开"按钮
// ============================================================================

import { CONFIG } from './config.js';
import { fetchIndexPublic, readIndex } from './api.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';

const $ = sel => document.querySelector(sel);

function pvCfg() {
  return CONFIG.pageviews || {};
}

function provider() {
  const cfg = pvCfg();
  if (!cfg.enabled) return 'none';
  return cfg.provider || 'busuanzi';
}

function saobbyCfg() {
  return pvCfg().saobby || {};
}

function listCounters(posts = []) {
  const sb = saobbyCfg();
  const items = [];
  const site = sb.site || {};
  if (site.img || site.dashboard) {
    items.push({ id: 'site', name: '站点总计数器', img: site.img, dashboard: site.dashboard, kind: 'site' });
  }
  const article = sb.article || {};
  if (article.img || article.dashboard) {
    items.push({ id: 'article', name: '文章页（全站共用）', img: article.img, dashboard: article.dashboard, kind: 'article' });
  }
  (sb.extra || []).forEach((it, i) => {
    if (!it) return;
    if (it.img || it.dashboard) {
      items.push({ id: `extra-${i}`, name: it.name || `自建计数器 ${i + 1}`, img: it.img, dashboard: it.dashboard, kind: 'extra' });
    }
  });
  // 每篇带 frontmatter.counter 的文章
  posts.forEach(p => {
    if (!p || !p.counter) return;
    const c = p.counter;
    if (!c.img && !c.dashboard) return;
    items.push({
      id: `post-${p.slug}`,
      name: `文章：${p.title || p.slug}`,
      img: c.img,
      dashboard: c.dashboard,
      kind: 'post',
      slug: p.slug,
    });
  });
  return items;
}

async function loadPosts() {
  try {
    const idx = await readIndex().catch(() => null);
    if (idx && idx.data && Array.isArray(idx.data.posts)) return idx.data.posts;
  } catch {}
  try {
    const idx = await fetchIndexPublic();
    if (idx && Array.isArray(idx.posts)) return idx.posts;
  } catch {}
  return [];
}

function articlesWithoutCounter(posts) {
  return posts.filter(p => !p.draft && !p.page && !(p.counter && (p.counter.img || p.counter.dashboard)));
}

function emptyHtml() {
  const isSaobby = provider() === 'saobby';
  return `
    <section class="admin-empty-card">
      <h2>暂时没有可展示的访问数据</h2>
      ${isSaobby
        ? '<p>当前 provider 是 <b>saobby</b>，但还没有配置任何计数器。</p>'
        : `<p>当前 provider 是 <b>${escapeHtml(provider())}</b>。本页面仅支持嵌入 <b>saobby</b> 的控制面板。</p>`
      }
      <ol style="margin:14px 0 0 18px;color:var(--text-secondary);line-height:1.9;">
        <li>到 <a href="https://www.saobby.com/create_webcounter" target="_blank" rel="noopener">saobby.com / 创建网页计数器</a> 创建一个或多个计数器（默认设置即可）。</li>
        <li>每个计数器都会得到一张 <b>计数图片 URL</b> 和一个 <b>控制面板 URL</b>（含 key）。</li>
        <li>回到本站「站点设置 → 访问计数」，把图片 URL 和控制面板 URL 填进对应字段，并将 provider 切到 <code>saobby</code>。</li>
        <li>保存后回到本页，即可看到嵌入的控制面板。</li>
      </ol>
      <p style="margin-top:18px"><a class="btn btn-primary" href="settings.html">前往站点设置 →</a></p>
    </section>
  `;
}

function counterTabsHtml(items) {
  // 把文章计数器折叠到一个二级 select，避免几十篇文章把 tab 撑爆
  const pinned = items.filter(it => it.kind !== 'post');
  const posts = items.filter(it => it.kind === 'post');
  const firstId = items[0] ? items[0].id : '';
  return `
    <div class="analytics-tabs" role="tablist">
      ${pinned.map(it => `
        <button type="button" class="analytics-tab${it.id === firstId ? ' active' : ''}" data-tab-id="${escapeHtml(it.id)}" role="tab">
          ${escapeHtml(it.name)}
        </button>
      `).join('')}
      ${posts.length ? `
        <select class="analytics-post-select" id="analyticsPostSelect">
          <option value="">— 文章独立计数器（${posts.length}）—</option>
          ${posts.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
      ` : ''}
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
    <a class="btn btn-primary" href="settings.html#pv">配置计数器</a>
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
  const sel = document.getElementById('analyticsPostSelect');
  if (sel) {
    sel.addEventListener('change', () => {
      const id = sel.value;
      if (!id) return;
      activatePanel(id);
      document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
    });
  }
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

function postsWithoutCounterHtml(posts) {
  const missing = articlesWithoutCounter(posts);
  if (!missing.length) return '';
  return `
    <details class="analytics-missing">
      <summary>${missing.length} 篇文章还没有独立计数器（点击展开）</summary>
      <p class="settings-hint" style="margin:6px 0 10px 0">
        在文章编辑器里点「为本文创建计数器…」即可补上。每篇创建后回到本页能看到对应控制面板。
      </p>
      <ul class="analytics-missing-list">
        ${missing.slice(0, 50).map(p => `
          <li>
            <a href="editor.html?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.title || p.slug)}</a>
            <span class="analytics-missing-meta">${escapeHtml(String(p.date || '').slice(0, 10))}</span>
          </li>
        `).join('')}
      </ul>
      ${missing.length > 50 ? `<p class="settings-hint">…共 ${missing.length} 篇，先列前 50 篇</p>` : ''}
    </details>
  `;
}

(async function init() {
  const ctx = await mountAdminShell({ active: 'analytics', title: '访问数据', actions: topActions() });
  if (!ctx) return;
  const posts = await loadPosts();
  const items = listCounters(posts);
  if (!items.length) {
    ctx.content.innerHTML = emptyHtml();
    return;
  }
  ctx.content.innerHTML = `
    <div class="analytics-shell">
      <p class="settings-help" style="margin:0 0 12px 0">
        以下控制面板由 <a href="https://www.saobby.com" target="_blank" rel="noopener">saobby.com</a> 提供。每张图片即一个独立计数器，加载页面就会 +1；首屏数字延迟一两秒属于正常现象。
      </p>
      ${counterTabsHtml(items)}
      ${postsWithoutCounterHtml(posts)}
      <div class="analytics-panels">
        ${items.map((it, i) => counterPanelHtml(it, i === 0)).join('')}
      </div>
    </div>
  `;
  bindTabs();
  watchIframeLoadFailures();
})();
