// ============================================================================
// 留言板页：嵌入评论（CloudBase 或 giscus，与首页「留言板」Tab 共用 notesTerm）
// ============================================================================

import { initSite } from './site.js';
import { setMeta } from './seo.js';
import { isCommentsReady, mountNotesComments } from './comments-embed.js';

const $ = sel => document.querySelector(sel);

(async function init() {
  initSite({ active: 'notes.html' });
  setMeta({
    title: '留言板',
    description: '欢迎留言，随便聊聊。',
  });

  const host = $('#notesGiscusHost');
  if (!host) return;

  if (!isCommentsReady('notes')) {
    host.innerHTML = `
      <div class="comments-hint">
        请先在 <a href="admin/settings.html">后台 · 站点设置</a> 中启用 CloudBase 评论并填写 envId。
      </div>
    `;
    return;
  }

  mountNotesComments(host);
})();
