// ============================================================================
// 编辑器：EasyMDE + 草稿/置顶 + 拖拽/粘贴上传图片 + 发布前校验
// ============================================================================

import { CONFIG } from './config.js';
import { isAuthorized, getToken, getUser, logout, rememberReturnTo } from './auth.js';
import { readFile, writeFile, deleteFile, readIndex, writeIndex, uploadImage } from './api.js';
import {
  renderMarkdown,
  parseFrontmatter,
  stringifyFrontmatter,
  extractSummary,
  slugify,
} from './markdown.js';
import { initTheme, bindThemeToggle } from './theme.js';

const $ = sel => document.querySelector(sel);

function showToast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 200);
  }, 2400);
}

function setStatus(text, kind = '') {
  const el = $('#status');
  el.textContent = text;
  el.className = 'editor-status ' + kind;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

const params = new URLSearchParams(window.location.search);
const initialSlug = params.get('slug');

const state = {
  loadedSlug: initialSlug,
  loadedSha: null,
  loadedPath: null,
  data: {},
  loading: false,
  mde: null,
  vditor: null,            // Vditor 实例（懒加载，第一次切「富文本」时初始化）
  vditorReady: false,      // Vditor after() 回调里翻 true
  vditorPendingValue: '',  // ready 之前 setContent 过来的值，ready 后兜底回填
  editorMode: 'markdown',  // markdown | rich
  selectedTags: [],
  availableTags: [],
  selectedSeries: '',
  seriesOrder: '',
  availableSeries: [],
  counter: { img: '', dashboard: '' }, // 文章独立 saobby 计数器
  docList: [],
  docSearch: '',
  syncScrollLock: false,
};

function getContent() {
  if (state.editorMode === 'rich' && state.vditor && state.vditorReady) {
    return state.vditor.getValue() || '';
  }
  return state.mde ? state.mde.value() : ($('#content').value || '');
}
function setContent(v) {
  const md = v || '';
  // EasyMDE 也同步保留一份，切回去时不丢
  if (state.mde) state.mde.value(md);
  else $('#content').value = md;
  if (state.vditor) {
    if (state.vditorReady) state.vditor.setValue(md);
    else state.vditorPendingValue = md;
  }
}

function goLogin() {
  rememberReturnTo(window.location.href);
  window.location.href = './';
}

function gateAuth() {
  if (!getToken()) {
    if (confirm('需要先登录后台。点击确定前往登录页。')) goLogin();
    return false;
  }
  if (!isAuthorized()) {
    showToast('当前账号不在白名单内', 'error');
    return false;
  }
  return true;
}

async function loadPost(slug) {
  state.loading = true;
  setStatus('加载中…');
  const path = `${CONFIG.paths.posts}/${slug}.md`;
  try {
    const file = await readFile(path);
    if (!file) {
      setStatus('未找到文章', 'error');
      return;
    }
    const { data, content } = parseFrontmatter(file.content);
    state.loadedSha = file.sha;
    state.loadedPath = file.path;
    state.data = data;
    $('#title').value = data.title || '';
    $('#author').value = data.author || (getUser() && getUser().name) || CONFIG.site.author || '';
    setEditorTags(data.tags || []);
    $('#cover').value = data.cover || '';
    $('#slug').value = slug;
    $('#draftToggle').checked = !!data.draft;
    $('#pinnedToggle').checked = !!data.pinned;
    $('#carouselToggle').checked = !!data.carousel;
    setEditorSeries(data.series || '', data.seriesOrder);
    setEditorCounter(data.counter || { img: '', dashboard: '' });
    setContent(content);
    document.title = `编辑：${data.title || slug}`;
    renderSummaryPreview();
    setStatus('已加载', 'saved');
    $('#btnDelete').style.display = '';
    updatePreview();
    refreshEditorLayout();
  } catch (e) {
    console.error(e);
    if (e.status === 401) { logout(window.location.href); return; }
    setStatus('加载失败：' + e.message, 'error');
  } finally {
    state.loading = false;
  }
}

let previewTimer = null;
async function updatePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const t = $('#title').value || '预览';
    $('#previewTitle').textContent = t;
    $('#preview').innerHTML = await renderMarkdown(getContent());
    buildToc();
    renderSummaryPreview();
    renderDocList(state.docSearch);
  }, 200);
}

function renderSummaryPreview() {
  const el = $('#summaryPreview');
  if (!el) return;
  const content = getContent();
  const summary = state.data.summary || extractSummary(content, 120);
  el.textContent = summary || '发布时自动从正文提取，也可点「生成摘要」';
}

function buildToc() {
  const preview = $('#preview');
  const toc = $('#docToc');
  if (!preview || !toc) return;

  const headings = [...preview.querySelectorAll('h2, h3, h4')];
  if (!headings.length) {
    toc.innerHTML = '<p class="studio-toc-empty">正文标题将自动生成目录</p>';
    return;
  }

  headings.forEach((h, i) => {
    if (!h.id) h.id = `studio-h-${i}`;
  });

  toc.innerHTML = headings.map(h => {
    const level = h.tagName.toLowerCase();
    return `<a class="studio-toc-link is-${level}" href="#${h.id}" data-target="${h.id}">${escapeHtml(h.textContent.trim())}</a>`;
  }).join('');

  toc.querySelectorAll('.studio-toc-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = preview.querySelector(`#${link.dataset.target}`);
      const pane = $('#previewPane');
      if (target && pane) {
        const top = target.offsetTop - pane.offsetTop - 12;
        pane.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      }
      toc.querySelectorAll('.studio-toc-link').forEach(a => a.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  });
}

async function loadDocList() {
  try {
    const idx = await readIndex();
    state.docList = ((idx && idx.data && idx.data.posts) || [])
      .filter(p => !p.page)
      .sort((a, b) => new Date(b.updated || b.date) - new Date(a.updated || a.date));
    renderDocList(state.docSearch);
  } catch (e) {
    console.warn('文章列表加载失败', e);
  }
}

