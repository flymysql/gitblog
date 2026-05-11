---
title: "nebula graph 图计算数据库"
date: 2022-03-11T15:03:00+08:00
updated: 2022-03-11T15:03:00+08:00
author: "兰州小红鸡"
tags:
  - "图数据库"
  - nebula
  - "图计算"
summary: "更新历史 在学习过程中，本文持续更新 2021 12 13：更新nebula官方介绍 2021 12 14：更新编译与部署方式，总结importer导入方式 2021 12 15：…"
origin:
  from: cnblogs
  url: https://www.cnblogs.com/gitpull/p/15993772.html
  id: 15993772
  cnblogsDate: "2022-03-11 15:03"
---

目录

-   [更新历史](#更新历史)
-   [什么是nebula graph](#什么是nebula-graph)
    -   [举个例子](#举个例子)
-   [服务架构](#服务架构)
    -   [graph 服务](#graph-服务)
    -   [Meta服务](#meta服务)
        -   [META 服务架构](#meta-服务架构)
    -   [Storage 服务](#storage-服务)
    -   [Raft 协议](#raft-协议)
        -   [raft故障流程](#raft故障流程)
-   [nebula的数据模型](#nebula的数据模型)
-   [编译部署](#编译部署)
    -   [使用docker编译](#使用docker编译)
    -   [在线编译](#在线编译)
    -   [生产环境配置要求](#生产环境配置要求)
    -   [运行部署](#运行部署)
        -   [安装准备](#安装准备)
        -   [手动部署](#手动部署)
-   [使用nebula](#使用nebula)
    -   [客户端连接](#客户端连接)
        -   [console 和 web端](#console-和-web端)
        -   [客户端sdk](#客户端sdk)
    -   [常用命令](#常用命令)
    -   [常用的查询与匹配命令](#常用的查询与匹配命令)
        -   [MATCH匹配](#match匹配)
    -   [nebula-importer 批量导入](#nebula-importer-批量导入)
        -   [点配置](#点配置)
        -   [边配置](#边配置)
    -   [使用Exchange导入](#使用exchange导入)
-   [nebula集群](#nebula集群)
-   [nebula 进阶学习](#nebula-进阶学习)

## 更新历史

在学习过程中，本文持续更新

-   2021-12-13：更新nebula官方介绍
-   2021-12-14：更新编译与部署方式，总结importer导入方式
-   2021-12-15：更新使用用例，常见命令等
-   2021-12-16：更新nebula集群部署方式，更新Match语法使用总结
-   2021-12-17：添加raft协议示例
-   2021-12-22：添加运行环境配置要求
-   2022-01-10：添加nebula进阶学习

## 什么是nebula graph

官方：Nebula Graph 是一款开源的、分布式的、易扩展的原生图数据库，能够承载数千亿个点和数万亿条边的超大规模数据集，并且提供毫秒级查询。

什么是图数据库？

> 图数据库是图数据库管理系统的简称，使用图形化的模型进行查询的数据库，通过节点、边和属性等方式来表示和存储数据，支持增删改查等操作，提供在线事务处理能力。与图数据库对应的是图计算引擎，提供基于图的大数据分析能力。

Nebula Graph 作为一个典型的图数据库，可以将丰富的关系通过边及其类型和属性自然地呈现。

简单来说，传统的关系型数据库，如果要查询不同实体之间的关系，比如一层或者多层的关系时候，需要多次的KV查询才能得到结果，而图数据库可以直接从点出发一次查询与该点的深层次的关系的其他实体。

图数据库和关系型数据库的区别具体介绍可以看：[https://zhuanlan.zhihu.com/p/50171330](https://zhuanlan.zhihu.com/p/50171330)

### 举个例子

在推荐召回中的swingi2i召回模型中，使用传统的kv查询我们需要

1.  从用户id去查询一次用户行为历史
2.  再由每个用户行为历史去查询对应的相似item  
    一共两次数据库查询，并且第二次查询为多key的mget。

但使用图数据库，我们可以使用一次查询便得到结果。

```
# 匹配从uuid为1的user点出发经过click连接doc点再经过swing边连接的doc点的所有路径
match p=(v:user{uuid:"123"})-[e:click]->(v2)-[e2:swing]->(v3) return p
```

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-01.png)

甚至更直观的我们还可以看到返回的simItem里面高度重合的部分  
![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-02.png)

## 服务架构

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-03.png)

Nebula Graph 由三种服务构成：Graph 服务、Meta 服务和 Storage 服务，是一种存储与计算分离的架构。

### graph 服务

Graph 服务主要负责处理查询请求，包括解析查询语句、校验语句、生成执行计划以及按照执行计划执行四个大步骤。

1.  Parser：词法语法解析模块。
2.  Validator：语义校验模块。
3.  Planner：执行计划与优化器模块。
4.  Executor：执行引擎模块。

关于四个步骤的具体事务可以看官方介绍：[https://docs.nebula-graph.com.cn/2.6.1/1.introduction/3.nebula-graph-architecture/3.graph-service/](https://docs.nebula-graph.com.cn/2.6.1/1.introduction/3.nebula-graph-architecture/3.graph-service/)

### Meta服务

#### META 服务架构

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-04.png)

在集群模式下，所有 nebula-metad 进程构成了基于 Raft 协议的集群，其中一个进程是 leader，其他进程都是 follower。leader 是由多数派选举出来，只有 leader 能够对客户端或其他组件提供服务，其他 follower 作为候补，如果 leader 出现故障，会在所有 follower 中选举出新的 leader。

1.  提供账号管理功能  
    Meta 服务中存储了用户的账号和权限信息，当客户端通过账号发送请求给 Meta 服务，Meta 服务会检查账号信息，以及该账号是否有对应的请求权限。
    
2.  管理分片  
    Meta 服务负责存储和管理分片的位置信息，并且保证分片的负载均衡。
    
3.  管理图空间  
    Nebula Graph 支持多个图空间，不同图空间内的数据是安全隔离的。Meta 服务存储所有图空间的元数据（非完整数据），并跟踪数据的变更，例如增加或删除图空间。
    
4.  管理schema信息  
    Nebula Graph 是强类型图数据库，它的 Schema 包括 Tag、Edge type、Tag 属性和 Edge type 属性。Meta 服务中存储了 Schema 信息，同时还负责 Schema 的添加、修改和删除，并记录它们的版本。
    
5.  管理数据生命周期 TTL  
    Meta 服务存储 TTL（Time To Live）定义信息，可以用于设置数据生命周期。数据过期后，会由 Storage 服务进行处理。
    
6.  管理作业  
    Meta 服务中的作业管理模块负责作业的创建、排队、查询和删除。
    

### Storage 服务

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-05.png)

和Meta一样，Storage也是用Raft协议作集群。  
**storage的三个服务层次**

1.  Storage interface 层  
    Storage 服务的最上层，定义了一系列和图相关的 API。API 请求会在这一层被翻译成一组针对分片的 KV 操作。正是这一层的存在，使得 Storage 服务变成了真正的图存储，否则 Storage 服务只是一个 KV 存储服务。
2.  Consensus 层  
    Storage 服务的中间层，实现了 Multi Group Raft，用于storage集群。
3.  Store Engine 层  
    Storage 服务的最底层，是一个单机版本地存储引擎，提供对本地数据的get、put、scan等操作。

### Raft 协议

Raft 就是一种用于保证多副本一致性的协议。Raft 采用多个副本之间竞选的方式，赢得”超过半数”副本投票的(候选)副本成为 Leader，由 Leader 代表所有副本对外提供服务；其他 Follower 作为备份。

当该 Leader 出现异常后(通信故障、运维命令等)，其余 Follower 进行新一轮选举，投票出一个新的 Leader。Leader 和 Follower 之间通过心跳的方式相互探测是否存活，并以 Raft-wal 的方式写入硬盘，超过多个心跳仍无响应的副本会认为发生故障。

#### raft故障流程

假设3个机器，3个partition， 3个副本(A, B, C)，L标识为leader副本

| 机器1 | 机器2 | 机器3 |
| --- | --- | --- |
| A1(L) | A2(L) | A3(L) |
| B2 | B3 | B1 |
| C3 | C1 | C2 |
| 假设A为Leader， 当机器1故障时，系统剩下的分区为 |  |  |

| ~机器1~ | 机器2 | 机器3 |
| --- | --- | --- |
| ~A1~ | A2(L) | A3(L) |
| ~B2~ | B3 | B1 |
| ~C3~ | C1 | C2 |

可以看到分区1的leader故障，需要重新选出分区1的leader，假设经过选举，选出了B1作为分区1的leader。

| ~机器1~ | 机器2 | 机器3 |
| --- | --- | --- |
| ~A1~ | A2(L) | A3(L) |
| ~B2~ | B3 | B1(L) |
| ~C3~ | C1 | C2 |

## nebula的数据模型

-   图空间 space  
    图空间用于隔离不同团队或者项目的数据。不同图空间的数据是相互隔离的，可以指定不同的存储副本数、权限、分片等。
    
-   标签 Tag  
    Tag 由一组事先预定义的属性构成，用于定义点的类型。
    
-   边类型 Edge type  
    Edge type 由一组事先预定义的属性构成，用于定义边的类型。
    
-   属性 Properties  
    属性是指以键值对（Key-value pair）形式存储的信息。
    
-   点 Vertex
    
    -   点用来保存实体对象，点是用点标识符（VID）标识的。VID在同一图空间中唯一。VID 是一个 int64，或者 fixed\_string(N)。
    -   点必须有至少一个 Tag，也可以有多个 Tag。但不能没有 Tag。

nebula 常用命令可以见：[https://docs.nebula-graph.com.cn/2.6.1/2.quick-start/4.nebula-graph-crud/](https://docs.nebula-graph.com.cn/2.6.1/2.quick-start/4.nebula-graph-crud/)

## 编译部署

如果使用官方编译的包部署，可以跳过编译部分，下面讲如何在自己环境编译nebula包。

### 使用docker编译

1.  本地安装好 Docker
2.  将 vesoft/nebula-dev 镜像 pull 到本地

```
$ docker pull vesoft/nebula-dev
```

3.  运行 Docker 并挂载 Nebula 源码目录到容器的 /home/nebula 目录

```
$ docker run --rm -ti -v nebula本地路径:/home/nebula vesoft/nebula-dev bash
```

4.  进到/home/nebula路径下进行编译

```
$ mkdir build && cd build
$ cmake -DCMAKE_INSTALL_PREFIX=/usr/local/nebula -DENABLE_TESTING=OFF -DCMAKE_BUILD_TYPE=Release ..
$ make -j{N} # E.g., make -j2
$ make install
```

### 在线编译

不推荐，依赖较多，比较难解决

### 生产环境配置要求

**生产环境部署方式**

-   3 个元数据服务进程 metad
-   至少 3 个存储服务进程 storaged
-   至少 3 个查询引擎服务进程 graphd  
    以上进程都无需独占机器。例如一个由 5 台机器组成的集群：A、B、C、D、E，可以如下部署：
-   A：metad, storaged, graphd
-   B：metad, storaged, graphd
-   C：metad, storaged, graphd
-   D：storaged, graphd
-   E：storaged, graphd

> 同一个集群不要跨机房部署。 metad 每个进程都会创建一份元数据的存储副本，因此通常只需 3 个进程。storaged 进程数量不影响图空间数据的副本数量。

**服务器配置要求(标准配置)**  
以 AWS EC2 c5d.12xlarge 为例：

-   处理器：48 core
-   内存：96 GB
-   存储：2 \* 900 GB, NVMe SSD
-   Linux 内核：3.9 或更高版本，通过命令 uname -r 查看
-   glibc：2.12 或更高版本，通过命令 ldd --version 查看

**资源估算**

-   存储空间（全集群）：点和边数量 \* 平均属性的字节数 \* 6
-   内存（全集群）：点边数量 \* 15 字节 + RocksDB 实例数量 \* (write\_buffer\_size \* max\_write\_buffer\_number + rocksdb\_block\_cache), 其中 etc/nebula-storaged.conf 文件中 --data\_path 项中的每个目录对应一个 RocksDB 实例
-   图空间 partition 数量：全集群硬盘数量 \* （2 至 10 —— 硬盘越好该值越大）
-   内存和硬盘另预留 20% buffer。
-   rocksdb\_block\_cache官方建议 1/3 内存

**关于机械硬盘和千兆网络**

> Nebula Graph 设计时主要针对的硬件设备是 NVMe SSD 和万兆网。没有对于机械磁盘和千兆网络做过适配，以下是一些需调整的参数：

-   etc/nebula-storage.conf：
    -   \--raft\_rpc\_timeout\_ms= 5000 至 10000
    -   \--rocksdb\_batch\_size= 4096 至 16384
    -   \--heartbeat\_interval\_secs = 30 至 60
    -   \--raft\_heartbeat\_interval\_secs = 30 至 60
-   etc/nebula-meta.conf：
    -   \--heartbeat\_interval\_secs 与 etc/nebula-storage.conf 该项相同
-   Spark Writer:

```
rate: {
 timeout: 5000 至 10000
 }
```

-   go-importer:
    -   batchSize: 10 至 50
    -   concurrency: 1 至 10
    -   channelBufferSize：100 至 500
-   创建图空间时partition 值为全集群硬盘数量 2 倍

**注意：上面是针对机械硬盘和千兆网络的优化，如果有SSD和万兆网就不必设置**

### 运行部署

#### 安装准备

-   若使用官方rpm包，直接rpm安装即可。
-   若使用在线编译，进到install目录下执行启动

#### 手动部署

1.  更改配置文件，将etc目录下的nebula-xxxx-conf.default改名或者copy为nebula-xxxx-conf。
    
2.  查看端口是否有被占用：
    
    -   nebula三个服务的默认端口：9559、9669、9779；
    -   对应的三个http端口：19559、19669、19779；
    -   三个http2的端口：19560、19670、19780
    -   启动前要查看这9个端口有没有被占用。如果要修改端口的话在对应的conf文件里修改。
3.  运行
    

```
# 启动所有服务
./scripts/nebula.service start all
# 命令格式
./scripts/nebula.service [-v] [-c /path/to/config] <start|stop|restart|status|kill> <metad|graphd|storaged|all>
```

4.  查看是否启动成功

```
./scripts/nebula.service status all
```

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-06.png)

三个端口都正常说明启动成功，有某一个端口不正常，应该排查端口是否被占用，可以logs目录下的日志查看报错。

5.  停止服务

-   stop停止服务

```
./scripts/nebula.service stop all
```

虽然服务停止，但是进程并不会退出，端口的占用也不会释放。如果要在运行环境重新部署，请使用kill原服务，

-   kill 完全停止服务

```
./scripts/nebula.service kill all
```

## 使用nebula

### 客户端连接

#### console 和 web端

可以连接nebula的客户端有终端nebula-console，studio的web界面。两个工具可以在官网下载。[https://docs.nebula-graph.com.cn/2.6.1/2.quick-start/3.connect-to-nebula-graph/](https://docs.nebula-graph.com.cn/2.6.1/2.quick-start/3.connect-to-nebula-graph/)  
nebula studio需要 v10.12.0 以上的 Node.js。

> 使用一键部署的，在部署的时候已经装好nebula studio，直接访问对应的ip端口即可。

启动成功后，在浏览器地址栏输入 [http://ip](http://ip) address:7001。

如果在浏览器窗口中能看到以下登录界面，表示已经成功部署并启动 Studio。  
![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-07.png)

#### 客户端sdk

1.  Nebula CPP ： [https://github.com/vesoft-inc/nebula-cpp](https://github.com/vesoft-inc/nebula-cpp)
2.  Nebula Java：[https://github.com/vesoft-inc/nebula-java/tree/v2.6.1](https://github.com/vesoft-inc/nebula-java/tree/v2.6.1)
3.  Nebula Python：[https://github.com/vesoft-inc/nebula-python](https://github.com/vesoft-inc/nebula-python)
4.  Nebula Go：[https://github.com/vesoft-inc/nebula-go/tree/v2.6.0](https://github.com/vesoft-inc/nebula-go/tree/v2.6.0)

### 常用命令

1.  创建图空间

```
nebula> create space SpaceName(partition_num=15, replica_factor=1, vid_type=fixed_string(30));
```

**注意:**

-   partition\_num：指定一个副本中的分区数。通常为全集群硬盘数量的 5 倍。
-   replica\_factor：指定集群中副本的数量，通常生产环境为 3，测试环境可以为 1。由于采用多数表决原理，因此需为奇数。
-   你可以通过 SHOW HOSTS 命令检查机器和 partition 分布情况：

2.  执行命令SHOW HOSTS检查分片的分布情况
3.  选择空间 USE SPACE
4.  创建 Tag 和 Edge type

```
CREATE {TAG | EDGE} {<tag_name> | <edge_type>}(<property_name> <data_type>
[, <property_name> <data_type> ...])
[COMMENT = '<comment>'];
```

示例：

```
nebula> CREATE TAG player(name string, age int);

nebula> CREATE TAG team(name string);

nebula> CREATE EDGE follow(degree int);

nebula> CREATE EDGE serve(start_year int, end_year int);
```

5.  插入点

```
INSERT VERTEX [IF NOT EXISTS] <tag_name> (<property_name>[, <property_name>...])
[, <tag_name> (<property_name>[, <property_name>...]), ...]
{VALUES | VALUE} <vid>: (<property_value>[, <property_value>...])
[, <vid>: (<property_value>[, <property_value>...];
```

INSERT VERTEX TAG名称 Value VID:(属性列表)，示例

```
nebula> INSERT VERTEX player(name, age) VALUES "player100":("Tim Duncan", 42);

nebula> INSERT VERTEX player VALUES "player101":("Tony Parker", 36);

nebula> INSERT VERTEX player VALUES "player102":("LaMarcus Aldridge", 33);

nebula> INSERT VERTEX team(name) VALUES "team203":("Trail Blazers"), "team204":("Spurs");
```

6.  插入边

```
INSERT EDGE [IF NOT EXISTS] <edge_type> (<property_name>[, <property_name>...])
{VALUES | VALUE} <src_vid> -> <dst_vid>[@<rank>] : (<property_value>[, <property_value>...])
[, <src_vid> -> <dst_vid>[@<rank>] : (<property_name>[, <property_name>...]), ...];
```

INSERT EDGE EDGE类型名 Values src点Vid -> dts点Vid : (属性列表)  
示例

```
nebula> INSERT EDGE follow(degree) VALUES "player101" -> "player100":(95);

nebula> INSERT EDGE follow(degree) VALUES "player101" -> "player102":(90);

nebula> INSERT EDGE follow(degree) VALUES "player102" -> "player100":(75);

nebula> INSERT EDGE serve(start_year, end_year) VALUES "player101" -> "team204":(1999, 2018),"player102" -> "team203":(2006,  2015);
```

7.  创建索引

```
CREATE {TAG | EDGE} INDEX [IF NOT EXISTS] <index_name>
ON {<tag_name> | <edge_name>} ([<prop_name_list>]) [COMMENT = '<comment>'];
```

示例

```
CREATE TAG INDEX player_index on player()
```

> 需要注意的是，索引创建后再插入的数据，并不在索引之中，数据更新后需要手动重建索引

重建索引

```
REBUILD TAG INDEX player_index
```

### 常用的查询与匹配命令

#### MATCH匹配

MATCH的语法概括如下：

```
MATCH <pattern> [<WHERE clause>] RETURN <output>;
```

MATCH用于寻找与规则匹配的点和边，MATCH语句使用原生索引查找起始点或边，起始点或边可以在模式的任何位置。即一个有效的MATCH语句，**必须有一个属性、Tag 或 Edge type 已经创建索引，或者在WHERE子句中用 id() 函数指定了特定点的 VID**

1.  匹配整个TAG的点  
    用户可以在点的右侧用`:<tag_name>`表示模式中的 `Tag`。

```
nebula> MATCH (v:player) RETURN v;
+---------------------------------------------------------------+
| v                                                             |
+---------------------------------------------------------------+
| ("player105" :player{age: 31, name: "Danny Green"})           |
| ("player109" :player{age: 34, name: "Tiago Splitter"})        |
| ("player111" :player{age: 38, name: "David West"})            |
+---------------------------------------------------------------+
```

2.  匹配符合属性的点  
    用户可以在 `Tag` 的右侧用`{<prop_name>: <prop_value>}`表示模式中点的属性。

```
nebula> MATCH (v:player{name:"Tim Duncan"}) RETURN v;
+----------------------------------------------------+
| v                                                  |
+----------------------------------------------------+
| ("player100" :player{age: 42, name: "Tim Duncan"}) |
+----------------------------------------------------+
```

同样可以使用`where`语句来实现

```
nebula> MATCH (v:player) WHERE v.name == "Tim Duncan" RETURN v;
```

3.  匹配指定ID的多个点  
    可以使用点 ID 去匹配点。`id()`函数可以检索点的 ID。如果要匹配多个点，可以用IN指定ID列表

```
nebula> MATCH (v:player { name: 'Tim Duncan' })--(v2) \
        WHERE id(v2) IN ["player101", "player102"] \
        RETURN v2;
+-----------------------------------------------------------+
| v2                                                        |
+-----------------------------------------------------------+
| ("player101" :player{age: 36, name: "Tony Parker"})       |
| ("player102" :player{age: 33, name: "LaMarcus Aldridge"}) |
+-----------------------------------------------------------+
```

4.  匹配有边连接的两个点

-   可以使用`--`符号表示两个方向的边，并匹配这些边连接的点。
-   可以在`--`符号上增加`<`或`>`符号指定边的方向。
    -   `-->` 表示出边
    -   `<--` 表示入边

```
# 查询：与属性name为Tim Duncan的点有边连接的所有点的name
nebula> MATCH (v:player{name:"Tim Duncan"})--(v2) \
        RETURN v2.name AS Name;
+---------------------+
| Name                |
+---------------------+
| "Spurs"             |
| "Tony Parker"       |
| "LaMarcus Aldridge" |
| "Marco Belinelli"   |
...
```

```
# 查询：从属性name为Tim Duncan的点出发的边所指向的所有点的name
nebula> MATCH (v:player{name:"Tim Duncan"})-->(v2) \
        RETURN v2.name AS Name;
+-----------------+
| Name            |
+-----------------+
| "Spurs"         |
| "Tony Parker"   |
| "Manu Ginobili" |
+-----------------+
```

5.  匹配更深层次的连接关系  
    比如QQ上面我们需要去匹配某个人的好友的好友，也就是共同好友的关系

```
# 查询：与属性name为Tim Duncan点有连接的所有点的它们的所有有连接的点
nebula> MATCH (v:player{name:"Tim Duncan"})-->(v2)<--(v3) \
        RETURN v3.name AS Name;
+---------------------+
| Name                |
+---------------------+
| "Dejounte Murray"   |
| "LaMarcus Aldridge" |
| "Marco Belinelli"   |
...
```

这个层次还可以继续往下查询得更深，比如有个观点大概就是，这个社交网络中任意两人之间的关系间隔不超过五个人，于是我们便可以通过图数据库去查询和自己有5层连接深度关系的所有点，看看是否能够覆盖整个网络。而这个种操作在传统的关系型数据库使用kv查询是很难实现的。

6.  匹配路径  
    点与点之间的连接构成一条路径，查询时可以使用自定义变量名来命名路径

```
# 匹配以属性name为Tim Duncan的点为起点的所有路径
nebula> MATCH p=(v:player{name:"Tim Duncan"})-->(v2) \
        RETURN p;
+--------------------------------------------------------------------------------------------------------------------------------------+
| p                                                                                                                                    |
+--------------------------------------------------------------------------------------------------------------------------------------+
| <("player100" :player{age: 42, name: "Tim Duncan"})-[:serve@0 {end_year: 2016, start_year: 1997}]->("team204" :team{name: "Spurs"})> |
| <("player100" :player{age: 42, name: "Tim Duncan"})-[:follow@0 {degree: 95}]->("player101" :player{age: 36, name: "Tony Parker"})>   |
| <("player100" :player{age: 42, name: "Tim Duncan"})-[:follow@0 {degree: 95}]->("player125" :player{age: 41, name: "Manu Ginobili"})> |
+--------------------------------------------------------------------------------------------------------------------------------------+
```

7.  匹配边  
    查询时可以在方括号中使用自定义变量命名边。例如`-[e]-`。

```
匹配：与属性name为Tim Duncan的点有连接的所有边
nebula> MATCH (v:player{name:"Tim Duncan"})-[e]-(v2) \
        RETURN e;
+-----------------------------------------------------------------------+
| e                                                                     |
+-----------------------------------------------------------------------+
| [:serve "player100"->"team204" @0 {end_year: 2016, start_year: 1997}] |
| [:follow "player101"->"player100" @0 {degree: 95}]                    |
| [:follow "player102"->"player100" @0 {degree: 75}]                    |
...
```

8.  匹配EDGE TYPE  
    和点一样，用户可以用:<edge\_type>表示模式中的 Edge type，例如`-[e:follow]-`。

```
匹配edge type为follow的边
nebula> MATCH ()-[e:follow]-() RETURN e;
+-----------------------------------------------------+
| e                                                   |
+-----------------------------------------------------+
| [:follow "player104"->"player105" @0 {degree: 60}]  |
| [:follow "player113"->"player105" @0 {degree: 99}]  |
| [:follow "player105"->"player100" @0 {degree: 70}]  |
...
```

9.  匹配多个EDGE TYPE  
    使用`|`可以匹配多个 Edge type，例如`[e:follow|:serve]`。第一个 Edge type 前的英文冒号`:`不可省略，后续 Edge type 前的英文冒号可以省略，例如`[e:follow|serve]`。

```
nebula> MATCH (v:player{name:"Tim Duncan"})-[e:follow|:serve]->(v2) RETURN e;
+---------------------------------------------------------------------------+
| e                                                                         |
+---------------------------------------------------------------------------+
| [:follow "player100"->"player101" @0 {degree: 95}]                        |
| [:follow "player100"->"player125" @0 {degree: 95}]                        |
| [:serve "player100"->"team204" @0 {end_year: 2016, start_year: 1997}]     |
+---------------------------------------------------------------------------+
```

10.  匹配多条边

```
# 匹配从点Tim Duncan出发所有边的所有入端点v2和与之有server边连接的出端点v3
nebula> MATCH (v:player{name:"Tim Duncan"})-[]->(v2)<-[e:serve]-(v3) \
        RETURN v2, v3;
+----------------------------------+-----------------------------------------------------------+
| v2                               | v3                                                        |
+----------------------------------+-----------------------------------------------------------+
| ("team204" :team{name: "Spurs"}) | ("player104" :player{age: 32, name: "Marco Belinelli"})   |
| ("team204" :team{name: "Spurs"}) | ("player101" :player{age: 36, name: "Tony Parker"})       |
| ("team204" :team{name: "Spurs"}) | ("player102" :player{age: 33, name: "LaMarcus Aldridge"}) |
...
```

11.  匹配定长路径的边  
     可以在模式中使用`:<edge_type>*<hop>`匹配定长路径。`hop`必须是一个非负整数。

```
# 匹配从Tim Duncan点出发长度为2的路径
# 注意：匹配多跳路径的时候，e不再是一条边，而是一个hop大小的e的list
nebula> MATCH p=(v:player{name:"Tim Duncan"})-[e:follow*2]->(v2) \
        RETURN DISTINCT v2 AS Friends;
+-----------------------------------------------------------+
| Friends                                                   |
+-----------------------------------------------------------+
| ("player100" :player{age: 42, name: "Tim Duncan"})        |
| ("player125" :player{age: 41, name: "Manu Ginobili"})     |
| ("player102" :player{age: 33, name: "LaMarcus Aldridge"}) |
+-----------------------------------------------------------+
```

12.  匹配边长路径  
     用户可以在模式中使用`:<edge_type>*[minHop]..<maxHop>`匹配变长路径。

```
# 匹配从Tim Duncan点出发长度为1~3的路径
nebula> MATCH p=(v:player{name:"Tim Duncan"})-[e:follow*1..3]->(v2) \
        RETURN v2 AS Friends;
+-----------------------------------------------------------+
| Friends                                                   |
+-----------------------------------------------------------+
| ("player101" :player{age: 36, name: "Tony Parker"})       |
| ("player125" :player{age: 41, name: "Manu Ginobili"})     |
| ("player100" :player{age: 42, name: "Tim Duncan"})        |
...
```

更多命令见官方文档：[https://docs.nebula-graph.com.cn/2.6.1/2.quick-start/6.cheatsheet-for-ngql-command/](https://docs.nebula-graph.com.cn/2.6.1/2.quick-start/6.cheatsheet-for-ngql-command/)

### nebula-importer 批量导入

Importer 可以读取本地的 CSV 文件，然后导入数据至 Nebula Graph 图数据库中。在我的仓库离线编译的包里面已自带nebula-importer，也可以使用官方最新包。使用方法：

```
./nebula-importer --config configFile.yml
```

配置文件示例

```
# 连接的Nebula Graph版本，连接2.x时设置为v2。
version: v2
description: example

# 是否删除临时生成的日志和错误数据文件。
removeTempFiles: false
clientSettings:

  # nGQL语句执行失败的重试次数。
  retry: 3
  # Nebula Graph客户端并发数。
  concurrency: 10 
  # 每个Nebula Graph客户端的缓存队列大小。
  channelBufferSize: 128
  # 指定数据要导入的Nebula Graph图空间。
  space: test
  # 连接信息。
  connection:
    user: root
    password: nebula
    address: 10.97.174.132:9669

  postStart:
    # 配置连接Nebula Graph服务器之后，在插入数据之前执行的一些操作。
    commands: |
      USE search_rec_hin_graph;
    # 执行上述命令后到执行插入数据命令之间的间隔。
    afterPeriod: 1s

  preStop:
    # 配置断开Nebula Graph服务器连接之前执行的一些操作。
    commands: |

# 错误等日志信息输出的文件路径。    
logPath: ./err/test.log
# CSV文件相关设置。
files:

    # 数据文件的存放路径，如果使用相对路径，则会将路径和当前配置文件的目录拼接。本示例第一个数据文件为点的数据。
  - path: ./test.csv
    # 插入失败的数据文件存放路径，以便后面补写数据。
    failDataPath: ./err/search_rec_hin_grapherr.csv
    # 读取数据的行数限制。
    limit: 10
    # 是否按顺序在文件中插入数据行。如果为false，可以避免数据倾斜导致的导入速率降低。
    inOrder: true
    # 文件类型，当前仅支持csv。
    type: csv
    csv:
      # 是否有表头。
      withHeader: false
      # 是否有LABEL。
      withLabel: false
      # 指定csv文件的分隔符。只支持一个字符的字符串分隔符。
      delimiter: ","

    schema:
      # Schema的类型，可选值为vertex和edge。
      type: vertex
      vertex:
        # 点ID设置。
        vid:
           # 点ID对应CSV文件中列的序号。CSV文件中列的序号从0开始。
           index: 0
           # 点ID的数据类型，可选值为int和string，分别对应Nebula Graph中的INT64和FIXED_STRING。
           type: string

        # 标签设置。   
        tags:
            # 标签名称。
          - name: query
            # 标签内的属性设置。
            props:
                # 属性名称。
              - name: query
                # 属性数据类型。
                type: string
                # 属性对应CSV文件中列的序号。
                index: 1
              - name: lang
                type: string
                index: 2
              - name: region
                type: string
                index: 3
```

#### 点配置

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-08.png)

#### 边配置

```
schema:
  type: edge
  edge:
    name: follow
    withRanking: true
    srcVID:
      type: string
      index: 0
    dstVID:
      type: string
      index: 1
    rank:
      index: 2
    props:
      - name: degree
        type: double
        index: 3
```

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-09.png)

### 使用Exchange导入

Exchange可以将不同数据源的数据导入到nebula数据库，便于迁移数据。  
支持的数据列表：  
![image.png](http://image.huawei.com/tiny-lts/v1/images/3a5d9573a940364935c1abd68db6685b_242x439.png@900-0-90-f.png)

详情：[https://docs.nebula-graph.com.cn/2.6.1/nebula-exchange/use-exchange/ex-ug-import-from-csv/](https://docs.nebula-graph.com.cn/2.6.1/nebula-exchange/use-exchange/ex-ug-import-from-csv/)

## nebula集群

现在我们用2台机器举例做部署方案（这里只是举例，在实际的生产环境中建议5个节点以上的集群，才能发挥集群的可靠性优势）  
![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-11.png)

步骤1：将nebula的安装解压到两台机器上  
步骤2：修改每个服务器上的Nebula Graph配置文件。  
Nebula Graph的所有配置文件均位于安装目录的etc目录内，包括nebula-graphd.conf、nebula-metad.conf和nebula-storaged.conf，用户可以只修改所需服务的配置文件。

机器A配置  
nebula-graphd.conf

```
########## networking ##########
# Comma separated Meta Server Addresses
--meta_server_addrs=192.168.10.111:9559,192.168.10.112:9559
# Local IP used to identify the nebula-graphd process.
# Change it to an address other than loopback if the service is distributed or
# will be accessed remotely.
--local_ip=192.168.10.111
# Network device to listen on
--listen_netdev=any
# Port to listen on
--port=9669
```

nebula-storaged.conf

```
########## networking ##########
# Comma separated Meta server addresses
--meta_server_addrs=192.168.10.111:9559,192.168.10.112:9559
# Local IP used to identify the nebula-storaged process.
# Change it to an address other than loopback if the service is distributed or
# will be accessed remotely.
--local_ip=192.168.10.111
# Storage daemon listening port
--port=9779
nebula-metad.conf
```

```
########## networking ##########
# Comma separated Meta Server addresses
--meta_server_addrs=192.168.10.111:9559,192.168.10.112:9559
# Local IP used to identify the nebula-metad process.
# Change it to an address other than loopback if the service is distributed or
# will be accessed remotely.
--local_ip=192.168.10.111
# Meta daemon listening port
--port=9559
```

机器B配置

nebula-graphd.conf

```
########## networking ##########
# Comma separated Meta Server Addresses
--meta_server_addrs=192.168.10.111:9559,192.168.10.112:9559
# Local IP used to identify the nebula-graphd process.
# Change it to an address other than loopback if the service is distributed or
# will be accessed remotely.
--local_ip=192.168.10.112
# Network device to listen on
--listen_netdev=any
# Port to listen on
--port=9669
```

nebula-storaged.conf

```
########## networking ##########
# Comma separated Meta server addresses
--meta_server_addrs=192.168.10.111:9559,192.168.10.112:9559
# Local IP used to identify the nebula-storaged process.
# Change it to an address other than loopback if the service is distributed or
# will be accessed remotely.
--local_ip=192.168.10.112
# Storage daemon listening port
--port=9779
```

nebula-metad.conf

```
########## networking ##########
# Comma separated Meta Server addresses
--meta_server_addrs=192.168.10.111:9559,192.168.10.112:9559
# Local IP used to identify the nebula-metad process.
# Change it to an address other than loopback if the service is distributed or
# will be accessed remotely.
--local_ip=192.168.10.112
# Meta daemon listening port
--port=9559
```

其实从上面可以看出，相比单机部署，集群部署的配置文件的最大不同点在于三个配置文件的`meta_server_addrs`需要填各个节点的ip端口  
**踩坑注意：配置文件里默认的local ip为127.0.0.1，需要改成机器实际的ip地址，否则部署集群的时候会有一些奇怪的错误**

步骤3：启动，启动流程如下

1.  先启动两台机器的meta服务。
2.  保证meta服务正常起来后，在分别启动两台机器的graph和storage服务

![](assets/uploads/2026/05/置顶-nebula-graph-图计算数据库-15993772-12.png)

## nebula 进阶学习

1.  nebula graphd服务代码走读：  
    [https://www.cnblogs.com/gitpull/p/15988828.html](https://www.cnblogs.com/gitpull/p/15988828.html)
