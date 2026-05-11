---
title: "nebula代码走读——从Validator到Executor"
date: 2022-03-10T11:41:00+08:00
updated: 2022-03-10T11:41:00+08:00
author: "兰州小红鸡"
tags:
  - "图数据库"
summary: "整体架构 Nebula Graph Query Engine 主要分为四个模块，分别是 Parser、Validator、Optimizer 和 Executor。 Parser …"
origin:
  from: cnblogs
  url: https://www.cnblogs.com/gitpull/p/15988828.html
  id: 15988828
  cnblogsDate: "2022-03-10 11:41"
---

## 整体架构

Nebula Graph Query Engine 主要分为四个模块，分别是 Parser、Validator、Optimizer 和 Executor。

![](assets/uploads/2026/05/nebula代码走读——从Validator到Executor-15988828-01.png)

Parser 完成对语句的词法语法解析并生成抽象语法树（AST），Validator 会将 AST 转化为执行计划，Optimizer 对执行计划进行优化，而 Executor 负责实际数据的计算。

## Graphd服务命令执行计划

```
命令行执行
QueryInstance
  execute
    validateAndOptimize
      Validator::validate
        makeValidator -> validator //生成对应的字句
          validator->validate //字句生成执行计划
            validateImpl //校验
            toPlan //生成执行计划
              getAstContext //获取抽象语法树
              Planner::toPlan
                plannersMap().find 找到 registPlanners注册的每个字句对应的计划
                  planner.instantiate()->transform
                    // 以LookupPlanner为例
					edgeIndexFullScan
					plan.root = Filter::make // 设置过滤
					plan.root = Project::make // 设置yield
	//执行
	AsyncMsgNotifyBasedScheduler::schedule()
      create
		makeExecutor // 根据planner生成实际逻辑执行队列
	  doSchedule
	    queue.push
		scheduleExecutor
		  runExecutor
		    execute
			  executor->open //正式执行前的一些初始化操作
			  executor->execute
			  // 以IndexScanExecutor为例
			  IndexScanExecutor::execute
			    indexScan
				  storageClient->lookupIndex //RPC到storaged服务执行查询命令
					handleResp
					  finish //完成当前planNode
					    ectx_->setResult // 将当前结果输出作为下一个节点的数据依赖输入
```

## Storaged命令执行计划

```
Storaged服务接收到graphd的处理请求，以lookup为例
LookupProcessor::process
  doProcess
    runInSingleThread
	  buildPlan // 生成执行计划（与graph的执行计划不同，粒度更小）
	  for part : parts // 遍历part
	    StoragePlan::go
		  RealNode::execute
		    doExecute // planNode执行各自的操作
	  
```