function renderDocList(filter = '') {
  const list = $('#docList');
  if (!list) return;
  const q = String(filter || '').trim().toLowerCase();
  const currentSlug = state.loadedSlug || ($('#slug') && $('#slug').value) || '';
  const items = state.docList.filter(p => {
    if (!q) return true;
    return (p.title || '').toLowerCase().includes(q) || (p.slug || '').toLowerCase().includes(q);
  });

  list.innerHTML = items.length
    ? items.map(p => `
        <a class="studio-doc-item${p.slug === currentSlug ? ' is-active' : ''}${p.draft ? ' is-draft' : ''}"
           href="./editor.html?slug=${encodeURIComponent(p.slug)}"
           title="${escapeHtml(p.title || p.slug)}">
          <span class="studio-doc-title">${escapeHtml(p.title || p.slug)}</span>
          ${p.series ? `<span class="studio-doc-badge studio-doc-series">${escapeHtml(p.series)}</span>` : ''}
          ${p.draft ? '<span class="studio-doc-badge">草稿</span>' : ''}
        </a>
      `).join('')
    : '<p class="studio-nav-empty">没有匹配的文章</p>';

  refreshSeriesFromDocList();
}

function refreshSeriesFromDocList() {
  const names = state.docList.map(p => normalizeSeriesName(p.series)).filter(Boolean);
  if (state.selectedSeries) names.push(state.selectedSeries);
  state.availableSeries = [...new Set([...state.availableSeries, ...names])]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  renderSeriesPicker();
  renderSeriesDatalist();
}

function toCommaList(s) {
  return String(s || '').split(/[,，]/).map(x => x.trim()).filter(Boolean);
}

function uniqueTags(tags) {
  const seen = new Set();
  const list = [];
  for (const raw of tags || []) {
    const tag = String(raw || '').trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    list.push(tag);
  }
  return list;
}

function syncTagsInput() {
  $('#tags').value = state.selectedTags.join(', ');
}

