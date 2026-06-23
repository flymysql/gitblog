import { initToolPage, $, escapeHtml, copyText, setStatus } from './tool-kit-common.js';
import { CONFIG } from './config.js';
import { rootPath } from './site.js';

const STORAGE_KEY = 'farm-seed-prefs-v1';

const GOALS = {
  xp: { label: '冲等级', icon: '⭐', weights: { gold: 0.15, xp: 0.7, ease: 0.15 }, hint: '优先单位时间经验' },
  gold: { label: '攒金币', icon: '💰', weights: { gold: 0.7, xp: 0.15, ease: 0.15 }, hint: '优先单位时间利润' },
  ease: { label: '少上线', icon: '🌙', weights: { gold: 0.15, xp: 0.15, ease: 0.7 }, hint: '长周期、少收菜' },
  balance: { label: '均衡', icon: '⚖️', weights: { gold: 0.34, xp: 0.33, ease: 0.33 }, hint: '经验、金币、省心兼顾' },
};

const LAND_STYLE = {
  normal: { label: '普通', class: 'land-normal' },
  red: { label: '红土', class: 'land-red' },
  black: { label: '黑土', class: 'land-black' },
  gold: { label: '金土', class: 'land-gold' },
};

let meta = null;
let crops = [];
let compareIds = new Set();
let activeGoal = 'xp';

