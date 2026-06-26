// ============================================================================
// 后台诊断页：逐项检查 token / 仓库 / 分支 / 写权限 / 索引文件 / GitHub Pages
// ============================================================================

import { CONFIG } from './config.js';
import { getToken } from './auth.js';
import {
  getCurrentUser,
  useCloudEditorProxy,
  isCloudbaseEditorConfigured,
  writeFile,
  deleteFile,
  readFile,
} from './api.js';
import { ghGetRepo, ghGetBranch } from './cloudbase-github.js';
import { mountAdminShell, escapeHtml, showToast } from './admin-shell.js';
import { postPathFromAdminPost } from './site.js';
import { analyzeBrokenLinks, findOrphanImages, bulkDelete } from './admin-tools.js';

const $ = sel => document.querySelector(sel);

function makeRow(id, title) {
  return `
    <div class="diagnose-row" data-id="${id}">
      <span class="diagnose-icon pending">…</span>
      <div class="diagnose-info">
        <div class="diagnose-title">${escapeHtml(title)}</div>
        <div class="diagnose-detail">检查中…</div>
      </div>
    </div>
  `;
}

function setRow(id, status, detail) {
  const row = document.querySelector(`.diagnose-row[data-id="${id}"]`);
  if (!row) return;
  const icon = row.querySelector('.diagnose-icon');
  const det = row.querySelector('.diagnose-detail');
  icon.className = 'diagnose-icon ' + status;
  icon.textContent = status === 'ok' ? '✓' : status === 'fail' ? '✕' : status === 'warn' ? '!' : '…';
  det.innerHTML = detail;
}

const checks = [
  { id: 'token', title: isCloudbaseEditorConfigured() ? '是否已登录（管理 session）' : '是否已登录（PAT 存在）' },
  { id: 'user', title: 'GitHub 用户身份' },
  { id: 'whitelist', title: '账号是否在 authorizedUsers 白名单' },
  { id: 'repo', title: `仓库 ${CONFIG.repo.owner}/${CONFIG.repo.name} 是否可访问` },
  { id: 'branch', title: `分支 ${CONFIG.repo.branch} 是否存在` },
  { id: 'contents', title: 'Contents 写权限（是否能写文件）' },
  { id: 'index', title: '索引文件 data/posts.json' },
  { id: 'pages', title: 'GitHub Pages 是否启用' },
];