function renderTagPicker() {
  const selected = $('#selectedTags');
  const suggestions = $('#tagSuggestions');
  if (!selected || !suggestions) return;

  selected.innerHTML = state.selectedTags.length
    ? state.selectedTags.map(t => `
        <button class="editor-tag-chip selected" type="button" data-remove-tag="${escapeHtml(t)}" title="点击移除">
          ${escapeHtml(t)}<span>×</span>
        </button>
      `).join('')
    : '<span class="editor-tag-empty">还没有选择标签</span>';

  const q = ($('#tagInput') && $('#tagInput').value.trim().toLowerCase()) || '';
  const tags = state.availableTags
    .filter(t => !state.selectedTags.includes(t))
    .filter(t => !q || t.toLowerCase().includes(q))
    .slice(0, 30);

  suggestions.innerHTML = tags.length
    ? tags.map(t => `<button class="editor-tag-chip" type="button" data-add-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')
    : '<span class="editor-tag-empty">没有可选标签，可直接输入新的</span>';
}

function setEditorTags(tags) {
  state.selectedTags = uniqueTags(tags);
  state.availableTags = uniqueTags([...state.availableTags, ...state.selectedTags]).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  syncTagsInput();
  renderTagPicker();
}

// ---------- 文章独立计数器（saobby 半自动） ----------
function setEditorCounter(counter) {
  state.counter = {
    img: String((counter && counter.img) || '').trim(),
    dashboard: String((counter && counter.dashboard) || '').trim(),
  };
  renderEditorCounter();
}

function renderEditorCounter() {
  const field = $('#counterField');
  if (!field) return;
  // 文章阅读数由 Vercount 按页面 URL 统计，编辑器不再配置 per-post 计数器
  field.hidden = true;
}

function buildSaobbyCreateUrl() {
  // saobby 创建页本身没有 query string 配置入口（页面是富表单），
  // 所以这里只是直跳过去，让用户用默认设置创建。
  // 之所以经一次拼接，是为后续 saobby 提供更好集成时方便扩展。
  return 'https://www.saobby.com/create_webcounter';
}

async function pasteCounterDialog() {
  // 一个简单的双行输入对话框：让用户把 saobby 给的「图片 URL」和「控制面板 URL」粘进来
  const cur = state.counter || {};
  const imgIn = prompt(
    '把 saobby 给你的「计数器图片 URL」粘到这里：\n（例如：https://www.saobby.com/w/abc123 或 .../webcounter/svg?id=...）',
    cur.img || ''
  );
  if (imgIn == null) return; // 用户取消
  const img = String(imgIn || '').trim();
  if (img && !/^https?:\/\//i.test(img)) {
    alert('图片 URL 看起来不对，请确认是 https:// 开头的完整地址');
    return;
  }
  const dashIn = prompt(
    '再把 saobby 给你的「控制面板 URL（含 access_token / key）」粘进来：\n（例如：https://www.saobby.com/webcounter_dashboard?access_token=xxx）',
    cur.dashboard || ''
  );
  if (dashIn == null) return;
  const dashboard = String(dashIn || '').trim();
  if (dashboard && !/^https?:\/\//i.test(dashboard)) {
    alert('控制面板 URL 看起来不对，请确认是 https:// 开头的完整地址');
    return;
  }
  setEditorCounter({ img, dashboard });
  showToast('已记录本文计数器，发布时会写入 frontmatter');
}

function bindCounterPanel() {
  const createBtn = $('#counterCreateBtn');
  const pasteBtn = $('#counterPasteBtn');
  const clearBtn = $('#counterClearBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      const w = window.open(buildSaobbyCreateUrl(), '_blank', 'noopener,noreferrer');
      if (!w) {
        showToast('浏览器拦截了新窗口，请手动打开 saobby.com 创建', 'error');
        return;
      }
      // 创建完成后用户回到本页面，提示去粘贴 URL
      showToast('在新窗口中创建计数器后，回来点「粘贴 URL…」把图片 + 控制面板 URL 粘进来');
    });
  }
  if (pasteBtn) pasteBtn.addEventListener('click', pasteCounterDialog);
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!confirm('清除本文的独立计数器配置？')) return;
    setEditorCounter({ img: '', dashboard: '' });
  });
}

function addEditorTag(tag) {
  const [clean] = uniqueTags([tag]);
  if (!clean) return;
  if (!state.selectedTags.includes(clean)) state.selectedTags.push(clean);
  if (!state.availableTags.includes(clean)) {
    state.availableTags.push(clean);
    state.availableTags.sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }
  $('#tagInput').value = '';
  syncTagsInput();
  renderTagPicker();
}

function removeEditorTag(tag) {
  state.selectedTags = state.selectedTags.filter(t => t !== tag);
  syncTagsInput();
  renderTagPicker();
}

async function loadAvailableTags() {
  try {
    const idx = await readIndex();
    const tags = [];
    for (const p of ((idx && idx.data && idx.data.posts) || [])) {
      tags.push(...(p.tags || []));
    }
    state.availableTags = uniqueTags([...state.availableTags, ...tags]).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    renderTagPicker();
  } catch (e) {
    console.warn('标签列表加载失败', e);
  }
}

function bindTagPicker() {
  const input = $('#tagInput');
  const addBtn = $('#addTagBtn');
  const selected = $('#selectedTags');
  const suggestions = $('#tagSuggestions');
  if (!input || !addBtn || !selected || !suggestions) return;

  addBtn.addEventListener('click', () => addEditorTag(input.value));
  input.addEventListener('input', renderTagPicker);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',' || e.key === '，') {
      e.preventDefault();
      addEditorTag(input.value);
    }
  });
  suggestions.addEventListener('click', e => {
    const btn = e.target.closest('[data-add-tag]');
    if (btn) addEditorTag(btn.dataset.addTag);
  });
  selected.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove-tag]');
    if (btn) removeEditorTag(btn.dataset.removeTag);
  });
}

function normalizeSeriesName(name) {
  return String(name || '').trim();
}

function suggestSeriesOrder(seriesName) {
  const name = normalizeSeriesName(seriesName);
  if (!name) return '';
  const inSeries = state.docList.filter(p => normalizeSeriesName(p.series) === name && p.slug !== state.loadedSlug);
  const max = inSeries.reduce((m, p) => Math.max(m, Number(p.seriesOrder) || 0), 0);
  return String(max + 1);
}

function setEditorSeries(series, order) {
  state.selectedSeries = normalizeSeriesName(series);
  const orderEl = $('#seriesOrder');
  const orderWrap = $('#seriesOrderWrap');
  const input = $('#seriesInput');
  if (input) input.value = state.selectedSeries;
  if (orderEl) {
    const n = order == null || order === '' ? '' : String(order);
    state.seriesOrder = n;
    orderEl.value = n;
  }
  if (orderWrap) orderWrap.hidden = !state.selectedSeries;
  renderSeriesPicker();
  renderSeriesDatalist();
}

function renderSeriesDatalist() {
  const list = $('#seriesNameList');
  if (!list) return;
  list.innerHTML = state.availableSeries
    .map(s => `<option value="${escapeHtml(s)}"></option>`)
    .join('');
}

function renderSeriesPicker() {
  const selected = $('#selectedSeries');
  const suggestions = $('#seriesSuggestions');
  const orderWrap = $('#seriesOrderWrap');
  if (!selected || !suggestions) return;

  selected.innerHTML = state.selectedSeries
    ? `<button class="editor-tag-chip selected" type="button" data-remove-series title="点击移除专栏">
        ${escapeHtml(state.selectedSeries)}<span>×</span>
      </button>`
    : '<span class="editor-tag-empty">尚未加入专栏</span>';

  if (orderWrap) orderWrap.hidden = !state.selectedSeries;

  const q = ($('#seriesInput') && $('#seriesInput').value.trim().toLowerCase()) || '';
  const names = state.availableSeries
    .filter(s => s !== state.selectedSeries)
    .filter(s => !q || s.toLowerCase().includes(q))
    .slice(0, 24);

  suggestions.innerHTML = names.length
    ? names.map(s => `<button class="editor-tag-chip" type="button" data-add-series="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')
    : '<span class="editor-tag-empty">输入新专栏名后点「加入专栏」</span>';
}

function addEditorSeries(raw) {
  const name = normalizeSeriesName(raw);
  if (!name) {
    showToast('请输入专栏名称', 'error');
    return;
  }
  state.selectedSeries = name;
  if (!state.availableSeries.includes(name)) {
    state.availableSeries.push(name);
    state.availableSeries.sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }
  const input = $('#seriesInput');
  if (input) input.value = name;
  const orderEl = $('#seriesOrder');
  if (orderEl && !orderEl.value.trim()) {
    const suggested = suggestSeriesOrder(name);
    orderEl.value = suggested;
    state.seriesOrder = suggested;
  }
  renderSeriesPicker();
  renderSeriesDatalist();
  showToast(`已加入专栏「${name}」`);
}

function removeEditorSeries() {
  state.selectedSeries = '';
  state.seriesOrder = '';
  const input = $('#seriesInput');
  const orderEl = $('#seriesOrder');
  if (input) input.value = '';
  if (orderEl) orderEl.value = '';
  renderSeriesPicker();
}

function bindSeriesPicker() {
  const input = $('#seriesInput');
  const addBtn = $('#addSeriesBtn');
  const selected = $('#selectedSeries');
  const suggestions = $('#seriesSuggestions');
  const orderEl = $('#seriesOrder');
  if (!input || !addBtn || !selected || !suggestions) return;

  addBtn.addEventListener('click', () => addEditorSeries(input.value));
  input.addEventListener('input', renderSeriesPicker);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEditorSeries(input.value);
    }
  });
  suggestions.addEventListener('click', e => {
    const btn = e.target.closest('[data-add-series]');
    if (btn) addEditorSeries(btn.dataset.addSeries);
  });
  selected.addEventListener('click', e => {
    if (e.target.closest('[data-remove-series]')) removeEditorSeries();
  });
  if (orderEl) {
    orderEl.addEventListener('input', () => {
      state.seriesOrder = orderEl.value.trim();
    });
  }
}

async function loadAvailableSeries() {
  try {
    const idx = await readIndex();
    const names = [];
    for (const p of ((idx && idx.data && idx.data.posts) || [])) {
      const s = normalizeSeriesName(p.series);
      if (s) names.push(s);
    }
    if (state.selectedSeries) names.push(state.selectedSeries);
    state.availableSeries = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    renderSeriesPicker();
    renderSeriesDatalist();
  } catch (e) {
    console.warn('专栏列表加载失败', e);
  }
}

