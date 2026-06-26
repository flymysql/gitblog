# CloudBase 数据备份

本目录存放 CloudBase **评论**与**访问统计**的最新 JSON 快照（仅保留 `latest.json`，不保留历史归档）。

- **构建后**：`main` 分支触发 build workflow 时会自动拉取一份
- **每天 0:00（北京时间）**：backup-cloudbase workflow 定时执行
- **本地手动**：

```bash
COMMENT_ADMIN_SECRET=你的密钥 node scripts/backup-cloudbase-data.mjs
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `latest.json` | 最近一次成功备份的全量快照 |

备份不含评论者邮箱、IP 等敏感字段，仅保留恢复所需的 `contentHtml` 与元数据。

## GitHub Actions 密钥配置（重要）

Workflow 使用 `environment: github-pages`，密钥必须配置在 **Environment secrets**，不能只在 Variables 里：

1. 打开 **Settings → Environments → github-pages**
2. 在 **Environment secrets**（不是 Variables）添加 `COMMENT_ADMIN_SECRET`
3. 值与云函数环境变量 `COMMENT_ADMIN_SECRET` 一致

推荐 CI 调用方式（按优先级）：

- `TENCENTCLOUD_SECRETID` + `TENCENTCLOUD_SECRETKEY` — 走 `tcb fn invoke`（最稳定）
- 或 `CLOUDBASE_HTTP_URL` — 云函数 HTTP 访问地址

首次启用前需部署含 `ADMIN_EXPORT` / `PV_ADMIN_EXPORT` 的云函数：

```bash
npm run cloudbase:deploy-comments
```

## 备份为空？

若 workflow 成功但 `latest.json` 里评论/阅读数为 0，而站点上能看到阅读量，通常是：

1. **云函数未重新部署** — 导出接口 `PV_ADMIN_EXPORT` 仍是旧版或未上线
2. **管理密钥不一致** — GitHub `COMMENT_ADMIN_SECRET` 与云函数环境变量不匹配
3. **CI 连错环境** — 检查 `cloudbaserc.json` / `config.js` 的 `envId` 与密钥所属账号

备份脚本会先调用公开的 `PV_SITE` 探测；若线上有 PV 但导出为空，将 **失败并输出诊断信息**，避免把空文件 commit 进仓库。
