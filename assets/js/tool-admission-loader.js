import {
  DATA_YEAR,
  DATA_SOURCE,
  UNIVERSITIES,
  getUniversityByName,
  hasRealAdmissionData,
  estimateAdmissionLine,
} from './tool-admission-data.js';
import { CONFIG } from './config.js';

const shardCache = new Map();

function dataBasePath() {
  const base = String(CONFIG.site?.url || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/$/, '');
  return `${base}/data/admission`;
}

/** @returns {Promise<{ meta: object, schools: object[], majors: object[] }|null>} */
export async function loadAdmissionShard(provinceId, track) {
  const key = `${provinceId}-${track}`;
  if (shardCache.has(key)) return shardCache.get(key);
  if (!hasRealAdmissionData(provinceId)) {
    shardCache.set(key, null);
    return null;
  }
  const url = `${dataBasePath()}/provinces/${key}.json`;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    shardCache.set(key, data);
    return data;
  } catch (e) {
    console.warn('[admission] 加载失败', url, e);
    shardCache.set(key, null);
    return null;
  }
}

function majorLineKey(schoolName, majorId) {
  return `${schoolName}::${majorId}`;
}

/**
 * 列出候选院校-专业（优先 major-lines，其次院校线 + 目录专业）
 * @returns {Promise<Array<{ uni: object, majorId: string, minScore: number, minRank: number, year: number, lineType: string }>>}
 */
export async function listAdmissionCandidates(provinceId, track, majorIds) {
  const want = new Set(majorIds);
  const shard = await loadAdmissionShard(provinceId, track);
  const out = [];

  if (shard) {
    const majorMap = new Map(
      (shard.majors || []).filter(m => want.has(m.majorId)).map(m => [majorLineKey(m.schoolName, m.majorId), m]),
    );
    const schoolMap = new Map((shard.schools || []).map(s => [s.name, s]));

    for (const [key, m] of majorMap) {
      const uni = getUniversityByName(m.schoolName);
      if (!uni || !uni.majors.includes(m.majorId)) continue;
      const school = schoolMap.get(m.schoolName);
      out.push({
        uni,
        majorId: m.majorId,
        minScore: m.minScore ?? school?.minScore,
        minRank: m.minRank ?? school?.minRank,
        year: m.year || shard.meta?.year || DATA_YEAR,
        lineType: 'major',
        batch: school?.batch,
      });
    }

    for (const school of shard.schools || []) {
      const uni = getUniversityByName(school.name);
      if (!uni) continue;
      for (const majorId of uni.majors) {
        if (!want.has(majorId)) continue;
        if (majorMap.has(majorLineKey(school.name, majorId))) continue;
        if (!Number.isFinite(school.minRank)) continue;
        out.push({
          uni,
          majorId,
          minScore: school.minScore,
          minRank: school.minRank,
          year: shard.meta?.year || DATA_YEAR,
          lineType: 'school',
          batch: school.batch,
        });
      }
    }

    return out;
  }

  // 浙江/上海等：估算兜底
  for (const uni of UNIVERSITIES) {
    for (const majorId of uni.majors) {
      if (!want.has(majorId)) continue;
      const line = estimateAdmissionLine(provinceId, uni.id, majorId, track);
      if (!line) continue;
      out.push({
        uni,
        majorId,
        minScore: line.minScore,
        minRank: line.minRank,
        year: line.year,
        lineType: 'estimated',
        batch: '估算',
      });
    }
  }
  return out;
}

export function getAdmissionDataInfo(provinceId) {
  if (!hasRealAdmissionData(provinceId)) {
    return {
      year: DATA_YEAR,
      source: DATA_SOURCE,
      mode: 'estimated',
      note: '该省暂无开源历年 CSV 数据，以下为参考估算',
    };
  }
  return {
    year: DATA_YEAR,
    source: DATA_SOURCE,
    mode: 'csv',
    note: `${DATA_YEAR} 年院校投档线（开源 CSV），有专业线时优先展示专业线`,
  };
}
