import { initToolPage, $ } from './tool-kit-common.js';
import { drawAgeShareImage, downloadCanvas, toolPageUrl } from './tool-share-image.js';

initToolPage({
  title: '年龄计算器',
  description: '输入生日，计算年龄、总天数、总小时与距下次生日的天数。',
  path: 'tool-age.html',
  commentsHint: '算出来的数字准不准？来晒晒你的年龄～',
});

let lastAge = null;

function calcAge() {
  const dateVal = $('ageBirth').value;
  const timeVal = $('ageTime').value || '00:00:00';
  const el = $('ageResult');
  const shareBtn = $('ageShare');
  if (!dateVal) {
    el.innerHTML = '<p class="tool-kit-placeholder">请选择出生日期</p>';
    if (shareBtn) shareBtn.hidden = true;
    lastAge = null;
    return;
  }
  const birth = new Date(`${dateVal}T${timeVal.length === 5 ? timeVal + ':00' : timeVal}`);
  if (Number.isNaN(birth.getTime())) {
    el.innerHTML = '<p class="tool-kit-error">日期无效</p>';
    if (shareBtn) shareBtn.hidden = true;
    lastAge = null;
    return;
  }
  const now = new Date();
  if (birth > now) {
    el.innerHTML = '<p class="tool-kit-error">出生日期不能晚于现在</p>';
    if (shareBtn) shareBtn.hidden = true;
    lastAge = null;
    return;
  }

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const livedMs = now - birth;
  const livedDays = Math.floor(livedMs / 86400000);
  const livedHours = Math.floor(livedMs / 3600000);
  let nextBday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate(), birth.getHours(), birth.getMinutes(), birth.getSeconds());
  if (nextBday <= now) {
    nextBday = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate(), birth.getHours(), birth.getMinutes(), birth.getSeconds());
  }
  const daysToBday = Math.ceil((nextBday - now) / 86400000);

  el.innerHTML = `
    <div class="tool-kit-stat"><strong>${years}</strong><span>岁 ${months} 个月 ${days} 天</span></div>
    <div class="tool-kit-stat-grid">
      <div><strong>${livedDays.toLocaleString()}</strong><span>总天数</span></div>
      <div><strong>${livedHours.toLocaleString()}</strong><span>总小时</span></div>
      <div><strong>${daysToBday}</strong><span>天后生日</span></div>
      <div><strong>${Math.floor(livedMs / 1000).toLocaleString()}</strong><span>总秒数</span></div>
    </div>
  `;

  if (shareBtn) shareBtn.hidden = false;
  lastAge = {
    birthLabel: `${dateVal}${timeVal !== '00:00:00' && timeVal !== '00:00' ? ' ' + timeVal : ''}`,
    ageLine: `${years} 岁 ${months} 个月 ${days} 天`,
    livedDays: livedDays.toLocaleString(),
    livedHours: livedHours.toLocaleString(),
    daysToBday,
  };
}

$('ageBirth').max = new Date().toISOString().slice(0, 10);
$('ageBirth').addEventListener('change', calcAge);
$('ageTime').addEventListener('change', calcAge);

$('ageShare').addEventListener('click', async () => {
  if (!lastAge) return;
  const btn = $('ageShare');
  btn.disabled = true;
  btn.textContent = '生成中…';
  try {
    const canvas = await drawAgeShareImage({
      ...lastAge,
      pageUrl: toolPageUrl('tool-age.html'),
    });
    downloadCanvas(canvas, `age-${Date.now()}.png`);
  } catch (e) {
    alert(`分享图生成失败：${e.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '生成分享图';
  }
});
