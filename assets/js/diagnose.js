// ============================================================================
// 后台诊断页：逐项检查 token / 仓库 / 分支 / 写权限 / 索引文件 / GitHub Pages
// ============================================================================

import { CONFIG } from './config.js';
import { getToken, getUser } from './auth.js';

const $ = sel => document.querySelector(sel);

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

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
  { id: 'token', title: '是否已登录（PAT 存在）' },
  { id: 'user', title: 'GitHub 用户身份' },
  { id: 'whitelist', title: '账号是否在 authorizedUsers 白名单' },
  { id: 'repo', title: `仓库 ${CONFIG.repo.owner}/${CONFIG.repo.name} 是否可访问` },
  { id: 'branch', title: `分支 ${CONFIG.repo.branch} 是否存在` },
  { id: 'contents', title: 'Contents 写权限（是否能写文件）' },
  { id: 'index', title: '索引文件 data/posts.json' },
  { id: 'pages', title: 'GitHub Pages 是否启用' },
];

async function ghAuth(path) {
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

  // 1. token
  const token = getToken();
  if (!token) {
    setRow('token', 'fail', '没有 token。<a href="./" style="color:var(--primary)">前往登录</a>');
    return;
  }
  setRow('token', 'ok', `已登录，token 后 6 位：<code>${escapeHtml(token.slice(-6))}</code>`);

  // 2. user
  let userLogin = '';
  try {
    const r = await ghAuth('/user');
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || `${r.status}`);
    userLogin = j.login;
    setRow('user', 'ok', `登录账号：<code>${escapeHtml(j.login)}</code> · ${escapeHtml(j.name || '')}`);
  } catch (e) {
    setRow('user', 'fail', '获取用户信息失败：' + escapeHtml(e.message));
    return;
  }

  // 3. whitelist
  const allow = (CONFIG.authorizedUsers || []).map(s => s.toLowerCase());
  if (!allow.length) setRow('whitelist', 'warn', '未配置 authorizedUsers，所有登录账号都可访问后台');
  else if (allow.includes(userLogin.toLowerCase())) setRow('whitelist', 'ok', `已包含 <code>${escapeHtml(userLogin)}</code>`);
  else setRow('whitelist', 'fail', `账号 <code>${escapeHtml(userLogin)}</code> 不在白名单 <code>[${escapeHtml(allow.join(', '))}]</code>`);

  // 4. repo
  let repoData = null;
  try {
    const r = await ghAuth(`/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}`);
    const j = await r.json();
    if (r.status === 404) {
      setRow('repo', 'fail', `404：仓库不存在或 token 没有访问权限。<br>请检查：<br>1) 仓库名拼写（当前 <code>${escapeHtml(CONFIG.repo.owner)}/${escapeHtml(CONFIG.repo.name)}</code>）<br>2) Token 的 Repository access 是否包含此仓库`);
      return;
    }
    if (!r.ok) throw new Error(j.message || `${r.status}`);
    repoData = j;
    const perm = j.permissions || {};
    setRow('repo', 'ok', `<code>${escapeHtml(j.full_name)}</code> · ${j.private ? '私有' : '公开'} · 默认分支 <code>${escapeHtml(j.default_branch)}</code> · push:${perm.push ? '✓' : '✗'}`);
  } catch (e) {
    setRow('repo', 'fail', '检查失败：' + escapeHtml(e.message));
    return;
  }

  // 5. branch
  try {
    const r = await ghAuth(`/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/branches/${encodeURIComponent(CONFIG.repo.branch)}`);
    if (r.status === 404) {
      setRow('branch', 'fail', `分支 <code>${escapeHtml(CONFIG.repo.branch)}</code> 不存在。仓库默认分支是 <code>${escapeHtml(repoData.default_branch)}</code>，请改 config.js`);
    } else if (r.ok) {
      setRow('branch', 'ok', `分支 <code>${escapeHtml(CONFIG.repo.branch)}</code> 存在`);
    } else {
      const j = await r.json();
      setRow('branch', 'warn', '检查异常：' + escapeHtml(j.message || r.status));
    }
  } catch (e) {
    setRow('branch', 'warn', '检查失败：' + escapeHtml(e.message));
  }

  // 6. contents 写权限：发起一次诊断写入再删除
  try {
    const probe = `.diagnose/probe-${Date.now()}.txt`;
    const put = await fetch(`https://api.github.com/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/contents/${probe}`, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        message: 'diagnose: probe write',
        content: btoa('probe ' + new Date().toISOString()),
        branch: CONFIG.repo.branch,
      }),
    });
    const pj = await put.json();
    if (put.ok) {
      // 立即删除
      try {
        await fetch(`https://api.github.com/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/contents/${probe}`, {
          method: 'DELETE',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
          },
          body: JSON.stringify({
            message: 'diagnose: cleanup probe',
            sha: pj.content && pj.content.sha,
            branch: CONFIG.repo.branch,
          }),
        });
      } catch {}
      setRow('contents', 'ok', '可以写入仓库内容（已自动清理诊断文件）');
    } else if (put.status === 403 || put.status === 404) {
      setRow('contents', 'fail', `${put.status} ${escapeHtml(pj.message || '')}<br>多半是 token 的 Contents 权限不是 Read and write。<a target="_blank" href="https://github.com/settings/tokens?type=beta" style="color:var(--primary)">前往修复</a>`);
    } else {
      setRow('contents', 'warn', `${put.status}: ${escapeHtml(pj.message || '')}`);
    }
  } catch (e) {
    setRow('contents', 'warn', '检查失败：' + escapeHtml(e.message));
  }

  // 7. 索引文件
  try {
    const r = await ghAuth(`/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/contents/${encodeURI(CONFIG.paths.index)}?ref=${CONFIG.repo.branch}`);
    if (r.status === 404) setRow('index', 'warn', `<code>${escapeHtml(CONFIG.paths.index)}</code> 不存在，第一次发布文章时会自动创建`);
    else if (r.ok) {
      const j = await r.json();
      const txt = atob((j.content || '').replace(/\s/g, ''));
      try {
        const obj = JSON.parse(decodeURIComponent(escape(txt)));
        const cnt = (obj.posts || []).length;
        setRow('index', 'ok', `<code>${escapeHtml(CONFIG.paths.index)}</code> 已存在，包含 ${cnt} 篇文章`);
      } catch (pe) {
        setRow('index', 'warn', `<code>${escapeHtml(CONFIG.paths.index)}</code> 不是有效 JSON，建议手动修复`);
      }
    } else {
      const j = await r.json();
      setRow('index', 'warn', `${r.status}: ${escapeHtml(j.message || '')}`);
    }
  } catch (e) {
    setRow('index', 'warn', '检查失败：' + escapeHtml(e.message));
  }

  // 8. Pages
  try {
    const r = await ghAuth(`/repos/${CONFIG.repo.owner}/${CONFIG.repo.name}/pages`);
    if (r.status === 404) setRow('pages', 'warn', 'GitHub Pages 尚未启用。仓库 Settings → Pages 中开启');
    else if (r.ok) {
      const j = await r.json();
      setRow('pages', 'ok', `已启用，URL：<a href="${escapeHtml(j.html_url || '')}" target="_blank" style="color:var(--primary)">${escapeHtml(j.html_url || '')}</a> · 状态：${escapeHtml(j.status || 'unknown')}`);
    } else {
      const j = await r.json();
      setRow('pages', 'warn', `${r.status}: ${escapeHtml(j.message || '')}`);
    }
  } catch (e) {
    setRow('pages', 'warn', '检查失败：' + escapeHtml(e.message));
  }
}

(function init() {
  if (!getToken()) {
    document.getElementById('list').innerHTML = '<div class="empty">尚未登录。<a href="./" style="color:var(--primary)">前往登录</a></div>';
    return;
  }
  run();
  document.getElementById('rerun').addEventListener('click', run);
})();
