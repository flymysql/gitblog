---
title: dsh-remote——给 DeepSeek Harness 的多机远程工作区
date: 2026-08-14
updated: "2026-08-14T00:00:00.000Z"
author: Jimmy
tags: [DeepSeek, DSH, 远程开发, 高效工作, 插件]
carousel: true
summary: 一个让 Agent 在多台 SSH 机器上「选目录即工作」的插件：多机管理、双 tab 工作区选择器（本机系统文件夹 or 远程目录）、远程目录本地镜像 + 双向 SFTP 同步，全程不改 harness 核心。
---

> 仓库：[github.com/flymysql/dsh-remote](https://github.com/flymysql/dsh-remote)  
> npm：[dsh-remote](https://www.npmjs.com/package/dsh-remote)（v0.5）  
> 已收录：[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的 Web 界面刻意只监听 `127.0.0.1`（为安全拒绝 `--host 0.0.0.0`）。这带来一个隐含问题：**Agent 的工作做在哪里？**

答案通常是「本地工作区」。但很多人真正的代码和运行环境在**远程机器**上——编译机、测试桩、内网仓库。DSH 本身没有「连远程 + 选远程工作区」的官方能力。

`dsh-remote` 就是来补这块的：它让我把若干台 SSH 机器管起来，然后在原生的「Add workspace」流程里，**要么选本机目录，要么选某台机器的某个远程目录作为工作区**。

---

## 核心能力

### 1. 多台 SSH 机器

设置页就是一个多机 registry：增删改、设「当前」，每台记录 `host / port / user / 私钥或密码`。密码只存在本地（`~/.dsh/remote-workspaces/machines.json`），界面回显的是 `🔒` 表示已设，不回明文。

![设置页——多机 SSH 列表](https://raw.githubusercontent.com/flymysql/dsh-remote/main/docs/ui-settings.svg)

### 2. 双模式工作区选择器

在 DSH 原生「Add workspace」里，`dsh-remote` 用 client 半把 directory-flow 槽位补齐（`priority -100` shadow 掉官方 native），弹出一个**双 tab** 的对话框：

- **本机**：走**系统文件夹选择器**（host 端的原生 `directoryPicker`），或直接输入本地路径 → 直接就是普通 DSH 本地工作区（和本地工作区共存）。
- **远程**：先选**机器**，再浏览它的目录（可点进子目录），或直接输入 `/绝对路径` → 确定后把它 mirror 成本地镜像工作区。

![选工作区——本机 / 远程 双 tab](https://raw.githubusercontent.com/flymysql/dsh-remote/main/docs/ui-picker.svg)

### 3. 远程工作区 = 本地镜像 + 双向同步

选中的远程目录会被**真实镜像**到本地 `~/.dsh/remote-workspaces/<host>/<basename>-<hash>`——它是一个 **`fs.realpath` 通过的真实目录**，所以 DSH 原生工作区系统能正常收养它。然后 `dsh-remote` 通过 SFTP 让它和远程保持同步：

- `rw_sync`：远程 → 本地镜像（拉取）
- `rw_push`：本地镜像 → 远程（推送）

于是你（或 Agent）在镜像里的任何 `read / write / edit / exec` 都是真实地对远程项目操作，但用的是 DSH 最普通的本地文件流。

### 4. 模型工具

- `rw_info` / `rw_connect` / `rw_pick_workspace`
- `rw_list_dir` / `rw_read_file` / `rw_exec`
- `rw_sync` / `rw_push`

当前 `user@host:/path` 还会注入每次系统提示，让 Agent 明确自己的工作根。

---

## 安装

```bash
dsh plugin add dsh-remote            # 或
npx --yes @deepseek-ai/dsh plugin --profile web add dsh-remote
```

装完在 **设置 → 远程工作区** 加机器，然后点 **Add workspace** 选本机或远程目录即可。

---

## 一点设计与取舍

- **不改 harness 核心**：`dsh-workspace` 的「工作区必须是本地 `fs.realpath` 路径」设计我没动，而是让 dsh-remote 把远程目录**物化成一个真实本地目录**再交给它收养。这样既完全融入生态，又保持了 harness 的原有安全感（工作区就是真实文件系统路径）。
- **选工作区是 `single` 槽位**：DSH 的 directory-flow 是一个单槽位，所以 dsh-remote 以最低优先级占住它，官方 native 会选择器被 shadow；如果换成 browser 组合，它也能 fallback。
- **密码存本机明文**：目前按「方便」存本机文件。如果需要更严，可以锁 ACL 或用系统凭据存储——看反馈再考虑。

---

## 结尾

`dsh-remote` 想解决的是「Agent 和我的真实执行环境分离」这个最常见痛点。它已经完全发布到 npm，社区列表可见。欢迎试用、踩坑、提 issue。如果大家觉得「远程工作区」值得成为 DSH 一等公民，也可以去官方讨论区反馈，作为佐证。

- 仓库/安装/文档：https://github.com/flymysql/dsh-remote
- npm：https://www.npmjs.com/package/dsh-remote
- 说明：效果图用了 SVG 占位「 UI 原型」，真实界面以此为准（我这边 headless 无法截图）。