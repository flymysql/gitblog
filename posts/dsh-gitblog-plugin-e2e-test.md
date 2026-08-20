---
title: DSH gitblog 插件端到端验证
date: "2026-08-21T00:47:41+08:00"
updated: "2026-08-21T00:47:41+08:00"
author: Jimmy
tags: [测试, DSH]
summary: "验证 DeepSeek Harness 通过 gitblog 插件自动发布：写内容 -> 推 GitHub -> Actions 构建 -> Pages 发布全链路。验证完成后会自动删除。"
---

这是一篇由 DSH gitblog 发布机制自动生成并提交的验证文章，用于确认「写内容 → 推 GitHub → 构建 → 发布」全链路。验证完成后会被自动删除，不会留在博客上。

- 推送方式：GitHub Contents API（与 gitblog 浏览器后台一致）
- 构建：push 触发 GitHub Actions build 工作流
- 发布：GitHub Pages 自动部署
