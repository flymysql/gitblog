// ============================================================================
// 后台运维工具：死链 / 死图自检 + 孤儿图片清理
// 关键：用 GitHub Git Trees API（recursive=1）一次拿到整棵树，避免反复 listDir
// ============================================================================

import { CONFIG } from './config.js';
import { getToken } from './auth.js';
import { readFile, fetchPostMarkdownPublic } from './api.js';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

async function gh(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch('https://api.github.com' + path, init);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const e = new Error((data && data.message) || res.statusText || `${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

export async function fetchRepoTree() {
  const { owner, name, branch } = CONFIG.repo;
  // 取分支 commit 上的 root tree sha，再 recursive=1 拿整棵树
  const refData = await gh(`/repos/${owner}/${name}/branches/${encodeURIComponent(branch)}`);
  const treeSha = refData.commit && refData.commit.commit && refData.commit.commit.tree && refData.commit.commit.tree.sha;
  if (!treeSha) throw new Error('无法解析仓库 tree sha');
  const tree = await gh(`/repos/${owner}/${name}/git/trees/${treeSha}?recursive=1`);
  return Array.isArray(tree.tree) ? tree.tree : [];
}

// 从 markdown 文本里提取所有 url（图片 + 链接 + html src/href）
function extractUrls(md) {
  const urls = new Set();
  const collect = (re, group = 1) => {
    let m;
    while ((m = re.exec(md))) urls.add(m[group]);
  };
  collect(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]+)?\)/g);   // ![alt](url)
  collect(/(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]+)?\)/g); // [text](url)
  collect(/<img\s+[^>]*src\s*=\s*["']([^"']+)["']/gi);
  collect(/<a\s+[^>]*href\s*=\s*["']([^"']+)["']/gi);
  return [...urls];
}

// frontmatter cover 也要算引用
function extractFrontmatterRefs(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return [];
  const out = [];
  const cover = m[1].match(/^cover\s*:\s*(.+)$/m);
  if (cover) out.push(cover[1].trim().replace(/^['"]|['"]$/g, ''));
  return out;
}

// 把 url 归一为：相对仓库根目录的路径（与 tree.path 对得上）
// 例如：
//   "../assets/uploads/2026/05/x.png"  → "assets/uploads/2026/05/x.png"
//   "/gitblog/assets/uploads/x.png"    → "assets/uploads/x.png"
//   "assets/uploads/x.png"             → "assets/uploads/x.png"
//   外部 http 链接 → 返回 { external: true, url }
export function normalizeUrl(url) {
  if (!url) return null;
  url = String(url).trim();
  if (!url) return null;
  if (url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(url)) {
    // 同站绝对 URL：截到 path
    try {
      const u = new URL(url);
      const siteUrl = CONFIG.site && CONFIG.site.url;
      if (siteUrl) {
        const su = new URL(siteUrl);
        if (u.host === su.host) {
          let path = u.pathname.replace(/^\/+/, '');
          // 把站点前缀 /gitblog 去掉
          const prefix = su.pathname.replace(/^\/+|\/+$/g, '');
          if (prefix && path.startsWith(prefix + '/')) path = path.slice(prefix.length + 1);
          return { internal: true, path: decodeURIComponent(path), raw: url };
        }
      }
      return { external: true, url };
    } catch {
      return { external: true, url };
    }
  }
  // 站内相对：剥掉前导的 ./ 和 ../
  let path = url.replace(/^\.?\/+/, '').replace(/^(\.\.\/)+/, '');
  // 站内绝对（/gitblog/...）
  if (url.startsWith('/')) {
    let p = url.replace(/^\/+/, '');
    const siteUrl = CONFIG.site && CONFIG.site.url;
    if (siteUrl) {
      try {
        const su = new URL(siteUrl);
        const prefix = su.pathname.replace(/^\/+|\/+$/g, '');
        if (prefix && p.startsWith(prefix + '/')) p = p.slice(prefix.length + 1);
      } catch {}
    }
    path = decodeURIComponent(p);
  } else {
    path = decodeURIComponent(path);
  }
  if (!path) return null;
  // 去掉 query / hash
  path = path.split('?')[0].split('#')[0];
  return { internal: true, path, raw: url };
}

// 扫描所有 posts/*.md，返回引用 + 死链结果
export async function analyzeBrokenLinks() {
  const tree = await fetchRepoTree();
  const allPaths = new Set(tree.filter(t => t.type === 'blob').map(t => t.path));
  const mdFiles = tree.filter(t => t.type === 'blob' && t.path.startsWith(CONFIG.paths.posts + '/') && t.path.endsWith('.md'));

  const broken = [];
  const externalSeen = new Set();
  for (const f of mdFiles) {
    const slug = f.path.split('/').pop().replace(/\.md$/, '');
    let raw;
    try { raw = await fetchPostMarkdownPublic(slug); } catch (e) { continue; }
    const refs = [...extractUrls(raw), ...extractFrontmatterRefs(raw)];
    for (const r of refs) {
      const n = normalizeUrl(r);
      if (!n) continue;
      if (n.external) {
        externalSeen.add(n.url);
        continue;
      }
      if (!allPaths.has(n.path)) {
        broken.push({ slug, postPath: f.path, url: r, normalized: n.path });
      }
    }
  }
  return {
    posts: mdFiles.length,
    broken,
    externalCount: externalSeen.size,
  };
}

// 找出 assets/uploads/** 中没有被任何 markdown 引用的图片
export async function findOrphanImages() {
  const tree = await fetchRepoTree();
  const uploadsRoot = (CONFIG.paths.uploads || 'assets/uploads').replace(/\/+$/, '') + '/';
  const images = tree.filter(t =>
    t.type === 'blob' &&
    t.path.startsWith(uploadsRoot) &&
    IMAGE_EXT.test(t.path)
  );
  const mdFiles = tree.filter(t => t.type === 'blob' && t.path.startsWith(CONFIG.paths.posts + '/') && t.path.endsWith('.md'));

  const used = new Set();
  for (const f of mdFiles) {
    const slug = f.path.split('/').pop().replace(/\.md$/, '');
    let raw;
    try { raw = await fetchPostMarkdownPublic(slug); } catch { continue; }
    const refs = [...extractUrls(raw), ...extractFrontmatterRefs(raw)];
    for (const r of refs) {
      const n = normalizeUrl(r);
      if (n && n.internal) used.add(n.path);
    }
  }
  // 也认为 frontmatter 里的 cover 字段（在索引里）算引用：保险起见再读一次 posts.json
  try {
    const idxFile = await readFile(CONFIG.paths.index);
    if (idxFile) {
      const idx = JSON.parse(idxFile.content);
      for (const p of (idx.posts || [])) {
        if (p.cover) {
          const n = normalizeUrl(p.cover);
          if (n && n.internal) used.add(n.path);
        }
      }
    }
  } catch {}

  const orphans = images.filter(img => !used.has(img.path));
  return {
    total: images.length,
    used: used.size,
    orphans: orphans.map(o => ({ path: o.path, sha: o.sha, size: o.size || 0 })),
  };
}

// 批量删除：合并为 1 次 commit
// 走 Git Data API（git/trees + git/commits + git/refs），一次清掉一批文件
//   1. 取分支当前 commit / base tree
//   2. 基于 base tree 创建一棵新 tree，把要删的 path 标记为 sha:null
//   3. 用新 tree 创建新 commit
//   4. 把分支 ref 指到新 commit
// 几十张图也只产生 1 个 commit，比 Contents API 一图一 commit 快得多
export async function bulkDelete(items, onProgress) {
  if (!items.length) return { done: 0, failed: [], commit: null };
  const { owner, name, branch } = CONFIG.repo;

  onProgress && onProgress({ phase: 'tree', total: items.length });

  const branchData = await gh(`/repos/${owner}/${name}/branches/${encodeURIComponent(branch)}`);
  const parentCommitSha = branchData && branchData.commit && branchData.commit.sha;
  const baseTreeSha = branchData && branchData.commit && branchData.commit.commit && branchData.commit.commit.tree && branchData.commit.commit.tree.sha;
  if (!parentCommitSha || !baseTreeSha) throw new Error('无法解析仓库 branch / tree sha');

  const treeEntries = items.map(it => ({
    path: it.path,
    mode: '100644',
    type: 'blob',
    sha: null,
  }));
  const newTree = await gh(`/repos/${owner}/${name}/git/trees`, {
    method: 'POST',
    body: { base_tree: baseTreeSha, tree: treeEntries },
  });

  onProgress && onProgress({ phase: 'commit', total: items.length });

  const summary = items.length === 1
    ? `cleanup: 删除孤儿图 ${items[0].path.split('/').pop()}`
    : `cleanup: 批量删除 ${items.length} 张孤儿图`;
  const newCommit = await gh(`/repos/${owner}/${name}/git/commits`, {
    method: 'POST',
    body: { message: summary, tree: newTree.sha, parents: [parentCommitSha] },
  });

  await gh(`/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: { sha: newCommit.sha },
  });

  onProgress && onProgress({ phase: 'done', total: items.length });
  return { done: items.length, failed: [], commit: newCommit.sha };
}
