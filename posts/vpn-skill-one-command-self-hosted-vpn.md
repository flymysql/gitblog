---
title: vpn-skill：给个服务器登录方式，帮你把自建 VPN 装好并连上
date: 2026-09-29T13:10:00+08:00
updated: 2026-09-29T13:10:00+08:00
author: Jimmy
tags: [项目介绍, 教程]
carousel: true
summary: 一条命令：在你自己的海外服务器上装好代理服务，在你电脑上装好客户端并连上，最后验证真的能出去。全自动、只读不改你的东西、不想用了能一键还原。
cover: ../assets/uploads/2026/09/vpn-skill-cover.svg
---

> 仓库：[github.com/flymysql/vpn-skill](https://github.com/flymysql/vpn-skill)
> 你需要的：一台**自己买的**海外服务器（IP + 密码或私钥）+ 电脑上装了 Node 18 以上。
> 你不需要：会 Linux、会配代理、会装客户端、会排查端口。

![它替你做的事](assets/uploads/2026/09/vpn-skill-flow.svg)

---

# 它能做什么

**一句话：你给服务器登录方式，它把服务端和你的电脑都配好，让你直接能上外网。**

具体替你干这些活：

| | |
|---|---|
| 装服务端 | SSH 上你的服务器，装好代理服务并设为开机自启 |
| 开端口 | 自动放行本机防火墙，并提醒你去云控制台开安全组 |
| 装客户端 | 在你电脑上下载客户端内核、生成配置、启动它 |
| 设代理 | 自动打开系统代理（Windows/macOS/Linux 都支持） |
| 验证 | 真的连一次外网，告诉你出口 IP 是多少，确认不是假的 |
| 给手机用 | 生成一条分享链接，手机客户端粘进去就能用 |
| 不想用了 | 一条命令停掉并**把系统代理设置原样还回去** |

支持三种协议，装哪种都能用同一个客户端，不用换软件：

| 协议 | 什么时候选它 |
|---|---|
| **Hysteria2**（默认） | 不知道选啥就选它：最快、打游戏延迟最低 |
| **Shadowsocks** | 想要最稳、最兼容（有些客户端很老，只认它） |
| **VLESS + Reality** | 想要最不容易被封（伪装成正常网站访问） |

---

# 怎么用

### 第一步：跑一条命令

```bash
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --user root --password '你的服务器密码'
```

把 `1.2.3.4` 换成你的服务器 IP，`root` 和密码换成你买服务器时拿到的。

就这么一条。它会自己把上面表格里的活干完，大概一两分钟。

跑完看到这样就是成功了：

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

看到最后一行，**你电脑已经能上外网了**，浏览器直接开就行，不用再做别的。

### 第二步（可选）：让手机也能用

上面输出里的那条 `分享链接` 就是手机要的东西。没存下来也没关系：

```bash
npx github:flymysql/vpn-skill link
```

再打印一次。复制它，粘进手机的代理客户端（Shadowrocket / v2rayN / NekoBox / Clash Verge 都行）。

### 常用命令

```bash
npx github:flymysql/vpn-skill status    # 看现在还连着没、走的哪个服务器
npx github:flymysql/vpn-skill verify    # 再验证一次能不能出外网
npx github:flymysql/vpn-skill down      # 用完关掉（系统代理会还原成原来的样子）
npx github:flymysql/vpn-skill up        # 下次要用，再打开
```

`down` 之后想再用，`up` 一下就行，不用重新装。

### 换协议

比如想把默认的 Hysteria2 换成更抗封锁的 Reality：

```bash
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --user root --password '密码' --protocol reality
```

端口和密码会自动沿用，不会白装一遍。

---

# 常见问题

**连不上 / 验证失败怎么办？**

九成是云服务器的**安全组没放行端口**。去你买服务器的网站控制台，把上面输出的那个端口放行：

- Hysteria2 → 放行 **UDP**
- Shadowsocks → **TCP 和 UDP 都要放**
- Reality → 放行 **TCP**

放行后再跑一次 `npx github:flymysql/vpn-skill up`。

**不想每次都写密码？**

用私钥：

```bash
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --key ~/.ssh/id_ed25519
```

如果你平时 `ssh 我的服务器` 就能连上，那更简单——`~/.ssh/config` 里配好的用户、端口、私钥它都会自动读，只要写 `--host 名字` 就够了。

**想彻底删掉？**

```bash
npx github:flymysql/vpn-skill down                              # 关掉本机的代理
npx github:flymysql/vpn-skill server uninstall --host 1.2.3.4 --password '密码'   # 卸载服务器上的
```

**会不会动我别的东西？**

不会。它只写自己的目录（服务器上是 `/etc/vpn-skill` 和对应服务的配置，本机是一个独立文件夹），系统的代理设置改了会备份，`down` 的时候**精确还原**。

---

# 也可以直接交给 AI 用

装上 skill 之后，你只要说一句话：

> 我的服务器是 1.2.3.4，root / 密码 xxxx，帮我搭个 VPN 并连上。

```bash
git clone https://github.com/flymysql/vpn-skill.git ~/vpn-skill
ln -s ~/vpn-skill ~/.dsh/skills/vpn-skill      # DeepSeek Harness 用户
```

---

# 一句提醒

这是给你**自己买的服务器**和**个人电脑**用的。别在公司机器或公司内网里用，那多半违反你公司的规定；服务本身的合规性也请按你所在地的法律来。

---

**仓库**：[github.com/flymysql/vpn-skill](https://github.com/flymysql/vpn-skill) · 用法细节见里面的 `README.md`，连不上见 `docs/TROUBLESHOOTING.md`。
