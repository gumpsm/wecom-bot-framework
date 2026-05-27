# 👋 欢迎！请先让我介绍这个项目

> **如果你是 AI 工具**：请先阅读本文件，然后**主动向用户展示以下欢迎信息**。

---

## 给用户的欢迎信息（AI 进入后必须主动输出）

当你（AI）进入本项目后，请立即向用户输出以下全部内容：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  👋 欢迎来到企业微信智能机器人应用框架！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📖 这是什么

一个 **企业微信智能机器人的全栈开发和部署框架**，核心思路是：
把企业微信的长连接、CLI 能力、大模型 API 封装成可复用的原子能力和
组合业务 Skill，让你可以快速开发出各种场景的智能机器人。

## 🏗 项目历程

| 阶段 | 内容 | 状态 |
|------|------|------|
| P1 | WS 长连接 + 15 种消息 + 5 种模板卡片 | ✅ 2026-05-25 |
| P2 | 企业微信 CLI 集成：6 品类 42 个原子 Skill | ✅ 2026-05-26 |
| P3 | Agent 引擎：LLM 意图识别 + Skill 调度 | ✅ 2026-05-26 |
| P4 | 正式 Bot 开发 + 多角色协作体系 | 🔧 进行中 |

## 📊 当前能力数据

- **42 个原子 Skill**：文档/智能表格/会议/日程/待办/通讯录，全部测试通过
- **5 个组合 Skill**：周报创建、会议组织、会议纪要、投票推荐、信息汇集分析
- **3 个 Bot 模板**：test-bot（本地测试）、party-bot（党建助手）、project-bot（项目管理）
- **17 个单元测试**：覆盖 core/llm/agent/providers 四大模块
- **Docker 部署**：腾讯云服务器已就绪，一容器一 Bot

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
│ LLM 多Key轮换  │          │   42原子Skill自动注册 │
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
→ 适合：技术负责人、基础设施维护者

**🅱️ 项目经理 (PM)**
→ 开发具体 Bot 的人设和配置、写组合Skill、本地测试
→ 适合：Bot 产品经理、业务场景开发者
→ 需要告诉我你要开发哪个 Bot（如 party-bot / project-bot）

**🅲 运营协调 (PC)**
→ 汇总项目进度、写日报周报、做宣传材料
→ 适合：项目运营、对外宣传

选好后，我会加载对应的 Session 提示词，自动进入工作状态。
```

**在用户选择角色后**：
- 选 PA → 读取 `prompts/PA.md`，执行其中启动流程
- 选 PM → 询问 Bot 名称，替换 `prompts/PM.md` 中 `{BOT_NAME}`，执行启动流程
- 选 PC → 读取 `prompts/PC.md`，执行其中启动流程

---

# 企业微信智能机器人应用框架

> **AI 入口文件** — 任何 AI 工具进入此项目时，首先读取本文件。
> 本文件同时承担**新人上手引导**职能——AI 读到它后会主动介绍项目。

## 必读规范

**先读 [STANDARDS.md](STANDARDS.md)** — 铁律、代码规范、测试规范、跨工具协作规范。

## 了解全局

**[ROADMAP.md](ROADMAP.md)** — 角色定义、当前 Phase、模块进度。所有人必读。

## 项目结构

```
README.md               ← 人看的项目介绍
AGENTS.md               ← 本文件（AI入口 + 新人引导）
STANDARDS.md            ← 开发测试规范
ROADMAP.md              ← 全局路线图 + 角色定义
DESIGN.md               ← 方案设计（含踩坑记录）
CONTRIBUTING.md         ← 贡献指南
prompts/                ← 各角色 Session 启动提示词
  PA.md / PM.md / PC.md / README.md
packages/               ← 源代码（PA 管辖）
  core/ llm/ agent/ providers/ server/ skills/
framework/              ← 架构文档 + PLAN.md（PA 管辖）
composite-skills/       ← 组合 Skill + PLAN.md（PM 管辖）
bots/                   ← Bot 实例 + PLAN.md（PM 管辖）
  _template/ test-bot/ party-bot/ project-bot/
docs/                   ← 官方文档
  pc/                   ←  PC 工作区
scripts/                ← 测试脚本
```

## 角色路由

| 角色 | 代号 | 下一步读什么 | 管辖 | 禁止碰 |
|------|------|------------|------|--------|
| 架构师 | PA | `framework/AGENTS.md` + `framework/PLAN.md` | `packages/` `framework/` | `bots/` `composite-skills/` |
| 项目经理 | PM | `bots/_template/AGENTS.md` + `composite-skills/PLAN.md` + `bots/{name}/PLAN.md` | `bots/{name}/` `composite-skills/` | `packages/` `framework/` |
| 运营协调 | PC | `docs/pc/AGENTS.md` | `docs/pc/` | 其他所有 |
| 产品总监 | PO | `ROADMAP.md` | 决策权 | — |

## 知识同步协议

为避免角色间信息孤岛，任何角色**完成任务后必须**更新对应文档：

- **PM 新增组合 Skill** → 更新 `composite-skills/PLAN.md`（标记完成）
- **PA 新增原子 Skill / 框架变更** → 更新 `framework/PLAN.md` + `ROADMAP.md`
- **部署完成** → 更新 `ROADMAP.md` 对应模块状态
- **Bot 验收通过** → 更新 `bots/{name}/PLAN.md`

**每次 Session 开始时**，AI 必须先检查上述文件自上次以来是否有变化，如有变化主动告知用户。

## 快速命令

```bash
npx vitest run                              # 单元测试
npx tsx scripts/test-all-skills-v3.ts       # 原子 Skill 集成测试
npx tsx scripts/test-composite-skills.ts    # 组合 Skill 集成测试
npx tsx packages/server/src/index.ts        # 启动本地服务
```