function focusSeriesPanel() {
  const meta = $('#editorMeta');
  const shell = $('#studioShell');
  if (meta) meta.classList.remove('is-collapsed');
  if (shell && window.matchMedia('(max-width: 960px)').matches) {
    shell.classList.add('is-mobile-nav-open');
  }
  const field = $('#seriesField');
  if (field) field.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  $('#seriesInput')?.focus();
}

function validateBeforePublish({ title, slug, content, tags, summary, allPosts, isUpdate }) {
  const errs = [];
  if (!title.trim()) errs.push('标题不能为空');
  if (!content.trim()) errs.push('正文不能为空');
  if (!slug.trim()) errs.push('slug 不能为空');
  if (!tags.length) errs.push('建议至少添加一个标签');
  if (!summary.trim()) errs.push('建议补充摘要（首段或自动生成）');
  if (!isUpdate && allPosts && allPosts.some(p => p.slug === slug)) errs.push('slug 已存在，请改一个');
  return errs;
}

async function publish() {
  if (!gateAuth()) return;

  const title = $('#title').value.trim();
  const content = getContent();
  let slug = $('#slug').value.trim() || slugify(title);
  $('#slug').value = slug;

  const tags = uniqueTags(state.selectedTags.length ? state.selectedTags : toCommaList($('#tags').value));
  const author = $('#author').value.trim() || (getUser() && getUser().name) || CONFIG.site.author || '';
  const cover = $('#cover').value.trim();
  const draft = $('#draftToggle').checked;
  const pinned = $('#pinnedToggle').checked;
  const carousel = $('#carouselToggle').checked;
  const summary = state.data.summary || extractSummary(content, 80);
  const series = normalizeSeriesName(state.selectedSeries || ($('#seriesInput') && $('#seriesInput').value));
  const seriesOrderRaw = ($('#seriesOrder') && $('#seriesOrder').value.trim()) || state.seriesOrder || '';
  if (carousel && !cover) {
    if (!confirm('当前文章没有封面图，无法进入首页轮播。\n\n继续发布会取消「轮播」勾选。是否继续？')) return;
  }

  // 拉一次最新索引用于查重
  let curIndex = null;
  try { curIndex = await readIndex(); } catch {}
  const allPosts = (curIndex && curIndex.data && curIndex.data.posts) || [];
  const isUpdate = !!state.loadedSlug;
  const errs = validateBeforePublish({ title, slug, content, tags, summary, allPosts, isUpdate });
  // 仅 "不能为空" 与 slug 冲突 阻止发布；建议级别的可忽略
  const blockers = errs.filter(e => e.endsWith('不能为空') || e.startsWith('slug 已存在'));
  const warnings = errs.filter(e => !blockers.includes(e));
  if (blockers.length) {
    alert('无法发布：\n\n' + blockers.join('\n'));
    return;
  }
  if (warnings.length) {
    if (!confirm('注意：\n\n' + warnings.join('\n') + '\n\n仍要发布吗？')) return;
  }

  const now = new Date().toISOString();
  const data = {
    title,
    date: state.data.date || now,
    updated: now,
    author,
    tags,
  };
  if (cover) data.cover = cover;
  if (summary) data.summary = summary;
  if (draft) data.draft = true;
  if (pinned) data.pinned = true;
  if (carousel && cover) data.carousel = true;
  if (series) {
    data.series = series;
    if (seriesOrderRaw !== '') {
      const n = Number(seriesOrderRaw);
      if (!Number.isNaN(n) && n > 0) data.seriesOrder = n;
    }
  }
  const counter = state.counter || {};
  if (counter.img || counter.dashboard) {
    data.counter = {
      img: counter.img || '',
      dashboard: counter.dashboard || '',
    };
  }

  const md = stringifyFrontmatter(data, content);
  const path = `${CONFIG.paths.posts}/${slug}.md`;
  const isRename = state.loadedSlug && state.loadedSlug !== slug;

  setStatus('发布中…', 'saving');
  $('#btnPublish').disabled = true;

  try {
    let sha = state.loadedSha;
    if (isRename) sha = null;
    let writeRes;
    try {
      writeRes = await writeFile(path, md, `post: ${state.loadedSha ? '更新' : '新增'} ${title}`, sha);
    } catch (e) {
      if (!sha && e.status === 422) {
        const altSlug = `${slug}-${Date.now().toString(36)}`;
        const altPath = `${CONFIG.paths.posts}/${altSlug}.md`;
        writeRes = await writeFile(altPath, md, `post: 新增 ${title}`);
        slug = altSlug;
        $('#slug').value = altSlug;
      } else if (e.status === 409) {
        // 远端 SHA 冲突
        if (confirm('文章已被外部修改。\n\n点确定重新加载远端版本（你将丢失本次修改）。')) {
          await loadPost(state.loadedSlug);
        }
        $('#btnPublish').disabled = false;
        setStatus('已取消（版本冲突）', 'error');
        return;
      } else {
        throw e;
      }
    }
    state.loadedSha = writeRes && writeRes.content && writeRes.content.sha;
    state.loadedPath = `${CONFIG.paths.posts}/${slug}.md`;

    if (isRename) {
      try {
        const oldPath = `${CONFIG.paths.posts}/${state.loadedSlug}.md`;
        const oldFile = await readFile(oldPath);
        if (oldFile) {
          await deleteFile(oldPath, oldFile.sha, `post: 重命名 ${state.loadedSlug} -> ${slug}`);
        }
      } catch (e) {
        console.warn('删除旧文件失败', e);
      }
    }

    await updateIndex({
      slug,
      title,
      date: data.date,
      updated: data.updated,
      author,
      summary,
      tags,
      cover: cover || undefined,
      draft,
      pinned,
      carousel: carousel && !!cover,
      series: data.series,
      seriesOrder: data.seriesOrder,
      counter: data.counter,
      path: state.loadedPath,
      removeSlug: isRename ? state.loadedSlug : null,
    });

    state.loadedSlug = slug;
    state.data = data;
    setStatus(draft ? '已保存为草稿' : '已发布', 'saved');
    showToast(draft ? '草稿已保存' : '发布成功，几十秒后线上生效');
    loadDocList();
    renderSummaryPreview();

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('slug', slug);
    window.history.replaceState(null, '', newUrl.toString());
    $('#btnDelete').style.display = '';
  } catch (e) {
    console.error(e);
    if (e.status === 401) { logout(window.location.href); return; }
    if (e.status === 404 || e.status === 403) {
      setStatus('发布失败：权限不足', 'error');
      alert('发布失败\n\n' + (e.message || '权限不足'));
    } else {
      setStatus('发布失败：' + e.message, 'error');
      showToast('发布失败：' + e.message, 'error');
    }
  } finally {
    $('#btnPublish').disabled = false;
  }
}

