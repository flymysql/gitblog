# CloudBase 数据备份

本目录存放 CloudBase **评论**与**访问统计**的 JSON 快照。

- **构建后**：`main` 分支触发 build workflow 时会自动拉取一份
- **每天 0:00（北京时间）**：backup-cloudbase workflow 定时执行
- **本地手动**：

```bash
COMMENT_ADMIN_SECRET=你的密钥 node scripts/backup-cloudbase-data.mjs
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `latest.json` | 始终指向最近一次备份 |
| `daily/YYYY-MM-DD.json` | 按日归档的历史副本 |

备份不含评论者邮箱、IP 等敏感字段，仅保留恢复所需的 `contentHtml` 与元数据。

## GitHub Actions 密钥配置（重要）

Workflow 使用 `environment: github-pages`，密钥必须配置在 **Environment secrets**，不能只在 Variables 里：

1. 打开 **Settings → Environments → github-pages**
2. 在 **Environment secrets**（不是 Variables）添加 `COMMENT_ADMIN_SECRET`
3. 值与云函数环境变量 `COMMENT_ADMIN_SECRET` 一致

可选：

- `CLOUDBASE_HTTP_URL` — 云函数 HTTP 访问地址（推荐，CI 无需 tcb login）
- 或 `TENCENTCLOUD_SECRETID` + `TENCENTCLOUD_SECRETKEY` — 用于 `tcb fn invoke`

也可改用 **Repository secrets**（Settings → Secrets and variables → Actions），但 job 仍需 `environment: github-pages` 时只会读到 Environment 里的值；若只用仓库级密钥，可去掉 workflow 里的 `environment:` 行。

首次启用前需部署含 `ADMIN_EXPORT` / `PV_ADMIN_EXPORT` 的云函数：

```bash
npm run cloudbase:deploy-comments
```
