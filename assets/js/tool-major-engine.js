import { MAJORS } from './tool-major-data.js';

const SKILL_MAP = {
  math: ['logic', 'math'],
  writing: ['writing'],
  handsOn: ['handsOn'],
  art: ['creativity'],
  social: ['social'],
  focus: ['logic', 'gradSchool'],
  stress: ['pressure'],
  english: ['abroad', 'writing'],
};

/** 选科硬过滤 */
export function isMajorEligible(major, answers) {
  const { examMode, firstChoice, track, subjects = [] } = answers;
  const picked = new Set([...(subjects || []), firstChoice].filter(Boolean));

  if (examMode === 'wenli') {
    if (track === 'science' && major.needsHistory) return false;
    if (track === 'arts' && major.needsPhysics) return false;
  } else {
    if (major.needsPhysics && firstChoice === 'history') return false;
    if (major.needsHistory && firstChoice === 'physics') return false;
  }

  for (const req of major.needsSubjects || []) {
    if (req === 'chemistry' && !picked.has('chemistry')) return false;
    if (req === 'biology' && !picked.has('biology')) return false;
  }

  return true;
}

function interestScore(major, interests = []) {
  if (!interests.length) return 0.5;
  const set = new Set(interests);
  const hits = (major.interestTags || []).filter(t => set.has(t)).length;
  const denom = Math.max(major.interestTags.length, 1);
  return Math.min(1, hits / denom + (hits > 0 ? 0.15 : 0));
}

function skillScore(major, skills = {}) {
  let total = 0;
  let count = 0;
  for (const [skillId, level] of Object.entries(skills)) {
    const lv = Number(level) || 3;
    const keys = SKILL_MAP[skillId] || [skillId];
    const avgTrait = keys.reduce((s, k) => s + (major.traits[k] || 5), 0) / keys.length;
    const diff = 1 - Math.abs(lv * 2 - avgTrait) / 10;
    total += Math.max(0, diff);
    count += 1;
  }
  return count ? total / count : 0.5;
}

function developmentScore(major, answers) {
  const t = major.traits;
  let score = 0;
  let parts = 0;

  const gradMap = { strong: 1, normal: 0.6, unsure: 0.4, job: 0.2 };
  score += (t.gradSchool / 10) * (gradMap[answers.gradIntent] ?? 0.5);
  parts += 1;

  const abroadMap = { yes: 1, maybe: 0.6, no: 0.2 };
  score += (t.abroad / 10) * (abroadMap[answers.abroadIntent] ?? 0.5);
  parts += 1;

  const workMap = { stable: t.publicService, money: t.income, free: t.creativity, unsure: 5 };
  const wk = answers.workPref || 'unsure';
  score += (workMap[wk] ?? 5) / 10;
  parts += 1;

  if (answers.acceptPressure === 'no') {
    score += (10 - t.pressure) / 10;
    parts += 1;
  } else if (answers.acceptPressure === 'yes') {
    score += t.pressure / 10;
    parts += 1;
  }

  return parts ? score / parts : 0.5;
}

function valuesScore(major, answers) {
  const money = Number(answers.moneySlider ?? 50);
  const passion = 100 - money;
  const t = major.traits;

  const incomeFit = 1 - Math.abs(money / 10 - t.income) / 10;
  const passionFit = interestScore(major, answers.interests);

  const valueMap = {
    achievement: (t.gradSchool + t.creativity) / 20,
    income: t.income / 10,
    recognition: (t.income + t.publicService) / 20,
    balance: (10 - t.pressure + t.stability) / 20,
  };
  const valueFit = valueMap[answers.valuePref] ?? 0.5;

  return incomeFit * (money / 100) + passionFit * (passion / 100) + valueFit * 0.35;
}

function familyScore(major, answers) {
  const t = major.traits;
  if (answers.familyEcon === 'early_job') {
    return (t.stability + (10 - t.gradSchool) + t.income) / 30;
  }
  if (answers.familyEcon === 'support_grad') {
    return (t.gradSchool + t.abroad) / 20;
  }
  return (t.stability + t.income) / 20;
}