async function updateIndex({ slug, title, date, updated, author, summary, tags, cover, draft, pinned, carousel, series, seriesOrder, counter, path, removeSlug }) {
  const idx = await readIndex();
  const data = idx ? idx.data : { posts: [] };
  if (!Array.isArray(data.posts)) data.posts = [];

  if (removeSlug) {
    data.posts = data.posts.filter(p => p.slug !== removeSlug);
  }

  const existing = data.posts.findIndex(p => p.slug === slug);
  const entry = { slug, title, date, updated, author, summary, tags, path };
  if (cover) entry.cover = cover;
  if (draft) entry.draft = true;
  if (pinned) entry.pinned = true;
  if (carousel && cover) entry.carousel = true;
  if (series) entry.series = series;
  if (seriesOrder != null && !Number.isNaN(Number(seriesOrder))) entry.seriesOrder = Number(seriesOrder);
  if (counter && (counter.img || counter.dashboard)) {
    entry.counter = {
      img: String(counter.img || ''),
      dashboard: String(counter.dashboard || ''),
    };
  }
  if (pinned && existing >= 0 && data.posts[existing].pinnedOrder) entry.pinnedOrder = data.posts[existing].pinnedOrder;

  if (existing >= 0) data.posts[existing] = entry;
  else data.posts.unshift(entry);

  data.posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  await writeIndex(data, `index: 更新 ${slug}`, idx && idx.sha);
}

async function deletePost() {
  if (!gateAuth()) return;
  if (!state.loadedSlug) return;
  if (!confirm(`确定删除「${$('#title').value || state.loadedSlug}」吗？`)) return;
  setStatus('删除中…', 'saving');
  $('#btnDelete').disabled = true;
  try {
    const path = state.loadedPath || `${CONFIG.paths.posts}/${state.loadedSlug}.md`;
    const file = await readFile(path);
    if (file) {
      await deleteFile(path, file.sha, `post: 删除 ${state.loadedSlug}`);
    }
    const idx = await readIndex();
    const data = idx ? idx.data : { posts: [] };
    data.posts = (data.posts || []).filter(p => p.slug !== state.loadedSlug);
    await writeIndex(data, `index: 移除 ${state.loadedSlug}`, idx && idx.sha);
    showToast('已删除');
    setTimeout(() => { window.location.href = './'; }, 600);
  } catch (e) {
    console.error(e);
    setStatus('删除失败：' + e.message, 'error');
    $('#btnDelete').disabled = false;
  }
}

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function uploadResultMessage(result, fileName) {
  if (!result.optimized || result.finalSize >= result.originalSize) {
    return `已上传 ${fileName}`;
  }
  const saved = Math.max(0, 100 - Math.round((result.finalSize / result.originalSize) * 100));
  return `已上传 ${fileName}（${formatBytes(result.originalSize)} → ${formatBytes(result.finalSize)}，省 ${saved}%）`;
}

// ---------- 图片上传：拖拽 + 粘贴 ----------
async function handleImageFiles(files) {
  if (!gateAuth()) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    setStatus(`上传 ${file.name}…`, 'saving');
    try {
      const result = await uploadImage(file, file.name);
      const url = '../' + result.path;
      const md = `\n![${file.name}](${url})\n`;
      insertAtCursor(md);
      const msg = uploadResultMessage(result, file.name);
      setStatus(msg, 'saved');
      showToast(msg);
    } catch (e) {
      console.error(e);
      setStatus('上传失败：' + e.message, 'error');
      showToast('上传失败：' + e.message, 'error');
    }
  }
}

function insertAtCursor(text) {
  if (state.editorMode === 'rich' && state.vditor && state.vditorReady) {
    state.vditor.insertValue(text);
    state.vditor.focus();
  } else if (state.mde) {
    const cm = state.mde.codemirror;
    const doc = cm.getDoc();
    const pos = doc.getCursor();
    doc.replaceRange(text, pos);
    cm.focus();
  } else {
    const ta = $('#content');
    const start = ta.selectionStart || 0;
    const end = ta.selectionEnd || 0;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + text.length;
    ta.focus();
  }
  updatePreview();
}

function setupDragAndPaste() {
  const pane = document.querySelector('.studio-source-body') || document.querySelector('.editor-pane');
  const hint = $('#dropHint');
  if (!pane) return;

  ['dragenter', 'dragover'].forEach(ev =>
    pane.addEventListener(ev, e => {
      if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
        hint.hidden = false;
      }
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
    pane.addEventListener(ev, e => {
      hint.hidden = true;
    })
  );
  pane.addEventListener('drop', async e => {
    e.preventDefault();
    // 富文本模式：让 Vditor 自己处理 drop（它的 upload.handler 会走 GitHub 上传）
    if (state.editorMode === 'rich') return;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      await handleImageFiles([...e.dataTransfer.files]);
    }
  });

  document.addEventListener('paste', async e => {
    if (!e.clipboardData) return;
    // 富文本模式让 Vditor 自己接管粘贴（它的 upload.handler 会走我们的 uploadImage），
    // 不要在 document 层重复处理，否则同一张图会被上传两次
    if (state.editorMode === 'rich') return;
    const files = [...e.clipboardData.items]
      .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      await handleImageFiles(files);
    }
  });
}

// ---------- 富文本（WYSIWYG）模式：Vditor 懒加载 + 初始化 + 模式切换 ----------
const VDITOR_VERSION = '3.10.6';
const VDITOR_CDN_BASE = `https://cdn.jsdelivr.net/npm/vditor@${VDITOR_VERSION}`;

