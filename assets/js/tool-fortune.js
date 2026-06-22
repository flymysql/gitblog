import { initToolPage, $, dateSeed, pick } from './tool-kit-common.js';
import { FORTUNE_GRADES, FORTUNE_TEXTS, FORTUNE_GOOD, FORTUNE_BAD, FORTUNE_COLORS } from './tool-fortune-data.js';

initToolPage({
  title: '今日运势',
  description: '娱乐向今日签文，同一日期与昵称结果固定，图一乐，请勿当真。',
  path: 'tool-fortune.html',
});

function drawFortune() {
  const name = ($('fortuneName').value || '').trim();
  const seed = dateSeed(name);
  const grade = pick(FORTUNE_GRADES, seed);
  const card = $('fortuneResult');
  card.hidden = false;
  $('fortuneGrade').textContent = grade;
  $('fortuneGrade').dataset.level = grade.includes('吉') ? 'good' : grade === '平' ? 'mid' : 'bad';
  $('fortuneText').textContent = pick(FORTUNE_TEXTS, seed >> 3);
  $('fortuneGood').textContent = `${pick(FORTUNE_GOOD, seed >> 5)}、${pick(FORTUNE_GOOD, seed >> 7)}`;
  $('fortuneBad').textContent = `${pick(FORTUNE_BAD, seed >> 9)}、${pick(FORTUNE_BAD, seed >> 11)}`;
  $('fortuneColor').textContent = pick(FORTUNE_COLORS, seed >> 13);
  $('fortuneNum').textContent = String((seed % 9) + 1);
}

$('fortuneBtn').addEventListener('click', drawFortune);
drawFortune();
