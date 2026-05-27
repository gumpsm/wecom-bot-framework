# 👋 欢迎！请先让我介绍这个项目

> **如果你是 AI 工具**：请先阅读本文件，然后**主动向用户展示以下欢迎信息**。

---

## 给用户的欢迎信息（AI 进入后必须主动输出）

当你（AI）进入本项目后，请立即向用户输出以下全部内容。

**⚠️ 关键：所有数据必须从对应源文件动态读取，绝对不使用本文件中可能过期的硬编码数值。**

**数据源映射**（AI 必须在输出前读取这些文件）：
- 项目历程 → `ROADMAP.md` 版本历史表
- 当前指标 → `METRICS.md` 当前指标表
- Bot 列表 → `bots/PLAN.md` Bot 清单表
- 组合 Skill 列表 → `composite-skills/PLAN.md` 能力清单表
- 各模块进度 → `ROADMAP.md` Phase 模块状态表

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  👋 欢迎来到企业微信智能机器人应用框架！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📖 这是什么

一个 **企业微信智能机器人的全栈开发和部署框架**，核心思路：
把企业微信的长连接、CLI 能力、大模型 API 封装成可复用的原子能力和
组合业务 Skill，让你可以快速开发出各种场景的智能机器人。

## 🏗 项目历程

（从 `ROADMAP.md` 版本历史表动态读取）

| 版本 | 日期 | 内容 |
|------|------|------|
| [读取 ROADMAP.md 版本历史表，展示最近 5 个版本] |

## 📊 当前能力数据

（从 `METRICS.md` 动态读取）

| 指标 | 实时数量 |
|------|---------|
| 原子 Skill | [METRICS.md: 原子 Skill] |
| 组合 Skill | [METRICS.md: 组合 Skill] |
| Bot 模板 | [METRICS.md: Bot 模板] |
| 单元测试 | [METRICS.md: 单元测试] |
| 已部署 Bot | [METRICS.md: 已部署 Bot] |

## 🤖 已有 Bot

（从 `bots/PLAN.md` Bot 清单表动态读取）

| Bot | 状态 | 说明 |
|-----|------|------|
| [读取 bots/PLAN.md 的 Bot 清单表] |

## 🧩 已有组合 Skill

（从 `composite-skills/PLAN.md` 能力清单表动态读取）

| Skill | 名称 | 状态 |
|-------|------|------|
| [读取 composite-skills/PLAN.md 的能力清单表] |

## 🧩 架构总览

```
┌─────────────────────────────────────────────────┐
│                  企业微信服务器                    │
│         WebSocket 长连接 / HTTP API 回调          │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              WeComWsProvider                      │
│         消息收发 · 事件回调 · 心跳 · 重连          │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│              BotManager                           │
│      多Bot生命周期 · MCP启用 · EventRouter        │
└─────┬───────────────────────────────┬───────────┘
      │                               │
┌─────▼──────────┐          ┌─────────▼───────────┐
│   Agent 引擎    │          │   MCP Client +       │
│ 意图识别+调度   │◄────────►│   Skill Provider     │
│ LLM 多Key轮换  │          │   原子Skill自动注册   │
└─────┬──────────┘          └─────────┬───────────┘
      │                               │
┌─────▼───────────────────────────────▼───────────┐
│              SkillRegistry                        │
│     原子Skill + 组合Skill + 事件Handler           │
└─────────────────────────────────────────────────┘
```

## 👥 多角色协作体系

```
PO（产品总监）
  │  提需求、验收、协调
  │
  ├── PA（架构师）
  │   管 framework + 原子Skill + 生产部署
  │   只能改: packages/ framework/
  │
  ├── PM（项目经理）
  │   管 Bot配置 + 组合Skill + 本地测试
  │   只能改: bots/{name}/ composite-skills/
  │   可以有多个PM同时工作，互不干扰
  │
  └── PC（运营协调）
      管 日报/周报/宣传材料
      只能改: docs/pc/
```

## 🎯 你想扮演哪个角色？

请从下面选一个：

**🅰️ 架构师 (PA)**
→ 改框架代码、配置原子Skill、维护规范、执行生产部署

**🅱️ 项目经理 (PM)**
→ 开发具体 Bot 的人设和配置、写组合Skill、本地测试
→ 需要告诉我你要开发哪个 Bot

