# 简书风格 GitHub Pages 博客 · 在线后台编辑（零后端版）

完全静态、托管在 GitHub Pages 的博客，但带一个**可在线编辑的伪后台**：在浏览器里写文章，点发布按钮就把 Markdown commit 到 GitHub 仓库，触发 Pages 自动重新部署。

**没有任何后端服务**：不需要 Cloudflare Worker，不需要 Vercel / Netlify Functions，不需要服务器。整套项目就是一组静态文件 + 你浏览器里的一段 token。

- 前台：仿简书风格的列表页 + 阅读页（纯 HTML/CSS/JS，无构建步骤）
- 后台：`/admin` 路径下，粘贴 GitHub Personal Access Token 即可登录
- 写仓库：直接调用 [GitHub Contents API](https://docs.github.com/rest/repos/contents)

---

## 工作原理

```
[浏览器]                                         [GitHub]
   │  访问 /admin                                   │
   │  粘贴 fine-grained PAT                         │
   │                                                │
   │  GET /user  (Authorization: Bearer <token>) ──>│
   │<── { login, name, avatar_url, ... }            │
   │                                                │
   │  写文章 → 点发布                                │
   │  PUT /repos/<owner>/<repo>/contents/posts/x.md ─>│
   │<── { commit, content }                         │
   │                                                │  Pages 重新构建
   │                                                │  几十秒后线上更新
```

token 只存在你浏览器的 `localStorage` 或 `sessionStorage`，不会上传到任何第三方。

---

## 目录结构

```
blog/
├── index.html                # 首页（文章列表，简书风格）
├── post.html                 # 文章阅读页
├── admin/
│   ├── index.html            # 后台（登录 + 文章管理）
│   └── editor.html           # Markdown 编辑器
├── assets/
│   ├── css/
│   │   ├── common.css
│   │   ├── home.css
│   │   ├── post.css
│   │   └── admin.css
│   └── js/
│       ├── config.js         # 公共配置（仓库信息、白名单、站点信息）
│       ├── api.js            # GitHub API 封装
│       ├── auth.js           # PAT 验证
│       ├── markdown.js       # Markdown / frontmatter
│       ├── home.js
│       ├── post.js
│       ├── admin.js
│       └── editor.js
├── data/
│   └── posts.json            # 文章索引（后台自动维护）
├── posts/
│   └── *.md                  # 文章源文件
├── .nojekyll
├── .gitignore
└── README.md
```

---

## 快速开始

### 1. 创建仓库并启用 GitHub Pages

把这个目录推到一个 GitHub 仓库（公开或私有都行），然后在仓库 Settings → Pages 启用：

- Source: `Deploy from a branch`
- Branch: `main`，目录 `/ (root)`

等几十秒，访问 `https://<your-username>.github.io/<repo>/` 就能看到博客。

### 2. 修改 `assets/js/config.js`

只有这一处配置需要改：

```js
export const CONFIG = {
  repo: {
    owner: 'your-username',
    name: 'blog',
    branch: 'main',
  },
  authorizedUsers: ['your-username'],
  site: {
    title: '我的博客',
    subtitle: '记录想法与代码',
    author: '你的名字',
    avatar: 'https://avatars.githubusercontent.com/u/1?v=4',
    description: '一个用 GitHub Pages 托管、可在线编辑的博客',
  },
  paths: {
    posts: 'posts',
    index: 'data/posts.json',
    uploads: 'assets/uploads',
  },
};
```

> 这个文件**可以提交**到仓库，里面没有任何敏感信息。

### 3. 生成 GitHub Personal Access Token（PAT）

强烈推荐 **fine-grained** PAT，权限最小化：

1. 打开 [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/personal-access-tokens/new)
2. **Token name**：随便填，比如 `Blog Admin`
3. **Expiration**：建议设短一点，例如 90 天，到期再换
4. **Repository access** → `Only select repositories` → 只勾选你这个博客仓库
5. **Repository permissions**：
   - **Contents**: `Read and write` （必须，提交 commit 用）
   - **Metadata**: `Read-only`（默认会自动选上）
6. 创建后复制 token，形如 `github_pat_xxx`，**只会显示一次，离开页面就拿不到了**

> ⚠️ 不要用 classic PAT 也行，但 classic 的权限粒度很粗。

### 4. 登录后台

访问 `https://<your-username>.github.io/<repo>/admin/`，粘贴你刚生成的 token，点"验证并登录"。

后台会调一次 `GET /user` 验证：

- 如果 token 无效或过期 → 报错，token 会被立即清除
- 如果通过验证但你的账号不在 `authorizedUsers` 里 → 报错
- 都通过 → 进入文章管理界面，可以新建 / 编辑 / 删除文章

---

## 安全说明

### 哪些东西可以推送到仓库

| 文件 | 是否可推送 | 备注 |
|---|---|---|
| `assets/js/config.js` | ✅ 可以 | 只有公开配置 |
| `assets/js/*.js` | ✅ 可以 | 全部前端代码 |
| `posts/*.md` | ✅ 可以 | 文章本身 |
| `data/posts.json` | ✅ 可以 | 文章索引 |
| 你的 PAT | ❌ 千万不要 | 只粘贴到登录框，不写进任何文件 |
| `.env`、`token.txt` | ❌ 已加 .gitignore | 防止误提交 |

### token 存哪儿了

- 勾选"在此设备保持登录" → 存在 `localStorage`，跨标签页持久
- 不勾选 → 存在 `sessionStorage`，关掉标签页就没了

可以随时点后台右上角的"退出"按钮清掉 token。token 也可以在 GitHub 设置里随时手动 revoke。

### `authorizedUsers` 不是安全边界

它只是前端 UI 的额外校验，防止不小心给外人 token 后被 UI 直接用。**真正决定能不能写仓库的是 GitHub 仓库本身的 collaborator / push 权限**。

### token 风险面

如果你的 token 泄露：

- 攻击者最多能做你 fine-grained PAT 授权的事（即在你这一个仓库里 read/write contents）
- 不能改你账号设置、不能动其他仓库
- 你随时可以在 [Token 设置页](https://github.com/settings/tokens) revoke

所以建议：

1. 一定使用 fine-grained PAT
2. 只授予 **该博客仓库** 的 **Contents: Read and write**
3. 设置过期时间（90 天 / 1 年）
4. 不要在公共电脑勾选"保持登录"

---

## 文章格式

每篇文章是一个带 YAML frontmatter 的 Markdown 文件，例如 `posts/2026-05-11-hello.md`：

```markdown
---
title: Hello World
date: 2026-05-11T10:00:00.000Z
updated: 2026-05-11T10:00:00.000Z
author: 你的名字
tags: [随笔, 介绍]
summary: 这是我的第一篇文章
cover: https://example.com/cover.jpg
---

# 正文

正文内容…
```

后台编辑器会自动生成、解析这些字段，不用你手写。

`data/posts.json` 是文章索引：

```json
{
  "posts": [
    {
      "slug": "welcome",
      "title": "欢迎来到我的博客",
      "date": "2026-05-11T10:00:00.000Z",
      "author": "你的名字",
      "summary": "...",
      "tags": ["介绍"],
      "path": "posts/welcome.md"
    }
  ]
}
```

每次后台保存文章时，编辑器都会自动重新拉一次最新版本的索引、修改、写回。

---

## 常见问题

**Q: 为什么不用 OAuth？**
A: OAuth 必须有 `client_secret`，不能放在浏览器，所以一定需要一个后端中转（哪怕是 Cloudflare Worker）。你说"想要纯无后台"，所以这版用 PAT。如果你后续想升级 OAuth 体验，再加一个 Worker 也可以，前端代码改动不大。

**Q: 我可以把仓库设成私有吗？**
A: 公共账号下的私有仓库不能用 GitHub Pages（除非升级到 Pro）。所以一般做法是**仓库 public，但写文章前的隐私内容不要写进来**。后台 token 仍然是必需的，因为是写操作。

**Q: 多人协作？**
A: 把多个 GitHub 账号加进 `authorizedUsers`，每个人各自生成 PAT 登录即可。同一篇文章如果两人同时编辑，后保存的会因为 sha 冲突报错，刷新重试即可。

**Q: 图片怎么办？**
A: 当前编辑器还没做拖拽上传，可以先把图片放进 `assets/uploads/yyyy/mm/` 然后用 `![](assets/uploads/2026/05/x.png)` 引用。后续可以加自动上传到这个目录。

**Q: GitHub API 有 rate limit 怎么办？**
A: 带 token 的请求每小时 5000 次，个人博客远远够用。前台读文章不走 API，直接走 Pages 静态资源，不消耗配额。

**Q: 文章发布后多久能看到？**
A: 提交完 commit，GitHub Pages 通常 30~120 秒内重建并生效。有时偶尔会久一点。

**Q: 我能改成所见即所得编辑器吗？**
A: 可以。编辑器是一个普通 textarea，可以替换为 [Vditor](https://b3log.org/vditor/)、[EasyMDE](https://github.com/Ionaru/easy-markdown-editor) 或 [Toast UI Editor](https://ui.toast.com/tui-editor)，只要保证最终拿到的是 Markdown 字符串即可。
