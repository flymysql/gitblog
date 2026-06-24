/**
 * 院校录取参考数据（基于 2024 年各省投档情况整理的示意数据，仅供辅助参考）
 * 实际填报请以当年招生章程、官方志愿填报系统为准。
 */

export const DATA_YEAR = 2024;

/** @typedef {{ id: string, name: string, fullScore: number, baseline: { physics: number, history: number }, rankScale: number }} ProvinceMeta */

/** @type {ProvinceMeta[]} */
export const PROVINCES = [
  { id: 'bj', name: '北京', fullScore: 750, baseline: { physics: 448, history: 448 }, rankScale: 0.35 },
  { id: 'tj', name: '天津', fullScore: 750, baseline: { physics: 475, history: 472 }, rankScale: 0.45 },
  { id: 'he', name: '河北', fullScore: 750, baseline: { physics: 439, history: 430 }, rankScale: 1.15 },
  { id: 'sx', name: '山西', fullScore: 750, baseline: { physics: 396, history: 418 }, rankScale: 0.95 },
  { id: 'nm', name: '内蒙古', fullScore: 750, baseline: { physics: 360, history: 381 }, rankScale: 0.7 },
  { id: 'ln', name: '辽宁', fullScore: 750, baseline: { physics: 368, history: 400 }, rankScale: 0.85 },
  { id: 'jl', name: '吉林', fullScore: 750, baseline: { physics: 345, history: 365 }, rankScale: 0.75 },
  { id: 'hl', name: '黑龙江', fullScore: 750, baseline: { physics: 360, history: 382 }, rankScale: 0.8 },
  { id: 'sh', name: '上海', fullScore: 660, baseline: { physics: 405, history: 405 }, rankScale: 0.4 },
  { id: 'js', name: '江苏', fullScore: 750, baseline: { physics: 462, history: 478 }, rankScale: 1.05 },
  { id: 'zj', name: '浙江', fullScore: 750, baseline: { physics: 488, history: 488 }, rankScale: 1.0 },
  { id: 'ah', name: '安徽', fullScore: 750, baseline: { physics: 465, history: 462 }, rankScale: 1.0 },
  { id: 'fj', name: '福建', fullScore: 750, baseline: { physics: 449, history: 431 }, rankScale: 0.9 },
  { id: 'jx', name: '江西', fullScore: 750, baseline: { physics: 448, history: 463 }, rankScale: 1.05 },
  { id: 'sd', name: '山东', fullScore: 750, baseline: { physics: 444, history: 444 }, rankScale: 1.2 },
  { id: 'ha', name: '河南', fullScore: 750, baseline: { physics: 396, history: 428 }, rankScale: 1.35 },
  { id: 'hb', name: '湖北', fullScore: 750, baseline: { physics: 437, history: 432 }, rankScale: 1.0 },
  { id: 'hn', name: '湖南', fullScore: 750, baseline: { physics: 422, history: 438 }, rankScale: 1.05 },
  { id: 'gd', name: '广东', fullScore: 750, baseline: { physics: 439, history: 433 }, rankScale: 1.15 },
  { id: 'gx', name: '广西', fullScore: 750, baseline: { physics: 371, history: 400 }, rankScale: 0.95 },
  { id: 'hi', name: '海南', fullScore: 900, baseline: { physics: 483, history: 483 }, rankScale: 0.55 },
  { id: 'cq', name: '重庆', fullScore: 750, baseline: { physics: 427, history: 428 }, rankScale: 0.85 },
  { id: 'sc', name: '四川', fullScore: 750, baseline: { physics: 459, history: 457 }, rankScale: 1.1 },
  { id: 'gz', name: '贵州', fullScore: 750, baseline: { physics: 380, history: 442 }, rankScale: 0.9 },
  { id: 'yn', name: '云南', fullScore: 750, baseline: { physics: 420, history: 465 }, rankScale: 0.95 },
  { id: 'xz', name: '西藏', fullScore: 750, baseline: { physics: 315, history: 335 }, rankScale: 0.25 },
  { id: 'sn', name: '陕西', fullScore: 750, baseline: { physics: 449, history: 397 }, rankScale: 0.95 },
  { id: 'gs', name: '甘肃', fullScore: 750, baseline: { physics: 370, history: 421 }, rankScale: 0.75 },
  { id: 'qh', name: '青海', fullScore: 750, baseline: { physics: 325, history: 382 }, rankScale: 0.35 },
  { id: 'nx', name: '宁夏', fullScore: 750, baseline: { physics: 371, history: 419 }, rankScale: 0.4 },
  { id: 'xj', name: '新疆', fullScore: 750, baseline: { physics: 390, history: 425 }, rankScale: 0.65 },
];

