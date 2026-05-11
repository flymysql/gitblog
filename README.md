# GitHub Pages 静态博客 · 在线后台编辑

完全静态、托管在 GitHub Pages，但带一个**在线后台**：在浏览器里写文章，发布按钮一点就把 Markdown 文件 commit 到仓库，触发 Pages 自动重新部署。**没有任何后端服务**，使用 GitHub Personal Access Token 直接调用 GitHub API。

## 功能一览

读者侧：

- 简洁的首页（Hero + 文章列表 + 标签云 + 最近更新）
- 文章阅读页支持 TOC 目录、giscus 评论、封面、Open Graph / Twitter Card
- 标签聚合页 `/tags.html`、归档页 `/archives.html`
- 站内搜索（顶部按钮 / `Ctrl+K` / `/`）
- 浅色 / 深色 / 跟随系统三态主题
- RSS（`rss.xml`）+ sitemap（`sitemap.xml`）

后台侧：

- GitHub PAT 登录（无后端、无 OAuth）
- 文章管理：全部 / 已发布 / 草稿三 tab，搜索、删除
- 站点设置：在线修改 `config.js`（站点名、头像、Logo、favicon、导航、社交链接、giscus、路径、主题等）
- Markdown 编辑器（EasyMDE）：工具栏、快捷键、实时预览
- 拖拽 / 粘贴 上传图片（自动写入 `assets/uploads/yyyy/mm/`）
- 草稿模式（`draft: true` 不进首页）
- 置顶（`pinned: true` 在首页置顶）
- 发布前校验（标题/正文/slug/标签/摘要）
- `Ctrl+S` 一键发布
- 版本冲突自动重新加载
- 一键诊断页：检查 token / 仓库 / 分支 / 写权限 / 索引文件 / Pages

运维：

- GitHub Actions 自动重新生成 `data/posts.json` / `sitemap.xml` / `rss.xml`
- 校验 Markdown frontmatter
- 所有 HTML 静态资源带版本号缓存破坏

## 目录结构

```
blog/
├── index.html / post.html / tags.html / archives.html
├── admin/
│   ├── index.html        # 登录 + 文章管理
│   ├── editor.html       # Markdown 编辑器
│   ├── settings.html     # 站点设置
│   └── diagnose.html     # 一键诊断
├── assets/
│   ├── css/              # common / home / post / admin
│   └── js/               # 各页面入口 + site / theme / seo / api / auth / markdown
├── data/posts.json       # 文章索引（Action 自动生成）
├── posts/                # Markdown 源
├── assets/uploads/       # 图片上传目录（按 yyyy/mm 自动归类）
├── scripts/build.mjs     # sitemap / rss / posts.json 生成器
├── .github/workflows/build.yml  # 自动构建
├── sitemap.xml / rss.xml
└── README.md
```

## 部署

### 1. 推到 GitHub 并启用 Pages

```bash
git init
git add .
git commit -m "init blog"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```

仓库 → Settings → Pages → Source: `Deploy from a branch`，分支 `main` 根目录。

### 2. 修改 `assets/js/config.js`

首次部署前可以手动修改 `assets/js/config.js`。部署完成后，也可以在后台 `/admin/settings.html` 在线修改这些配置，并自动提交到 GitHub 仓库。

可在线配置的内容包括：

- 仓库信息：`owner / name / branch`
- 站点信息：名称、副标题、作者、描述、站点 URL、头像、Logo、favicon
- 导航：顶部导航 JSON
- 社交链接：GitHub / Twitter / Email / RSS
- giscus 评论配置
- 文章目录、索引文件、上传目录
- 默认主题：浅色 / 深色 / 跟随系统

`site.url` 写你 Pages 站点地址，例如 `https://flymysql.github.io/gitblog`，**末尾不要 `/`**。SEO 元数据、sitemap、rss 都会用到。

### 3. 生成 PAT

[Fine-grained Token](https://github.com/settings/personal-access-tokens/new)：

- Repository access：`Only select repositories` → 勾选你的博客仓库
- Repository permissions：
  - **Contents**: `Read and write`
  - Metadata: `Read-only`（自动）
- 其他 `No access`

### 4. 登录后台

访问 `https://<your-username>.github.io/<repo>/admin/`，粘贴 token 登录。

如果遇到问题，去 `/admin/diagnose.html` 一键诊断。

### 5. （可选）配置 giscus 评论

去 [giscus.app](https://giscus.app) 完成配置（需要先在 GitHub 仓库启用 Discussions），把 `repo / repoId / category / categoryId` 填回 `config.js` 的 `giscus` 段，并设 `enabled: true`。

## 文章格式

```markdown
---
title: 文章标题
date: 2026-05-11T10:00:00.000Z
updated: 2026-05-11T10:00:00.000Z
author: 作者名
tags: [标签1, 标签2]
summary: 摘要，会出现在列表和 OG meta 中
cover: https://example.com/cover.jpg
draft: false
pinned: false
---

正文 Markdown…
```

## 工作流程

```
浏览器：写文章 → 点发布
   ↓ GitHub Contents API
GitHub 仓库：commit posts/<slug>.md + 更新 data/posts.json
   ↓ push 触发
GitHub Actions：重新生成 sitemap.xml / rss.xml / posts.json
   ↓ 自动 commit
GitHub Pages：重新部署
   ↓
线上博客更新
```

## 安全说明

- `config.js` 是公开的，只放公开信息
- token 只放浏览器 `localStorage` 或 `sessionStorage`
- 使用 fine-grained PAT、最小权限、设置过期
- 一旦怀疑泄露，[Token 设置页](https://github.com/settings/tokens?type=beta) 一键 revoke

## 常见问题

**A. 登录后无法发布（404 / 403）**：去 `/admin/diagnose.html`，按提示修复。

**B. 缓存导致改动不生效**：所有 HTML 引用 CSS/JS 时带 `?v=20260511`。需要时把这个值改一下。

**C. Action 没自动跑**：仓库 → Settings → Actions → General，确保允许写权限。

**D. giscus 不显示**：检查仓库是否启用 Discussions，以及 repoId / categoryId 是否填对。

**E. 不要照搬简书 UI**：本项目是"受简书启发的清爽博客风格"，不复制其品牌 / logo。
