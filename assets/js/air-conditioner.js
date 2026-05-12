import { CONFIG } from './config.js';
import { initSite } from './site.js';
import { setMeta, setJsonLd } from './seo.js';

const $ = sel => document.querySelector(sel);

const state = {
  power: false,
  temp: 26,
  mode: 'cool',
  speed: 1,
  swing: true,
  sound: false,
  eco: false,
  audio: null,
  gain: null,
  hum: null,
  noise: null,
};

const MODES = {
  cool: { label: '制冷', tip: '冷风已送达，办公室体感 -3°C。' },
  dry: { label: '除湿', tip: '空气变得干爽了一点，心情也是。' },
  fan: { label: '送风', tip: '风来了，虽然没有压缩机，但仪式感满分。' },
  sleep: { label: '睡眠', tip: '低噪柔风模式，适合夜读和发呆。' },
};
const SPEEDS = ['轻风', '自然风', '强风'];

function clampTemp(v) {
  return Math.max(16, Math.min(30, v));
}

function setTip(text) {
  const tip = $('#acTip');
  if (tip) tip.textContent = text;
}

function render() {
  const air = $('#aircon');
  const wind = $('#wind');
  const wrap = $('#airWrap');
  const mode = MODES[state.mode] || MODES.cool;

  air.classList.toggle('is-on', state.power);
  air.classList.toggle('is-swing', state.power && state.swing);
  air.classList.toggle('is-eco', state.eco);
  wind.classList.toggle('is-on', state.power);
  wind.classList.toggle('speed-1', state.speed === 0);
  wind.classList.toggle('speed-2', state.speed === 1);
  wind.classList.toggle('speed-3', state.speed === 2);
  wrap.style.setProperty('--wind-opacity', state.power ? String(0.28 + state.speed * 0.17) : '0');

  $('#tempValue').textContent = state.temp;
  $('#remoteTemp').textContent = state.temp;
  $('#screenMode').textContent = state.power ? mode.label : '待机';
  $('#screenSpeed').textContent = state.power ? SPEEDS[state.speed] : '未启动';
  $('#powerBtn').setAttribute('aria-pressed', String(state.power));

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === state.mode);
  });
  $('#swingBtn').classList.toggle('active', state.swing);
  $('#soundBtn').classList.toggle('active', state.sound);
  $('#ecoBtn').classList.toggle('active', state.eco);

  if (!state.power) {
    setTip('小空调已关闭。点击开关启动。');
  } else {
    setTip(`${mode.tip} 当前 ${state.temp}°C · ${SPEEDS[state.speed]}${state.swing ? ' · 摆风中' : ''}${state.eco ? ' · 节能' : ''}`);
  }
}

async function ensureAudio() {
  if (state.audio) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.gain.value = 0.035;

  const hum = ctx.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 82;

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 680;

  hum.connect(gain);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  hum.start();
  noise.start();

  state.audio = ctx;
  state.gain = gain;
  state.hum = hum;
  state.noise = noise;
}

async function updateAudio() {
  if (!state.sound || !state.power) {
    if (state.gain) state.gain.gain.setTargetAtTime(0, state.audio.currentTime, 0.05);
    return;
  }
  await ensureAudio();
  if (!state.audio) return;
  if (state.audio.state === 'suspended') await state.audio.resume();
  state.hum.frequency.setTargetAtTime(72 + state.speed * 18, state.audio.currentTime, 0.08);
  state.gain.gain.setTargetAtTime(0.025 + state.speed * 0.018, state.audio.currentTime, 0.05);
}

function bindControls() {
  const togglePower = () => {
    state.power = !state.power;
    render();
    updateAudio();
  };

  $('#powerBtn').addEventListener('click', togglePower);
  $('#remotePower').addEventListener('click', togglePower);

  $('#tempUp').addEventListener('click', () => {
    state.temp = clampTemp(state.temp + 1);
    if (state.temp >= 30) setTip('已经是最高 30°C 了，再高就是暖风了。');
    render();
  });
  $('#tempDown').addEventListener('click', () => {
    state.temp = clampTemp(state.temp - 1);
    if (state.temp <= 16) setTip('已经是最低 16°C 了，注意别着凉。');
    render();
  });

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      if (state.mode === 'sleep') state.speed = 0;
      if (state.mode === 'fan' && state.temp < 24) state.temp = 24;
      render();
      updateAudio();
    });
  });

  $('#speedBtn').addEventListener('click', () => {
    state.speed = (state.speed + 1) % SPEEDS.length;
    render();
    updateAudio();
  });
  $('#swingBtn').addEventListener('click', () => {
    state.swing = !state.swing;
    render();
  });
  $('#soundBtn').addEventListener('click', async () => {
    state.sound = !state.sound;
    render();
    await updateAudio();
  });
  $('#ecoBtn').addEventListener('click', () => {
    state.eco = !state.eco;
    if (state.eco && state.temp < 25) state.temp = 25;
    render();
  });
}

function renderGiscus() {
  const g = CONFIG.giscus || {};
  const host = $('#toolGiscus');
  if (!host || !g.enabled) {
    if (host) host.innerHTML = '<div class="tool-comments-hint">留言板未启用。可在后台设置里打开 giscus。</div>';
    return;
  }
  if (!g.repoId || !g.categoryId) {
    host.innerHTML = '<div class="tool-comments-hint">giscus 缺少 repoId 或 categoryId，请先在后台设置中补全。</div>';
    return;
  }
  const html = document.documentElement;
  const choice = html.dataset.themeChoice || 'auto';
  const resolved = choice === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : choice;
  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.crossOrigin = 'anonymous';
  script.async = true;
  const attrs = {
    'data-repo': g.repo,
    'data-repo-id': g.repoId,
    'data-category': g.category,
    'data-category-id': g.categoryId,
    'data-mapping': 'specific',
    'data-term': 'tool-air-conditioner',
    'data-strict': g.strict || '0',
    'data-reactions-enabled': g.reactionsEnabled || '1',
    'data-emit-metadata': g.emitMetadata || '0',
    'data-input-position': g.inputPosition || 'top',
    'data-theme': resolved,
    'data-lang': g.lang || 'zh-CN',
    'data-loading': 'lazy',
  };
  Object.entries(attrs).forEach(([key, value]) => script.setAttribute(key, value));
  host.appendChild(script);
}

initSite({ active: 'tools.html' });
setMeta({
  title: '在线小空调',
  description: '一个可以开关、调温、切模式和留言的在线小空调。',
  type: 'website',
});
setJsonLd({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: '在线小空调',
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Any',
  url: `${CONFIG.site.url || location.origin}/tool-air-conditioner.html`,
  description: '一个可以开关、调温、切模式和留言的在线小空调。',
});
bindControls();
render();
renderGiscus();
