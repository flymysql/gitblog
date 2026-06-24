/**
 * 院校录取数据：元数据 + 院校目录；真实分数线由 data/admission 分省 JSON 懒加载
 */

export const DATA_YEAR = 2020;
export const DATA_SOURCE = 'https://github.com/labolado/gaokao_2016-2020';

/** 开源数据集未覆盖的省份（浙江、上海） */
export const PROVINCES_WITHOUT_OPEN_DATA = new Set(['zj', 'sh']);

/** @typedef {{ id: string, name: string }} ProvinceMeta */

/** @type {ProvinceMeta[]} */
export const PROVINCES = [
  { id: 'bj', name: '北京' },
  { id: 'tj', name: '天津' },
  { id: 'he', name: '河北' },
  { id: 'sx', name: '山西' },
  { id: 'nm', name: '内蒙古' },
  { id: 'ln', name: '辽宁' },
  { id: 'jl', name: '吉林' },
  { id: 'hl', name: '黑龙江' },
  { id: 'sh', name: '上海' },
  { id: 'js', name: '江苏' },
  { id: 'zj', name: '浙江' },
  { id: 'ah', name: '安徽' },
  { id: 'fj', name: '福建' },
  { id: 'jx', name: '江西' },
  { id: 'sd', name: '山东' },
  { id: 'ha', name: '河南' },
  { id: 'hb', name: '湖北' },
  { id: 'hn', name: '湖南' },
  { id: 'gd', name: '广东' },
  { id: 'gx', name: '广西' },
  { id: 'hi', name: '海南' },
  { id: 'cq', name: '重庆' },
  { id: 'sc', name: '四川' },
  { id: 'gz', name: '贵州' },
  { id: 'yn', name: '云南' },
  { id: 'xz', name: '西藏' },
  { id: 'sn', name: '陕西' },
  { id: 'gs', name: '甘肃' },
  { id: 'qh', name: '青海' },
  { id: 'nx', name: '宁夏' },
  { id: 'xj', name: '新疆' },
];

export function getProvinceById(id) {
  return PROVINCES.find(p => p.id === id) || null;
}

export function hasRealAdmissionData(provinceId) {
  return !PROVINCES_WITHOUT_OPEN_DATA.has(provinceId);
}

/**
 * @typedef {{ id: string, name: string, tier: string, city: string, majors: string[] }} University
 */

