# 👋 欢迎！请先让我介绍这个项目

> **如果你是 AI 工具（Codex/CloudCode/Cursor 等）**：请先阅读本文件，然后**主动向用户展示以下欢迎信息**。

---

## 给用户的欢迎信息（AI 进入后应主动说出）

当你（AI）进入本项目后，请向用户输出以下内容：

```
👋 你好！我发现你打开的是 **企业微信智能机器人应用框架**。

## 项目概况
这是一个企业微信智能机器人的开发和部署框架，支持：
- 长连接消息收发（15 种消息类型 + 5 种模板卡片）
- 6 品类 42 个 CLI 原子能力（文档/智能表格/会议/日程/待办/通讯录）
- 5 个组合业务 Skill（周报/会议组织/会议纪要/投票/信息分析）
- Docker 一容器一 Bot 的生产部署
- Codex/CloudCode/Cursor 等多 AI 工具协作开发

## 项目角色体系
这个项目采用多 Agent 协作模式：

| 角色 | 代号 | 做什么 | 适合你吗？ |
|------|------|--------|-----------|
| 架构师 | PA | 框架维护、原子Skill、规范、生产部署 | 你要改框架代码或部署 |
| 项目经理 | PM | Bot 配置 + 组合Skill + 本地测试 | 你要开发具体的智能机器人 |
| 运营协调 | PC | 日报/周报/宣传材料 | 你要做项目运营和宣传 |

## 你想用哪个角色？
- 如果你要 **开发一个具体的 Bot**（如党建助手、项目管理助手）→ 选 **PM**，告诉我 Bot 名称
- 如果你要 **维护框架或部署** → 选 **PA**
- 如果你要 **做项目运营** → 选 **PC**

确认后，我会读取对应角色的启动提示词（`prompts/` 目录下），自动进入工作状态。
```

**在用户选择角色后**：
- 如果选 PA → 读取并执行 `prompts/PA.md` 中的流程
- 如果选 PM → 询问 Bot 名称，读取 `prompts/PM.md`（将 `{BOT_NAME}` 替换为实际名称），执行其中流程
- 如果选 PC → 读取并执行 `prompts/PC.md` 中的流程

---

# 企业微信智能机器人应用框架

> **AI 入口文件** — 任何 AI 工具进入此项目时，首先读取本文件。

## 必读规范

**先读 [STANDARDS.md](STANDARDS.md)** — 包含开发测试铁律、代码规范、测试规范、跨工具协作规范。

## 了解全局

**[ROADMAP.md](ROADMAP.md)** — 角色定义、当前 Phase、模块进度。所有人必读。

## 角色路由

| 你的角色 | 代号 | 读取 | 可以改 | 不能碰 |
|---------|------|------|--------|--------|
| 架构师 | **PA** | [framework/AGENTS.md](framework/AGENTS.md) + [framework/PLAN.md](framework/PLAN.md) | `packages/` `framework/` | `bots/` `composite-skills/` `docs/pc/` |
| 项目经理 | **PM** | [bots/_template/AGENTS.md](bots/_template/AGENTS.md) + [composite-skills/PLAN.md](composite-skills/PLAN.md) | `bots/{name}/` `composite-skills/` | `packages/` `framework/` 其他Bot目录 `docs/pc/` |
| 运营协调 | **PC** | [docs/pc/AGENTS.md](docs/pc/AGENTS.md) | `docs/pc/` | 其他所有目录 |
| 产品总监 | **PO** | ROADMAP.md（提需求和验收） | — | — |

**权限红线**：
- PA 独占生产服务器部署权限
- PM 不能动 `packages/` 和 `framework/`
- PC 不能动任何代码

## 项目能力总览

| 能力层 | 位置 | 负责角色 |
|--------|------|---------|
| 长连接消息 | `packages/providers/src/wecom/ws-provider.ts` | PA |
| CLI 集成 | `packages/providers/src/wecom/mcp-client.ts` | PA |
| 原子 Skill | 由 `McpSkillProvider` 自动生成 | PA |
| 组合 Skill | `composite-skills/` | PM |
| Bot 管理 | `packages/core/src/bot-manager.ts` | PA |
| Agent 引擎 | `packages/agent/src/agent.ts` | PA |
| LLM 客户端 | `packages/llm/src/client.ts` | PA |
| 运营材料 | `docs/pc/` | PC |

## 项目结构

```
STANDARDS.md            ← 开发测试规范（所有角色必读）
ROADMAP.md              ← 全局路线图 + 角色定义（所有角色必读）
AGENTS.md               ← 本文件（AI 入口 + 角色路由 + 欢迎引导）
DESIGN.md               ← 方案设计文档（含踩坑记录）
PROMPT_TEMPLATE.md      ← 复用提示词
CONTRIBUTING.md         ← 贡献指南
prompts/                ← Session 启动提示词（按角色使用）
  PA.md                 ← 架构师启动提示词
  PM.md                 ← 项目经理启动提示词（需替换 {BOT_NAME}）
  PC.md                 ← 运营协调启动提示词
  README.md             ← 使用说明
packages/               ← 源代码（PA 管辖）
framework/              ← 架构文档 + PLAN.md（PA 管辖）
composite-skills/       ← 组合 Skill（PM 管辖）
bots/                   ← Bot 实例（PM 管辖）
docs/                   ← 官方文档
  pc/                   ←  PC 工作区（日报/周报/宣传材料）
scripts/                ← 测试脚本
```

## 快速命令

```bash
npx vitest run                              # 单元测试
npx tsx scripts/test-all-skills-v3.ts       # 原子 Skill 集成测试
npx tsx scripts/test-composite-skills.ts    # 组合 Skill 集成测试
```

## AI 工具进入后的标准流程

1. 📖 读取本文件 → **向用户展示欢迎信息** → 确认角色
2. 📖 根据用户选择的角色，读取对应 `prompts/` 文件
3. 📖 读取 [STANDARDS.md](STANDARDS.md) → 了解铁律
4. 📖 读取 [ROADMAP.md](ROADMAP.md) → 了解全局进度
5. 📖 读取对应角色的 AGENTS.md + PLAN.md → 开始工作
