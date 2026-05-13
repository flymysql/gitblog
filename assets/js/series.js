// ============================================================================
// 系列页：按 series 分组，篇内顺序优先 seriesOrder，其次按发布时间升序
// ============================================================================

import { fetchIndexPublic } from './api.js';
import { initSite, escapeHtml, postPathFromPost } from './site.js';
import { setMeta } from './seo.js';

const $ = sel => document.querySelector(sel);

const ORDER_FALLBACK = 1e9;

function seriesOrderNum(o) {
  if (o == null || o === '') return ORDER_FALLBACK;
  const n = Number(o);
  return Number.isFinite(n) ? n : ORDER_FALLBACK;
}

function groupBySeries(posts) {
  const map = new Map();
  for (const p of posts) {
    const s = String(p.series || '').trim();
    if (!s) continue;
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(p);
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => {
      const ao = seriesOrderNum(a.seriesOrder);
      const bo = seriesOrderNum(b.seriesOrder);
      if (ao !== bo) return ao - bo;
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return da - db;
    });
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));
}

function formatShortDate(iso) {
  const d = new Date(iso || 0);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderSeries(groups) {
  const root = $('#seriesList');
  if (!groups.length) {
    root.innerHTML = '<div class="empty">暂无带 <code>series</code> 字段的文章，可在文章 frontmatter 中设置 <code>series</code> 与 <code>seriesOrder</code>。</div>';
    return;
  }
  root.innerHTML = groups.map(([name, posts]) => `
    <section class="series-group">
      <div class="series-title">${escapeHtml(name)} <span style="font-size:13px;color:var(--text-tertiary);font-weight:400">· ${posts.length} 篇</span></div>
      <ul class="series-list">
        ${posts.map((p, i) => {
          const ord = seriesOrderNum(p.seriesOrder);
          const orderLabel = ord < ORDER_FALLBACK ? String(ord) : String(i + 1);
          const dateStr = formatShortDate(p.date);
          return `
            <li class="series-item">
              <span class="order">${escapeHtml(orderLabel)}</span>
              <a class="title" href="${postPathFromPost(p)}">${escapeHtml(p.title || '无标题')}</a>
              <span class="meta">${escapeHtml(dateStr)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  `).join('');
}

(async function init() {
  initSite({ active: 'series.html' });
  setMeta({ title: '系列', description: '按系列浏览文章' });

  let posts = [];
  try {
    const data = await fetchIndexPublic();
    posts = (data.posts || []).filter(p => !p.draft && p.type !== 'note');
  } catch (e) {
    $('#seriesList').innerHTML = `<div class="error">加载失败：${escapeHtml(e.message)}</div>`;
    return;
  }

  const withSeries = posts.filter(p => String(p.series || '').trim());
  const groups = groupBySeries(withSeries);
  const totalPosts = withSeries.length;
  $('#seriesDesc').textContent = `共 ${groups.length} 个系列，收录 ${totalPosts} 篇文章（仅统计已设置 series 的公开文章）`;
  renderSeries(groups);
})();