let vditorAssetPromise = null;
function loadVditorAssets() {
  if (vditorAssetPromise) return vditorAssetPromise;
  vditorAssetPromise = new Promise((resolve, reject) => {
    if (typeof window.Vditor !== 'undefined') {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${VDITOR_CDN_BASE}/dist/index.css`;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = `${VDITOR_CDN_BASE}/dist/index.min.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('富文本编辑器（Vditor）加载失败，请检查网络'));
    document.head.appendChild(script);
  });
  return vditorAssetPromise;
}

function currentDarkMode() {
  return document.documentElement.getAttribute('data-mode') === 'dark';
}

async function setupVditor(initialMd) {
  await loadVditorAssets();
  const host = $('#vditorHost');
  if (!host) return;
  host.hidden = false;

  return new Promise(resolve => {
    state.vditor = new window.Vditor('vditorHost', {
      mode: 'wysiwyg',  // 默认所见即所得；用户可以用工具栏切到 ir / sv
      height: '100%',
      width: '100%',
      theme: currentDarkMode() ? 'dark' : 'classic',
      preview: { theme: { current: currentDarkMode() ? 'dark' : 'light' } },
      cdn: VDITOR_CDN_BASE,
      cache: { enable: false },
      placeholder: '所见即所得：直接输入文字 / 粘贴图片，无需懂 Markdown',
      toolbar: [
        'emoji', 'headings', 'bold', 'italic', 'strike', 'link', '|',
        'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
        'quote', 'line', 'code', 'inline-code', 'insert-before', 'insert-after', '|',
        'upload', 'table', '|',
        'undo', 'redo', '|',
        'edit-mode', 'preview', 'fullscreen', '|',
        { name: 'help', tipPosition: 'nw' },
      ],
      toolbarConfig: { pin: true },
      counter: { enable: false },
      hint: { emoji: {} },
      upload: {
        accept: 'image/*',
        multiple: true,
        // 自定义上传：拦截 Vditor 自带 multipart 上传，走我们既有的 uploadImage（写入 GitHub）
        // 返回 null = 我们自己负责把图片插到编辑器里，Vditor 不要再做任何事
        handler: async (files) => {
          if (!gateAuth()) return '未授权';
          for (const file of files) {
            try {
              setStatus(`上传 ${file.name}…`, 'saving');
              const result = await uploadImage(file, file.name);
              const url = '../' + result.path;
              state.vditor.insertValue(`![${file.name}](${url})\n`);
              const msg = uploadResultMessage(result, file.name);
              setStatus(msg, 'saved');
              showToast(msg);
            } catch (e) {
              console.error(e);
              setStatus('上传失败：' + e.message, 'error');
              showToast('上传失败：' + e.message, 'error');
            }
          }
          return null;
        },
      },
      input: () => updatePreview(),
      after: () => {
        state.vditorReady = true;
        const v = state.vditorPendingValue || initialMd || '';
        if (v) state.vditor.setValue(v);
        state.vditorPendingValue = '';
        refreshEditorLayout();
        resolve();
      },
    });
  });
}

