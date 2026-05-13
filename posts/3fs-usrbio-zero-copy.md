---
title: 3FS 的零拷贝之路：USRBIO 是怎么把存储吞吐推到 6.6 TiB/s 的
date: 2026-03-11
updated: 2026-05-12
author: Jimmy
tags: [分布式存储, AI 基础设施, C++]
cover: assets/uploads/2026/05/3fs-usrbio-cover.webp
series: DeepSeek 数据基础设施巡礼
seriesOrder: 1
summary: DeepSeek 开源的 3FS 在 180 节点集群上实测聚合读取吞吐约 6.6 TiB/s。本文从 FUSE 的性能瓶颈讲起，拆解 3FS 如何通过共享内存、io_uring 风格的环形队列、以及 RDMA 直接传输三层叠加，把数据通路上的每一次拷贝都抠掉。
carousel: true
---

> **项目地址**：[github.com/deepseek-ai/3FS](https://github.com/deepseek-ai/3FS)
>
> **调研日期**：2026-03-11

## 一、背景与动机

3FS（Fire-Flyer File System）是 DeepSeek 开源的高性能分布式文件系统，专为 AI 训练和推理场景设计。它的存储层完全建立在现代 NVMe SSD 与 RDMA（InfiniBand / RoCE）网络之上，在 180 节点集群上实测聚合读取吞吐量达到约 **6.6 TiB/s**——这个数字在过去几乎是科研论文里才会出现的，而 3FS 把它做到了开源仓库里、可复现的程度。

### 1.1 传统 FUSE 的性能瓶颈

3FS 同时提供了 FUSE 客户端（低使用门槛）和原生客户端（高性能）两种接入方式。FUSE 用着舒服——它让一个分布式文件系统看起来就是一个本地目录，应用不需要做任何改造。但当你想榨干现代硬件的性能时，FUSE 这一层很快就会变成新的瓶颈：

| 问题 | 描述 |
|------|------|
| **内存拷贝开销** | FUSE 用户态守护进程无法直接访问应用内存，内核态↔用户态的数据要往返拷贝，消耗大量内存带宽 |
| **多线程扩展性差** | I/O 请求队列被自旋锁保护，并发越高竞争越凶；FUSE 实测处理 4 KiB 小读只能跑到约 400K iops，再加并发也不再涨 |
| **写并发限制** | Linux 5.x 上的 FUSE 不支持同一文件的并发写 |

简单说，FUSE 的设计初衷是「让用户态实现文件系统变得简单」，**但它从来不是为 RDMA + NVMe 这种硬件量级设计的**。所以 3FS 在 FUSE 守护进程内额外实现了一套**原生客户端（Native Client）**，对外暴露异步、零拷贝的 I/O 接口——它叫做 **USRBIO（User-space Ring Buffer I/O）**。

---

## 二、USRBIO 零拷贝接口设计

USRBIO 设计灵感来源于 Linux `io_uring`，核心思想可以浓缩成一句话：**绕过内核的拷贝路径，通过共享内存 + RDMA 在用户进程地址空间和存储服务之间直接搬数据**。

### 2.1 核心数据结构

USRBIO 一共围绕三个数据结构展开，理解了这三个结构基本就理解了它的全部设计哲学。

#### 2.1.1 `hf3fs_iov`（I/O Vector / 共享内存区域）

```c
struct hf3fs_iov {
  uint8_t *base;           // 共享内存基地址
  hf3fs_iov_handle iovh;   // 句柄（内部管理用）

  char id[16];             // 唯一标识
  char mount_point[256];   // 挂载点路径
  size_t size;             // 内存区域总大小
  size_t block_size;       // 数据块大小
  int numa;                // NUMA 节点亲和性
};
```

**作用**：`hf3fs_iov` 本质上是**一块大共享内存区域**，用作零拷贝读写的数据缓冲区。原生客户端会向 InfiniBand 注册这块内存（Memory Registration），让 RDMA 硬件可以直接访问它的物理页：

- **读操作**：数据从存储服务直接 RDMA Write 到此区域，**全程不经过内核**
- **写操作**：应用先把数据写进这块缓冲区，再发起写请求；存储服务通过 RDMA Read 直接拉走

理解 RDMA 注册的意义对后面的设计取舍很重要——因为内存一旦被 pin 住，物理页就不能被换出，所以 `iov` 是一个**昂贵的资源**，应该长期持有、反复复用，而不是每次 I/O 都申请。

#### 2.1.2 `hf3fs_ior`（I/O Ring / 环形请求队列）

```c
struct hf3fs_ior {
  struct hf3fs_iov iov;    // 内嵌的共享内存区域
  hf3fs_ior_handle iorh;   // 句柄

  char mount_point[256];
  bool for_read;           // true=读环，false=写环
  int io_depth;            // 批处理深度
  int priority;            // 优先级
  int timeout;             // 超时
  uint64_t flags;          // 特性标志
};
```

**作用**：`hf3fs_ior` 是用户进程与原生客户端之间的**共享环形通信缓冲区**，跟 `io_uring` 的 SQE/CQE 几乎是同款思路：

- 用户进程把 I/O 请求入队（enqueue）
- 原生客户端的 I/O Worker 线程从队列出队并处理
- 多个 `ior` 实例可并行处理，刚好契合多线程场景

`io_depth` 这个参数值得展开说一下，三种取值的语义并不直观：

| 值 | 行为 |
|----|------|
| `> 0` | 每次最多批处理 io_depth 个请求（控制单批大小，适合训练样本批加载场景） |
| `== 0` | 尽快处理所有已准备好的请求 |
| `< 0` | 尽快处理，但每次不超过 `-io_depth` 个（防止某个超大批次拖慢延迟） |

负值这个语义乍看奇怪，其实是一种「**默认低延迟、必要时降级保护**」的设计：worker 平时尽快收割，但又不至于一次吃下太多请求让其它环饿死。

#### 2.1.3 `hf3fs_cqe`（Completion Queue Entry / 完成事件）

```c
struct hf3fs_cqe {
  int32_t index;       // I/O 请求索引
  int32_t reserved;
  int64_t result;      // 返回值（字节数或 -errno）
  const void *userdata; // 用户关联数据
};
```

`userdata` 是个小但很关键的设计——它让用户在批量收割完成事件时，可以零成本地把 cqe 关联回业务层的 request 对象，省掉一张额外的索引表。

---

## 三、完整 API 流程

### 3.1 API 列表

| 函数 | 说明 |
|------|------|
| `hf3fs_iovcreate()` | 创建共享内存 IOV |
| `hf3fs_iovopen()` | 打开已有 IOV |
| `hf3fs_iovwrap()` | 把已注册的共享内存包装为 IOV（跳过创建） |
| `hf3fs_iovdestroy()` | 销毁 IOV |
| `hf3fs_iorcreate()` / `hf3fs_iorcreate4()` | 创建 IOR（多个版本，参数逐步扩充） |
| `hf3fs_iordestroy()` | 销毁 IOR |
| `hf3fs_reg_fd()` | 注册文件描述符（必须在 prep 前调用） |
| `hf3fs_dereg_fd()` | 注销文件描述符 |
| `hf3fs_prep_io()` | 准备一个 I/O 请求（加入环） |
| `hf3fs_submit_ios()` | 提交 hint（worker 可能已在处理中） |
| `hf3fs_wait_for_ios()` | 等待完成事件，收割结果 |

### 3.2 典型读操作流程

```
1. hf3fs_iovcreate()          → 分配并注册共享内存（RDMA MR）
2. hf3fs_iorcreate()          → 创建读环形队列
3. hf3fs_reg_fd(fd)           → 注册打开的文件 fd
4. [循环准备请求]
   hf3fs_prep_io(ior, iov,
     read=true, ptr,
     fd, offset, len,
     userdata)               → 把请求写入环形队列
5. hf3fs_submit_ios(ior)       → 通知 I/O Worker（可选；worker 也会主动轮询）
6. hf3fs_wait_for_ios(ior,
     cqes, cqec,
     min_results, timeout)   → 等待结果，拿到 cqe 列表
7. 处理 cqes（cqe.result >= 0 即成功的字节数）
8. 直接读 iov.base + ptr 偏移处的数据（零拷贝）
```

**注意**：`hf3fs_prep_io` **不是线程安全的**，多线程场景下每个线程应该持有独立的 `ior` 实例——这也是为什么前面说 `ior` 天然适合"一线程一环"的写法。

### 3.3 高级特性标志（`hf3fs_iorcreate4`）

| 标志 | 值 | 说明 |
|------|-----|------|
| `HF3FS_IOR_ALLOW_READ_UNCOMMITTED` | 1 | 允许读取未提交（Pending）版本数据 |
| `HF3FS_IOR_FORBID_READ_HOLES` | 2 | 禁止读取文件空洞 |

第一个标志很有意思——它放宽了一致性要求来换吞吐，对训练这种"几乎只读"的负载特别合适。第二个则相反，是给某些校验场景使用的额外严格性。

---

## 四、零拷贝的底层机制

### 4.1 RDMA 内存注册与直接传输

```
┌─────────────────────────────────────────────────────┐
│  应用进程                                            │
│  ┌─────────────────────┐                            │
│  │  hf3fs_iov.base     │ ← 用户态虚拟内存           │
│  │  (RDMA 注册内存区)  │   由 IB 驱动 pin 住物理页  │
│  └──────────┬──────────┘                            │
│             │ 零拷贝（RDMA Write/Read）              │
└─────────────┼───────────────────────────────────────┘
              │ InfiniBand / RoCE
              ▼
┌─────────────────────────────┐
│  存储服务 (Storage Service)  │
│  NVMe SSD → RDMA 硬件       │
│  直接 DMA，不经过 CPU        │
└─────────────────────────────┘
```

- **RDMA Read**（写操作时）：存储服务**主动**从客户端 `iov` 内存区拉取数据，客户端 CPU 完全不需要参与传输
- **RDMA Write**（读操作时）：存储服务把数据**直接写**到客户端的 `iov` 内存区，等客户端读到数据时同样不需要再做一次拷贝

注意这里的"主动"——RDMA 的关键不是"快"，而是**网卡可以在不打扰对端 CPU 的情况下访问对端内存**。所以两端 CPU 都解放了出来，只剩下网卡和 DMA 在跑。

### 4.2 与 io_uring 的对比

| 特性 | Linux io_uring | 3FS USRBIO |
|------|---------------|------------|
| 异步 I/O | ✅ | ✅ |
| 零拷贝 | 部分（需配合 fixed buffers） | ✅ 全程零拷贝 |
| 用户态轮询 | ✅ SQ/CQ Ring | ✅ IOR Ring |
| 网络传输层 | 内核 TCP / 本地 | RDMA（InfiniBand / RoCE） |
| 批处理控制 | `io_depth` via SQE | `io_depth` 参数 |
| 内存注册 | Fixed Buffer Registration | RDMA Memory Registration |
| 适用场景 | 本地文件 / 网络 I/O | 分布式存储大吞吐 |

可以这么理解：**USRBIO 是把 io_uring 的设计哲学延伸到了 RDMA 网络上**。io_uring 解决的是"用户态怎么和内核高效交换 I/O"，USRBIO 进一步解决的是"用户态怎么和远程存储服务高效交换 I/O"。两者并不冲突，思路一脉相承。

### 4.3 内存区域的生命周期

```
hf3fs_iovcreate()
  └─ 通过 UNIX Domain Socket 与 FUSE 守护进程通信
  └─ 在 /dev/shm 或指定路径创建共享内存
  └─ 向 IB 注册内存区域（ibv_reg_mr）
  └─ 在 3FS 虚拟目录中创建符号链接（供守护进程识别）

hf3fs_iovwrap()
  └─ 允许包装已有的共享内存（例如 PyTorch 的 tensor buffer）
  └─ 避免二次注册的开销
  └─ 注意：被包装的内存不能在 ior 使用期间被 munmap
```

`iovwrap` 这个能力对深度学习框架特别友好——PyTorch 训练时已经分配了大量 pinned memory 作为 dataloader buffer，USRBIO 可以直接复用它们而不必再开一份。这种"我不需要你额外给我内存，把现成的标记给 RDMA 注册一下就行"的接口，远比"先 alloc 再 copy"优雅。

---

## 五、C++ 高级客户端接口（hf3fs.h）

除了 C 风格的 USRBIO 接口，3FS 还提供了完整的 C++ 原生客户端 `IClient`，更适合大型应用做封装。

### 5.1 零拷贝 I/O 接口

```cpp
// 分配 RDMA 注册内存
Result<struct iovec> iovalloc(size_t bytes, int numa = -1,
                               bool global = false, size_t blockSize = 0);
void iovfree(const std::shared_ptr<iovec_handle_t> &iovh);

// 零拷贝批量读写（必须使用 iovalloc 分配的内存）
NoResult preadv(int iovcnt, const struct iovec *iov,
                const struct ioseg *segv, ssize_t *resv);
NoResult pwritev(int iovcnt, const struct iovec *iov,
                 const struct ioseg *segv, ssize_t *resv);
```

- `preadv` / `pwritev` 接受 `iovec` 数组（对应多个文件段 `ioseg`），一次调用就能批量处理多个文件
- 必须用 `iovalloc` 分配的内存才能享受零拷贝；普通 `read/write` 会走非零拷贝路径

### 5.2 跨节点 IOV 共享

```cpp
// 把 IOV 句柄序列化为字符串，可跨机器传递
Result<std::string> sharedIovecHandle(const std::shared_ptr<iovec_handle_t> &iovh);

// 在另一台机器上还原 IOV（支持 acrossAgent 跨 Agent 访问）
Result<struct iovec> openIovecHandle(const std::string &iovh, bool acrossAgent = false);
```

这个特性其实是个"小而美"的设计：分布式训练里不同节点共享同一块 IOV 的元数据，可以进一步省掉重复分配和注册——当训练规模上到几百卡之后，这种碎边际优化加起来就是肉眼可见的成本节约。

---

## 六、实际场景中的应用

USRBIO 能拿到这么夸张的数字，靠的是**针对性的场景定制**。下面三类是 3FS 设计文档里反复提到、也是它实测最快的几种工作负载。

### 6.1 AI 训练数据加载（Dataloader）

```
Dataset on 3FS
     │
     │ hf3fs_prep_io（随机偏移读）
     ▼
hf3fs_iov 共享内存
     │
     │ 直接指针传递（零拷贝）
     ▼
PyTorch DataLoader Worker
     │
     │ pin_memory（已是 Pinned Memory）
     ▼
GPU（DMA 传输）
```

训练负载的特点是**大量随机小读**（几 KiB ~ 几 MiB），这是 FUSE 路径最难受的工作模式——锁竞争和拷贝开销都呈倍数放大。USRBIO 通过批处理 + RDMA 让 dataloader 直接从 SSD 读到与 GPU pinned memory 共用的缓冲区，整条链路只剩下 NVMe + 网卡 + GPU 三段 DMA，CPU 几乎不参与。

### 6.2 KVCache 推理场景

3FS 在 KVCache 场景下实测**单节点峰值读吞吐达到 40 GiB/s**（1×400 Gbps NIC，已经接近网卡线速）。推理服务通过 USRBIO 批量拉取 KV 缓存块，直接落进 GPU 可见的内存区域，避免传统方案"SSD → CPU DRAM → GPU DRAM"的中转。这一点对大模型推理意义非常大：KV 缓存复用的时延越小，长上下文推理的端到端体验越好。

### 6.3 并行 Checkpoint 写入

大规模训练定期写 checkpoint 是另一个老大难。3FS 让多个线程各自持有独立 `ior`，并行写入不同文件块，配合 RDMA Read 的写路径，把 checkpoint 写入这件"过去阻塞训练步几十秒"的事压缩到了「几乎不影响训练步」的水平。

---

## 七、关键设计取舍与限制

3FS 不是银弹，它有非常明确的"以何种代价换性能"。这部分清单很重要，决定了你是否能直接把它套到自己的系统上：

| 项目 | 说明 |
|------|------|
| **fd 注册后不可关闭** | 注册的 fd 关闭后旧 inode 仍被使用；同整数值新 fd 注册会返回 EINVAL |
| **prep_io 非线程安全** | 同一 ior 不可多线程并发 prep_io；建议每个线程独立 ior |
| **元数据仍走 FUSE** | open / close / stat 等元数据操作走 POSIX 路径以保持兼容性，只有数据面才走零拷贝 |
| **NUMA 亲和性** | iov 与 ior 都可以指定 NUMA 节点，能显著降低跨 NUMA 内存访问延迟 |
| **写操作不支持同文件并发** | 继承自 FUSE 的限制，多线程写得分散到不同文件 |

可以看到，3FS 在「**保证元数据兼容、把数据面榨干**」这件事上做得很彻底——它没有去重新造一套元数据协议，而是把精力集中在 hot path 上。这种取舍非常理性。

---

## 八、总结

3FS USRBIO 的零拷贝实现核心是三层机制的叠加：

1. **共享内存（hf3fs_iov）**：在用户进程地址空间分配 RDMA 注册内存，消除内核↔用户态的拷贝
2. **环形队列（hf3fs_ior）**：借鉴 io_uring 的异步批处理模式，减少 RPC 次数和同步开销
3. **RDMA 直接传输**：存储服务直接通过 InfiniBand 向客户端内存写入 / 读取数据，CPU 不参与数据搬运

这三层叠加之后，3FS 能够把 NVMe SSD 和 RDMA 网络的硬件性能利用到接近上限，从而在大规模 AI 负载下达到 TiB/s 量级的存储带宽。

更值得关注的是，**3FS 没有发明任何新的底层技术**——共享内存、io_uring、RDMA 都是行业里成熟的零件。它真正的工程价值在于"**把这些零件按一个非常清醒的目标拼起来**"：所有设计取舍都围绕一句话——**让 NVMe 和 IB 网卡尽可能直接对话，CPU 只做必要的指挥**。这种"克制而坚决"的工程审美，是值得任何做存储 / 系统软件的同行细品的。

---

## 参考资料

- [3FS GitHub 仓库](https://github.com/deepseek-ai/3FS)
- [Design Notes](https://github.com/deepseek-ai/3FS/blob/main/docs/design_notes.md)
- [USRBIO API 参考（UsrbIo.md）](https://github.com/deepseek-ai/3FS/blob/main/src/lib/api/UsrbIo.md)
- [hf3fs_usrbio.h（C API 头文件）](https://github.com/deepseek-ai/3FS/blob/main/src/lib/api/hf3fs_usrbio.h)
- [hf3fs.h（C++ 原生客户端接口）](https://github.com/deepseek-ai/3FS/blob/main/src/lib/api/hf3fs.h)
