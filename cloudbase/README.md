# CloudBase 评论后端部署

GitBlog 的 CloudBase 评论由云函数 `gitblog-comments` 提供 API，前端通过 `@cloudbase/js-sdk` 调用。

## 1. 创建环境

1. 打开 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 新建环境（建议选上海 `ap-shanghai` 或广州 `ap-guangzhou`）
3. 记录 **环境 ID**（`env-xxxxx`）

## 2. 部署云函数

安装 [CloudBase CLI](https://docs.cloudbase.net/cli-v1/install)：

```bash
npm i -g @cloudbase/cli
tcb login
```

在本仓库 `cloudbase/` 目录：

```bash
cd cloudbase
# 编辑 cloudbaserc.json，填入 envId
tcb fn deploy gitblog-comments
```

或在控制台 → 云函数 → 新建 → 上传 `functions/gitblog-comments` 文件夹。

## 3. 数据库与安全

云函数首次运行会自动创建集合：

- `gitblog_comments` — 评论正文
- `gitblog_comment_rates` — IP 频率限制

**安全规则建议**（控制台 → 数据库 → 权限）：

- `gitblog_comments`：**所有用户不可读写**（仅云函数可写）
- `gitblog_comment_rates`：**不可读写**

评论读写全部走云函数，前端不直连数据库。

## 3.1 匿名登录（必开，否则报 you can't request without auth）

控制台 → **登录授权** → 开启 **匿名登录**。

前端调用云函数前会自动 `signInAnonymously()`。若未开启，评论区会提示鉴权失败。

云函数 → `gitblog-comments` → **权限控制**：勾选允许 **未登录用户** / 所有用户调用（视控制台文案而定）。

## 4. 云存储

云函数会将评论图片上传到云存储路径 `comments/{path}/...`。

在控制台 → 云存储 → 权限：允许**所有用户可读**，**仅管理员/云函数可写**（或保持私有，依赖 `getTempFileURL` 临时链接）。

## 5. 环境变量

在云函数配置中设置：

| 变量 | 说明 |
|------|------|
| `COMMENT_MODERATION` | `1` 开启人工审核（pending），`0` 直接显示 |
| `COMMENT_SALT` | 随机字符串，用于 IP hash |

## 6. 前端配置

在 [后台设置](/admin/settings.html) 或 `assets/js/config.js`：

```js
cloudbase: {
  enabled: true,
  envId: 'gitbolg-d7gmnsrw46e011706',
  region: 'ap-shanghai',
  functionName: 'gitblog-comments',
  placeholderNick: '访客',
  moderation: false,
  maxLength: 5000,
  allowImage: true,
  pageSize: 50,
  notesTerm: 'gitblog-notes-feed',
},
```

`enabled: true` 且填写 `envId` 后，文章页/工具页/随笔页将加载 CloudBase 评论区（不再使用 GitHub giscus）。

## 7. API 说明

云函数 `event` 字段：

| action | 字段 | 说明 |
|--------|------|------|
| `GET` | `path`, `limit?` | 拉取评论树 |
| `POST` | `path`, `contentHtml`, `nick?`, `email?`, `parentId?` | 发表评论 |
| `UPLOAD` | `path`, `base64`, `mime`, `fileName?` | 上传评论图片 |

返回 `{ ok: true, ... }` 或 `{ ok: false, message }`。

## 8. 费用提示

CloudBase 免费体验版有每月资源点限制；个人博客评论量通常足够。详见 [CloudBase 价格文档](https://cloud.tencent.com/document/product/876/75213)。
