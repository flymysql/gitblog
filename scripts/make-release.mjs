// ============================================================================
// scripts/make-release.mjs
//
// 在仓库外建立一个 git worktree（默认 ../gitblog-release/），把它清理为一份
// 「干净的博客模板」并提交到 release 分支。其他人 fork 仓库后切到 release 分支
// 即可得到一份没有任何文章 / 上传 / 站点配置 的初始模板。
//
// 用法：
//   node scripts/make-release.mjs              # 在 ../gitblog-release/ 生成 release 分支（不 push）
//   node scripts/make-release.mjs --push       # 生成并 push 到 origin/release（force-with-lease）
//   node scripts/make-release.mjs --dir ../foo # 指定 worktree 目录
// ============================================================================

import { execSync } from 'node:child_process';
import {
  rmSync, mkdirSync, readdirSync, statSync, writeFileSync,
  copyFileSync, existsSync, readFileSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const valueOf = (k) => {
  const i = args.indexOf(k);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

const PUSH = flag('--push');
const TARGET_DIR = resolve(REPO_ROOT, valueOf('--dir') || '../gitblog-release');
const BRANCH = valueOf('--branch') || 'release';

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: opts.stdio || 'inherit',
    cwd: opts.cwd || REPO_ROOT,
    encoding: 'utf8',
    ...opts,
  });
}
function shOut(cmd, opts = {}) {
  return sh(cmd, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function step(msg) { console.log(`\n▸ ${msg}`); }

// -------- 0. 预检查 --------
step('预检查');
try { shOut('git rev-parse --is-inside-work-tree'); } catch {
  console.error('当前目录不是 git 仓库，请先 git init / git clone。');
  process.exit(1);
}
const dirty = shOut('git status --porcelain');
if (dirty) {
  if (flag('--allow-dirty')) {
    console.warn('⚠ 工作树有未提交改动，但已通过 --allow-dirty 强制运行。');
    console.warn('  注意：release worktree 看的是 HEAD commit，未提交的改动不会进入 release 分支。');
    console.warn(dirty);
  } else {
    console.error('工作树有未提交改动，先 commit / stash 再运行（或加 --allow-dirty）：');
    console.error(dirty);
    process.exit(1);
  }
}
const headSha = shOut('git rev-parse --short HEAD');
const sourceBranch = shOut('git rev-parse --abbrev-ref HEAD');
console.log(`源分支：${sourceBranch} @ ${headSha}`);
console.log(`目标 worktree：${TARGET_DIR}`);
console.log(`目标分支：${BRANCH}`);

// -------- 1. 准备 worktree --------
step('准备 worktree');
// 如果已有 worktree 在该路径，先 remove
const wts = shOut('git worktree list --porcelain');
if (wts.includes(`worktree ${TARGET_DIR.replace(/\\/g, '/')}`)
    || wts.includes(`worktree ${TARGET_DIR}`)) {
  console.log('  发现已有 worktree，先 remove');
  try { sh(`git worktree remove "${TARGET_DIR}" --force`); } catch {}
}
if (existsSync(TARGET_DIR)) rmSync(TARGET_DIR, { recursive: true, force: true });

// 创建 / 重置分支：基于当前 HEAD 强制建一个 release 分支
sh(`git worktree add -B ${BRANCH} "${TARGET_DIR}" HEAD`);

// -------- 2. 清理 posts/ 只留模板 welcome --------
step('清理 posts/');
const POSTS = join(TARGET_DIR, 'posts');
if (existsSync(POSTS)) {
  for (const f of readdirSync(POSTS)) {
    rmSync(join(POSTS, f), { force: true });
  }
} else {
  mkdirSync(POSTS, { recursive: true });
}
const tmplWelcome = join(REPO_ROOT, 'scripts/release-template/welcome.md');
copyFileSync(tmplWelcome, join(POSTS, 'welcome.md'));
console.log('  已写入 posts/welcome.md（模板）');

// -------- 3. 清空 assets/uploads / assets/og --------
step('清空 assets/uploads / assets/og');
function emptyDirKeep(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.gitkeep'), '');
}
emptyDirKeep(join(TARGET_DIR, 'assets/uploads'));
emptyDirKeep(join(TARGET_DIR, 'assets/og'));

// -------- 4. 重置 config.js / posts.json / sitemap.xml / rss.xml --------
step('重置 config.js / posts.json / sitemap.xml / rss.xml');
copyFileSync(
  join(REPO_ROOT, 'scripts/release-template/config.js'),
  join(TARGET_DIR, 'assets/js/config.js'),
);
writeFileSync(
  join(TARGET_DIR, 'data/posts.json'),
  JSON.stringify({ posts: [] }, null, 2) + '\n',
);
// sitemap / rss 由 build 重新生成，先占位写空
writeFileSync(join(TARGET_DIR, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`);
writeFileSync(join(TARGET_DIR, 'rss.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>placeholder</title></channel></rss>\n`);

// -------- 5. 在 worktree 里跑 build，生成基于模板的 posts.json / sitemap / rss / OG --------
step('在 worktree 里跑 build');
try {
  sh('node scripts/build.mjs', { cwd: TARGET_DIR });
} catch (e) {
  console.warn('  build.mjs 跑失败（可忽略，部署后 Action 会再跑一次）：', e?.message);
}

// -------- 6. 删除任何不该出现在模板里的文件（开发杂物）--------
step('删除杂物');
const IGNORE_PATTERNS = [
  '.release-staging', '.cache', 'node_modules',
  // 开发中临时残留
  'scripts/_run.log', 'scripts/_bump.mjs',
];
for (const p of IGNORE_PATTERNS) {
  const t = join(TARGET_DIR, p);
  if (existsSync(t)) rmSync(t, { recursive: true, force: true });
}

// -------- 7. commit --------
step('commit');
sh('git add -A', { cwd: TARGET_DIR });
const hasChanges = shOut('git status --porcelain', { cwd: TARGET_DIR });
if (!hasChanges) {
  console.log('  release 分支与 main 没差异，跳过 commit');
} else {
  const msg = `release: clean template based on ${sourceBranch}@${headSha}`;
  sh(`git commit -m "${msg}"`, { cwd: TARGET_DIR });
}

// -------- 8.（可选）push --------
if (PUSH) {
  step('push origin release');
  sh(`git push --force-with-lease origin ${BRANCH}`, { cwd: TARGET_DIR });
}

console.log(`\n✓ 完成。release 工作树位于：\n  ${TARGET_DIR}\n`);
console.log(`  - 切换查看：cd "${TARGET_DIR}" && git log --oneline -5`);
console.log(`  - 推到远端：node scripts/make-release.mjs --push`);
console.log(`  - 删除工作树：git worktree remove "${TARGET_DIR}"`);
