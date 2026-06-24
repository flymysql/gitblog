# CloudBase 评论后端部署

GitBlog 的 CloudBase 评论由云函数 `gitblog-comments` 提供 API。博客页默认通过 **iframe 嵌入**（`accessMode: 'embed'`）加载托管在 CloudBase 静态网站上的评论页，**免费版无需配置安全域名**。

## 免费版 vs 付费版

| 能力 | 免费/体验版 | 个人版及以上 |
|------|-------------|--------------|
| 添加 `gitpull.cn` 安全域名 | ❌ `CreateAuthDomain` 报错 | ✅ |
| iframe 嵌入（推荐） | ✅ | ✅ |
| HTTP / SDK 直连博客域 | ❌ 会 CORS | ✅ |

若执行 `tcb cors add gitpull.cn` 出现 **「当前套餐无法执行此操作」**，这是套餐限制，不是域名格式问题。请使用下文 **iframe 方案**，或升级 CloudBase 个人版。

## 1. 创建环境

1. 打开 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 新建环境（建议选上海 `ap-shanghai`）
3. 记录 **环境 ID**（如 `gitbolg-d7gmnsrw46e011706`）

## 2. 部署云函数

安装 [CloudBase CLI](https://docs.cloudbase.net/cli-v1/install)：

```bash
npm i -g @cloudbase/cli
tcb login
```

在本仓库 `cloudbase/` 目录：

```bash
cd cloudbase
tcb fn deploy gitblog-comments -e gitbolg-d7gmnsrw46e011706
```

## 3. 开启匿名登录（embed / sdk 模式需要）

控制台 → **登录授权** → 开启 **匿名登录**。

云函数 → **权限控制**：允许未登录用户调用 `gitblog-comments`。

## 4. 部署评论嵌入页（免费版必做）

将 `cloudbase/static/` 部署到 CloudBase 静态网站托管：

```bash
cd cloudbase
tcb hosting deploy ./static -e gitbolg-d7gmnsrw46e011706
```

部署后访问（示例）：

`https://gitbolg-d7gmnsrw46e011706.tcloudbaseapp.com/comments-embed.html?path=test&env=gitbolg-d7gmnsrw46e011706`

博客页会以 iframe 加载该地址，嵌入页与 CloudBase API 同域，**不触发跨域**。

### 静态目录文件

| 文件 | 说明 |
|------|------|
| `static/comments-embed.html` | 嵌入页入口 |
| `static/comments-embed.js` | 评论 UI + SDK 调用 |
| `static/comments-embed.css` | 样式（支持 light/dark） |

更新评论 UI 后需重新执行 `tcb hosting deploy ./static`。

## 5. 数据库与安全

云函数首次运行会自动创建集合：

- `gitblog_comments` — 评论正文
- `gitblog_comment_rates` — IP 频率限制

**安全规则建议**（控制台 → 数据库 → 权限）：

- `gitblog_comments`：**所有用户不可读写**（仅云函数可写）
- `gitblog_comment_rates`：**不可读写**

## 6. 云存储

评论图片上传到 `comments/{path}/...`。

控制台 → 云存储 → 权限：允许**所有用户可读**，**仅云函数可写**。

## 7. 云函数环境变量

| 变量 | 说明 |
|------|------|
| `COMMENT_MODERATION` | `1` 开启审核，`0` 直接显示 |
| `COMMENT_SALT` | 随机字符串，用于 IP hash |
| `ALLOWED_ORIGINS` | HTTP 模式跨域来源（embed 模式可忽略） |

## 8. 前端配置

`assets/js/config.js` 或 [后台设置](/admin/settings.html)：

```js
cloudbase: {
  enabled: true,
  envId: 'gitbolg-d7gmnsrw46e011706',
  region: 'ap-shanghai',
  functionName: 'gitblog-comments',
  accessMode: 'embed',           // 免费版推荐
  embedPage: 'comments-embed.html',
  placeholderNick: '访客',
  moderation: false,
  maxLength: 5000,
  allowImage: true,
  pageSize: 50,
  notesTerm: 'gitblog-notes-feed',
},
```

### accessMode 说明

| 值 | 说明 |
|----|------|
| `embed` | iframe 加载托管页（**免费版默认**） |
| `http` | 博客域直连云函数 HTTP（须安全域名 + 开启 HTTP 访问） |
| `sdk` | 博客域加载 Web SDK（须安全域名 + 匿名登录） |

## 9. 付费版：安全域名与 HTTP（可选）

升级个人版后，若希望评论 UI 直接嵌在博客页（非 iframe）：

1. 控制台 → **环境配置** → **安全来源**，添加 `gitpull.cn`、`www.gitpull.cn`
2. 或 CLI：`tcb cors add gitpull.cn,www.gitpull.cn -e gitbolg-d7gmnsrw46e011706`
3. 云函数 → `gitblog-comments` → 开启 **HTTP 访问**
4. 将 `accessMode` 改为 `http` 或 `sdk`

## 10. API 说明

| action | 字段 | 说明 |
|--------|------|------|
| `GET` | `path`, `limit?` | 拉取评论树 |
| `POST` | `path`, `contentHtml`, `nick?`, `email?`, `parentId?` | 发表评论 |
| `UPLOAD` | `path`, `base64`, `mime`, `fileName?` | 上传评论图片 |

返回 `{ ok: true, ... }` 或 `{ ok: false, message }`。

## 11. 费用提示

CloudBase 免费体验版有每月资源点限制；个人博客评论量通常足够。详见 [CloudBase 价格文档](https://cloud.tencent.com/document/product/876/75213)。