initToolPage({
  title: '微信农场 · 种子选择助手',
  description: '根据等级与上线习惯，推荐微信农场小程序种什么更划算。数据来自游戏内种子商店配置，浏览器本地计算。',
  path: 'tools/tool-farm-seed.html',
  commentsHint: '作物数值有误？欢迎纠错或补充新种子～',
});

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePrefs(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function readInputs() {
  const level = Math.max(0, parseInt($('farmLevel').value, 10) || 0);
  const intervalH = Math.max(1, parseFloat($('farmInterval').value) || 8);
  const land = $('farmLand').value || 'all';
  const levelOnly = $('farmLevelOnly').checked;
  return { level, intervalH, land, levelOnly, goal: activeGoal };
}

function formatHours(h) {
  const hours = Number(h) || 0;
  if (hours < 1 / 60) return `${Math.round(hours * 3600)} 秒`;
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`;
  if (hours < 24) return `${hours % 1 ? hours.toFixed(1) : hours} 小时`;
  const d = Math.floor(hours / 24);
  const r = hours % 24;
  return r ? `${d} 天 ${r % 1 ? r.toFixed(1) : r} 小时` : `${d} 天`;
}

function cropTimeLabel(crop) {
  const base = crop.growTimeLabel || formatHours(crop.growHours);
  return crop.seasons > 1 ? `${base} · ${crop.seasons}季` : base;
}

function easeScore(crop, intervalH) {
  const growMin = crop.growHours * 60;
  const windowMin = intervalH * 60;
  const rounds = Math.floor(windowMin / growMin);
  if (rounds < 1) return 0;
  return Math.min(rounds, 3) / 3;
}

function normMap(items, key) {
  const vals = items.map(c => c[key]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  return new Map(items.map(c => [c.id, (c[key] - min) / span]));
}

function scoreCrop(crop, ctx, norms) {
  const w = GOALS[ctx.goal]?.weights || GOALS.balance.weights;
  const goldN = norms.gold.get(crop.id) ?? 0;
  const xpN = norms.xp.get(crop.id) ?? 0;
  const easeN = norms.ease.get(crop.id) ?? 0;
  const total = w.gold * goldN + w.xp * xpN + w.ease * easeN;
  return { total, goldN, xpN, easeN };
}

function buildReason(crop, ctx, scores) {
  const w = GOALS[ctx.goal]?.weights || GOALS.balance.weights;
  const parts = [];
  if (w.xp >= 0.5) parts.push(`经验 ${crop.xpPerHour}/时`);
  if (w.gold >= 0.5) parts.push(`利润 ${crop.profitPerHour} 金/时`);
  if (w.ease >= 0.5) parts.push(`成熟 ${cropTimeLabel(crop)}，适合你的上线间隔`);
  const rounds = Math.floor((ctx.intervalH * 60) / (crop.growHours * 60));
  if (rounds < 1) return { text: `成熟需 ${cropTimeLabel(crop)}，超过你设置的 ${ctx.intervalH} 小时间隔，容易烂菜。`, warn: true };
  if (rounds >= 1 && w.ease >= 0.4) parts.push(`每 ${ctx.intervalH} 小时可收 ${rounds} 轮`);
  if (crop.profitNote) parts.push(crop.profitNote);
  const land = LAND_STYLE[crop.land]?.label || crop.land;
  parts.push(`需 ${land} · ${crop.minLevel} 级`);
  return { text: parts.join('；'), warn: false };
}

function filterCrops(ctx) {
  return crops.filter(c => {
    if (ctx.levelOnly && c.minLevel > ctx.level) return false;
    if (ctx.land !== 'all' && c.land !== ctx.land) return false;
    return true;
  });
}

function rankCrops(ctx) {
  const list = filterCrops(ctx);
  if (!list.length) return [];

  const easeMap = new Map(list.map(c => [c.id, easeScore(c, ctx.intervalH)]));
  const enriched = list.map(c => ({
    ...c,
    easeRaw: easeMap.get(c.id) ?? 0,
    fitInterval: easeMap.get(c.id) >= 1 / 3,
  }));

  const norms = {
    gold: normMap(enriched, 'profitPerHour'),
    xp: normMap(enriched, 'xpPerHour'),
    ease: normMap(enriched, 'easeRaw'),
  };

  return enriched
    .map(c => {
      const s = scoreCrop(c, ctx, norms);
      const reason = buildReason(c, ctx, s);
      return { ...c, score: s.total, scores: s, reason };
    })
    .sort((a, b) => b.score - a.score);
}

function cropIconHtml(crop, size = 'md') {
  const cls = size === 'lg' ? 'farm-crop-icon is-lg' : 'farm-crop-icon';
  return `<span class="${cls}" role="img" aria-label="${escapeHtml(crop.name)}">${crop.emoji || '🌱'}</span>`;
}

function renderTopPick(top, ctx) {
  const box = $('farmTopPick');
  if (!top) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const land = LAND_STYLE[top.land] || LAND_STYLE.normal;
  $('farmTopPick').innerHTML = `
    <div class="farm-pick-badge">今日推荐</div>
    <div class="farm-pick-main">
      ${cropIconHtml(top, 'lg')}
      <div class="farm-pick-body">
        <h2>${escapeHtml(top.name)}</h2>
        <p class="farm-pick-meta">
          <span class="farm-land-tag ${land.class}">${escapeHtml(land.label)}</span>
          <span>${top.minLevel} 级</span>
          <span>成熟 ${cropTimeLabel(top)}</span>
        </p>
        <p class="farm-pick-reason${top.reason.warn ? ' is-warn' : ''}">${escapeHtml(top.reason.text)}</p>
        <div class="farm-pick-stats">
          <span><em>${top.profitPerHour}</em> 金/时</span>
          <span><em>${top.xpPerHour}</em> 经验/时</span>
          <span>种子 <em>${top.seedCost || '免费'}</em></span>
        </div>
      </div>
    </div>
    <div class="farm-pick-actions">
      <button type="button" class="tool-kit-btn" id="farmCopyPick">复制推荐</button>
      <button type="button" class="tool-kit-btn is-ghost" id="farmComparePick">加入对比</button>
    </div>
  `;
  $('farmCopyPick').onclick = () => copyRecommendation(top);
  $('farmComparePick').onclick = () => toggleCompare(top.id);
}

function copyRecommendation(crop) {
  const text = `【微信农场】推荐种：${crop.name}\n成熟 ${cropTimeLabel(crop)} · ${crop.profitPerHour} 金/时 · ${crop.xpPerHour} 经验/时\n${crop.reason.text}`;
  copyText(text).then(() => setStatus($('farmStatus'), '已复制到剪贴板', true));
}

function toggleCompare(id) {
  if (compareIds.has(id)) compareIds.delete(id);
  else if (compareIds.size >= 3) compareIds = new Set([...compareIds].slice(1));
  else compareIds.add(id);
  render();
}

function renderList(ranked) {
  const ul = $('farmCropList');
  if (!ranked.length) {
    ul.innerHTML = '<li class="farm-crop-empty">没有符合条件的作物，试试降低等级过滤或切换土地类型。</li>';
    return;
  }
  ul.innerHTML = ranked.map((c, i) => {
    const land = LAND_STYLE[c.land] || LAND_STYLE.normal;
    const checked = compareIds.has(c.id) ? ' checked' : '';
    const warn = !c.fitInterval ? ' is-warn' : '';
    return `
      <li class="farm-crop-card${warn}" data-id="${escapeHtml(c.id)}">
        <label class="farm-crop-check">
          <input type="checkbox" data-compare="${escapeHtml(c.id)}"${checked} aria-label="加入对比">
        </label>
        ${cropIconHtml(c)}
        <div class="farm-crop-info">
          <div class="farm-crop-title">
            <strong>${escapeHtml(c.name)}</strong>
            <span class="farm-rank">#${i + 1}</span>
            <span class="farm-land-tag ${land.class}">${escapeHtml(land.label)}</span>
          </div>
          <p class="farm-crop-sub">${c.minLevel} 级 · ${cropTimeLabel(c)} · 种子 ${c.seedCost || '免费'}</p>
          <div class="farm-crop-bars">
            <span title="金币/时"><i style="width:${Math.round(c.scores.goldN * 100)}%"></i></span>
            <span title="经验/时"><i style="width:${Math.round(c.scores.xpN * 100)}%"></i></span>
            <span title="省心"><i style="width:${Math.round(c.scores.easeN * 100)}%"></i></span>
          </div>
        </div>
        <div class="farm-crop-metrics">
          <span>${c.profitPerHour}<small>金/时</small></span>
          <span>${c.xpPerHour}<small>经验/时</small></span>
        </div>
      </li>
    `;
  }).join('');

  ul.querySelectorAll('input[data-compare]').forEach(inp => {
    inp.addEventListener('change', () => toggleCompare(inp.dataset.compare));
  });
}

function renderCompare(ranked) {
  const panel = $('farmCompare');
  const ids = [...compareIds];
  const items = ids.map(id => ranked.find(c => c.id === id)).filter(Boolean);
  if (!items.length) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const maxGold = Math.max(...items.map(c => c.profitPerHour));
  const maxXp = Math.max(...items.map(c => c.xpPerHour));
  $('farmCompareGrid').innerHTML = items.map(c => `
    <article class="farm-compare-card">
      ${cropIconHtml(c, 'lg')}
      <h3>${escapeHtml(c.name)}</h3>
      <dl>
        <div><dt>金币/时</dt><dd><span class="farm-meter"><i style="width:${Math.round((c.profitPerHour / maxGold) * 100)}%"></i></span>${c.profitPerHour}</dd></div>
        <div><dt>经验/时</dt><dd><span class="farm-meter"><i style="width:${Math.round((c.xpPerHour / maxXp) * 100)}%"></i></span>${c.xpPerHour}</dd></div>
        <div><dt>成熟</dt><dd>${cropTimeLabel(c)}</dd></div>
        <div><dt>土地</dt><dd>${escapeHtml(LAND_STYLE[c.land]?.label || c.land)}</dd></div>
      </dl>
    </article>
  `).join('');
}

function renderGoals() {
  $('farmGoals').innerHTML = Object.entries(GOALS).map(([key, g]) => `
    <button type="button" class="farm-goal-card${key === activeGoal ? ' is-active' : ''}" data-goal="${key}">
      <span class="farm-goal-icon">${g.icon}</span>
      <span class="farm-goal-label">${escapeHtml(g.label)}</span>
      <span class="farm-goal-hint">${escapeHtml(g.hint)}</span>
    </button>
  `).join('');
  $('farmGoals').querySelectorAll('[data-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeGoal = btn.dataset.goal;
      renderGoals();
      render();
    });
  });
}

function render() {
  const ctx = readInputs();
  savePrefs({ ...ctx, goal: activeGoal });
  const ranked = rankCrops(ctx);
  renderTopPick(ranked[0] || null);
  renderList(ranked);
  renderCompare(ranked);
  const n = ranked.length;
  $('farmResultDesc').textContent = n
    ? `共 ${n} 种作物符合条件 · 目标「${GOALS[ctx.goal].label}」`
    : '暂无匹配作物';
}

async function loadData() {
  const url = rootPath(`data/farm-crops.json?v=${encodeURIComponent(CONFIG.VERSION || '')}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error('无法加载作物数据');
  meta = await res.json();
  crops = meta.crops || [];
  $('farmDataNote').textContent = meta.disclaimer || '';
  if (meta.sources?.length) {
    $('farmSources').innerHTML = meta.sources.map(s =>
      `<a href="${escapeHtml(s)}" target="_blank" rel="noopener noreferrer">来源</a>`
    ).join(' · ');
  }
}

function bindInputs() {
  ['farmLevel', 'farmInterval', 'farmLand', 'farmLevelOnly'].forEach(id => {
    $(id).addEventListener('input', render);
    $(id).addEventListener('change', render);
  });
}

function applyPrefs() {
  const p = loadPrefs();
  if (p.level != null) $('farmLevel').value = p.level;
  if (p.intervalH != null) $('farmInterval').value = p.intervalH;
  if (p.land) $('farmLand').value = p.land;
  if (p.levelOnly != null) $('farmLevelOnly').checked = p.levelOnly;
  if (p.goal && GOALS[p.goal]) activeGoal = p.goal;
}

(async function init() {
  renderGoals();
  applyPrefs();
  bindInputs();
  try {
    await loadData();
    render();
  } catch (e) {
    $('farmCropList').innerHTML = `<li class="farm-crop-empty is-error">${escapeHtml(e.message)}</li>`;
  }
})();