/** @type {University[]} */
export const UNIVERSITIES = [
  { id: 'pku', name: '北京大学', tier: '985', city: '北京', majors: ['cs', 'ai', 'economics', 'finance', 'law', 'chinese', 'math', 'physics', 'psychology', 'clinical'] },
  { id: 'thu', name: '清华大学', tier: '985', city: '北京', majors: ['cs', 'ai', 'software', 'ee', 'auto', 'architecture', 'mechanical', 'economics', 'finance', 'journalism'] },
  { id: 'ruc', name: '中国人民大学', tier: '985', city: '北京', majors: ['economics', 'finance', 'law', 'journalism', 'business', 'accounting', 'statistics', 'chinese', 'hr'] },
  { id: 'buaa', name: '北京航空航天大学', tier: '985', city: '北京', majors: ['cs', 'software', 'ai', 'ee', 'auto', 'mechanical', 'math', 'physics'] },
  { id: 'bnu', name: '北京师范大学', tier: '985', city: '北京', majors: ['education', 'psychology', 'chinese', 'english', 'math', 'physics', 'preschool'] },
  { id: 'fudan', name: '复旦大学', tier: '985', city: '上海', majors: ['cs', 'software', 'economics', 'finance', 'law', 'journalism', 'chinese', 'clinical', 'pharmacy', 'math'] },
  { id: 'sjtu', name: '上海交通大学', tier: '985', city: '上海', majors: ['cs', 'ai', 'software', 'ee', 'mechanical', 'clinical', 'finance', 'economics', 'journalism'] },
  { id: 'tongji', name: '同济大学', tier: '985', city: '上海', majors: ['architecture', 'civil', 'mechanical', 'auto', 'environment', 'cs', 'software'] },
  { id: 'ecnu', name: '华东师范大学', tier: '985', city: '上海', majors: ['education', 'psychology', 'chinese', 'english', 'math', 'software', 'statistics'] },
  { id: 'zju', name: '浙江大学', tier: '985', city: '杭州', majors: ['cs', 'ai', 'software', 'ee', 'auto', 'clinical', 'pharmacy', 'economics', 'finance', 'architecture', 'civil'] },
  { id: 'nju', name: '南京大学', tier: '985', city: '南京', majors: ['cs', 'ai', 'math', 'physics', 'chemistry', 'economics', 'law', 'chinese', 'english', 'clinical'] },
  { id: 'seu', name: '东南大学', tier: '985', city: '南京', majors: ['architecture', 'civil', 'ee', 'auto', 'cs', 'software', 'mechanical'] },
  { id: 'ustc', name: '中国科学技术大学', tier: '985', city: '合肥', majors: ['cs', 'ai', 'math', 'physics', 'chemistry', 'statistics', 'ee'] },
  { id: 'whu', name: '武汉大学', tier: '985', city: '武汉', majors: ['cs', 'software', 'law', 'economics', 'finance', 'journalism', 'chinese', 'clinical', 'pharmacy', 'civil'] },
  { id: 'hust', name: '华中科技大学', tier: '985', city: '武汉', majors: ['cs', 'software', 'ai', 'ee', 'mechanical', 'auto', 'clinical', 'pharmacy', 'architecture'] },
  { id: 'scu', name: '四川大学', tier: '985', city: '成都', majors: ['cs', 'software', 'clinical', 'pharmacy', 'law', 'economics', 'journalism', 'civil', 'chemistry'] },
  { id: 'uestc', name: '电子科技大学', tier: '985', city: '成都', majors: ['cs', 'ai', 'software', 'ee', 'auto', 'math', 'statistics'] },
  { id: 'xjtu', name: '西安交通大学', tier: '985', city: '西安', majors: ['cs', 'software', 'ee', 'mechanical', 'auto', 'chemical_eng', 'economics', 'finance', 'clinical'] },
  { id: 'hit', name: '哈尔滨工业大学', tier: '985', city: '哈尔滨', majors: ['cs', 'ai', 'software', 'ee', 'mechanical', 'auto', 'civil', 'architecture'] },
  { id: 'xmu', name: '厦门大学', tier: '985', city: '厦门', majors: ['economics', 'finance', 'accounting', 'law', 'journalism', 'cs', 'software', 'chemistry'] },
  { id: 'tju', name: '天津大学', tier: '985', city: '天津', majors: ['architecture', 'civil', 'mechanical', 'chemical_eng', 'cs', 'software', 'auto'] },
  { id: 'nankai', name: '南开大学', tier: '985', city: '天津', majors: ['economics', 'finance', 'math', 'statistics', 'law', 'business', 'chinese', 'english'] },
  { id: 'sysu', name: '中山大学', tier: '985', city: '广州', majors: ['clinical', 'pharmacy', 'cs', 'software', 'law', 'economics', 'finance', 'business', 'journalism'] },
  { id: 'scut', name: '华南理工大学', tier: '985', city: '广州', majors: ['cs', 'software', 'ee', 'architecture', 'civil', 'mechanical', 'chemical_eng', 'business'] },
  { id: 'hnu', name: '湖南大学', tier: '985', city: '长沙', majors: ['cs', 'software', 'civil', 'mechanical', 'architecture', 'finance', 'journalism'] },
  { id: 'csu', name: '中南大学', tier: '985', city: '长沙', majors: ['clinical', 'pharmacy', 'cs', 'software', 'civil', 'mechanical', 'chemistry'] },
  { id: 'sdu', name: '山东大学', tier: '985', city: '济南', majors: ['cs', 'software', 'clinical', 'pharmacy', 'law', 'economics', 'math', 'chinese'] },
  { id: 'jlu', name: '吉林大学', tier: '985', city: '长春', majors: ['cs', 'software', 'clinical', 'pharmacy', 'law', 'economics', 'mechanical', 'chemistry'] },
  { id: 'dlut', name: '大连理工大学', tier: '985', city: '大连', majors: ['cs', 'software', 'mechanical', 'civil', 'chemical_eng', 'ee'] },
  { id: 'cqu', name: '重庆大学', tier: '985', city: '重庆', majors: ['cs', 'software', 'architecture', 'civil', 'mechanical', 'auto', 'business'] },
  { id: 'lzu', name: '兰州大学', tier: '985', city: '兰州', majors: ['cs', 'math', 'physics', 'chemistry', 'biology', 'clinical', 'pharmacy'] },
  { id: 'nwnu', name: '西北师范大学', tier: '省属重点', city: '兰州', majors: ['education', 'preschool', 'chinese', 'english', 'math', 'psychology'] },
  { id: 'hznu', name: '杭州师范大学', tier: '省属重点', city: '杭州', majors: ['education', 'preschool', 'chinese', 'english', 'clinical', 'nursing'] },
  { id: 'szu', name: '深圳大学', tier: '省属重点', city: '深圳', majors: ['cs', 'software', 'ee', 'finance', 'business', 'marketing', 'visual_design', 'journalism'] },
  { id: 'njust', name: '南京理工大学', tier: '211', city: '南京', majors: ['cs', 'software', 'ee', 'mechanical', 'auto', 'chemical_eng'] },
  { id: 'nuaa', name: '南京航空航天大学', tier: '211', city: '南京', majors: ['cs', 'ee', 'mechanical', 'auto', 'software'] },
  { id: 'swjtu', name: '西南交通大学', tier: '211', city: '成都', majors: ['civil', 'mechanical', 'ee', 'cs', 'software', 'auto'] },
  { id: 'buct', name: '北京化工大学', tier: '211', city: '北京', majors: ['chemical_eng', 'chemistry', 'environment', 'cs'] },
  { id: 'cufe', name: '中央财经大学', tier: '211', city: '北京', majors: ['finance', 'economics', 'accounting', 'business', 'statistics'] },
  { id: 'uibe', name: '对外经济贸易大学', tier: '211', city: '北京', majors: ['finance', 'economics', 'business', 'english', 'law', 'accounting'] },
  { id: 'cnu', name: '首都师范大学', tier: '双一流', city: '北京', majors: ['education', 'chinese', 'english', 'math', 'preschool', 'psychology'] },
  { id: 'gdut', name: '广东工业大学', tier: '省属重点', city: '广州', majors: ['cs', 'software', 'ee', 'mechanical', 'civil', 'architecture'] },
  { id: 'zjut', name: '浙江工业大学', tier: '省属重点', city: '杭州', majors: ['cs', 'software', 'chemical_eng', 'mechanical', 'civil', 'business'] },
  { id: 'hnust', name: '湖南科技大学', tier: '省属', city: '湘潭', majors: ['education', 'chinese', 'law', 'business', 'mechanical', 'civil'] },
];

