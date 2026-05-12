// ============================================================================
// 访问计数：默认接入「不蒜子（busuanzi）」
//
// 不蒜子是一款国内静态博客生态常用的纯前端计数器：
//   - 一段 CDN 脚本，不需要后端、不需要注册
//   - 按 referer 自动区分站点，无需配置
//   - 在页面里放约定 id 的 span 占位，脚本会把数字填进去
//
// 我们做了三件加固：
//   1. 没有任何占位元素时，不注入脚本（避免无意义请求）
//   2. 加载失败 / 5 秒未拿到数字 → 把所有 .bsz 占位静默隐藏，避免布局裸奔
//   3. config.pageviews.enabled = false 时不接入任何 provider
// ============================================================================

import { CONFIG } from './config.js';

const BUSUANZI_SRC = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';

const STATE = {
  injected: false,
  fallbackTimer: null,
};

function hideAllBsz(root = document) {
  root.querySelectorAll('.bsz').forEach(el => {
    el.style.display = 'none';
  });
}

function hideEmptyBsz(root = document) {
  root.querySelectorAll('.bsz').forEach(el => {
    const num = el.querySelector('.bsz-num');
    if (!num) return;
    if (!num.textContent || !num.textContent.trim()) {
      el.style.display = 'none';
    }
  });
}

function injectBusuanzi() {
  if (STATE.injected) return;
  STATE.injected = true;
  const s = document.createElement('script');
  s.src = BUSUANZI_SRC;
  s.async = true;
  s.referrerPolicy = 'no-referrer-when-downgrade';
  s.onerror = () => hideAllBsz();
  document.head.appendChild(s);
}

function hasBszContainer() {
  return !!document.querySelector(
    '#busuanzi_container_site_pv, #busuanzi_container_site_uv, #busuanzi_container_page_pv'
  );
}

// 在每个页面的入口 / 渲染完成后调用一次。
// 重复调用是安全的：脚本只会注入一次；超时兜底也只生效最后一次。
export function initPageviews() {
  const cfg = CONFIG.pageviews || {};
  if (!cfg.enabled || cfg.provider !== 'busuanzi') {
    hideAllBsz();
    return;
  }
  if (!hasBszContainer()) return;

  injectBusuanzi();

  // 5 秒兜底：到点还没拿到数字 → 把对应占位隐藏
  if (STATE.fallbackTimer) clearTimeout(STATE.fallbackTimer);
  STATE.fallbackTimer = setTimeout(() => hideEmptyBsz(), 5000);
}

// 独立 helper：返回首页 / footer / 文章页的占位 HTML，
// 在各 page 渲染时直接拼接即可，统一文案与 id。
export function bszSiteStatsHtml({ compact = false } = {}) {
  if (!isBusuanziOn()) return '';
  if (compact) {
    return `
      <span class="bsz" id="busuanzi_container_site_pv">总访问 <span id="busuanzi_value_site_pv" class="bsz-num"></span></span>
      <span class="bsz-sep">·</span>
      <span class="bsz" id="busuanzi_container_site_uv">访客 <span id="busuanzi_value_site_uv" class="bsz-num"></span></span>
    `;
  }
  return `
    <div class="stat bsz" id="busuanzi_container_site_pv">
      <strong class="bsz-num"><span id="busuanzi_value_site_pv"></span></strong>次访问
    </div>
    <div class="stat bsz" id="busuanzi_container_site_uv">
      <strong class="bsz-num"><span id="busuanzi_value_site_uv"></span></strong>位访客
    </div>
  `;
}

export function bszPagePvHtml() {
  if (!isBusuanziOn()) return '';
  return `<span class="bsz" id="busuanzi_container_page_pv">阅读 <span id="busuanzi_value_page_pv" class="bsz-num"></span></span>`;
}

export function isBusuanziOn() {
  const cfg = CONFIG.pageviews || {};
  return !!cfg.enabled && cfg.provider === 'busuanzi';
}
