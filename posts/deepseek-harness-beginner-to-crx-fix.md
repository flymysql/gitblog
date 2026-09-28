---
title: 从零开始：装上 DeepSeek Harness，让 AI 帮我修好一个装不上的浏览器插件
date: 2026-09-25T22:30:00+08:00
updated: 2026-09-28T16:40:00+08:00
author: Jimmy
tags: [教程, AI 基础设施]
carousel: true
summary: 给完全没用过 AI 编程工具的人：5 分钟装好 DeepSeek Harness、5 分钟配好 DeepSeek API Key（注册/充值/取 Key 全流程截图），再附上一段可以直接复制使用的 prompt 模板。
cover: ../assets/uploads/2026/09/dsh-desktop-cover.webp
---

> 写给**完全没用过 AI 编程工具**的人。全程不需要会写代码，你只要会提问、会看结论。
>
> 官方资料：[DSH 文档](https://deepseek-harness.github.io/deepseek-harness/guide/quickstart) · [DeepSeek API 文档](https://api-docs.deepseek.com/zh-cn/) · [开放平台](https://platform.deepseek.com/)

![三步走：装上 DSH → 配好 Key → 让它替你干活](assets/uploads/2026/09/dsh-guide-01-flow.webp)

---

# 一、装 DSH（5 分钟）

**它是什么**：跑在你自己电脑上的 AI 助手。能读你指定的文件夹、能自己跑命令、动手前会问你。聊天机器人给你答案，它给你结果。

分两条路，小白走第一条：

| | 是什么 | 适合谁 |
| --- | --- | --- |
| **DSH Desktop**（推荐） | 社区维护的桌面客户端，**一键安装包，不需要命令行和 Node.js** | 绝大多数人 |
| 官方 Harness | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 源码 / CLI | 开发者 |

打开官网 **<https://dshdesktop.cn>**，点「**为 Windows 下载**」或「**为 macOS 下载**」：

![DSH Desktop 官网：一键下载（为 Windows / 为 macOS 下载）](assets/uploads/2026/09/dsh-site-download.webp)

> 说明一下：**DSH Desktop 是社区独立维护的开源项目，不是 DeepSeek 官方产品**（官网自己也标了这句话）。想用官方版本就走上面那条 CLI 路线。旁边那个「下载 Next 版」是更新更快的分支，小白先用普通版。

装完双击打开，就是这个样子：

![DSH Desktop 真实界面：左边工作区与会话，右边对话区，底部能看到模型和 token 用量](assets/uploads/2026/09/dsh-desktop-chat.webp)

安装包 200~500 MB 是正常的（自带运行时，不用另装 Node.js）。

- Windows 弹「Windows 已保护你的电脑」→ **更多信息 → 仍要运行**
- macOS 提示无法验证开发者 → **系统设置 → 隐私与安全性 → 仍要打开**

## 第一次打开：只认这三个地方

1. **① 左下「选择工作区」** —— 选一个文件夹（比如放插件、放代码的那个目录）。
   **没选之前输入框是灰的、点不动，这不是坏了** —— 这是新手最容易卡住的地方。它只看得到你选中的那个文件夹。
2. **② 输入框** —— 选中工作区后才能输入。新任务的第一次提问，建议永远加一句 `先不要修改任何文件`。
3. **⚙ 设置 → 模型** —— 填 API Key（下一节）。

> 一个小习惯：**一个任务开一个新会话**，别把改插件和写周报混在一起。

---

# 二、配模型：注册 → 充值 → 取 Key（5 分钟）

从 <https://platform.deepseek.com/> 开始（注意：**和聊天版 `chat.deepseek.com` 不是一个站**，只有开放平台里才有 API Key）。

**第 1 步｜注册登录**：手机号收验证码，或者微信扫码。

![DeepSeek 开放平台登录页](assets/uploads/2026/09/ds-platform-login.webp)

**第 2 步｜充值**：左侧「充值」→ 选金额 → 支付宝 / 微信扫码。**第一次充 ¥20 就够用很久。**

![充值页：选金额后用支付宝或微信支付](assets/uploads/2026/09/ds-platform-recharge.webp)

**第 3 步｜创建 API Key**：左侧「API keys」→ 点右上角「创建 API key」。

![API keys 页：右上角就是「创建 API key」](assets/uploads/2026/09/ds-platform-apikeys.webp)

创建出来的那串 `sk-…` **只显示这一次**，立刻点「复制」：

![创建 API key 弹窗：出于安全原因，之后无法再次查看](assets/uploads/2026/09/ds-platform-createkey.webp)

> ⚠️ 它是你的钱包，**不要发给别人、不要粘进代码或 GitHub**（GitHub 上有机器人 7×24 扫这种字符串，几分钟就能刷爆）。泄露了立刻去 API keys 页删掉重建。

**第 4 步｜粘进 DSH**：**设置 → 模型 → DeepSeek 卡片粘 Key → 保存**。立即生效，不用重启；密钥只写不读（页面上只显示脱敏结果）。

![DSH 设置 → 模型：DeepSeek 卡片、API 密钥输入框、保存按钮](assets/uploads/2026/09/dsh-models-settings.webp)

**花多少钱？**（官方价，元 / 百万 tokens）

| 模型 | 输入（未命中） | 输出 |
| --- | --- | --- |
| `deepseek-flash` 空闲时段 | **1** | **4** |
| `deepseek-flash` 高峰时段 | 2 | 8 |
| `deepseek-v4-pro` 空闲时段 | 4.5 | 13.5 |

- 北京时间**周一至周五 9:00–12:00、14:00–18:00 是高峰**（不含法定节假日），其余时间**半价**
- 新手默认用 `deepseek-flash`：上下文 1M，做「读代码 + 改代码」完全够
- 一般的排查 + 改代码任务，**成本在几块钱量级**

配好后先验证一句，别省这一步：

> 请回答：1+1 等于几？只回答数字。

报错对照：`401` = Key 不对（检查空格）；`Insufficient Balance` = 该充值了；`MISSING_CREDENTIAL` = 回设置里重新保存一次。

---

# 三、直接抄的 prompt

**它最容易犯的错是"你一句话交代完、它就开始瞎改"。** 所以第一句别写"帮我改代码"，先把**现象 + 你想要的结果**讲清楚。下面这句**整体复制**给 AI 就行（换成你自己的事）：

> 我要处理的是：**我们发布的一个 Chrome 插件（给淘宝卖家批量上传证书用的）被用户反馈"新版装不上、旧版也有问题"，请帮我定位到底哪里出了问题，修好并重新打包。**

发出去就是这个样子：

![在 DSH 会话窗口里把这段话发给它（示意图）](assets/uploads/2026/09/dsh-prompt-window.webp)

换成你自己的活，只要改这一句：**谁反馈了什么现象、你想让它做成什么样**。文件在哪不用提前想清楚——它第一步会先问你、先读一遍再说。

> 全文最重要的一句：让 AI 明确告诉你 —— **哪些它验证过了，哪些它只是在猜。**

---

# 四、小白避坑清单

**用 DSH 的时候**

1. 没选工作区，输入框是灰的 —— 不是坏了
2. 一个任务一个会话
3. 新任务先只读，加一句"不要修改任何文件"
4. 权限弹窗看清楚再点，那是安全阀
5. 模型先用 `deepseek-flash`，便宜且够用
6. 想省钱就避开工作日 9–12、14–18

**关于 API Key**

7. Key 只显示一次，创建后立刻复制
8. 别往聊天框、代码、GitHub 里粘；泄露立刻删掉重建
9. 第一次充 ¥20 就够跑很久

**让 AI 干活**

10. 一次只让它做一件事，别一句话交代完
11. 要证据（文件 + 行号 + 可复现命令），不要"我觉得"
12. 要自检脚本，不要"我改好了"
13. 要它自己说清楚"哪些没验证过"
14. 把踩过的坑写成测试用例

**发给用户的东西**

15. "我能打开" ≠ "用户能安装"：**先验证产物合法，再去 debug 功能**，顺序反了会白干几天
16. 不要写"失败就降级成另一个格式"的兜底 —— 伪格式比明确报错糟糕一百倍
17. 尽量别换签名私钥，换了等于换了个新插件
18. 私钥是公章，不要随包分发

---

> 图片来源：DSH Desktop 官网（[dshdesktop.cn](https://dshdesktop.cn)）与项目仓库截图、[DeepSeek Harness 官方文档](https://deepseek-harness.github.io/deepseek-harness/guide/providers)截图；DeepSeek 开放平台界面截图引自公开图文教程（[腾讯云社区](https://cloud.tencent.com/developer/article/2727785)）。