const UNI_BY_NAME = new Map(UNIVERSITIES.map(u => [u.name, u]));

export function getUniversityByName(name) {
  return UNI_BY_NAME.get(String(name || '').trim()) || null;
}

/** 浙江/上海无开源数据时的简易估算（仅作兜底） */
const MAJOR_HEAT = {
  cs: 22, ai: 24, software: 18, clinical: 26, finance: 20, law: 18, ee: 14, economics: 16,
  architecture: 12, auto: 10, mechanical: 8, accounting: 12, business: 10, journalism: 8,
  education: 4, nursing: 6, pharmacy: 14, math: 16, physics: 12, chemistry: 10, biology: 8,
  statistics: 14, psychology: 10, chinese: 6, english: 8, marketing: 6, hr: 4, civil: 8,
  chemical_eng: 8, environment: 4, visual_design: 6, animation: 8, preschool: 2, tcm: 6,
};

const FALLBACK_BASELINE = {
  zj: { physics: 488, history: 488, fullScore: 750 },
  sh: { physics: 405, history: 405, fullScore: 660 },
};

export function estimateAdmissionLine(provinceId, uniId, majorId, track) {
  const base = FALLBACK_BASELINE[provinceId];
  const uni = UNIVERSITIES.find(u => u.id === uniId);
  if (!base || !uni) return null;
  const tierScore = { '985': 118, '211': 95, '双一流': 80, '省属重点': 62, '省属': 50 }[uni.tier] ?? 55;
  const heat = MAJOR_HEAT[majorId] ?? 8;
  const minScore = Math.round((base[track] ?? base.physics) + tierScore + heat);
  const minRank = Math.max(500, Math.round((base.fullScore - minScore + 50) * 90));
  return { minScore, minRank, year: DATA_YEAR, estimated: true };
}
