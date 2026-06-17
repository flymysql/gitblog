---
title: QQ 经典农场辅助：挂机收菜、种菜、偷菜的一键工具
date: 2026-06-17T12:00:00+08:00
updated: 2026-06-17T12:00:00+08:00
author: Jimmy
tags: [杂七杂八]
carousel: true
summary: 一个跑在 Windows 上的 QQ 经典农场（微信小游戏）桌面辅助：用图像识别锁定微信窗口，自动收菜、补种、逛好友农场偷菜，支持虚拟机前台挂机。双击 init.bat 初始化，双击 start.bat 开跑，日志写在 logs/daemon.log。
---

> **项目地址**：[github.com/flymysql/qq-farm-assistant](https://github.com/flymysql/qq-farm-assistant)
>
> 一句话：**Windows 上的 QQ 经典农场挂机脚本**——识别游戏画面里的按钮，自动收菜、种菜、偷菜，适合把微信窗口固定在虚拟机里前台跑着。

QQ 经典农场最近又火了一轮。每天定时收菜、补种、逛好友列表偷一圈，手点久了挺费事。我写了这个小工具，把重复操作交给脚本，人只要保证游戏窗口在前台、大小固定就行。

---

## 它能做什么

守护进程会按固定间隔循环执行三件事：

1. **收菜**：在自己农场识别「一键收获」，成熟作物点掉。
2. **种菜**：收完后扫描空地，自动点种子补种（可在 `config.yaml` 里开关）。
3. **偷菜**：打开好友列表，拜访可偷的农场，点「一键摘取」；顺路还能点务农、额外奖励区块等。

另外还带了 **异地登录弹窗** 的自动处理：识别到「重新登录」后等待一段时间再点，减少挂机半夜掉线没人管的情况。

点击节奏做了随机延迟，识别前会等界面稳定，尽量不像机械连点。

---

## 环境要求

- **Windows 10 / 11**
- **Python 3.10+**（从 [python.org](https://www.python.org/downloads/) 安装）
- 微信里打开 **QQ 经典农场**，窗口大小**固定**，并保持**前台可见**
- 推荐：虚拟机或副屏专门挂一个微信窗口，别最小化

图像识别基于 OpenCV 模板匹配，按钮截图放在 `templates/` 目录。换电脑或改了窗口大小后需要重新初始化。

---

## 怎么用（三步）

### 1. 下载

```powershell
git clone https://github.com/flymysql/qq-farm-assistant.git
cd qq-farm-assistant
```

### 2. 初始化（新机器 / 换窗口大小必做）

1. 微信里打开 QQ 经典农场
2. 把游戏窗口调到日常使用的**固定大小**
3. 站在**自己农场**（底部导航栏可见）
4. **双击 `init.bat`**

首次会自动创建虚拟环境、安装依赖，并检查模板是否齐全、记录窗口尺寸、测一遍截图和导航按钮识别。

> 换电脑或改了窗口大小后，重新跑一次 `init.bat` 即可。日常挂机**不用**每次跑初始化。

### 3. 启动

**双击 `start.bat`**，程序进入守护循环，默认每 5 秒一轮（可在 `config.yaml` 的 `poll_interval_seconds` 修改）。

- 日志：`logs/daemon.log`
- 统计：`logs/daemon_stats.json`
- 停止：`Ctrl+C`，或把鼠标移到屏幕左上角（pyautogui 紧急停止）

---

## 配置里常改的几项

`config.yaml` 改完保存，**重启 `start.bat`** 生效。

| 配置项 | 说明 |
|--------|------|
| `poll_interval_seconds` | 每轮收菜 + 偷菜的间隔（秒） |
| `plant_enabled` | 是否收菜后自动补种 |
| `steal_max_friends` | 每轮最多拜访几个好友 |
| `click_delay_min_ms` / `click_delay_max_ms` | 点击后随机等待，模拟人工 |
| `capture_mode` | `auto` / `screen` / `hwnd`；虚拟机或 RDP 截图异常时可设 `screen` |
| `match_threshold` | 模板匹配阈值，误点多可提到 0.88 左右 |

更细的偷菜轮询、务农模板、种子栏区域等都在同一个文件里，带中文注释。

---

## 排错用脚本

| 文件 | 用途 |
|------|------|
| `init.bat` | 新机器 / 换窗口必跑 |
| `start.bat` | 启动守护进程 |
| `calibrate.bat` | 只重新保存窗口尺寸 |
| `test_capture.bat` | 截图是否正常 |
| `test_nav.bat` | 底部导航按钮识别分数 |

模板怎么采、怎么替换，见仓库里的 `templates/README.md`。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| 提示找不到 Python | 安装 Python 3.10+ 后重跑 `init.bat` |
| 虚拟机 / 远程桌面截图黑屏 | `config.yaml` 设 `capture_mode: screen`，窗口保持前台 |
| 日志出现 `ratio=1.5` 一类警告 | 固定窗口大小后重跑 `init.bat` |
| 按钮老点偏 | 跑 `test_nav.bat` 或 `test_capture.bat` 看匹配分数 |

---

## 技术实现（简略）

不写长文，只列个轮廓，有兴趣的直接看源码：

- **窗口**：按标题 / 进程名锁定微信窗口，截图前自动聚焦
- **识别**：OpenCV 多尺度模板匹配 + 按窗口尺寸自动缩放模板
- **任务**：`HarvestTask` / `PlantTask` / `StealTask` / `ReloginTask` 拆成独立模块，由 `FarmDaemon` 轮询调度
- **输入**：pyautogui 点击，带 FAILSAFE（鼠标左上角急停）

---

## 免责声明

本项目仅供**个人学习与研究**。使用风险自负，请遵守游戏及相关服务条款，勿用于任何可能违反规定的场景。

如果你也在怀旧农场、又不想被闹钟绑架，欢迎 Star 或提 Issue。有识别不准的按钮模板，也可以按 `templates/README.md` 自己补一张图 PR 回来。
