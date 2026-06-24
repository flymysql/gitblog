import { initToolPage, mountToolComments, $, escapeHtml, copyText } from './tool-kit-common.js';
import { INTEREST_OPTIONS, SKILL_DIMS, DISCIPLINE_META, SUBJECTS, getMajorById, majorReferenceLinks, describeMajorTraits } from './tool-major-data.js';
import { scoreMajors, formatResultText } from './tool-major-engine.js';
import { drawMajorResultShareImage, drawMajorDetailShareImage, showShareImagePreview, toolPageUrl } from './tool-share-image.js';

const COMMENTS_HINT = '你测出来适合什么专业？来聊聊你的志愿想法～';

initToolPage({
  title: '大学专业倾向测评',
  description: '通过兴趣、能力与发展规划问卷，推荐适合你的本科专业方向。仅供参考，不构成正式志愿填报建议。',
  path: 'tools/tool-major.html',
  commentsHint: COMMENTS_HINT,
  deferComments: true,
});

const STORAGE_KEY = 'gitblog-major-quiz-v1';
const RESULT_KEY = 'gitblog-major-last-result';
const TOTAL_STEPS = 5;

const state = {
  step: 1,
  examMode: '312',
  firstChoice: '',
  track: '',
  subjects: [],
  interests: [],
  skills: Object.fromEntries(SKILL_DIMS.map(s => [s.id, 3])),
  gradIntent: '',
  abroadIntent: '',
  workPref: '',
  acceptPressure: '',
  moneySlider: 50,
  valuePref: '',
  familyEcon: '',
  parentPref: '',
};

let view = 'quiz';
let lastPayload = null;
let detailMajorId = '';
let commentsMounted = false;

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    Object.assign(state, JSON.parse(raw));
  } catch { /* ignore */ }
}

function saveState() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function loadLastResult() {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastResult(payload) {
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

function getAnswers() {
  return { ...state };
}

function majorDetailUrl(id) {
  return toolPageUrl('tools/tool-major.html', `major=${encodeURIComponent(id)}`);
}

function syncChrome() {
  const hero = document.querySelector('.tool-kit-hero');
  if (hero) {
    hero.hidden = !(view === 'quiz' && state.step === 1);
  }
}

function setView(next) {
  view = next;
  $('majorQuiz').hidden = view !== 'quiz';
  $('majorResult').hidden = view !== 'result';
  $('majorDetail').hidden = view !== 'detail';
  syncChrome();
}

function ensureResultComments() {
  if (commentsMounted || view !== 'result') return;
  mountToolComments('tool-major', COMMENTS_HINT, 'majorGiscus');
  commentsMounted = true;
}

function renderProgress() {
  const el = $('majorProgress');
  if (!el) return;
  el.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) => {
    const n = i + 1;
    const cls = n < state.step ? 'is-done' : n === state.step ? 'is-active' : '';
    return `<span class="major-quiz-progress-dot ${cls}" aria-hidden="true"></span>`;
  }).join('');
  $('majorStepLabel').textContent = `第 ${state.step} / ${TOTAL_STEPS} 步`;
}