export function getProvinceById(id) {
  return PROVINCES.find(p => p.id === id) || null;
}

/**
 * @typedef {{ id: string, name: string, tier: string, tierScore: number, city: string, majors: string[] }} University
 */

/** @type {University[]} */
export const UNIVERSITIES = [
  { id: 'pku', name: '北京大学', tier: '985', tierScore: 128, city: '北京', majors: ['cs', 'ai', 'economics', 'finance', 'law', 'chinese', 'math', 'physics', 'psychology', 'clinical'] },
  { id: 'thu', name: '清华大学', tier: '985', tierScore: 130, city: '北京', majors: ['cs', 'ai', 'software', 'ee', 'auto', 'architecture', 'mechanical', 'economics', 'finance', 'journalism'] },
  { id: 'ruc', name: '中国人民大学', tier: '985', tierScore: 118, city: '北京', majors: ['economics', 'finance', 'law', 'journalism', 'business', 'accounting', 'statistics', 'chinese', 'hr'] },
  { id: 'buaa', name: '北京航空航天大学', tier: '985', tierScore: 115, city: '北京', majors: ['cs', 'software', 'ai', 'ee', 'auto', 'mechanical', 'math', 'physics'] },
  { id: 'bnu', name: '北京师范大学', tier: '985', tierScore: 112, city: '北京', majors: ['education', 'psychology', 'chinese', 'english', 'math', 'physics', 'preschool'] },
  { id: 'fudan', name: '复旦大学', tier: '985', tierScore: 122, city: '上海', majors: ['cs', 'software', 'economics', 'finance', 'law', 'journalism', 'chinese', 'clinical', 'pharmacy', 'math'] },
  { id: 'sjtu', name: '上海交通大学', tier: '985', tierScore: 124, city: '上海', majors: ['cs', 'ai', 'software', 'ee', 'mechanical', 'clinical', 'finance', 'economics', 'journalism'] },
  { id: 'tongji', name: '同济大学', tier: '985', tierScore: 112, city: '上海', majors: ['architecture', 'civil', 'mechanical', 'auto', 'environment', 'cs', 'software'] },
  { id: 'ecnu', name: '华东师范大学', tier: '985', tierScore: 105, city: '上海', majors: ['education', 'psychology', 'chinese', 'english', 'math', 'software', 'statistics'] },
  { id: 'zju', name: '浙江大学', tier: '985', tierScore: 120, city: '杭州', majors: ['cs', 'ai', 'software', 'ee', 'auto', 'clinical', 'pharmacy', 'economics', 'finance', 'architecture', 'civil'] },
  { id: 'nju', name: '南京大学', tier: '985', tierScore: 118, city: '南京', majors: ['cs', 'ai', 'math', 'physics', 'chemistry', 'economics', 'law', 'chinese', 'english', 'clinical'] },
  { id: 'seu', name: '东南大学', tier: '985', tierScore: 110, city: '南京', majors: ['architecture', 'civil', 'ee', 'auto', 'cs', 'software', 'mechanical'] },
  { id: 'ustc', name: '中国科学技术大学', tier: '985', tierScore: 122, city: '合肥', majors: ['cs', 'ai', 'math', 'physics', 'chemistry', 'statistics', 'ee'] },
  { id: 'whu', name: '武汉大学', tier: '985', tierScore: 112, city: '武汉', majors: ['cs', 'software', 'law', 'economics', 'finance', 'journalism', 'chinese', 'clinical', 'pharmacy', 'civil'] },
  { id: 'hust', name: '华中科技大学', tier: '985', tierScore: 114, city: '武汉', majors: ['cs', 'software', 'ai', 'ee', 'mechanical', 'auto', 'clinical', 'pharmacy', 'architecture'] },
  { id: 'scu', name: '四川大学', tier: '985', tierScore: 108, city: '成都', majors: ['cs', 'software', 'clinical', 'pharmacy', 'law', 'economics', 'journalism', 'civil', 'chemistry'] },
  { id: 'uestc', name: '电子科技大学', tier: '985', tierScore: 110, city: '成都', majors: ['cs', 'ai', 'software', 'ee', 'auto', 'math', 'statistics'] },
  { id: 'xjtu', name: '西安交通大学', tier: '985', tierScore: 110, city: '西安', majors: ['cs', 'software', 'ee', 'mechanical', 'auto', 'chemical_eng', 'economics', 'finance', 'clinical'] },
  { id: 'hit', name: '哈尔滨工业大学', tier: '985', tierScore: 112, city: '哈尔滨', majors: ['cs', 'ai', 'software', 'ee', 'mechanical', 'auto', 'civil', 'architecture'] },
  { id: 'xmu', name: '厦门大学', tier: '985', tierScore: 108, city: '厦门', majors: ['economics', 'finance', 'accounting', 'law', 'journalism', 'cs', 'software', 'chemistry'] },
  { id: 'tju', name: '天津大学', tier: '985', tierScore: 108, city: '天津', majors: ['architecture', 'civil', 'mechanical', 'chemical_eng', 'cs', 'software', 'auto'] },
  { id: 'nankai', name: '南开大学', tier: '985', tierScore: 106, city: '天津', majors: ['economics', 'finance', 'math', 'statistics', 'law', 'business', 'chinese', 'english'] },
  { id: 'sysu', name: '中山大学', tier: '985', tierScore: 110, city: '广州', majors: ['clinical', 'pharmacy', 'cs', 'software', 'law', 'economics', 'finance', 'business', 'journalism'] },
  { id: 'scut', name: '华南理工大学', tier: '985', tierScore: 104, city: '广州', majors: ['cs', 'software', 'ee', 'architecture', 'civil', 'mechanical', 'chemical_eng', 'business'] },
  { id: 'hnu', name: '湖南大学', tier: '985', tierScore: 100, city: '长沙', majors: ['cs', 'software', 'civil', 'mechanical', 'architecture', 'finance', 'journalism'] },
  { id: 'csu', name: '中南大学', tier: '985', tierScore: 102, city: '长沙', majors: ['clinical', 'pharmacy', 'cs', 'software', 'civil', 'mechanical', 'chemistry'] },
  { id: 'sdu', name: '山东大学', tier: '985', tierScore: 102, city: '济南', majors: ['cs', 'software', 'clinical', 'pharmacy', 'law', 'economics', 'math', 'chinese'] },
  { id: 'jlu', name: '吉林大学', tier: '985', tierScore: 98, city: '长春', majors: ['cs', 'software', 'clinical', 'pharmacy', 'law', 'economics', 'mechanical', 'chemistry'] },
  { id: 'dlut', name: '大连理工大学', tier: '985', tierScore: 100, city: '大连', majors: ['cs', 'software', 'mechanical', 'civil', 'chemical_eng', 'ee'] },
  { id: 'cqu', name: '重庆大学', tier: '985', tierScore: 100, city: '重庆', majors: ['cs', 'software', 'architecture', 'civil', 'mechanical', 'auto', 'business'] },
  { id: 'lzu', name: '兰州大学', tier: '985', tierScore: 92, city: '兰州', majors: ['cs', 'math', 'physics', 'chemistry', 'biology', 'clinical', 'pharmacy'] },
  { id: 'nwnu', name: '西北师范大学', tier: '省属重点', tierScore: 58, city: '兰州', majors: ['education', 'preschool', 'chinese', 'english', 'math', 'psychology'] },
  { id: 'hznu', name: '杭州师范大学', tier: '省属重点', tierScore: 62, city: '杭州', majors: ['education', 'preschool', 'chinese', 'english', 'clinical', 'nursing'] },
  { id: 'szu', name: '深圳大学', tier: '省属重点', tierScore: 78, city: '深圳', majors: ['cs', 'software', 'ee', 'finance', 'business', 'marketing', 'visual_design', 'journalism'] },
  { id: 'njust', name: '南京理工大学', tier: '211', tierScore: 88, city: '南京', majors: ['cs', 'software', 'ee', 'mechanical', 'auto', 'chemical_eng'] },
  { id: 'nuaa', name: '南京航空航天大学', tier: '211', tierScore: 86, city: '南京', majors: ['cs', 'ee', 'mechanical', 'auto', 'software'] },
  { id: 'swjtu', name: '西南交通大学', tier: '211', tierScore: 84, city: '成都', majors: ['civil', 'mechanical', 'ee', 'cs', 'software', 'auto'] },
  { id: 'buct', name: '北京化工大学', tier: '211', tierScore: 82, city: '北京', majors: ['chemical_eng', 'chemistry', 'environment', 'cs'] },
  { id: 'cufe', name: '中央财经大学', tier: '211', tierScore: 95, city: '北京', majors: ['finance', 'economics', 'accounting', 'business', 'statistics'] },
  { id: 'uibe', name: '对外经济贸易大学', tier: '211', tierScore: 94, city: '北京', majors: ['finance', 'economics', 'business', 'english', 'law', 'accounting'] },
  { id: 'cnu', name: '首都师范大学', tier: '双一流', tierScore: 72, city: '北京', majors: ['education', 'chinese', 'english', 'math', 'preschool', 'psychology'] },
  { id: 'gdut', name: '广东工业大学', tier: '省属重点', tierScore: 68, city: '广州', majors: ['cs', 'software', 'ee', 'mechanical', 'civil', 'architecture'] },
  { id: 'zjut', name: '浙江工业大学', tier: '省属重点', tierScore: 66, city: '杭州', majors: ['cs', 'software', 'chemical_eng', 'mechanical', 'civil', 'business'] },
  { id: 'hnust', name: '湖南科技大学', tier: '省属', tierScore: 52, city: '湘潭', majors: ['education', 'chinese', 'law', 'business', 'mechanical', 'civil'] },
];