async function ghAuth(path) {
  if (useCloudEditorProxy()) {
    if (path === '/user') return { ok: true, json: async () => getCurrentUser() };
    throw new Error('CloudBase 模式下请使用代理接口');
  }
  const token = getToken();
  return fetch('https://api.github.com' + path, {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

async function run() {
  $('#list').innerHTML = checks.map(c => makeRow(c.id, c.title)).join('');

  const token = getToken();
  if (!token) {
    setRow('token', 'fail', '未登录。<a href="./" style="color:var(--primary)">前往登录</a>');
    return;
  }
  setRow('token', 'ok', useCloudEditorProxy()
    ? '已通过 CloudBase 短密码登录（session 已建立）'
    : `已登录，token 后 6 位：<code>${escapeHtml(token.slice(-6))}</code>`);

  let userLogin = '';
  try {
    const j = await getCurrentUser();
    userLogin = j.login;
    setRow('user', 'ok', `登录账号：<code>${escapeHtml(j.login)}</code> · ${escapeHtml(j.name || '')}`);
  } catch (e) {
    setRow('user', 'fail', '获取用户信息失败：' + escapeHtml(e.message));
    return;
  }

  const allow = (CONFIG.authorizedUsers || []).map(s => s.toLowerCase());
  if (!allow.length) setRow('whitelist', 'warn', '未配置 authorizedUsers，所有登录账号都可访问后台');
  else if (allow.includes(userLogin.toLowerCase())) setRow('whitelist', 'ok', `已包含 <code>${escapeHtml(userLogin)}</code>`);
  else setRow('whitelist', 'fail', `账号 <code>${escapeHtml(userLogin)}</code> 不在白名单 <code>[${escapeHtml(allow.join(', '))}]</code>`);

  let repoData = null;
  try {
    if (useCloudEditorProxy()) {
      repoData = await ghGetRepo(token);
    } else {
      const r = await ghAuth(`/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}`);
      const j = await r.json();
      if (r.status === 404) {
        setRow('repo', 'fail', `404：仓库不存在或 token 没有访问权限。<br>请检查：<br>1) 仓库名拼写（当前 <code>${escapeHtml(CONFIG.repo.owner)}/${escapeHtml(CONFIG.repo.name)}</code>）<br>2) Token 的 Repository access 是否包含此仓库`);
        return;
      }
      if (!r.ok) throw new Error(j.message || `${r.status}`);
      repoData = j;
    }
    const perm = repoData.permissions || {};
    setRow('repo', 'ok', `<code>${escapeHtml(repoData.full_name)}</code> · ${repoData.private ? '私有' : '公开'} · 默认分支 <code>${escapeHtml(repoData.default_branch)}</code> · push:${perm.push ? '✓' : '✗'}`);
  } catch (e) {
    setRow('repo', 'fail', '检查失败：' + escapeHtml(e.message));
    return;
  }

  try {
    if (useCloudEditorProxy()) {
      await ghGetBranch(token, CONFIG.repo.branch);
      setRow('branch', 'ok', `分支 <code>${escapeHtml(CONFIG.repo.branch)}</code> 存在`);
    } else {
      const r = await ghAuth(`/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/branches/${encodeURIComponent(CONFIG.repo.branch)}`);
      if (r.status === 404) {
        setRow('branch', 'fail', `分支 <code>${escapeHtml(CONFIG.repo.branch)}</code> 不存在。仓库默认分支是 <code>${escapeHtml(repoData.default_branch)}</code>，请改 config.js`);
      } else if (r.ok) {
        setRow('branch', 'ok', `分支 <code>${escapeHtml(CONFIG.repo.branch)}</code> 存在`);
      } else {
        const j = await r.json();
        setRow('branch', 'warn', '检查异常：' + escapeHtml(j.message || r.status));
      }
    }
  } catch (e) {
    if (useCloudEditorProxy() && /404|Not Found/i.test(e.message || '')) {
      setRow('branch', 'fail', `分支 <code>${escapeHtml(CONFIG.repo.branch)}</code> 不存在。仓库默认分支是 <code>${escapeHtml(repoData.default_branch)}</code>，请改 config.js`);
    } else {
      setRow('branch', 'warn', '检查失败：' + escapeHtml(e.message));
    }
  }

  try {
    const probe = `assets/uploads/.diagnose/probe-${Date.now()}.txt`;
    const content = `probe ${new Date().toISOString()}`;
    await writeFile(probe, content, 'diagnose: probe write');
    const got = await readFile(probe);
    if (got?.sha) {
      try { await deleteFile(probe, got.sha, 'diagnose: cleanup probe'); } catch { /* ignore */ }
    }
    setRow('contents', 'ok', useCloudEditorProxy()
      ? 'CloudBase 代理写入成功（GITHUB_PAT 有效）'
      : '可以写入仓库内容（已自动清理诊断文件）');
  } catch (e) {
    const hint = useCloudEditorProxy()
      ? '<br>请检查云函数环境变量 GITHUB_PAT 是否有 Contents 写权限。'
      : '<br>多半是 token 的 Contents 权限不是 Read and write。<a target="_blank" href="https://github.com/settings/tokens?type=beta" style="color:var(--primary)">前往修复</a>';
    setRow('contents', 'fail', '写入失败：' + escapeHtml(e.message) + hint);
  }

  try {
    const idxFile = await readFile(CONFIG.paths.index);
    if (!idxFile) setRow('index', 'warn', `<code>${escapeHtml(CONFIG.paths.index)}</code> 不存在，第一次发布文章时会自动创建`);
    else {
      try {
        const obj = JSON.parse(idxFile.content);
        const cnt = (obj.posts || []).length;
        setRow('index', 'ok', `<code>${escapeHtml(CONFIG.paths.index)}</code> 已存在，包含 ${cnt} 篇文章`);
      } catch {
        setRow('index', 'warn', `<code>${escapeHtml(CONFIG.paths.index)}</code> 不是有效 JSON，建议手动修复`);
      }
    }
  } catch (e) {
    setRow('index', 'warn', '检查失败：' + escapeHtml(e.message));
  }

  try {
    if (useCloudEditorProxy()) {
      setRow('pages', 'warn', 'CloudBase 代理模式：请在 GitHub 仓库 Settings → Pages 确认站点已启用');
    } else {
      const r = await ghAuth(`/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/pages`);
      if (r.status === 404) setRow('pages', 'warn', 'GitHub Pages 尚未启用。仓库 Settings → Pages 中开启');
      else if (r.ok) {
        const j = await r.json();
        setRow('pages', 'ok', `已启用，URL：<a href="${escapeHtml(j.html_url || '')}" target="_blank" style="color:var(--primary)">${escapeHtml(j.html_url || '')}</a> · 状态：${escapeHtml(j.status || 'unknown')}`);
      } else {
        const j = await r.json();
        setRow('pages', 'warn', `${r.status}: ${escapeHtml(j.message || '')}`);
      }
    }
  } catch (e) {
    setRow('pages', 'warn', '检查失败：' + escapeHtml(e.message));
  }
}

function topActions() {
  return `<button class="btn btn-primary" id="rerun">重新检查</button>`;
}

function fmtSize(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function runBrokenLinks() {
  const out = document.getElementById('brokenOut');
  if (!out) return;
  out.innerHTML = '<div class="loading">正在扫描所有 posts/*.md…</div>';
  try {
    const r = await analyzeBrokenLinks();
    if (!r.broken.length) {
      out.innerHTML = `<div class="diagnose-detail">扫描了 ${r.posts} 篇文章，所有内部资源（图片 / 站内链接）都存在。<br>外部链接（${r.externalCount} 个）未做活性检查（前端跨域限制无法判断）。</div>`;
      return;
    }
    out.innerHTML = `
      <div class="diagnose-detail">扫描 ${r.posts} 篇文章，发现 <b>${r.broken.length}</b> 处死链（指向仓库内不存在的文件）：</div>
      <table class="tools-table">
        <thead><tr><th>文章</th><th>引用 URL</th><th>归一化路径</th></tr></thead>
        <tbody>
          ${r.broken.map(b => `
            <tr>
              <td><a href="${postPathFromAdminPost(b)}" target="_blank">${escapeHtml(b.slug)}</a></td>
              <td><code>${escapeHtml(b.url)}</code></td>
              <td><code>${escapeHtml(b.normalized)}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    out.innerHTML = `<div class="error">扫描失败：${escapeHtml(e.message || String(e))}</div>`;
  }
}

async function runOrphanImages() {
  const out = document.getElementById('orphanOut');
  if (!out) return;
  out.innerHTML = '<div class="loading">正在扫描 uploads/ 与所有 markdown 引用…</div>';
  try {
    const r = await findOrphanImages();
    if (!r.orphans.length) {
      out.innerHTML = `<div class="diagnose-detail">仓库里 ${r.total} 张图片，全部都被文章引用，没有孤儿图。</div>`;
      return;
    }
    const totalBytes = r.orphans.reduce((s, x) => s + (x.size || 0), 0);
    out.innerHTML = `
      <div class="diagnose-detail">
        共 ${r.total} 张图片，<b>${r.orphans.length}</b> 张未被任何文章引用（约 ${fmtSize(totalBytes)}）。
        <br><span style="color:var(--text-tertiary);">所选图片会被合并为 <b>1 次 commit</b> 一次性删除。</span>
      </div>
      <div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <label class="settings-check"><input type="checkbox" id="orphanSelectAll"> 全选</label>
        <button class="btn btn-danger" id="orphanDeleteBtn" type="button" disabled>删除选中</button>
        <span class="settings-hint" id="orphanCount"></span>
      </div>
      <table class="tools-table" id="orphanTable">
        <thead><tr><th><span class="sr-only">选</span></th><th>路径</th><th>大小</th><th>预览</th></tr></thead>
        <tbody>
          ${r.orphans.map(o => `
            <tr data-path="${escapeHtml(o.path)}" data-sha="${escapeHtml(o.sha)}">
              <td><input type="checkbox" class="orphan-pick"></td>
              <td><code>${escapeHtml(o.path)}</code></td>
              <td>${fmtSize(o.size)}</td>
              <td><a href="../${escapeHtml(o.path)}" target="_blank">查看</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    const checkboxes = () => out.querySelectorAll('.orphan-pick');
    function updateCount() {
      const selected = [...checkboxes()].filter(x => x.checked).length;
      document.getElementById('orphanCount').textContent = selected ? `已选 ${selected} 项` : '';
      document.getElementById('orphanDeleteBtn').disabled = selected === 0;
    }
    out.querySelector('#orphanSelectAll').addEventListener('change', e => {
      checkboxes().forEach(cb => { cb.checked = e.target.checked; });
      updateCount();
    });
    out.addEventListener('change', e => {
      if (e.target.classList.contains('orphan-pick')) updateCount();
    });
    document.getElementById('orphanDeleteBtn').addEventListener('click', async () => {
      const rows = [...out.querySelectorAll('tbody tr')].filter(tr => tr.querySelector('.orphan-pick').checked);
      if (!rows.length) return;
      const items = rows.map(tr => ({ path: tr.dataset.path, sha: tr.dataset.sha }));
      if (!confirm(`确定删除选中的 ${items.length} 张图片？将合并为 1 次 commit。`)) return;
      const btn = document.getElementById('orphanDeleteBtn');
      btn.disabled = true;
      btn.textContent = `删除中… 准备 ${items.length} 项`;
      try {
        const { done, commit } = await bulkDelete(items, ({ phase }) => {
          if (phase === 'tree') btn.textContent = '删除中… 生成 tree';
          else if (phase === 'commit') btn.textContent = '删除中… 创建 commit';
        });
        btn.textContent = '删除选中';
        showToast(`已删除 ${done} 张孤儿图（commit ${String(commit || '').slice(0, 7)}）`);
      } catch (err) {
        btn.textContent = '删除选中';
        showToast('删除失败：' + (err.message || String(err)), 'error');
      }
      await runOrphanImages();
    });
  } catch (e) {
    out.innerHTML = `<div class="error">扫描失败：${escapeHtml(e.message || String(e))}</div>`;
  }
}

(async function init() {
  const ctx = await mountAdminShell({ active: 'diagnose', title: '系统诊断', actions: topActions() });
  if (!ctx) return;

  ctx.content.innerHTML = `
    <div class="diagnose-list" id="list"></div>

    <section class="diagnose-tool">
      <div class="diagnose-tool-title">
        死链 / 死图自检
        <button class="btn btn-secondary" id="runBroken" type="button">开始扫描</button>
      </div>
      <p class="diagnose-tool-hint">扫描所有文章里指向仓库内但实际不存在的图片 / 文件链接。外部 http 链接因跨域限制不做活性检查。</p>
      <div id="brokenOut"></div>
    </section>

    <section class="diagnose-tool">
      <div class="diagnose-tool-title">
        孤儿图片清理
        <button class="btn btn-secondary" id="runOrphan" type="button">开始扫描</button>
      </div>
      <p class="diagnose-tool-hint">列出 ${escapeHtml(CONFIG.paths.uploads || 'assets/uploads')} 下没有被任何 markdown 引用的图片，可勾选批量删除（合并为 1 次 commit）。</p>
      <div id="orphanOut"></div>
    </section>
  `;
  await run();

  const btn = document.getElementById('rerun');
  if (btn) btn.addEventListener('click', run);
  document.getElementById('runBroken').addEventListener('click', runBrokenLinks);
  document.getElementById('runOrphan').addEventListener('click', runOrphanImages);
})();