function chipGroup(name, options, { multi = false, max = 99 } = {}) {
  const selected = multi ? state[name] : [state[name]];
  return `<div class="major-quiz-chips" data-field="${name}" data-multi="${multi ? '1' : '0'}" data-max="${max}">
    ${options.map(o => {
      const id = typeof o === 'string' ? o : o.id;
      const label = typeof o === 'string' ? o : o.label;
      const on = selected.includes(id);
      return `<button type="button" class="major-quiz-chip${on ? ' is-on' : ''}" data-value="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
    }).join('')}
  </div>`;
}

function skillSliders() {
  return SKILL_DIMS.map(s => `
    <label class="major-quiz-skill">
      <span class="major-quiz-skill-head">
        <span>${escapeHtml(s.label)}</span>
        <span class="major-quiz-skill-val" data-skill-val="${s.id}">${state.skills[s.id]}</span>
      </span>
      <input type="range" min="1" max="5" step="1" value="${state.skills[s.id]}" data-skill="${s.id}">
      <span class="major-quiz-skill-hint"><em>弱</em><em>强</em></span>
    </label>
  `).join('');
}

function renderStep() {
  const host = $('majorQuizSteps');
  const panels = {
    1: `
      <h2 class="major-quiz-step-title">选科与基础</h2>
      <p class="major-quiz-step-desc">先确认你的高考模式与选科，我们会过滤掉不符合要求的专业。</p>
      <div class="major-quiz-field">
        <span class="major-quiz-label">高考模式</span>
        ${chipGroup('examMode', [
          { id: '312', label: '3+1+2' },
          { id: '33', label: '3+3' },
          { id: 'wenli', label: '传统文理分科' },
        ])}
      </div>
      ${state.examMode === 'wenli' ? `
      <div class="major-quiz-field">
        <span class="major-quiz-label">科类</span>
        ${chipGroup('track', [{ id: 'science', label: '理科' }, { id: 'arts', label: '文科' }])}
      </div>` : `
      <div class="major-quiz-field">
        <span class="major-quiz-label">首选科目</span>
        ${chipGroup('firstChoice', [{ id: 'physics', label: '物理' }, { id: 'history', label: '历史' }])}
      </div>
      <div class="major-quiz-field">
        <span class="major-quiz-label">再选科目（多选）</span>
        ${chipGroup('subjects', SUBJECTS.filter(s => !['physics', 'history'].includes(s.id)), { multi: true, max: state.examMode === '33' ? 3 : 2 })}
      </div>`}
    `,
    2: `
      <h2 class="major-quiz-step-title">兴趣领域</h2>
      <p class="major-quiz-step-desc">选择你最感兴趣的领域，最多选 5 项。</p>
      <div class="major-quiz-field">
        ${chipGroup('interests', INTEREST_OPTIONS, { multi: true, max: 5 })}
      </div>
    `,
    3: `
      <h2 class="major-quiz-step-title">能力与日常技能</h2>
      <p class="major-quiz-step-desc">诚实评估即可，没有标准答案。</p>
      <div class="major-quiz-skills">${skillSliders()}</div>
    `,
    4: `
      <h2 class="major-quiz-step-title">发展规划</h2>
      <p class="major-quiz-step-desc">你对大学四年后的大致方向。</p>
      <div class="major-quiz-field">
        <span class="major-quiz-label">读研深造意向</span>
        ${chipGroup('gradIntent', [
          { id: 'strong', label: '很强烈' },
          { id: 'normal', label: '有考虑' },
          { id: 'unsure', label: '不确定' },
          { id: 'job', label: '倾向就业' },
        ])}
      </div>
      <div class="major-quiz-field">
        <span class="major-quiz-label">留学意向</span>
        ${chipGroup('abroadIntent', [
          { id: 'yes', label: '有' },
          { id: 'maybe', label: '可能' },
          { id: 'no', label: '无' },
        ])}
      </div>
      <div class="major-quiz-field">
        <span class="major-quiz-label">工作偏好</span>
        ${chipGroup('workPref', [
          { id: 'stable', label: '稳定体制内' },
          { id: 'money', label: '市场化高薪' },
          { id: 'free', label: '创业自由' },
          { id: 'unsure', label: '不确定' },
        ])}
      </div>
      <div class="major-quiz-field">
        <span class="major-quiz-label">能否接受高强度工作</span>
        ${chipGroup('acceptPressure', [
          { id: 'yes', label: '可以' },
          { id: 'neutral', label: '看情况' },
          { id: 'no', label: '更希望平衡' },
        ])}
      </div>
    `,
    5: `
      <h2 class="major-quiz-step-title">价值观与家庭</h2>
      <p class="major-quiz-step-desc">最后一步，帮助平衡兴趣与现实。</p>
      <div class="major-quiz-field">
        <span class="major-quiz-label">金钱 vs 兴趣</span>
        <div class="major-quiz-slider-row">
          <span>兴趣优先</span>
          <input type="range" id="majorMoneySlider" min="0" max="100" step="5" value="${state.moneySlider}">
          <span>收入优先</span>
        </div>
        <p class="major-quiz-slider-readout" id="majorMoneyReadout">${moneyReadout(state.moneySlider)}</p>
      </div>
      <div class="major-quiz-field">
        <span class="major-quiz-label">你最看重</span>
        ${chipGroup('valuePref', [
          { id: 'achievement', label: '成就感' },
          { id: 'income', label: '收入' },
          { id: 'recognition', label: '社会认可' },
          { id: 'balance', label: '生活平衡' },
        ])}
      </div>
      <div class="major-quiz-field">
        <span class="major-quiz-label">家庭经济条件</span>
        ${chipGroup('familyEcon', [
          { id: 'early_job', label: '希望早就业' },
          { id: 'normal', label: '一般' },
          { id: 'support_grad', label: '可支持深造' },
        ])}
      </div>
      <div class="major-quiz-field">
        <span class="major-quiz-label">父母专业期待（可选）</span>
        ${chipGroup('parentPref', [
          { id: 'none', label: '尊重我自己' },
          { id: 'engineering', label: '工科' },
          { id: 'medical', label: '医学' },
          { id: 'teacher', label: '师范' },
          { id: 'business', label: '商科' },
        ])}
      </div>
    `,
  };

  host.innerHTML = `<div class="major-quiz-step-panel">${panels[state.step] || ''}</div>`;
  bindStepEvents();
  renderProgress();
  $('majorPrev').hidden = state.step <= 1;
  $('majorNext').textContent = state.step >= TOTAL_STEPS ? '查看推荐' : '下一步';
  syncChrome();
}

function moneyReadout(v) {
  const n = Number(v);
  if (n <= 30) return '更愿意追随内心兴趣';
  if (n >= 70) return '较看重薪资与回报';
  return '兴趣与收入都想兼顾';
}

function bindStepEvents() {
  document.querySelectorAll('.major-quiz-chips').forEach(group => {
    const field = group.dataset.field;
    const multi = group.dataset.multi === '1';
    const max = Number(group.dataset.max) || 99;
    group.querySelectorAll('.major-quiz-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        if (multi) {
          const arr = [...(state[field] || [])];
          const idx = arr.indexOf(val);
          if (idx >= 0) arr.splice(idx, 1);
          else if (arr.length < max) arr.push(val);
          state[field] = arr;
        } else {
          state[field] = state[field] === val ? '' : val;
        }
        saveState();
        renderStep();
      });
    });
  });

  document.querySelectorAll('[data-skill]').forEach(input => {
    input.addEventListener('input', () => {
      const id = input.dataset.skill;
      state.skills[id] = Number(input.value);
      const valEl = document.querySelector(`[data-skill-val="${id}"]`);
      if (valEl) valEl.textContent = input.value;
      saveState();
    });
  });

  const money = $('majorMoneySlider');
  if (money) {
    money.addEventListener('input', () => {
      state.moneySlider = Number(money.value);
      $('majorMoneyReadout').textContent = moneyReadout(state.moneySlider);
      saveState();
    });
  }
}

function validateStep() {
  const err = $('majorQuizError');
  err.hidden = true;
  err.textContent = '';

  if (state.step === 1) {
    if (state.examMode === 'wenli') {
      if (!state.track) { err.textContent = '请选择文理科'; err.hidden = false; return false; }
    } else if (!state.firstChoice) {
      err.textContent = '请选择首选科目'; err.hidden = false; return false;
    }
  }
  if (state.step === 2 && state.interests.length < 1) {
    err.textContent = '请至少选择 1 项兴趣'; err.hidden = false; return false;
  }
  if (state.step === 4) {
    if (!state.gradIntent || !state.abroadIntent || !state.workPref) {
      err.textContent = '请完成本页所有选项'; err.hidden = false; return false;
    }
  }
  if (state.step === 5) {
    if (!state.valuePref || !state.familyEcon) {
      err.textContent = '请完成本页必选项'; err.hidden = false; return false;
    }
  }
  return true;
}

function getScoreForMajor(majorId) {
  const hit = lastPayload?.results?.find(r => r.major.id === majorId);
  return hit?.score || null;
}

function renderResults(payload) {
  lastPayload = payload;
  saveLastResult(payload);
  setView('result');

  $('majorProfile').textContent = payload.profile;
  $('majorFilterNote').textContent = payload.filteredCount > 0
    ? `已根据你的选科过滤 ${payload.filteredCount} 个不匹配专业，以下从 ${payload.eligibleCount} 个可报方向中推荐：`
    : `以下从 ${payload.eligibleCount} 个可报方向中为你推荐：`;

  $('majorCards').innerHTML = payload.results.map((r, i) => {
    const meta = DISCIPLINE_META[r.major.discipline] || { hue: 12, icon: '专' };
    return `
      <article class="major-result-card">
        <div class="major-result-rank">${i + 1}</div>
        <div class="major-result-icon" style="--major-hue:${meta.hue}">${escapeHtml(meta.icon)}</div>
        <div class="major-result-body">
          <div class="major-result-head">
            <h3 class="major-result-title">${escapeHtml(r.major.name)}</h3>
            <span class="major-result-score">${r.score}%</span>
          </div>
          <p class="major-result-discipline">${escapeHtml(r.major.discipline)} · ${escapeHtml(r.major.careers.slice(0, 2).join(' / '))}</p>
          <p class="major-result-summary">${escapeHtml(r.major.summary)}</p>
          <ul class="major-result-reasons">
            ${r.reasons.map(x => `<li>${escapeHtml(x)}</li>`).join('')}
          </ul>
          <p class="major-result-caution">${escapeHtml(r.major.cautions)}</p>
          <a class="major-result-detail-link" href="${majorDetailUrl(r.major.id)}">查看详情</a>
        </div>
      </article>
    `;
  }).join('');

  $('majorResult').dataset.text = formatResultText(payload);
  ensureResultComments();
}

function renderDetail(majorId) {
  const major = getMajorById(majorId);
  if (!major) {
    setView('quiz');
    return;
  }

  detailMajorId = majorId;
  const meta = DISCIPLINE_META[major.discipline] || { hue: 12, icon: '专' };
  const score = getScoreForMajor(majorId);
  const traits = describeMajorTraits(major);
  const links = majorReferenceLinks(major);

  $('majorDetailBody').innerHTML = `
    <header class="major-detail-header">
      <div class="major-detail-icon" style="--major-hue:${meta.hue}">${escapeHtml(meta.icon)}</div>
      <div class="major-detail-head-text">
        <p class="major-detail-discipline">${escapeHtml(major.discipline)}</p>
        <h2 class="major-detail-title">${escapeHtml(major.name)}</h2>
        ${score ? `<p class="major-detail-score">与你匹配 ${score}%</p>` : ''}
      </div>
    </header>
    <p class="major-detail-summary">${escapeHtml(major.summary)}</p>
    <section class="major-detail-block">
      <h3>典型去向</h3>
      <ul class="major-detail-careers">
        ${major.careers.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
      </ul>
    </section>
    ${traits.length ? `
    <section class="major-detail-block">
      <h3>专业特点</h3>
      <ul class="major-detail-traits">
        ${traits.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
      </ul>
    </section>` : ''}
    <section class="major-detail-block">
      <h3>填报提醒</h3>
      <p class="major-detail-caution">${escapeHtml(major.cautions)}</p>
    </section>
    <section class="major-detail-block">
      <h3>延伸阅读</h3>
      <div class="major-detail-links">
        ${links.map(link => `
          <a class="major-detail-link-card" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            <strong>${escapeHtml(link.label)}</strong>
            <span>${escapeHtml(link.desc || '')}</span>
          </a>
        `).join('')}
      </div>
    </section>
  `;

  setView('detail');
  history.replaceState(null, '', majorDetailUrl(majorId));
}

function showQuiz() {
  setView('quiz');
  history.replaceState(null, '', toolPageUrl('tools/tool-major.html'));
}

function resetQuiz() {
  Object.assign(state, {
    step: 1,
    examMode: '312',
    firstChoice: '',
    track: '',
    subjects: [],
    interests: [],
    skills: Object.fromEntries(SKILL_DIMS.map(s => [s.id, 3])),
    gradIntent: '',
    abroadIntent: '',
    workPref: '',
    acceptPressure: '',
    moneySlider: 50,
    valuePref: '',
    familyEcon: '',
    parentPref: '',
  });
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(RESULT_KEY);
  lastPayload = null;
  detailMajorId = '';
  showQuiz();
  renderStep();
}

function routeFromUrl() {
  const majorId = new URLSearchParams(location.search).get('major');
  if (majorId) {
    lastPayload = loadLastResult();
    renderDetail(majorId);
    return true;
  }
  return false;
}

loadState();
if (!routeFromUrl()) {
  renderStep();
}

$('majorPrev').addEventListener('click', () => {
  if (state.step > 1) {
    state.step -= 1;
    saveState();
    renderStep();
  }
});

$('majorNext').addEventListener('click', () => {
  if (!validateStep()) return;
  if (state.step < TOTAL_STEPS) {
    state.step += 1;
    saveState();
    renderStep();
    return;
  }
  const payload = scoreMajors(getAnswers());
  saveState();
  renderResults(payload);
});

$('majorRetry').addEventListener('click', resetQuiz);

$('majorCopy').addEventListener('click', async () => {
  const text = $('majorResult').dataset.text || '';
  if (!text) return;
  try {
    await copyText(text);
    $('majorCopy').textContent = '已复制';
    setTimeout(() => { $('majorCopy').textContent = '复制结果'; }, 1500);
  } catch {
    $('majorCopy').textContent = '复制失败';
  }
});

$('majorDetailBack').addEventListener('click', () => {
  if (lastPayload) {
    setView('result');
    history.replaceState(null, '', toolPageUrl('tools/tool-major.html'));
    ensureResultComments();
    return;
  }
  showQuiz();
  renderStep();
});

$('majorCards').addEventListener('click', (e) => {
  const link = e.target.closest('.major-result-detail-link');
  if (!link) return;
  e.preventDefault();
  const id = new URL(link.href).searchParams.get('major');
  if (id) renderDetail(id);
});

$('majorShare').addEventListener('click', async () => {
  if (!lastPayload) return;
  const btn = $('majorShare');
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    const pageUrl = toolPageUrl('tools/tool-major.html');
    const canvas = await drawMajorResultShareImage({
      profile: lastPayload.profile,
      results: lastPayload.results,
      pageUrl,
    });
    showShareImagePreview(canvas, {
      title: '专业推荐分享图',
      filename: 'major-result.png',
    });
  } catch (e) {
    alert(`分享图生成失败：${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '生成分享图';
  }
});

$('majorDetailShare').addEventListener('click', async () => {
  const major = getMajorById(detailMajorId);
  if (!major) return;
  const btn = $('majorDetailShare');
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    const pageUrl = majorDetailUrl(detailMajorId);
    const canvas = await drawMajorDetailShareImage({
      major,
      score: getScoreForMajor(detailMajorId),
      pageUrl,
    });
    showShareImagePreview(canvas, {
      title: `${major.name} 分享图`,
      filename: `major-${detailMajorId}.png`,
    });
  } catch (e) {
    alert(`分享图生成失败：${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '生成分享图';
  }
});
