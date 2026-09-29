---
title: 一条命令搭好自建 VPN：我把 8 个交互式脚本改造成了能给 agent 用的能力
date: 2026-09-29T11:40:00+08:00
author: Jimmy
tags: [项目介绍, 教程]
carousel: true
summary: 自建代理原本要手工走六步。我把它压成一个命令——只给服务器登录方式，自动部署服务端、装本机客户端、连上并验证出网。这篇文章讲清六个设计决策，以及测试帮我抓出的 12 个真实缺陷，其中三个会直接让功能不可用。
cover: ../assets/uploads/2026/09/vpn-skill-cover.svg
---

> 仓库：[github.com/flymysql/vpn-skill](https://github.com/flymysql/vpn-skill)（Apache-2.0）
> 上游：[chugzb/VPN](https://github.com/chugzb/VPN)，本文是把它**工程化**的记录，不是另起炉灶。
>
> ⚠️ 先说边界：这个工具是给你**自己买的海外服务器**和**个人设备**用的。别在公司机器 / 内网环境部署或使用，那很可能违反你的组织规定；服务本身的合规性请按你所在地的法律来。

---

# 一、先看结果

```bash
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --user root --password '你的密码'
```

跑完是这样：

```
[ ok ] 目标机: TencentOS Server 3.2 / x86_64 / user=jimmycppliu / systemd=yes
[ ok ] 已上传脚本到 /tmp/vpn-skill-upload-xxxxx
[ ok ] Hysteria2 部署完成
  端口   : 31949/UDP
  链接   : hysteria2://xxxx@203.0.113.10:31949/?insecure=1&sni=bing.com#vpn-skill-hy2
[ ok ] mihomo 安装完成: Mihomo Meta v1.19.31 windows amd64
[ ok ] mihomo 已启动 (pid 64028, 混合端口 7890)
[ ok ] 系统代理已设置为 127.0.0.1:7890
[ ok ] HTTPS 隧道 (gstatic/generate_204): HTTP 204 · 137ms
[ ok ] 出口 IP: 43.132.141.21  ·  直连 IP: 12.34.56.78
[ ok ] 全部完成 ✅
```

它做完了九件事：解析登录方式 → 探测目标机 → 上传部署脚本 → 装协议后端并起服务（含防火墙与 BBR）→ 读回状态 → 下载客户端内核 → 生成配置与分享链接 → 启动内核并设系统代理 → 验证出网。

支持三种协议，用同一个本地内核（mihomo）通吃，不用按协议换客户端：

| `--protocol` | 协议 | 适合 |
|---|---|---|
| `hy2`（默认） | Hysteria2（QUIC/TLS） | 最快、延迟最低、抗封锁好 |
| `ss` | Shadowsocks-Rust | TCP 最稳、客户端兼容性最好 |
| `reality` | VLESS + XTLS-Reality | 隐蔽性最强，握手伪装成真实 TLS |

---

# 二、为什么值得自动化

自建代理的手工流程，任何教程都会给你这六步：

1. 买服务器、记下 IP 和密码
2. SSH 上去，从 GitHub 拉一个安装脚本
3. 脚本问你端口，回车选随机
4. 等它装完，把屏幕上打印的配置**抄下来**
5. 在手机/电脑上装客户端，把配置**填进去**
6. 连不上，回去排查——大概率是云安全组没放行端口

这六步里有大量"可以机器做但因为在屏幕上所以只能人做"的动作。更要紧的是：**第 4 步的输出是给人看的**，没有程序接口。于是这件事既没法重跑（重跑会换端口、换密码），也没法校验（你不知道自己抄错没有），更没法交给 agent。

所以目标形态很明确：**只给登录方式，其余零输入**。

---

# 三、架构：服务端留在 bash，编排层换成 Node

![vpn-skill 的执行流程](assets/uploads/2026/09/vpn-skill-flow.svg)

两个刻意的选择：

**服务端继续用 bash。** 目标机只保证有 bash 和 coreutils，不能假设有 Node/Python。所以服务端退化成纯粹的"执行 + 回传状态"，不做任何决策。

**编排层用 Node。** 要同时覆盖 Windows/macOS/Linux 本机、要支持密码 SSH（Windows 上没有 `sshpass`）、要无依赖解压 zip、要写 Windows 注册表、要手工实现 `.gz` 解压——这些用 shell 做会变成三套互不相干的脚本。Node 是三端都现成可用的运行时。

目录结构因此长这样：

```
bin/vpn.mjs            CLI：参数 → 命令分发 → 人话输出
  ├─ src/deploy.mjs    传输编排：上传 → 提权执行 → 回读状态
  │    └─ src/ssh.mjs  ssh2 封装 + ~/.ssh/config 解析 + sudo 提权 + SFTP
  ├─ src/protocols.mjs state → mihomo 配置 / 分享链接 / Clash 订阅
  ├─ src/client.mjs    下载内核 / 生成配置 / 托管进程 / 系统代理 / 验证
  └─ src/util.mjs      参数解析 / 平台路径 / 终端输出
server/common.sh       服务端共享库：日志、依赖、端口、防火墙、BBR、状态
server/{hy2,ss-rust,reality}.sh    三种协议的非交互部署
```

---

# 四、六个关键设计决策

## 1. stdout 只放数据，日志一律走 stderr

这不是审美问题，是踩出来的。

我在服务端写了个 `resolve_port()`，它内部用 `info()` 打了一句"复用已有端口 8378"。然后我这样取值：

```bash
VPN_PORT="$(resolve_port udp)"
```

结果端口值变成了：

```
[ .. ] 复用已有端口 8378（幂等）
8378
```

日志被一起捕获了。后面写 `state.env` 时安全字符集校验拦下了它，报"状态字段 `VPN_PORT` 含不安全字符"——否则会生成一个**看起来正常但端口是垃圾字符串**的配置。

修法是把 `log/info/ok/warn/die` 全部重定向到 stderr，并在测试里加了一条断言：**stdout 里不允许出现日志标记**，防止回归。

同一条契约也定义了服务端怎么回传状态：机器可读的东西走 stdout——

```
##VPN_SKILL_STATE_FILE=/etc/vpn-skill/state.env##
##VPN_SKILL_STATE_BEGIN##
{ "VPN_PROTOCOL": "hy2", "VPN_PORT": "31949", ... }
##VPN_SKILL_STATE_END##
```

**永远不要用正则去抠中文日志。**

## 2. 幂等：不许作废已经发到手机上的配置

重跑是常态（换协议、改端口、修配置）。如果每次重跑都新生成一套密码，那手机上那份配置就废了；如果每次重跑都重启服务，在线连接就断了。

所以：

```bash
载入 /etc/vpn-skill/state.env（若存在）
  → 端口：命令行 > 历史状态 > 随机空闲
  → 密码/UUID：历史状态 > 新生成
  → 渲染配置到临时文件，与现有文件逐字节 cmp
      ├─ 相同 → 不落盘、不重启
      └─ 不同 → 落盘 + 重启
```

这里踩过一个很隐蔽的坑：我在 hy2 的配置头写了 `# 自动生成于 2026-09-29T02:22:03Z`。**时间戳让每次渲染的字节都不同**，于是每次都判定"配置已变更"、每次都重启服务——幂等设计当场失效，而表面上看一切正常。**写进配置的内容不能含易变信息。**

关联的一条：Reality 的私钥**不回传本机**，只留在服务端的 xray 配置里；重跑时从那份配置里读回私钥、从 `state.env` 复用公钥。这样"本机不持有服务端私钥"和"重跑不作废客户端"两件事同时成立。

`--force` 的语义也刻意区分开：**只重写配置并重启，绝不重置凭据**。

## 3. 三级下载降级：把你的海外服务器当下载代理

墙内直连 GitHub Release 基本不通。所以本机下载内核的梯度是：

```
1. github.com 直连
2. 内置镜像（ghproxy.net / gh-proxy.com / ghfast.top …）或 VPN_MIRRORS
3. 把服务器当下载代理：远端 curl 下来 → SFTP 拉回本机
```

第 3 级是整个"客户端自动化"能成立的前提——你的服务器在海外，它下载 GitHub 是通的，用它的带宽把 21MB 的内核搬回来即可。

## 4. SSH 层要像 `ssh` 一样

第一版我硬编码默认用户名 `root`、默认去猜 `~/.ssh/id_ed25519`。结果在编译机上直接认证失败——那台机器在 `~/.ssh/config` 里配的是 `id_rsa` 和端口 36000。

于是补上两件事：

- **解析 `~/.ssh/config`**（`HostName`/`User`/`Port`/`IdentityFile`，含 `Include`、glob 匹配、按文件顺序首个命中优先）。平时 `ssh myhost` 能通的，这里 `--host myhost` 就能通。
- **多凭据依次尝试**：显式给的 `--key` 失败后，继续试 config 里的和默认私钥。用户很可能给了错的那个，而对的就在 config 里。

## 5. 提权的副作用要收尾

这是最坑的一个 bug，因为它**让成功的部署看起来是失败的**。

场景：用非 root 账号登录，但 sudo 免密。这时脚本以 root 运行，`state.env` 是 `root:600`。本机 CLI 用普通账号去读——Permission denied。用户看到的是"部署失败"，实际上服务端已经装好了。

两处一起修：

- 服务端：以 sudo 执行时把 `state.env` 的属主让回调用者（`chown $SUDO_UID`）
- 客户端：回读状态走同一提权通道（先 `cat`，失败再 `sudo cat`）

并且加了回归断言：提权执行后，状态文件属主必须等于登录用户且权限仍是 600。

## 6. dry-run 必须对宿主零副作用

我写了个 `VPN_DRY_RUN=1` 模式，用来在没有 Linux 机器的环境下验证脚本逻辑。第一版它虽然跳过了下载和起服务，**却仍然把 systemd 单元文件写进了宿主的 `/etc/systemd/system/`**——"演练"污染了开发机。

改成新增一个 `apply_unit()`：dry-run 时单元文件落到 `$WORKDIR/units/`，只有真跑才装到 `/etc`。

没有这一条，后面那张四层测试表里的一半都做不出来。

---

# 五、测试：在没有海外机器的情况下做出可信证据

我没有海外服务器可用。但"没有环境"不该等于"没有验证"。最后做出四层：

| 层 | 命令 | 项数 | 覆盖 |
|---|---|---|---|
| 单元 + 字节不变量 | `npm test` | 22 | YAML 发射/转义、三种协议配置、分享链接、参数解析、env 注入转义、**文件换行/BOM/许可/frontmatter 不变量** |
| 服务端脚本 | `npm run test:bash` | 32 | dry-run 真跑 bash：状态输出、配置生成、幂等、`--force` 语义、命令行覆盖历史、非法值拒绝、stdout 纯净性 |
| **本机真实端到端** | `npm run test:e2e` | 18 | **真实代理链**（见下） |
| SSH 集成 | `npm run test:ssh` | 11 | ssh2 + `~/.ssh/config`、SFTP 上传、提权执行、状态回读、客户端装配 |

`test:e2e` 是这里面最有意思的一层：它**不是 mock**。它在本机拉一个真正的 `ssserver`（shadowsocks-rust 的 Windows 版）当服务端，把 `mihomo` 真启动起来，然后：

- 经 `本地混合端口 → mihomo → ssserver → 公网` 请求 `https://www.gstatic.com/generate_204`，**断言返回 204**
- 用 mihomo 的控制器 API 触发一次节点延迟探测，**断言拿到真实延迟**（实测 ~52ms）
- 经代理查询出口 IP，**断言拿到真实公网 IP**
- 打开系统代理、读回注册表值、再关闭，**断言精确还原到操作前的值**

也就是说：除了"服务端装在别人的机器上"这一点，客户端侧全部走真实代码路径。这是我能在没有海外机器的前提下给出的最强证据。

---

# 六、测试帮我抓出的 12 个缺陷

这些都是**写下测试之后**才暴露的，不是事后补记的清单：

| # | 缺陷 | 后果 |
|---|---|---|
| 1 | `resolve_port()` 在命令替换里打日志 | 端口值被日志污染 |
| 2 | hy2 配置头带生成时间戳 | 每次重跑都重启服务，幂等失效 |
| 3 | dry-run 仍往宿主 `/etc/systemd/system` 写单元文件 | "演练"污染宿主 |
| 4 | 无 BOM 的 UTF-8 `.ps1` 被 PowerShell 5.1 按 ANSI 解析 | **Windows 系统代理功能整体不可用** |
| 5 | 出口 IP 只查 `ip-api.com` | 该服务在部分网络不可达 ⇒ 验证误报失败 |
| 6 | 非 root + 免密 sudo 时 `state.env` 属 root:600 | **部署成功却报失败** |
| 7 | 显式 `--key` 失败就放弃 | config 里明明有能用的 key 却连不上 |
| 8 | 未解析 `~/.ssh/config` | 用户得把配好的 User/Port/IdentityFile 再抄一遍 |
| 9 | `vendor/upstream/*.sh` 工作树是 CRLF（索引是 LF） | 执行时报 `$'\r': command not found` |
| 10 | 测试脚本找不到 bash 时只打印一句就 `exit 0` | **假绿** |
| 11 | `npm test` 用带引号 glob，Node 20 不支持 | CI 矩阵里 Node 20 变成 0 用例（**假绿**） |
| 12 | 缺陷 #6 修完只写在文档里 | 未来容易回归 |

挑三个讲讲。

**#4 最贵。** `src/win/systemproxy.ps1` 里有中文注释，文件是 UTF-8 无 BOM。Windows PowerShell 5.1 会把无 BOM 的 UTF-8 当 ANSI 读——中文注释的字节被解成乱码，其中一个字节恰好破坏了字符串引号，于是整个脚本**语法错误**：

```
Unexpected token ')' in expression or statement.
```

也就是说：系统代理这个功能在 Windows 上是完全不可用的，而在我的编辑器里打开文件一切正常。修法是写入时加 UTF-8 BOM，并加了字节级断言常驻看守。

**#9 是被新加的测试当场抓到的。** 我给仓库加了"字节不变量测试"（`.sh` 必须 LF、`.ps1` 必须带 BOM、不许有 NUL 字节、frontmatter/许可/`.gitignore` 必须齐），第一次运行就失败了——`vendor/upstream/` 下的 8 个上游脚本在工作树里是 CRLF（git 索引里已经是 LF，但工作树没重写）。这意味着"我看到的"和"提交上去的"不是同一个东西。

**#10 和 #11 是同一类问题**，也是我认为最值得记住的一点。

---

# 七、假绿比没有测试更危险

`npm run test:bash` 在找不到 bash 时的第一版实现：

```js
if (!BASH) {
  console.log('未找到可用的 bash，跳过服务端脚本自测');
  return;   // ← 退出码 0
}
```

看起来是"优雅降级"，实际是**假绿**：本地和 CI 都显示测试通过，而一条断言都没跑。没有测试时你至少知道自己没有测试。

`npm test` 同理：`node --test "tests/unit/*.test.mjs"` 在 Node 24 上正常，但 Node 20 不支持 `--test` 的 glob 参数——CI 矩阵里的 Node 20 会安静地跑 0 个用例然后通过。

修法都很小：

- 缺依赖 → **非 0 退出**，并给出明确出路（`VPNSKILL_BASH=<path>` / `VPNSKILL_ALLOW_NO_BASH=1` 才允许跳过）
- 用裸 `node --test`，让 Node 按内置规则发现测试文件（实测只命中 `tests/unit/`，不会误跑 e2e）
- 把"仓库级不变量"也变成断言，而不是写进文档让人记住

一句话：**"测试通过"本身也需要被测。**

---

# 八、Windows 上顺带踩的几个坑

如果你是 Windows 上做跨平台工具，这几条能直接抄：

| 坑 | 正确姿势 |
|---|---|
| `.ps1` 脚本里中文变乱码甚至语法错误 | 写入 UTF-8 **BOM**；Windows PowerShell 5.1 不认无 BOM 的 UTF-8 |
| `git` 上检出的 `.sh` 变成 CRLF，到 Linux 就报 `$'\r': command not found` | `.gitattributes` 里 `*.sh text eol=lf`；`.ps1` 用 `-text` 保字节 |
| pwsh 的 `.NET` 静态调用与进程 cwd 可能不一致，相对路径静默失效 | 文件 API 一律绝对路径 |
| `Out-String` / `Set-Content` / `>` 会自己重写换行和编码 | 判字节用 `fs.readFileSync()` 或 `[IO.File]::ReadAllBytes()`，别过文本管线 |
| bash 的 `case` 里 `[!A-Za-z=...]` 这种方括号模式有词法歧义 | 字符集校验改用 `grep -E` |
| Windows 没有系统 bash | 用 Git 的 `bash.exe`；找不到要**失败**而不是跳过 |

最后一条特别值得说：我用 `Out-String` 去检查"提交里的文件是不是 CRLF"，它返回了 `True`——一度让我以为 git 把换行搞坏了。其实 `Out-String` **自己就会把行尾变成 CRLF**，我在测量仪器的噪声。换成在 Node 里读原始字节才看到真相。**测量工具本身会污染测量结果。**

---

# 九、已知边界（诚实清单）

- 客户端侧（Windows）是**真机验证**的：下载、解压、配置、起进程、过代理、系统代理开关往返，全部真跑。
- SSH 传输层是**真机验证**的：连了一台真实 Linux（TencentOS）跑 dry-run，验证上传/提权/状态回读。
- **服务端"在真实海外机器上完整安装"这一步我没有跑过**——因为手头没有海外服务器。脚本逻辑本身经过了 dry-run 全路径覆盖，但 `apt install`、下载二进制、`systemctl`、真实防火墙这几步的端到端，要等你给一台机器才能闭环。
- macOS / Linux 客户端脚本只做了语法与配置生成校验，没有真机验证。

我把这段话也写进了仓库的 `docs/DESIGN.md`——**没验证的部分要说清楚是没验证，而不是含糊过去**。

---

# 十、用法速查

```bash
# 全自动（推荐）
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --user root --password 'pwd'

# 隐蔽性优先
npx github:flymysql/vpn-skill setup --host 1.2.3.4 --key ~/.ssh/id_ed25519 --protocol reality

# 之后
npx github:flymysql/vpn-skill status     # 状态
npx github:flymysql/vpn-skill verify     # 验证出网
npx github:flymysql/vpn-skill link       # 拿分享链接（导到手机）
npx github:flymysql/vpn-skill down       # 断开（还原系统代理）
npx github:flymysql/vpn-skill server logs --host 1.2.3.4 --password 'pwd'
```

也把它做成了 agent skill：装上之后直接说"我的服务器是 1.2.3.4，帮我搭个 VPN 并连上"，剩下的交给它。

```bash
git clone https://github.com/flymysql/vpn-skill.git ~/vpn-skill
ln -s ~/vpn-skill ~/.dsh/skills/vpn-skill
```

---

**仓库**：[github.com/flymysql/vpn-skill](https://github.com/flymysql/vpn-skill)
**上游**：[github.com/chugzb/VPN](https://github.com/chugzb/VPN)（Apache-2.0，上游脚本原件完整保留在 `vendor/upstream/` 便于溯源）

如果这篇里有一条能带走，我希望是第七条：**先确认你的测试真的在跑。**
