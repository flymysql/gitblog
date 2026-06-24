/**
 * 从开源数据集生成录取 CSV 与分省 JSON（供专业测评院校推荐）
 * 数据源：https://github.com/labolado/gaokao_2016-2020（经 gaokao-zhiyuan-simulator 清洗打包）
 */
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync,
} from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ADM_DIR = join(ROOT, 'data/admission');
const RAW_GZ = join(ADM_DIR, 'admissions.json.gz');
const PROVINCE_DIR = join(ADM_DIR, 'provinces');
const SOURCES_DIR = join(ADM_DIR, 'sources');
const GZ_URL = 'https://raw.githubusercontent.com/wei011/gaokao-zhiyuan-simulator/main/data/admissions.json.gz';

export const DATA_YEAR = 2020;
export const DATA_SOURCE = 'https://github.com/labolado/gaokao_2016-2020';

const PROVINCE_NAME_TO_ID = {
  北京: 'bj', 天津: 'tj', 河北: 'he', 山西: 'sx', 内蒙古: 'nm',
  辽宁: 'ln', 吉林: 'jl', 黑龙江: 'hl', 上海: 'sh', 江苏: 'js',
  浙江: 'zj', 安徽: 'ah', 福建: 'fj', 江西: 'jx', 山东: 'sd',
  河南: 'ha', 湖北: 'hb', 湖南: 'hn', 广东: 'gd', 广西: 'gx',
  海南: 'hi', 重庆: 'cq', 四川: 'sc', 贵州: 'gz', 云南: 'yn',
  西藏: 'xz', 陕西: 'sn', 甘肃: 'gs', 青海: 'qh', 宁夏: 'nx', 新疆: 'xj',
};

const NO_OPEN_DATA = new Set(['zj', 'sh']);

function isUndergradBatch(batch) {
  return String(batch || '').includes('本科') && !String(batch).includes('专科');
}

function batchPriority(batch) {
  const b = String(batch || '');
  if (b === '普通类_本科一批') return 0;
  if (b.endsWith('本科一批') && !b.includes('协同') && !b.includes('分段')) return 1;
  if (b.includes('本科一批')) return 2;
  if (b.includes('本科')) return 3;
  return 9;
}

function trackFromSubject(subject) {
  return subject === '文科' ? 'history' : 'physics';
}

function schoolTier(r) {
  if (r.f985) return '985';
  if (r.f211) return '211';
  if (r.shuangyiliu) return '双一流';
  return '本科';
}