async function switchEditorMode(target) {
  if (!target || target === state.editorMode) return;
  const buttons = document.querySelectorAll('.editor-mode-btn');

  if (target === 'rich') {
    // 1. 把当前 Markdown 内容暂存
    const md = state.mde ? state.mde.value() : ($('#content').value || '');

    // 2. 第一次切：懒加载 Vditor 资源 + 初始化
    const targetBtn = document.querySelector('.editor-mode-btn[data-mode="rich"]');
    if (!state.vditor) {
      try {
        targetBtn && targetBtn.classList.add('is-loading');
        targetBtn && (targetBtn.textContent = '加载中…');
        setStatus('加载富文本编辑器…', 'saving');
        await setupVditor(md);
        setStatus('已切换到富文本', 'saved');
      } catch (e) {
        console.error(e);
        showToast(e.message || '富文本加载失败', 'error');
        setStatus('富文本加载失败', 'error');
        targetBtn && targetBtn.classList.remove('is-loading');
        targetBtn && (targetBtn.textContent = '富文本');
        return;
      }
      targetBtn && targetBtn.classList.remove('is-loading');
      targetBtn && (targetBtn.textContent = '富文本');
    } else {
      // 已经初始化过：把最新 Markdown 同步过去
      if (state.vditorReady) state.vditor.setValue(md);
      else state.vditorPendingValue = md;
      $('#vditorHost').hidden = false;
    }

    state.editorMode = 'rich';
    const sourcePanel = document.querySelector('.studio-panel-source') || document.querySelector('.editor-pane');
    if (sourcePanel) sourcePanel.classList.add('is-rich');
    refreshEditorLayout();
  } else {
    // 富文本 → Markdown：取 Vditor markdown 灌回 EasyMDE
    if (state.vditor && state.vditorReady) {
      const md = state.vditor.getValue() || '';
      if (state.mde) state.mde.value(md);
      else $('#content').value = md;
    }
    $('#vditorHost').hidden = true;
    state.editorMode = 'markdown';
    const sourcePanel = document.querySelector('.studio-panel-source') || document.querySelector('.editor-pane');
    if (sourcePanel) sourcePanel.classList.remove('is-rich');
    setStatus('已切换到 Markdown', 'saved');
    if (state.mde && state.mde.codemirror) state.mde.codemirror.refresh();
    refreshEditorLayout();
  }

  buttons.forEach(b => {
    const active = b.dataset.mode === state.editorMode;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  updatePreview();
}

function bindEditorModeSwitch() {
  document.querySelectorAll('.editor-mode-btn').forEach(b => {
    b.addEventListener('click', () => switchEditorMode(b.dataset.mode));
  });
  // 跟随主题切换：富文本编辑器在 dark/light 之间换皮
  const obs = new MutationObserver(() => {
    if (!state.vditor || !state.vditorReady) return;
    try {
      const dark = currentDarkMode();
      state.vditor.setTheme(
        dark ? 'dark' : 'classic',
        dark ? 'dark' : 'light',
        dark ? 'native' : 'github'
      );
    } catch (_) { /* Vditor 老版本无 setTheme，忽略 */ }
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** 根据左侧编辑区剩余高度，重算 CodeMirror / Vditor 尺寸，修复无法内部滚动的问题 */
function refreshEditorLayout() {
  if (state.editorMode === 'markdown' && state.mde && state.mde.codemirror) {
    const container = document.querySelector('.EasyMDEContainer');
    const cm = state.mde.codemirror;
    if (container && cm) {
      const toolbar = container.querySelector('.editor-toolbar');
      const styles = getComputedStyle(container);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const toolH = toolbar ? toolbar.offsetHeight + 8 : 0;
      const available = container.clientHeight - toolH - padY;
      if (available > 80) {
        cm.setSize(null, available);
      }
      cm.refresh();
    }
  }
  if (state.editorMode === 'rich' && state.vditor && state.vditorReady) {
    try { state.vditor.resize(); } catch (_) { /* ignore */ }
  }
}

let editorLayoutObserver = null;
function bindEditorLayoutRefresh() {
  const pane = document.querySelector('.studio-source-body')
    || document.querySelector('.studio-panel-source')
    || document.querySelector('.editor-pane');
  const run = () => requestAnimationFrame(refreshEditorLayout);

  window.addEventListener('resize', debounce(run, 120));

  if (typeof ResizeObserver !== 'undefined') {
    editorLayoutObserver = new ResizeObserver(debounce(run, 80));
    if (pane) editorLayoutObserver.observe(pane);
    const meta = $('#editorMeta');
    if (meta) editorLayoutObserver.observe(meta);
    const body = document.querySelector('.studio-workspace') || document.querySelector('.editor-body');
    if (body) editorLayoutObserver.observe(body);
    const mdeContainer = document.querySelector('.EasyMDEContainer');
    if (mdeContainer) editorLayoutObserver.observe(mdeContainer);
    const main = document.querySelector('.studio-main');
    if (main) editorLayoutObserver.observe(main);
  }

  run();
  setTimeout(run, 200);
  setTimeout(run, 800);
}

function bindMetaCollapse() {
  const meta = $('#editorMeta');
  const btn = $('#metaCollapseBtn');
  if (!meta || !btn) return;

  const key = 'editor_meta_collapsed';
  const collapsed = localStorage.getItem(key) === '1';
  meta.classList.toggle('is-collapsed', collapsed);
  btn.textContent = collapsed ? '展开' : '收起';
  btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

  btn.addEventListener('click', () => {
    const next = !meta.classList.contains('is-collapsed');
    meta.classList.toggle('is-collapsed', next);
    btn.textContent = next ? '展开' : '收起';
    btn.setAttribute('aria-expanded', next ? 'false' : 'true');
    localStorage.setItem(key, next ? '1' : '0');
    refreshEditorLayout();
  });
}

function bindStudioChrome() {
  const shell = $('#studioShell');
  const workspace = $('#studioWorkspace');
  const splitter = $('#studioSplitter');
  const navBtn = $('#navCollapseBtn');
  const outlineBtn = $('#outlineCollapseBtn');
  const mobileNavBtn = $('#btnToggleNav');
  const mobileOutlineBtn = $('#btnToggleOutline');
  const docSearch = $('#docSearch');
  const footAddTag = $('#footAddTag');
  const btnGenSummary = $('#btnGenSummary');

  if (navBtn && shell) {
    navBtn.addEventListener('click', () => {
      shell.classList.toggle('is-nav-collapsed');
      localStorage.setItem('studio_nav_collapsed', shell.classList.contains('is-nav-collapsed') ? '1' : '0');
      refreshEditorLayout();
    });
    if (localStorage.getItem('studio_nav_collapsed') === '1') shell.classList.add('is-nav-collapsed');
  }

  if (outlineBtn && shell) {
    outlineBtn.addEventListener('click', () => {
      shell.classList.toggle('is-outline-collapsed');
      localStorage.setItem('studio_outline_collapsed', shell.classList.contains('is-outline-collapsed') ? '1' : '0');
      refreshEditorLayout();
    });
    if (localStorage.getItem('studio_outline_collapsed') === '1') shell.classList.add('is-outline-collapsed');
  }

  if (mobileNavBtn && shell) {
    mobileNavBtn.addEventListener('click', () => {
      shell.classList.toggle('is-mobile-nav-open');
      shell.classList.remove('is-mobile-outline-open');
    });
  }
  if (mobileOutlineBtn && shell) {
    mobileOutlineBtn.addEventListener('click', () => {
      shell.classList.toggle('is-mobile-outline-open');
      shell.classList.remove('is-mobile-nav-open');
    });
  }

  if (docSearch) {
    docSearch.addEventListener('input', () => {
      state.docSearch = docSearch.value;
      renderDocList(state.docSearch);
    });
  }

  if (footAddTag) {
    footAddTag.addEventListener('click', () => {
      const meta = $('#editorMeta');
      if (meta) meta.classList.remove('is-collapsed');
      const nav = $('#studioNav');
      if (nav) nav.scrollTop = nav.scrollHeight;
      $('#tagInput')?.focus();
      if (window.matchMedia('(max-width: 960px)').matches && shell) {
        shell.classList.add('is-mobile-nav-open');
      }
    });
  }

  const footAddSeries = $('#footAddSeries');
  if (footAddSeries) {
    footAddSeries.addEventListener('click', focusSeriesPanel);
  }

  if (btnGenSummary) {
    btnGenSummary.addEventListener('click', () => {
      const content = getContent();
      if (!content.trim()) {
        showToast('正文为空，无法生成摘要', 'error');
        return;
      }
      state.data.summary = extractSummary(content, 120);
      renderSummaryPreview();
      showToast('摘要已生成');
    });
  }

  if (splitter && workspace) {
    let dragging = false;
    const onMove = e => {
      if (!dragging) return;
      const rect = workspace.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(78, Math.max(22, pct));
      workspace.style.gridTemplateColumns = `minmax(0, ${clamped}fr) var(--studio-splitter) minmax(0, ${100 - clamped}fr)`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      splitter.classList.remove('is-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      refreshEditorLayout();
    };
    splitter.addEventListener('mousedown', e => {
      dragging = true;
      splitter.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  bindSyncScroll();
}

function bindSyncScroll() {
  const previewPane = $('#previewPane');
  if (!previewPane) return;

  const getCmScroller = () => {
    if (!state.mde || !state.mde.codemirror) return null;
    return state.mde.codemirror.getScrollerElement();
  };

  previewPane.addEventListener('scroll', () => {
    if (state.syncScrollLock || state.editorMode !== 'markdown') return;
    const scroller = getCmScroller();
    if (!scroller) return;
    const maxP = previewPane.scrollHeight - previewPane.clientHeight;
    const maxC = scroller.scrollHeight - scroller.clientHeight;
    if (maxP <= 0 || maxC <= 0) return;
    state.syncScrollLock = true;
    scroller.scrollTop = (previewPane.scrollTop / maxP) * maxC;
    requestAnimationFrame(() => { state.syncScrollLock = false; });
  });

  const bindCm = () => {
    if (!state.mde || !state.mde.codemirror) return;
    const scroller = getCmScroller();
    if (!scroller || scroller.dataset.syncBound) return;
    scroller.dataset.syncBound = '1';
    scroller.addEventListener('scroll', () => {
      if (state.syncScrollLock || state.editorMode !== 'markdown') return;
      const maxC = scroller.scrollHeight - scroller.clientHeight;
      const maxP = previewPane.scrollHeight - previewPane.clientHeight;
      if (maxC <= 0 || maxP <= 0) return;
      state.syncScrollLock = true;
      previewPane.scrollTop = (scroller.scrollTop / maxC) * maxP;
      requestAnimationFrame(() => { state.syncScrollLock = false; });
    });
  };

  bindCm();
  setTimeout(bindCm, 500);
}

function setupEasyMDE() {
  if (typeof EasyMDE === 'undefined') {
    // 没加载到 EasyMDE 就回退到 textarea
    return;
  }
  state.mde = new EasyMDE({
    element: $('#content'),
    autoDownloadFontAwesome: true,
    spellChecker: false,
    status: false,
    placeholder: '开始用 Markdown 写作。支持拖拽 / 粘贴上传图片',
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'table', 'code', '|',
      {
        name: 'upload',
        action: () => {
          const inp = document.createElement('input');
          inp.type = 'file';
          inp.accept = 'image/*';
          inp.multiple = true;
          inp.onchange = () => handleImageFiles([...inp.files]);
          inp.click();
        },
        className: 'fa fa-upload',
        title: '上传图片',
      },
      'horizontal-rule', '|',
      'guide',
    ],
  });
  state.mde.codemirror.on('change', () => {
    // 富文本模式下 EasyMDE 是被动同步 buffer，不要回头触发预览（以富文本 input 为准）
    if (state.editorMode === 'markdown') updatePreview();
  });
  refreshEditorLayout();
}

(async function init() {
  initTheme();
  bindThemeToggle();

  if (!getToken()) {
    if (confirm('需要登录后台才能编辑。点击确定前往登录页。')) goLogin();
    else window.location.href = './';
    return;
  }
  if (!isAuthorized()) {
    alert('当前账号不在白名单内，无法编辑');
    window.location.href = './';
    return;
  }

  setStatus('已就绪', 'saved');
  $('#author').value = (getUser() && getUser().name) || CONFIG.site.author || '';

  setupEasyMDE();
  bindEditorLayoutRefresh();
  bindMetaCollapse();
  bindStudioChrome();
  bindEditorModeSwitch();
  setupDragAndPaste();
  bindTagPicker();
  bindSeriesPicker();
  bindCounterPanel();
  renderEditorCounter();
  loadAvailableTags();
  loadAvailableSeries();
  loadDocList();

  ['title'].forEach(id => {
    $('#' + id).addEventListener('input', updatePreview);
  });

  $('#title').addEventListener('blur', () => {
    const slugInput = $('#slug');
    if (!slugInput.value && $('#title').value) {
      slugInput.value = slugify($('#title').value);
    }
  });

  $('#btnPublish').addEventListener('click', publish);
  $('#btnDelete').addEventListener('click', deletePost);
  $('#btnPreview').addEventListener('click', () => {
    const shell = $('#studioShell');
    if (shell) {
      if (shell.classList.contains('is-preview-only')) {
        shell.classList.remove('is-preview-only');
        shell.classList.add('is-edit-only');
      } else if (shell.classList.contains('is-edit-only')) {
        shell.classList.remove('is-edit-only');
      } else {
        shell.classList.add('is-preview-only');
      }
      refreshEditorLayout();
      return;
    }
    document.querySelectorAll('.editor-pane').forEach(el => el.classList.toggle('preview-mode'));
  });

  // 自动草稿到 localStorage
  const draftKey = 'editor_draft_' + (initialSlug || 'new');
  const saved = localStorage.getItem(draftKey);
  if (!initialSlug && saved) {
    try {
      const d = JSON.parse(saved);
      if ((d.title || d.content) && confirm('检测到本地未发布的草稿，是否恢复？')) {
        $('#title').value = d.title || '';
        setContent(d.content || '');
        setEditorTags(toCommaList(d.tags || ''));
        setEditorSeries(d.series || '', d.seriesOrder);
        $('#cover').value = d.cover || '';
        $('#slug').value = d.slug || '';
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {}
  }
  setInterval(() => {
    if (state.loading) return;
    localStorage.setItem(draftKey, JSON.stringify({
      title: $('#title').value,
      content: getContent(),
      tags: $('#tags').value,
      series: state.selectedSeries,
      seriesOrder: ($('#seriesOrder') && $('#seriesOrder').value) || state.seriesOrder,
      cover: $('#cover').value,
      slug: $('#slug').value,
      savedAt: new Date().toISOString(),
    }));
    setStatus('本地草稿已自动保存 ' + new Date().toLocaleTimeString(), 'saved');
  }, 4000);

  // Ctrl+S / Cmd+S 触发发布
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      publish();
    }
  });

  if (initialSlug) {
    await loadPost(initialSlug);
  } else {
    updatePreview();
  }
})();
