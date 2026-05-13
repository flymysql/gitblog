# GitHub Pages 静态博客 · 在线伪后台

完全静态、托管在 GitHub Pages，但带一个**纯前端的"伪后台"**：在浏览器里写文章、拖拽上传图片、改站点设置，"发布"按钮一点就把 Markdown 直接 commit 到仓库，触发 Pages 自动重新部署。

**没有任何后端服务、没有 OAuth、没有数据库。** 鉴权直接用 GitHub Fine-grained Personal Access Token，调用 GitHub Contents / Repos API 完成所有操作。

[在线 Demo](https://flymysql.github.io/gitblog) · [项目欢迎页](https://flymysql.github.io/gitblog/post/welcome/) · [关于页](https://flymysql.github.io/gitblog/post/about/)

---

## 功能一览

### 读者侧

- **首页**：Hero 个人介绍 + 文章列表（懒加载分页）+ 标签云 + 最近更新 + 简书风轮播
- **文章页**：自动 TOC 目录、阅读进度条、回到顶部、代码一键复制、标题悬停锚点、图片懒加载 + 灯箱、上一篇 / 下一篇、相关文章（按 tag）、阅读时间估算
- **导航与检索**：标签聚合页（**彩色标签**，自动按字符 hash 上色）、按年月归档、站内搜索（顶部按钮 / `Ctrl + K` / `/`）
- **主题系统**：浅色 / 深色 / 跟随系统三态切换，**4 套预设**（jianshu / github / solarized / monokai）可一键切换；管理员可在后台配置色板、自定义 CSS、是否允许读者切换预设
- **评论**：基于 [giscus](https://giscus.app)（GitHub Discussions），**默认 `mapping: specific`**，每篇文章按 slug 独立绑定一条 Discussion
- **SEO / 分享**：自动 RSS、sitemap、Open Graph / Twitter Card meta、canonical、JSON-LD 结构化数据、自动生成 OG 分享图（SVG，1200×630）、PWA manifest、robots.txt
- **性能**：图片**真懒加载**（IntersectionObserver，进入视口前 300px 才注入 src，1×1 SVG 占位防抖）、首屏图 `fetchpriority=high` 优化 LCP、缓存版本号控制
- **移动端**：响应式排版，文章页图片 / 表格 / iframe 自动适应视口（公众号迁移文章里那些 `width=600` / `<section style="width:..."` 都会被运行时清掉）

### 写作侧（伪后台）

- **登录**：粘贴 GitHub Fine-grained PAT（或 GitHub Device Flow），存在 `localStorage`，无后端
- **编辑器**：[EasyMDE](https://easymde.tk/)，工具栏、快捷键、实时预览、`Ctrl + S` 一键发布
- **图片上传**：拖拽 / 粘贴上传到 `assets/uploads/yyyy/mm/`，自动写入 Markdown 链接
- **图片库**：浏览所有上传过的图片，复制地址 / 一键插入 / 删除
- **可视化标签输入**：编辑器里标签是从已有标签里选 / 输入新值，不用记住有哪些标签
- **草稿 / 置顶 / 独立页面**：
  - `draft: true` 不进首页 / 索引 / RSS / sitemap
  - `pinned: true` + `pinnedOrder: N` 在首页置顶（数字小的在前）
  - `page: true` 是关于页 / 友链页这种**独立页面**：不进文章流，但仍有 SEO / sitemap / OG 图
- **文章管理**：全部 / 已发布 / 草稿三 tab，搜索、删除、跳转编辑
- **站点设置**：在线修改 `assets/js/config.js` 全部字段——站点名、头像、Logo、favicon、导航（可视化拖拽编辑）、社交链接、giscus、analytics、路径、主题
- **主题色板编辑**：在后台拖色板调整每个 token，可注入自定义 CSS
- **发布前校验**：标题 / 摘要 / slug / 标签缺失会拦截
- **版本冲突**：远端文章已变更时自动提示重新加载，避免覆盖
- **一键诊断页**：检查 token / 仓库 / 写权限 / 分支 / `posts.json` 索引 / Pages 部署状态

### 自动化

- **GitHub Actions**：push 后自动重建 `data/posts.json` / `sitemap.xml` / `rss.xml` / `assets/og/*.svg` / `manifest.webmanifest` / `robots.txt`
- **frontmatter 校验**：缺 `title` / `date` 会在 Action 输出 warning
- **缓存版本号**：所有 HTML 引用 CSS/JS 时带 `?v=YYYYMMDD`，跟 `config.js` 的 `VERSION` 同步

### 文章迁移工具

`scripts/` 下的几个迁移脚本帮你把老博客一次性搬过来，自带图片下载、HTML→Markdown、智能取封面：

| 脚本 | 用途 |
| -- | -- |
| `npm run migrate:cnblogs` | 从 cnblogs.com/<user> 抓取并迁移所有文章 |
| `npm run migrate:hexo` | 从 hexo 站归档页抓取并迁移所有文章 |
| `npm run fix:hexo-codeblocks` | 修复早期 hexo 迁移中 `<table class="code">` 形式的代码块 |
| `npm run normalize` | 标签合并 + 自动选封面（按 SHA1 内容哈希区分共享装饰图与正文图） |
| `npm run strip:wechat` | 公众号文章清洗：剥离推广文案、装饰图、空内容自动转草稿 |
| `npm run build` | 重建 `posts.json` / `sitemap.xml` / `rss.xml` / OG 图 |

---

## 目录结构

```
blog/
├── index.html / post.html / tags.html / archives.html / 404.html
├── admin/
│   ├── index.html        # 登录 + 文章管理
│   ├── editor.html       # Markdown 编辑器
│   ├── settings.html     # 站点设置（含主题 / 导航 / giscus / analytics）
│   ├── images.html       # 图片库
│   └── diagnose.html     # 一键诊断
├── assets/
│   ├── css/              # common(主题预设) / home / post / admin
│   ├── js/               # 各页面入口 + site / theme / seo / api / auth / markdown / config
│   ├── uploads/          # 图片上传目录（按 yyyy/mm 自动归类）
│   └── og/               # 自动生成的分享图（SVG）
├── data/posts.json       # 文章索引（Action 自动生成）
├── posts/                # Markdown 源（含 about.md 等 page 页）
├── scripts/              # 构建 / 迁移 / 修复脚本
├── .github/workflows/    # GitHub Actions（自动构建）
├── sitemap.xml / rss.xml / robots.txt / manifest.webmanifest
├── package.json          # Node 脚本
└── README.md
```

---

## 部署 · 五步上线

> **如果你只是想用这套博客模板，不想克隆我现有的所有文章，请直接基于 [`release` 分支](https://github.com/flymysql/gitblog/tree/release) 起步。**
>
> `release` 分支是一份**干净模板**：没有任何已发布的文章、没有上传的图、`config.js` 全部是占位符——你 fork 后立即就是一个空白站点，可以直接开始写自己的内容。
>
> ```bash
> # 方式 1：clone release 分支（推荐）
> git clone -b release https://github.com/flymysql/gitblog.git my-blog
> cd my-blog
> git remote set-url origin https://github.com/<your-username>/<repo>.git
> git checkout -b main         # 把 release 内容作为你自己的 main 起点
> git push -u origin main
>
> # 方式 2：fork 后切到 release 分支，再合并到自己的 main
> ```

### 1. Fork 或克隆推到自己仓库

```bash
git clone <your-fork>
cd <your-fork>
git push -u origin main
```

### 2. 启用 GitHub Pages

仓库 → Settings → Pages → Source: `Deploy from a branch`，分支 `main`，目录 `/`，保存。

### 3. 修改 `assets/js/config.js`

至少改这几项：

```js
repo: { owner: "<your-username>", name: "<your-repo>", branch: "main" },
authorizedUsers: ["<your-username>"],   // 只允许你自己的账号登录后台
site: {
  title: "...",
  author: "...",
  url: "https://<your-username>.github.io/<your-repo>",  // 末尾不要 /
  ...
},
```

> 之后所有配置都可以在 `/admin/settings.html` 在线编辑，会自动 commit 回仓库。

### 4. 生成 Fine-grained PAT

[Fine-grained Token 创建页](https://github.com/settings/personal-access-tokens/new)：

- **Repository access**：`Only select repositories` → 勾选你的博客仓库
- **Repository permissions**：
  - **Contents**：`Read and write`
  - Metadata：`Read-only`（自动）
  - 其他都保持 `No access`
- 设过期时间，复制 token（**只显示一次**）

### 5. 登录后台

访问 `https://<your-username>.github.io/<repo>/admin/`，粘贴 token，登录。之后写、改、上图、改设置都在浏览器里完成。

如果哪一步报错，进 `/admin/diagnose.html`，按提示修复。

### 6. （可选）开评论

仓库里启用 **Discussions** → 去 [giscus.app](https://giscus.app) 完成配置（需选 Discussion category），把 `repo / repoId / category / categoryId` 填回 `admin/settings.html` 的 giscus 段，`enabled: true`。

> **`mapping` 字段推荐填 `specific`**（每篇文章按 slug 独立绑定一条 Discussion）。
> ⚠ **不要填 `pathname` 或 `url`**：本站所有文章 URL 路径都是 `/post.html`（只是 query 不同，giscus 不读 query），那两种模式会让所有文章共用同一条评论流。

---

## 文章 frontmatter 约定

```yaml
---
title: 文章标题
date: 2026-05-11T10:00:00+08:00          # ISO 时间
updated: 2026-05-11T10:00:00+08:00       # 可选，默认与 date 相同
author: 作者名                            # 可选
tags:                                    # 可选
  - 标签1
  - 标签2
summary: 一句话摘要，用于列表 / OG meta / RSS 描述
cover: assets/uploads/2026/05/cover.png  # 可选
draft: false                             # 草稿
pinned: false                            # 首页置顶
pinnedOrder: 1                           # 置顶顺序，数字小的在前
page: false                              # 独立页面（关于 / 友链）：不进文章流但有 SEO
---

正文 Markdown…
```

---

## 工作流程

```
浏览器：写文章 → 点发布 (或 Ctrl+S)
   ↓ GitHub Contents API (PUT)
GitHub 仓库：commit posts/<slug>.md + 更新 data/posts.json
   ↓ push 触发
GitHub Actions：重建 sitemap.xml / rss.xml / OG 图 / robots.txt / manifest
   ↓ 自动 commit
GitHub Pages：重新部署
   ↓ ~30s
线上博客更新
```

---

## 安全说明

- `assets/js/config.js` 是公开的，**只放公开信息**（仓库名、站点名、giscus 配置等）。**绝对不要把 token 写进任何源码文件。**
- token 只放在浏览器 `localStorage` / `sessionStorage`，可以选"记住登录"。
- 用 fine-grained PAT、最小权限（`Contents: Read and write`）、设置过期时间。
- `config.authorizedUsers` 限制后台只允许哪些 GitHub 用户登录（即使别人有 PAT 也进不来）。
- 一旦怀疑泄露，去 [Token 设置页](https://github.com/settings/tokens?type=beta) 一键 revoke，立即失效。

---

## 常见问题

**Q. 登录后无法发布（404 / 403）**：去 `/admin/diagnose.html`，会逐项检查 token / 仓库 / 写权限 / 分支，对应错误码会给修复建议。

**Q. 改了 CSS / JS 但浏览器还在用旧版**：所有 HTML 引用资源都带 `?v=YYYYMMDD`，跟 `assets/js/config.js` 的 `VERSION` 一致。新版本只需改 `VERSION` 并更新 HTML 里的 `v=` 即可让所有 CDN / 浏览器缓存失效。

**Q. GitHub Action 没自动跑**：仓库 → Settings → Actions → General → Workflow permissions，勾选 `Read and write permissions`，并允许 PR。

**Q. giscus 不显示评论 / 所有文章评论看起来一样**：检查仓库是否启用 Discussions，`repoId / categoryId` 是否对；如果是"所有文章评论一样"，说明 mapping 用了 `pathname` 或 `url`，改成 `specific` 即可。

**Q. 移动端文章右边被截断**：旧版 CSS 的 `:has()` 规则在移动端覆盖了媒体查询，已修复（`v=20260522` 起）。如果你 fork 的版本旧，把 `assets/css/post.css` 的 `:has(.toc-sidebar[hidden])` 那条规则包到 `@media (min-width: 981px)` 里。

**Q. 公众号 / 老 hexo 迁移过来的文章排版乱**：用 `npm run strip:wechat`（剥离推广 / 装饰图）、`npm run fix:hexo-codeblocks`（修代码块）、`npm run normalize`（合标签 / 选封面）。脚本都做了幂等，可以反复跑。

---

## 维护者：如何更新 release 模板

`release` 分支不是手工维护的，而是从 main 自动派生的"干净模板"。当 main 上有新功能 / 修复，跑一次 release 脚本就能基于最新 main 重建：

```bash
# 干跑（产物在 ../gitblog-release/，不会推到远端）
npm run release

# 验证 OK 后推送
npm run release:push
```

脚本会做这些事：

- 在仓库外（默认 `../gitblog-release/`）建一个 `git worktree`，分支为 `release`
- 删除所有 `posts/*.md`，写入一份"刚 fork 完"风格的 `welcome.md` 模板
- 清空 `assets/uploads/`、`assets/og/`，留 `.gitkeep`
- 重置 `assets/js/config.js` 为占位模板（owner / repo / authorizedUsers / site.url 全是 `YOUR_USERNAME`）
- 重置 `data/posts.json`，跑一遍 `build` 重建 `sitemap.xml` / `rss.xml` / OG 图
- commit `release: clean template based on main@<sha>`
- 加 `--push` 时自动 `git push --force-with-lease origin release`

模板内容在 `scripts/release-template/`（welcome.md / config.js）下，可以按需调整。

## 致谢与说明

UI 风格受简书启发，**不复制其品牌 / logo**。本项目仅作为个人博客方案与开源参考；如果你也搭了一个，欢迎在 issue 里交流。