/** 专业热度附加分（越高录取线越高） */
const MAJOR_HEAT = {
  cs: 22, ai: 24, software: 18, clinical: 26, finance: 20, law: 18, ee: 14, economics: 16,
  architecture: 12, auto: 10, mechanical: 8, accounting: 12, business: 10, journalism: 8,
  education: 4, nursing: 6, pharmacy: 14, math: 16, physics: 12, chemistry: 10, biology: 8,
  statistics: 14, psychology: 10, chinese: 6, english: 8, marketing: 6, hr: 4, civil: 8,
  chemical_eng: 8, environment: 4, visual_design: 6, animation: 8, preschool: 2, tcm: 6,
};

/**
 * 估算某省某校某专业的参考录取分数线与位次
 * @returns {{ minScore: number, minRank: number, year: number }}
 */
export function estimateAdmissionLine(provinceId, uniId, majorId, track) {
  const prov = getProvinceById(provinceId);
  const uni = UNIVERSITIES.find(u => u.id === uniId);
  if (!prov || !uni) return null;

  const base = prov.baseline[track] ?? prov.baseline.physics;
  const heat = MAJOR_HEAT[majorId] ?? 8;
  const minScore = Math.round(base + uni.tierScore + heat);
  const gap = Math.max(20, prov.fullScore - minScore);
  const minRank = Math.max(500, Math.round(gap * 95 * prov.rankScale));

  return { minScore, minRank, year: DATA_YEAR };
}

/** 列出某省某科类下所有可查询的院校-专业组合 */
export function listAdmissionCandidates(provinceId, track, majorIds) {
  const want = new Set(majorIds);
  const out = [];
  for (const uni of UNIVERSITIES) {
    for (const majorId of uni.majors) {
      if (!want.has(majorId)) continue;
      const line = estimateAdmissionLine(provinceId, uni.id, majorId, track);
      if (!line) continue;
      out.push({ uni, majorId, ...line });
    }
  }
  return out;
}
