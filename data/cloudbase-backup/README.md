# CloudBase 数据备份

本目录存放 CloudBase **评论**与**访问统计**的 JSON 快照，由 GitHub Actions 每天北京时间 0:00 自动更新，也可本地手动执行：

```bash
COMMENT_ADMIN_SECRET=你的密钥 node scripts/backup-cloudbase-data.mjs
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `latest.json` | 始终指向最近一次备份 |
| `daily/YYYY-MM-DD.json` | 按日归档的历史副本 |

备份不含评论者邮箱、IP 等敏感字段，仅保留恢复所需的 `contentHtml` 与元数据。

## 自动备份配置

在 GitHub 仓库 Settings → Secrets 中添加：

- `COMMENT_ADMIN_SECRET` — 与云函数环境变量一致（必填）
- `CLOUDBASE_HTTP_URL` — 云函数 HTTP 访问地址（推荐，CI 无需 tcb login）
- 或 `TENCENTCLOUD_SECRETID` + `TENCENTCLOUD_SECRETKEY` — 用于 `tcb fn invoke`

首次启用前需部署含 `ADMIN_EXPORT` / `PV_ADMIN_EXPORT` 的云函数：

```bash
npm run cloudbase:deploy-comments
```
