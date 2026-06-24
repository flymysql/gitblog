/**
 * 从微信农场小程序游戏配置生成 data/farm-crops.json
 * 数据源：gameConfig/Plant.json + seed-shop + ItemInfo（社区从游戏协议导出）
 * 土地类型按解锁等级分段（与常见作物效率表「土地」列一致）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'data/game');
const OVERRIDES_PATH = join(ROOT, 'data/farm-crop-overrides.json');
const EXTRA_PATH = join(ROOT, 'data/farm-crop-extra.json');

const EMOJI = {
  白萝卜: '🥬', 胡萝卜: '🥕', 大白菜: '🥬', 大蒜: '🧄', 大葱: '🧅', 水稻: '🌾', 小麦: '🌾', 玉米: '🌽',
  鲜姜: '🫚', 土豆: '🥔', 小白菜: '🥬', 生菜: '🥬', 油菜: '🌼', 银莲花: '🌸', 小雏菊: '🌼',
  '秋菊（黄色）': '🌼', '秋菊（红色）': '🌺', 天香百合: '🌸', 菠菜: '🥬', 非洲菊: '🌼', 向日葵: '🌻',
  竹笋: '🎋', 茉莉花: '🌸', 迎春花: '🌼', 茄子: '🍆', 番茄: '🍅', 豌豆: '🫛', 满天星: '✨', 辣椒: '🌶️',
  南瓜: '🎃', 草莓: '🍓', 火绒草: '🌿', 西瓜: '🍉', 桃子: '🍑', 葡萄: '🍇', 石榴: '🔴', 蘑菇: '🍄',
  椰子: '🥥', 猕猴桃: '🥝', 枇杷: '🍊', 香瓜: '🍈', 杨桃: '⭐', 芒果: '🥭', 瓶子树: '🌳', 曼陀罗华: '🌸',
  冬瓜: '🥒', 红毛丹: '🔴', 番荔枝: '🍎', 百香果: '🟣', 芦荟: '🌵', 菠萝蜜: '🍍', 红枣: '🫘', 花菜: '🥦',
  莲藕: '🪷', 含羞草: '🌿', 黄瓜: '🥒', 核桃: '🥜', 苹果: '🍎', 花香根鸢尾: '🌸', 黄豆: '🫘', 甘蔗: '🎋',
  丝瓜: '🥒', 栗子: '🌰', 菠萝: '🍍', 花生: '🥜', 梨: '🍐', 樱桃: '🍒', 木瓜: '🥭', 哈密瓜: '🍈', 杨梅: '🔴',
  蓝莓: '🫐', 曼珠沙华: '🌺', 豹皮花: '🌸', 宝华玉兰: '🌸', 大王花: '🌺', 金花茶: '🌼', 金边灵芝: '🍄', 人参: '🌿',
  蒲公英: '🌼', 韭菜: '🥬', 红玫瑰: '🌹', 牵牛花: '🌸', 芹菜: '🥬', 山楂: '🔴', 四叶草: '🍀', 虞美人: '🌺',
  香蕉: '🍌', 橙子: '🍊', 榛子: '🌰', 柚子: '🍊', 箬竹: '🎋', 金针菇: '🍄', 睡莲: '🪷', 李子: '🍑', 桂圆: '🟤',
  桑葚: '🫐', 榴莲: '🍈', 猪笼草: '🪴', 苦瓜: '🥒', 杏子: '🍑', 芭蕉: '🍌', 橄榄: '🫒', 灯笼果: '🟡', 薄荷: '🌿',
  鳄梨: '🥑', 无花果: '🟢', 葫芦: '🫒', 火龙果: '🐉', 荔枝: '🔴', 月柿: '🍅', 柠檬: '🍋', 番石榴: '🍐', 山竹: '🟣',
  天堂鸟: '🦜', 金桔: '🍊', 依米花: '✨', 人参果: '🥝', 天山雪莲: '❄️', 何首乌: '🌿', 似血杜鹃: '🌺',
  新春红灯笼: '🏮', 新春红包: '🧧',
};

/** 按解锁等级推断所需土地（与效率表「土地」列 1–5 对应） */
export function landFromLevel(minLevel) {
  const lv = Number(minLevel) || 1;
  if (lv >= 90) return 'purple';
  if (lv >= 60) return 'gold';
  if (lv >= 40) return 'black';
  if (lv >= 28) return 'red';
  return 'normal';
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadOverrides() {
  if (!existsSync(OVERRIDES_PATH)) return {};
  const raw = loadJson(OVERRIDES_PATH);
  const { _comment, ...rest } = raw;
  return rest;
}

function loadExtraRows() {
  if (!existsSync(EXTRA_PATH)) return [];
  const raw = loadJson(EXTRA_PATH);
  return Array.isArray(raw) ? raw : [];
}

function fruitPrice(itemMap, fruitId) {
  const item = itemMap.get(Number(fruitId));
  if (!item) return 0;
  return Number(item.price ?? item.sell_price ?? item.sellPrice ?? 0) || 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function generateFarmCrops() {
  const shop = loadJson(join(GAME, 'seed-shop.json'));
  const items = loadJson(join(GAME, 'ItemInfo.json'));
  const overrides = loadOverrides();
  const shopRows = [...shop.rows, ...loadExtraRows()];

  const itemMap = new Map(items.map(i => [Number(i.id), i]));

  const crops = [];
  for (const row of shopRows) {
    if (!row.name) continue;

    const patch = overrides[row.name] || {};
    const name = patch.name || row.name;
    const seasons = Number(patch.seasons ?? row.seasons) || 1;
    const growSec = Number(patch.growTimeSec ?? row.growTimeSec) || 0;
    if (growSec <= 0) continue;

    const minLevel = Number(patch.requiredLevel ?? row.requiredLevel) || 1;
    const fruitCount = Number(patch.fruitCount ?? row.fruitCount) || 0;
    const fruitId = patch.fruitId ?? row.fruitId;
    const unitPrice = fruitPrice(itemMap, fruitId);
    const seedCost = Number(patch.price ?? row.price) || 0;
    const harvestExp = Number(patch.exp ?? row.exp) || 0;

    const growMinutes = round2((growSec / 60) * seasons);
    const growHours = round2(growMinutes / 60);
    const sellTotal = unitPrice * fruitCount * seasons;
    const profit = sellTotal - seedCost;
    const profitPerHour = growHours > 0 ? round2(profit / growHours) : 0;
    const incomePerMin = growMinutes > 0 ? round2(profit / growMinutes) : 0;

    const xpPerHour = Number(row.expPerHour) || (growHours > 0
      ? round2((harvestExp * seasons) / growHours)
      : 0);
    const expPerMin = growMinutes > 0 ? round2((harvestExp * seasons) / growMinutes) : 0;

    const land = landFromLevel(minLevel);
    const landTier = land === 'normal' ? 1 : land === 'red' ? 2 : land === 'black' ? 3 : land === 'gold' ? 4 : 5;

    crops.push({
      id: `s${row.seedId}`,
      name,
      emoji: EMOJI[name] || EMOJI[row.name] || '🌱',
      minLevel,
      growHours,
      growMinutes,
      growTimeLabel: patch.growTimeStr || row.growTimeStr || '',
      seasons,
      harvestExp,
      fruitCount,
      unitPrice,
      seedCost,
      sellTotal,
      profitPerHour,
      incomePerMin,
      xpPerHour,
      expPerMin,
      land,
      landTier,
    });
  }

  crops.sort((a, b) => a.minLevel - b.minLevel || a.growHours - b.growHours);

  const out = {
    version: shop.exportedAt?.slice(0, 10) || 'game',
    updated: shop.exportedAt || new Date().toISOString(),
    game: '微信农场',
    disclaimer:
      '作物数据来自微信农场小程序游戏内种子商店与 Plant/Item 配置（社区协议导出），并按社区作物效率表校正土地类型与部分数值。未计入施肥、土地产量加成与被偷损失；请以游戏内商店为准。',
    sources: [
      'https://github.com/linguo2625469/qq-farm-bot/tree/main/gameConfig',
      'https://github.com/linguo2625469/qq-farm-bot/blob/main/tools/seed-shop-merged-export.json',
      'https://www.yishu.pro/oss/FarmCalc/',
    ],
    landLabels: {
      normal: '普通土地',
      red: '红土地',
      black: '黑土地',
      gold: '金土地',
      purple: '紫晶土地',
    },
    landTiers: {
      normal: { tier: 1, levelRange: '1–27' },
      red: { tier: 2, levelRange: '28–39' },
      black: { tier: 3, levelRange: '40–59' },
      gold: { tier: 4, levelRange: '60–89' },
      purple: { tier: 5, levelRange: '90+' },
    },
    crops,
  };

  const dest = join(ROOT, 'data/farm-crops.json');
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
  console.log('wrote', dest, `(${crops.length} crops)`);
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateFarmCrops();
}
