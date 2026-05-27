# 企业微信智能机器人框架 — 项目路线图

> **所有人必读。** 无论你负责哪个模块、用什么 AI 工具，先读本文件了解全局。

## 当前版本

**v0.2.0** — 框架就绪，正式 Bot 开发阶段

## 当前 Phase：P4 — 正式 Bot 开发

| 模块 | 状态 | 负责人角色 | 计划文件 | 依赖 |
|------|------|-----------|---------|------|
| framework | ✅ 稳定 | 架构负责人 | [framework/PLAN.md](framework/PLAN.md) | — |
| composite-skills | ✅ 5 个完成 | Skill 编排者 | [composite-skills/PLAN.md](composite-skills/PLAN.md) | framework |
| bot: test-bot | ✅ 开发测试用 | — | [bots/test-bot/PLAN.md](bots/test-bot/PLAN.md) | 全部 |
| bot: party-bot | 📋 待开发 | Bot PM | [bots/party-bot/PLAN.md](bots/party-bot/PLAN.md) | composite-skills |
| bot: project-bot | 📋 待开发 | Bot PM | [bots/project-bot/PLAN.md](bots/project-bot/PLAN.md) | composite-skills |
| 腾讯会议 API | 🔍 待调研 | 架构负责人 | framework/PLAN.md | — |
| 飞书 CLI | ⏸️ 暂不引入 | — | [STANDARDS.md](STANDARDS.md) §九 | — |

## 开发工具兼容性

本项目支持多种 AI 开发工具（Codex、CloudCode、Cursor 等），规范统一通过以下文件表达：

| 文件 | 作用 | 工具如何读取 |
|------|------|-------------|
| `AGENTS.md` | 项目入口 → 角色路由 | 任何 AI 工具进入项目时首先读取 |
| `STANDARDS.md` | 铁律 + 开发规范 | AI 工具在开发/测试/提交前必须遵守 |
| `ROADMAP.md` | 全局进度 | AI 工具了解当前状态和分工 |
| `{模块}/PLAN.md` | 模块级计划 | AI 工具知道自己该做什么 |
| `{模块}/AGENTS.md` | 模块级角色边界 | AI 工具知道自己能改什么、不能碰什么 |

**跨工具协作原则**：
- 所有规范文件是纯 Markdown，不依赖任何特定工具的功能
- AGENTS.md 中不出现工具特定指令（如 `@codex`、`!cloudcode`）
- 行为规则用「做什么」描述，不指定「用哪个工具怎么做」

## 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v0.1.0 | 2026-05-25 | P1 长连接消息收发 + 5 种模板卡片 |
| v0.1.3 | 2026-05-26 | P2 CLI 集成 42 原子 Skill + 5 组合 Skill + P3 Agent 引擎 |
| v0.2.0 | 2026-05-27 | 安全改造 + Docker 部署 + 开发流程规范 |