**🅲 运营协调 (PC)**
→ 汇总项目进度、写日报周报、做宣传材料

选好后，我会加载对应的 Session 提示词，自动进入工作状态。
```

**在用户选择角色后**：
- 选 PA → 读取 `prompts/PA.md`，执行其中启动流程
- 选 PM → 询问 Bot 名称，替换 `prompts/PM.md` 中 `{BOT_NAME}`，执行启动流程
- 选 PC → 读取 `prompts/PC.md`，执行其中启动流程

---

# 企业微信智能机器人应用框架

> **AI 入口文件** — 任何 AI 工具进入此项目时，首先读取本文件。
> 本文件同时承担**新人上手引导**——AI 读到它后会主动介绍项目。
> **所有会变的数据都从对应源文件动态读取，本文件不硬编码任何可变内容。**

## 必读规范

**先读 [STANDARDS.md](STANDARDS.md)** — 铁律、代码规范、测试规范、跨工具协作规范。

## 了解全局

| 文件 | 内容 | 何时读 |
|------|------|--------|
| [ROADMAP.md](ROADMAP.md) | 角色定义、Phase进度、版本历史 | 每次启动 |
| [METRICS.md](METRICS.md) | Skill/Bot/测试实时数量 | 每次启动 |
| [bots/PLAN.md](bots/PLAN.md) | Bot 清单和状态 | 每次启动 |
| [composite-skills/PLAN.md](composite-skills/PLAN.md) | 组合 Skill 清单 | 每次启动 |
| [framework/PLAN.md](framework/PLAN.md) | 框架开发计划 | 每次启动 |

## 项目结构

```
README.md               ← 人看的项目介绍
AGENTS.md               ← 本文件（AI入口 + 新人引导）
STANDARDS.md            ← 开发测试规范
ROADMAP.md              ← 全局路线图 + 角色定义 + 版本历史
METRICS.md              ← 实时数据（Skill/Bot/测试数量）
DESIGN.md               ← 方案设计（含踩坑记录）
CONTRIBUTING.md         ← 贡献指南
prompts/                ← 各角色 Session 启动提示词
packages/               ← 源代码（PA 管辖）
framework/              ← 架构文档 + PLAN.md（PA 管辖）
composite-skills/       ← 组合 Skill + PLAN.md（PM 管辖）
bots/                   ← Bot 实例 + PLAN.md（PM 管辖）
docs/                   ← 官方文档
  pc/                   ←  PC 工作区
scripts/                ← 测试脚本
```

## 角色路由

| 角色 | 代号 | 下一步读什么 | 管辖 | 禁止碰 |
|------|------|------------|------|--------|
| 架构师 | PA | `framework/AGENTS.md` + `framework/PLAN.md` | `packages/` `framework/` | `bots/` `composite-skills/` |
| 项目经理 | PM | `bots/_template/AGENTS.md` + `bots/{name}/PLAN.md` + `composite-skills/PLAN.md` | `bots/{name}/` `composite-skills/` | `packages/` `framework/` |
| 运营协调 | PC | `docs/pc/AGENTS.md` | `docs/pc/` | 其他所有 |
| 产品总监 | PO | `ROADMAP.md` | 决策权 | — |

## 知识同步协议

**谁做事，谁更新文档。** 完成工作后必须更新对应的源文件：

| 你做了什么 | 更新哪个文件 |
|-----------|------------|
| 新增组合 Skill | `composite-skills/PLAN.md` + `METRICS.md` |
| 新增原子 Skill | `framework/PLAN.md` + `METRICS.md` |
| 新建 Bot | `bots/PLAN.md` + `METRICS.md` + `ROADMAP.md` |
| 新增测试 | `METRICS.md` |
| 部署上线 | `ROADMAP.md` + `METRICS.md` |
| Phase 完成 | `ROADMAP.md` 版本历史表 |
| Bot 验收通过 | `bots/{name}/PLAN.md` |

**忘记更新 = 下一个启动的人看到过期数据。**

## 快速命令

```bash
npx vitest run                              # 单元测试
npx tsx scripts/test-all-skills-v3.ts       # 原子 Skill 集成测试
npx tsx scripts/test-composite-skills.ts    # 组合 Skill 集成测试
npx tsx packages/server/src/index.ts        # 启动本地服务
```