function buildReasons(major, answers, breakdown) {
  const reasons = [];
  const topInterest = (major.interestTags || []).find(t => (answers.interests || []).includes(t));
  if (topInterest) reasons.push(`与你的兴趣方向「${labelInterest(topInterest)}」较为契合`);

  if (breakdown.skill > 0.62) reasons.push('你的能力与该专业常见要求较匹配');
  if (answers.gradIntent === 'strong' && major.traits.gradSchool >= 7) reasons.push('你有读研意向，该专业深造路径较清晰');
  if (answers.abroadIntent === 'yes' && major.traits.abroad >= 7) reasons.push('留学友好度较高，适合有出国规划的同学');
  if (answers.workPref === 'stable' && major.traits.publicService >= 7) reasons.push('偏向稳定就业与公共领域，匹配你的职业规划');
  if (Number(answers.moneySlider) >= 65 && major.traits.income >= 7) reasons.push('薪资前景相对较好，符合你较看重收入的取向');
  if (Number(answers.moneySlider) <= 35) reasons.push('更侧重兴趣匹配，该专业与你勾选的方向一致');

  if (reasons.length < 2) reasons.push(major.summary);
  if (reasons.length < 3 && major.careers?.length) {
    reasons.push(`常见去向：${major.careers.slice(0, 2).join('、')}`);
  }
  return reasons.slice(0, 3);
}

function labelInterest(id) {
  const map = {
    tech: '科技数码', logic: '数理逻辑', design: '创意设计', writing: '文字表达',
    social: '社会观察', business: '商业财经', medical: '医疗健康', education: '教育公益',
    law: '法律规则', nature: '自然环境', media: '表演传媒', hands: '动手实操',
  };
  return map[id] || id;
}

function buildProfile(answers, topResults) {
  const parts = [];
  if ((answers.interests || []).length) {
    const labels = answers.interests.slice(0, 3).map(labelInterest);
    parts.push(`你展现出对 ${labels.join('、')} 等领域的兴趣`);
  }
  if (answers.gradIntent === 'strong') parts.push('有明确的深造规划');
  else if (answers.gradIntent === 'job') parts.push('更倾向于本科后就业');
  if (Number(answers.moneySlider) >= 60) parts.push('较看重收入与职业回报');
  else if (Number(answers.moneySlider) <= 40) parts.push('更愿意为兴趣买单');
  if (topResults[0]) parts.push(`综合匹配度最高的是「${topResults[0].major.name}」`);
  return parts.join('；') + '。';
}

/**
 * @param {object} answers 问卷答案
 * @returns {{ profile: string, results: Array, filteredCount: number }}
 */
export function scoreMajors(answers) {
  const eligible = MAJORS.filter(m => isMajorEligible(m, answers));
  const filteredCount = MAJORS.length - eligible.length;

  const scored = eligible.map(major => {
    const breakdown = {
      interest: interestScore(major, answers.interests),
      skill: skillScore(major, answers.skills),
      development: developmentScore(major, answers),
      values: valuesScore(major, answers),
      family: familyScore(major, answers),
    };
    const raw =
      breakdown.interest * 0.28 +
      breakdown.skill * 0.22 +
      breakdown.development * 0.2 +
      breakdown.values * 0.18 +
      breakdown.family * 0.12;
    const score = Math.round(Math.min(98, Math.max(55, raw * 100)));
    return {
      major,
      score,
      breakdown,
      reasons: buildReasons(major, answers, breakdown),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, 8);
  return {
    profile: buildProfile(answers, results),
    results,
    filteredCount,
    eligibleCount: eligible.length,
  };
}

export function formatResultText({ profile, results, filteredCount }) {
  const lines = [
    '【高考专业倾向测评结果】',
    profile,
    '',
    `共 ${results.length} 个推荐专业（已按选科过滤 ${filteredCount} 个不匹配项）：`,
    ...results.map((r, i) =>
      `${i + 1}. ${r.major.name}（${r.major.discipline}）匹配度 ${r.score}%\n   ${r.reasons.join('；')}`
    ),
    '',
    '仅供参考，不构成正式志愿填报建议，请结合分数、院校与招生章程综合判断。',
  ];
  return lines.join('\n');
}
