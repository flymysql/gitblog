// ============================================================================
// 随笔页：仅嵌入 giscus（与首页「随笔」Tab 共用 notesTerm 讨论串）
// ============================================================================

import { initSite } from './site.js';
import { setMeta } from './seo.js';
import { isGiscusReady, mountGiscusScript, notesFeedTerm } from './giscus-embed.js';

const $ = sel => document.querySelector(sel);

(async function init() {
  initSite({ active: 'notes.html' });
  setMeta({
    title: '随笔',
    description: '短文与备忘 · giscus 讨论',
  });

  const host = $('#notesGiscusHost');
  if (!host) return;

  if (!isGiscusReady()) {
    host.innerHTML = `
      <div class="comments-hint">
        请先在 <a href="admin/settings.html">后台 · 站点设置</a> 中启用 giscus，并填写 repo、repoId、category、categoryId。
      </div>
    `;
    return;
  }

  mountGiscusScript(host, notesFeedTerm());
})();
