---
title: "你的新博客 · 从这里开始"
date: 2026-01-01T00:00:00+08:00
updated: 2026-01-01T00:00:00+08:00
author: "Your Name"
tags:
  - 博客建站
pinned: true
pinnedOrder: 1
summary: "你刚 fork 了一份 GitHub Pages + 在线伪后台的博客模板。这篇文章会带你三步把它真正变成自己的站点。"
---

如果你看到这一篇，说明你已经成功把这个博客模板部署到了 GitHub Pages 上。

接下来花五分钟，把这个站点真正变成你自己的。

---

## 第 1 步：改 `assets/js/config.js`

打开仓库里 `assets/js/config.js`，至少改这几项：

```js
repo: {
  owner: "你的 GitHub 用户名",
  name: "你的仓库名",
  branch: "main"
},
authorizedUsers: ["你的 GitHub 用户名"],   // 只允许你自己的账号登录后台
site: {
  title: "你的博客标题",
  author: "你的名字",
  url: "https://你的用户名.github.io/仓库名",  // 末尾不要 /
  description: "一句话介绍",
  ...
}
```

这一步是**唯一必须用 git 改的**——之后所有配置都可以在 `/admin/settings.html` 在线编辑，自动 commit 回仓库。

> **`site.url` 一定要填对**，SEO meta、sitemap、RSS、OG 图、giscus 都会用到这个值。

---

## 第 2 步：生成一个 Fine-grained PAT

打开 [GitHub Token 创建页](https://github.com/settings/personal-access-tokens/new)：

- **Repository access**：选 `Only select repositories`，勾选你的博客仓库
- **Repository permissions** → `Contents` 选 `Read and write`，其他保持默认
- 设一个合适的过期时间，复制 token

> token 只显示一次，存好。**绝对不要把它写进任何源码文件**——它只放在你浏览器的 `localStorage` 里。

---

## 第 3 步：进后台开始写

访问 `https://你的用户名.github.io/仓库名/admin/`，把 token 粘进去，登录。

之后所有事情都在浏览器里：

- **写文章** → `admin/editor.html`，`Ctrl + S` 一键发布
- **改站点设置** → `admin/settings.html`，包括站点名、头像、Logo、导航、giscus、主题色板等
- **看图片库** → `admin/images.html`
- **管理文章** → `admin/index.html`，全部 / 已发布 / 草稿三 tab

每次"发布"，本质上是给仓库提交一次 commit，几十秒后 GitHub Pages 重新部署，文章就上线了。

---

## 然后：

- **删掉这篇 `posts/welcome.md`**，或者直接在线编辑改成你自己的"关于" / "你好"
- 进 `admin/settings.html` 把站点名、头像、社交链接换成你自己的
- 进 `admin/diagnose.html` 跑一遍诊断，确认 token / 仓库 / 写权限 / Pages 都 OK

> 完整功能与原理说明见仓库里的 [README.md](https://github.com/flymysql/gitblog/blob/main/README.md) 或主仓库 [`flymysql/gitblog`](https://github.com/flymysql/gitblog)。

---

祝你写作愉快。
