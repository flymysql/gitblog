import { initToolPage, $ } from './tool-kit-common.js';

initToolPage({
  title: '年龄计算器',
  description: '输入生日，计算年龄、总天数、总小时与距下次生日的天数。',
  path: 'tool-age.html',
});

function calcAge() {
  const dateVal = $('ageBirth').value;
  const timeVal = $('ageTime').value || '00:00:00';
  const el = $('ageResult');
  if (!dateVal) {
    el.innerHTML = '<p class="tool-kit-placeholder">请选择出生日期</p>';
    return;
  }
  const birth = new Date(`${dateVal}T${timeVal.length === 5 ? timeVal + ':00' : timeVal}`);
  if (Number.isNaN(birth.getTime())) {
    el.innerHTML = '<p class="tool-kit-error">日期无效</p>';
    return;
  }
  const now = new Date();
  if (birth > now) {
    el.innerHTML = '<p class="tool-kit-error">出生日期不能晚于现在</p>';
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
}

$('ageBirth').max = new Date().toISOString().slice(0, 10);
$('ageBirth').addEventListener('change', calcAge);
$('ageTime').addEventListener('change', calcAge);
