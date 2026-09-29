---
title: vpn-skill：对 AI 说一句话，帮你把自建 VPN 装好并连上
date: 2026-09-29T14:20:00+08:00
author: Jimmy
tags: [项目介绍, 教程]
carousel: true
summary: 先把 skill 装上，然后对 AI 说一句「我的服务器是 1.2.3.4，密码 xxxx，帮我搭个 VPN 并连上」，它会自己在你服务器上装服务端、在你电脑上装客户端、连上并验证出口 IP。也附了更多一句话指令和不用 AI 的命令行用法。
cover: ../assets/uploads/2026/09/vpn-skill-cover.svg
---

> 仓库：[github.com/flymysql/vpn-skill](https://github.com/flymysql/vpn-skill)
> 你需要的：一台**自己买的**海外服务器（IP + 密码或私钥）+ 一个能装 skill 的 AI（DeepSeek Harness / CodeBuddy / Claude Code 等）。
> 你不需要：会 Linux、会配代理、会装客户端、会排查端口。

![说一句话，剩下的交给它](assets/uploads/2026/09/vpn-skill-flow.svg)

---

# 它能做什么

**一句话：你告诉 AI 你的服务器登录方式，它把服务端和你电脑都配好，让你直接能上外网。**

| | |
|---|---|
| 装服务端 | SSH 上你的服务器，装好代理服务并设为开机自启 |
| 开端口 | 自动放行本机防火墙，并提醒你去云控制台开安全组 |
| 装客户端 | 在你电脑上下载客户端内核、生成配置、启动它 |
| 设代理 | 自动打开系统代理（Windows/macOS/Linux 都支持） |
| 验证 | 真的连一次外网，告诉你出口 IP 是多少，确认不是假的 |
| 给手机用 | 生成一条分享链接，手机客户端粘进去就能用 |
| 不想用了 | 说一声，停掉代理并**把系统设置原样还回去** |

支持三种协议，装哪种都用同一个客户端，不用换软件：

| 协议 | 什么时候选它 |
|---|---|
| **Hysteria2**（默认） | 不知道选啥就选它：最快、打游戏延迟最低 |
| **Shadowsocks** | 想要最稳、最兼容（有些客户端很老，只认它） |
| **VLESS + Reality** | 想要最不容易被封（伪装成正常网站访问） |

---

# 怎么用：给 AI 说一句话

## 第一步：装上 skill

复制这一行，在你的 AI 里执行（或者直接让 AI 帮你装）：

```bash
git clone https://github.com/flymysql/vpn-skill.git ~/vpn-skill
ln -s ~/vpn-skill ~/.dsh/skills/vpn-skill      # DeepSeek Harness 的 skill 目录
```

> 其他 agent 把软链换到对应的 skills 目录即可（CodeBuddy / Claude Code 同理）。

## 第二步：对 AI 说这句话

把 IP、用户名、密码换成你买服务器时拿到的：

> **我的海外服务器是 1.2.3.4，用户 root，密码 xxxx。帮我用 vpn-skill 搭个 VPN，并且让这台电脑连上，装完告诉我出口 IP 是多少。**

就这一句。它会自己把上面表格里的活干完，一两分钟。

## 第三步：等它汇报

成功时你会看到类似这样的结果（**最后一行说通了，你电脑就已经能上外网了**，浏览器直接开就行）：

```
[ ok ] Hysteria2 部署完成
  服务器 : 203.0.113.10
  端口   : 31949/UDP
  分享链接: hysteria2://xxxx@203.0.113.10:31949/?insecure=1&sni=bing.com#vpn-skill-hy2
[ ok ] mihomo 已启动 (混合端口 7890)
[ ok ] 系统代理已设置为 127.0.0.1:7890
[ ok ] HTTPS 隧道 (gstatic/generate_204): HTTP 204 · 137ms
[ ok ] 出口 IP: 43.132.141.21  ·  直连 IP: 12.34.56.78
[ ok ] 全部完成 ✅
```

---

# 更多「一句话指令」

装上之后，日常操作都只需要对 AI 说一句：

| 你想干什么 | 对 AI 说 |
|---|---|
| 默认方案（最快） | 「帮我搭个 VPN 并连上」 |
| 怕被封、要隐蔽 | 「换一个不容易被封的方案，然后连上」 |
| 要最稳、最兼容 | 「换成 Shadowsocks，然后连上」 |
| 手机也要用 | 「把手机能用的配置链接给我」 |
| 现在到底连上没有 | 「看看我的 VPN 现在是什么状态」 |
| 再验证一次 | 「验证一下现在能不能上外网」 |
| 今天先不用了 | 「把 VPN 断开」 |
| 明天继续用 | 「把 VPN 打开」 |
| 换个端口 | 「换个端口重新部署一下」 |
| 彻底卸载 | 「把服务器上的和本机的都卸载掉」 |

AI 会自己判断该跑哪条命令、该带什么参数，你说人话就行。

---

# 不想用 AI？命令行也一样

```bash
# 部署 + 装客户端 + 连上 + 验证，一条命令
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --user root --password '你的密码'

# 之后
npx github:flymysql/vpn-skill status    # 看状态
npx github:flymysql/vpn-skill verify    # 验证能不能出外网
npx github:flymysql/vpn-skill link      # 拿手机用的分享链接
npx github:flymysql/vpn-skill down      # 关掉（系统代理原样还原）
npx github:flymysql/vpn-skill up        # 启用
```

用私钥代替密码：

```bash
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --key ~/.ssh/id_ed25519
```

如果你平时 `ssh 我的服务器` 就能连上，那更简单——`~/.ssh/config` 里配好的用户、端口、私钥它都会自动读，只要写 `--host 名字` 就够了。

---

# 常见问题

**AI 说连不上 / 验证失败怎么办？**

九成是云服务器的**安全组没放行端口**。去你买服务器的网站控制台，把上面输出的那个端口放行：

- Hysteria2 → 放行 **UDP**
- Shadowsocks → **TCP 和 UDP 都要放**
- Reality → 放行 **TCP**

放行后跟 AI 说「再连一次」就行。

**会不会动我别的东西？**

不会。它只写自己的目录（服务器上是 `/etc/vpn-skill` 和对应服务的配置，本机是一个独立文件夹）。系统代理设置改了会先备份，「断开」的时候**精确还原**。

**想彻底删掉？**

对 AI 说「把服务器上的和本机的都卸载掉」，或者：

```bash
npx github:flymysql/vpn-skill down
npx github:flymysql/vpn-skill server uninstall --host 1.2.3.4 --password '密码'
```

---

# 一句提醒

这是给你**自己买的服务器**和**个人电脑**用的。别在公司机器或公司内网里用，那多半违反你公司的规定；服务本身的合规性也请按你所在地的法律来。

---

**仓库**：[github.com/flymysql/vpn-skill](https://github.com/flymysql/vpn-skill) · 连不上见里面的 `docs/TROUBLESHOOTING.md`
