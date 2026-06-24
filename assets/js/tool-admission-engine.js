import { isMajorEligible } from './tool-major-engine.js';
import { getMajorById } from './tool-major-data.js';
import { DATA_YEAR, getProvinceById, listAdmissionCandidates } from './tool-admission-data.js';

/** 从问卷答案推断投档科类 */
export function getUserTrack(answers) {
  if (answers.examMode === 'wenli') {
    return answers.track === 'science' ? 'physics' : 'history';
  }
  return answers.firstChoice === 'history' ? 'history' : 'physics';
}

function trackLabel(track) {
  return track === 'history' ? '历史类/文科' : '物理类/理科';
}

/**
 * 根据分数与位次判断冲稳保
 * @returns {'reach'|'match'|'safety'|null}
 */
function classifyTier({ score, rank }, line) {
  const scoreGap = score - line.minScore;
  const rankGap = line.minRank - rank; // 正数表示位次优于参考线

  if (scoreGap >= 18 || rankGap >= line.minRank * 0.35) return 'safety';
  if (scoreGap <= -12 || rankGap <= -line.minRank * 0.2) return 'reach';
  if (scoreGap >= -8 && scoreGap < 18) return 'match';
  if (rankGap >= -line.minRank * 0.15 && rankGap < line.minRank * 0.35) return 'match';
  if (scoreGap < -8) return 'reach';
  if (scoreGap >= 8) return 'safety';
  return 'match';
}

function tierMeta(tier) {
  const map = {
    reach: { label: '冲', hint: '录取有难度，可作为冲刺志愿' },
    match: { label: '稳', hint: '分数/位次与参考线接近，较有希望' },
    safety: { label: '保', hint: '相对稳妥，建议作为保底选择' },
  };
  return map[tier] || map.match;
}

/**
 * @param {object} opts
 * @param {number} opts.score 高考总分
 * @param {number} opts.rank 省排名/位次
 * @param {string} opts.province 省份 id
 * @param {object} opts.answers 问卷答案（选科过滤）
 * @param {string[]} opts.majorIds 倾向专业 id 列表
 * @param {Map<string, number>} [opts.majorScores] 专业匹配度
 */
export function recommendSchools({ score, rank, province, answers, majorIds, majorScores = new Map() }) {
  const prov = getProvinceById(province);
  if (!prov) {
    return { ok: false, error: '请选择省份' };
  }
  if (!Number.isFinite(score) || score <= 0) {
    return { ok: false, error: '请输入有效的高考分数' };
  }
  if (!Number.isFinite(rank) || rank <= 0) {
    return { ok: false, error: '请输入有效的省排名（位次）' };
  }

  const track = getUserTrack(answers);
  const eligibleMajorIds = majorIds.filter(id => {
    const major = getMajorById(id);
    return major && isMajorEligible(major, answers);
  });

  if (!eligibleMajorIds.length) {
    return { ok: false, error: '当前倾向专业与选科不匹配，请检查选科设置' };
  }

  const candidates = listAdmissionCandidates(province, track, eligibleMajorIds);
  const items = [];

  for (const row of candidates) {
    const major = getMajorById(row.majorId);
    if (!major || !isMajorEligible(major, answers)) continue;

    const tier = classifyTier({ score, rank }, row);
    if (!tier) continue;

    const majorScore = majorScores.get(row.majorId) ?? null;
    items.push({
      tier,
      ...tierMeta(tier),
      schoolId: row.uni.id,
      schoolName: row.uni.name,
      schoolTier: row.uni.tier,
      city: row.uni.city,
      majorId: row.majorId,
      majorName: major.name,
      majorDiscipline: major.discipline,
      majorMatch: majorScore,
      minScore: row.minScore,
      minRank: row.minRank,
      year: row.year,
      scoreGap: score - row.minScore,
      rankGap: row.minRank - rank,
    });
  }

  // 同校同档去重：保留与用户倾向匹配度最高的专业
  const dedup = new Map();
  for (const item of items) {
    const key = `${item.tier}:${item.schoolId}`;
    const prev = dedup.get(key);
    if (!prev || (item.majorMatch ?? 0) > (prev.majorMatch ?? 0)) {
      dedup.set(key, item);
    }
  }

  const sorted = [...dedup.values()].sort((a, b) => {
    const tierOrder = { reach: 0, match: 1, safety: 2 };
    if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
    const matchDiff = (b.majorMatch ?? 0) - (a.majorMatch ?? 0);
    if (matchDiff) return matchDiff;
    return Math.abs(a.scoreGap) - Math.abs(b.scoreGap);
  });

  const grouped = {
    reach: sorted.filter(i => i.tier === 'reach').slice(0, 6),
    match: sorted.filter(i => i.tier === 'match').slice(0, 8),
    safety: sorted.filter(i => i.tier === 'safety').slice(0, 6),
  };

  const total = grouped.reach.length + grouped.match.length + grouped.safety.length;
  if (!total) {
    return {
      ok: true,
      empty: true,
      province: prov,
      track,
      trackLabel: trackLabel(track),
      year: DATA_YEAR,
      score,
      rank,
      grouped,
      message: '暂未找到与当前分数段和倾向专业匹配的院校参考，建议扩大专业范围或查阅阳光高考官方数据。',
    };
  }

  return {
    ok: true,
    empty: false,
    province: prov,
    track,
    trackLabel: trackLabel(track),
    year: DATA_YEAR,
    score,
    rank,
    grouped,
    total,
  };
}

export function formatSchoolRecsText(rec) {
  if (!rec?.ok) return '';
  const lines = [
    '【院校专业参考推荐】',
    `${rec.province.name} · ${rec.trackLabel} · ${rec.year}年参考`,
    `我的成绩：${rec.score} 分，省排名 ${rec.rank}`,
    '',
  ];
  const sections = [
    ['冲 — 可冲刺', rec.grouped.reach],
    ['稳 — 较匹配', rec.grouped.match],
    ['保 — 较稳妥', rec.grouped.safety],
  ];
  for (const [title, list] of sections) {
    if (!list.length) continue;
    lines.push(title);
    for (const item of list) {
      lines.push(
        `· ${item.schoolName}（${item.schoolTier}）— ${item.majorName}`,
        `  参考线 ${item.minScore} 分 / 位次约 ${item.minRank.toLocaleString()}（${item.label}，分差 ${item.scoreGap >= 0 ? '+' : ''}${item.scoreGap}）`,
      );
    }
    lines.push('');
  }
  lines.push('数据为往年录取参考估算，不构成正式志愿填报建议，请以当年招生章程为准。');
  return lines.join('\n');
}
