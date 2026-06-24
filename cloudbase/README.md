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

## 3.1 安全来源 / 跨域（必做，否则浏览器报 CORS）

博客域名 `https://gitpull.cn` 不在白名单时，会出现：

`blocked by CORS policy ... tcb-api.tencentcloudapi.com`

**控制台操作**（环境 `gitbolg-d7gmnsrw46e011706`）：

1. 打开 [CloudBase 控制台](https://console.cloud.tencent.com/tcb) → 你的环境 → **环境配置** → **安全来源**（或「安全配置 → Web 安全域名」）
2. 添加（**不要**带 `https://`）：
   - `gitpull.cn`
   - `www.gitpull.cn`
3. 等待 **1～2 分钟** 生效

**命令行**（可选）：

```bash
tcb cors add gitpull.cn,www.gitpull.cn -e gitbolg-d7gmnsrw46e011706
```

## 3.2 开启云函数 HTTP 访问（推荐，默认走 HTTP 不调 SDK）

前端默认 `accessMode: 'http'`，直接请求：

`https://gitbolg-d7gmnsrw46e011706.ap-shanghai.app.tcloudbase.com/gitblog-comments`

控制台步骤：

1. **云函数** → `gitblog-comments` → **HTTP 访问** / **HTTP 访问服务** → **开启**
2. **重新部署**云函数（本仓库 `cloudbase/functions/gitblog-comments` 已支持 `OPTIONS` 与 CORS 响应头）
3. 若默认域名不可用，在 `config.js` 的 `cloudbase.httpUrl` 填入控制台显示的完整 HTTP 地址

云函数环境变量（可选）：

| 变量 | 说明 |
|------|------|
| `ALLOWED_ORIGINS` | 允许跨域来源，默认 `https://gitpull.cn,https://www.gitpull.cn` |

## 3.3 匿名登录（仅 accessMode 为 sdk 时需要）

若改回 Web SDK 模式（`accessMode: 'sdk'`），还需：

控制台 → **登录授权** → 开启 **匿名登录**。

前端会在 `callFunction` 前自动 `signInAnonymously()`。

云函数 → **权限控制**：允许未登录用户调用。

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
