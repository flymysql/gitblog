import { initToolPage, $, dateSeed, pick } from './tool-kit-common.js';
import { FORTUNE_GRADES, FORTUNE_TEXTS, FORTUNE_GOOD, FORTUNE_BAD, FORTUNE_COLORS } from './tool-fortune-data.js';
import { drawFortuneShareImage, downloadCanvas, toolPageUrl } from './tool-share-image.js';

initToolPage({
  title: '今日运势',
  description: '娱乐向今日签文，同一日期与昵称结果固定，图一乐，请勿当真。',
  path: 'tools/tool-fortune.html',
  commentsHint: '今日签文如何？来聊两句～',
});

let lastFortune = null;

function drawFortune() {
  const name = ($('fortuneName').value || '').trim();
  const seed = dateSeed(name);
  const grade = pick(FORTUNE_GRADES, seed);
  const level = grade.includes('吉') ? 'good' : grade === '平' ? 'mid' : 'bad';
  const card = $('fortuneResult');
  card.hidden = false;
  $('fortuneGrade').textContent = grade;
  $('fortuneGrade').dataset.level = level;
  const text = pick(FORTUNE_TEXTS, seed >> 3);
  const good = `${pick(FORTUNE_GOOD, seed >> 5)}、${pick(FORTUNE_GOOD, seed >> 7)}`;
  const bad = `${pick(FORTUNE_BAD, seed >> 9)}、${pick(FORTUNE_BAD, seed >> 11)}`;
  const color = pick(FORTUNE_COLORS, seed >> 13);
  const num = String((seed % 9) + 1);
  $('fortuneText').textContent = text;
  $('fortuneGood').textContent = good;
  $('fortuneBad').textContent = bad;
  $('fortuneColor').textContent = color;
  $('fortuneNum').textContent = num;
  lastFortune = { grade, level, text, good, bad, color, num, name };
}

$('fortuneBtn').addEventListener('click', drawFortune);

const urlName = new URLSearchParams(location.search).get('name');
if (urlName) $('fortuneName').value = urlName.slice(0, 20);

$('fortuneShare').addEventListener('click', async () => {
  if (!lastFortune) drawFortune();
  const btn = $('fortuneShare');
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    const name = lastFortune.name;
    const query = name ? `name=${encodeURIComponent(name)}` : '';
    const pageUrl = toolPageUrl('tools/tool-fortune.html', query);
    const canvas = await drawFortuneShareImage({ ...lastFortune, pageUrl });
    const d = new Date();
    downloadCanvas(canvas, `fortune-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.png`);
  } catch (e) {
    alert(`分享图生成失败：${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '生成分享图';
  }
});

drawFortune();