function csvEsc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function downloadGz() {
  mkdirSync(ADM_DIR, { recursive: true });
  const res = await fetch(GZ_URL, { headers: { 'User-Agent': 'gitblog-admission-import/1.0' } });
  if (!res.ok) throw new Error(`下载失败 ${res.status}: ${GZ_URL}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(RAW_GZ, buf);
  console.log(`已下载 ${RAW_GZ} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function loadRecords() {
  if (!existsSync(RAW_GZ)) await downloadGz();
  const parsed = JSON.parse(gunzipSync(readFileSync(RAW_GZ)).toString('utf8'));
  return parsed.records || [];
}

function pickBestLines(records, year = DATA_YEAR) {
  const best = new Map();
  for (const r of records) {
    if (r.year !== year || !isUndergradBatch(r.batch)) continue;
    if (!Number.isFinite(r.min_rank) || r.min_rank <= 0) continue;
    const provinceId = PROVINCE_NAME_TO_ID[r.src_province];
    if (!provinceId) continue;
    const track = trackFromSubject(r.subject);
    const key = `${provinceId}|${track}|${r.school}`;
    const pri = batchPriority(r.batch);
    const prev = best.get(key);
    if (!prev || pri < prev.pri || (pri === prev.pri && (r.min_score || 0) > (prev.line.min_score || 0))) {
      best.set(key, { pri, line: r, provinceId, track });
    }
  }
  return [...best.values()];
}

function lineToRow(entry) {
  const { line: r, provinceId, track } = entry;
  return {
    year: r.year,
    province_id: provinceId,
    province_name: r.src_province,
    track,
    school_name: r.school,
    school_province: r.school_province,
    city: r.city,
    tier: schoolTier(r),
    f985: r.f985 ? 1 : 0,
    f211: r.f211 ? 1 : 0,
    shuangyiliu: r.shuangyiliu ? 1 : 0,
    min_score: r.min_score ?? '',
    min_rank: r.min_rank,
    avg_score: r.avg_score ?? '',
    batch: r.batch,
  };
}

function writeSchoolLinesCsv(rows) {
  const header = [
    'year', 'province_id', 'province_name', 'track', 'school_name', 'school_province', 'city',
    'tier', 'f985', 'f211', 'shuangyiliu', 'min_score', 'min_rank', 'avg_score', 'batch',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map(k => csvEsc(row[k])).join(','));
  }
  const path = join(ADM_DIR, 'school-lines.csv');
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
  console.log(`已写入 ${path}（${rows.length} 行）`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') { inQ = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some(c => c !== '') || rows.length === 0) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function loadMajorLinesCsv() {
  const paths = [];
  const main = join(ADM_DIR, 'major-lines.csv');
  if (existsSync(main)) paths.push(main);
  if (existsSync(SOURCES_DIR)) {
    for (const f of readdirSync(SOURCES_DIR)) {
      if (f.endsWith('.csv')) paths.push(join(SOURCES_DIR, f));
    }
  }
  const out = [];
  for (const path of paths) {
    const table = parseCsv(readFileSync(path, 'utf8'));
    if (table.length < 2) continue;
    const header = table[0].map(h => h.trim());
    for (let i = 1; i < table.length; i++) {
      const obj = Object.fromEntries(header.map((h, j) => [h, (table[i][j] || '').trim()]));
      if (!obj.province_id || !obj.school_name || !obj.major_id) continue;
      if (obj.province_id.startsWith('#') || obj.year?.startsWith?.('#')) continue;
      out.push({
        year: Number(obj.year) || DATA_YEAR,
        province_id: obj.province_id,
        track: obj.track === 'history' ? 'history' : 'physics',
        school_name: obj.school_name,
        major_id: obj.major_id,
        major_name: obj.major_name || '',
        min_score: Number(obj.min_score) || null,
        min_rank: Number(obj.min_rank) || null,
        source: obj.source || path.split('/').pop(),
      });
    }
  }
  return out;
}

function buildProvinceShards(rows, majorLines) {
  mkdirSync(PROVINCE_DIR, { recursive: true });
  const byShard = new Map();
  for (const row of rows) {
    const key = `${row.province_id}-${row.track}`;
    if (!byShard.has(key)) byShard.set(key, []);
    byShard.get(key).push(row);
  }

  const majorByShard = new Map();
  for (const m of majorLines) {
    const key = `${m.province_id}-${m.track}`;
    if (!majorByShard.has(key)) majorByShard.set(key, []);
    majorByShard.get(key).push(m);
  }

  const available = [];
  for (const [key, lines] of byShard) {
    const [provinceId, track] = key.split('-');
    const tiered = lines.filter(r => r.f985 || r.f211 || r.shuangyiliu);
    const payload = {
      meta: {
        provinceId,
        provinceName: lines[0]?.province_name || provinceId,
        track,
        year: DATA_YEAR,
        source: DATA_SOURCE,
        note: '院校线为普通类本科批参考；专业线为 major-lines.csv 补充数据',
        schoolCount: tiered.length,
      },
      schools: tiered.map(r => ({
        name: r.school_name,
        city: r.city,
        tier: r.tier,
        f985: !!r.f985,
        f211: !!r.f211,
        shuangyiliu: !!r.shuangyiliu,
        minScore: Number(r.min_score) || null,
        minRank: Number(r.min_rank),
        batch: r.batch,
      })),
      majors: (majorByShard.get(key) || []).map(m => ({
        schoolName: m.school_name,
        majorId: m.major_id,
        majorName: m.major_name,
        minScore: m.min_score,
        minRank: m.min_rank,
        year: m.year,
        source: m.source,
      })),
    };
    writeFileSync(join(PROVINCE_DIR, `${key}.json`), `${JSON.stringify(payload)}\n`, 'utf8');
    available.push({ provinceId, track, schools: tiered.length, majors: payload.majors.length });
  }

  return available;
}

export async function importAdmissionData({ download = true } = {}) {
  mkdirSync(ADM_DIR, { recursive: true });
  mkdirSync(SOURCES_DIR, { recursive: true });
  if (download && !existsSync(RAW_GZ)) await downloadGz();

  const records = await loadRecords();
  const picked = pickBestLines(records, DATA_YEAR);
  const rows = picked.map(lineToRow).sort((a, b) =>
    a.province_id.localeCompare(b.province_id) || a.track.localeCompare(b.track) || a.min_rank - b.min_rank,
  );
  writeSchoolLinesCsv(rows);

  const majorLines = loadMajorLinesCsv();
  const shards = buildProvinceShards(rows, majorLines);

  const meta = {
    year: DATA_YEAR,
    source: DATA_SOURCE,
    importedAt: new Date().toISOString(),
    schoolLineCount: rows.length,
    majorLineCount: majorLines.length,
    provincesWithData: [...new Set(rows.map(r => r.province_id))].sort(),
    provincesWithoutOpenData: [...NO_OPEN_DATA],
    shards,
  };
  writeFileSync(join(ADM_DIR, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(`分省 JSON：${shards.length} 个 → ${PROVINCE_DIR}`);
  console.log(`专业线 CSV 记录：${majorLines.length} 条`);
  return meta;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  importAdmissionData().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
