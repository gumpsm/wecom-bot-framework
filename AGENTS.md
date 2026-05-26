# 企业微信智能机器人应用框架

> **AI 入口文件** — 任何 AI 工具进入此项目时，首先读取本文件。

## 必读规范

**先读 [STANDARDS.md](STANDARDS.md)** — 包含开发测试铁律、代码规范、测试规范、文档规范。

## 项目能力总览

| 能力层 | 位置 | 可做什么 |
|--------|------|---------|
| 长连接消息 | `packages/providers/src/wecom/ws-provider.ts` | 收发 15 种消息类型、5 种模板卡片、事件回调 |
| CLI 集成 | `packages/providers/src/wecom/mcp-client.ts` | 6 品类 42 个 MCP 工具 |
| 原子 Skill | 由 `McpSkillProvider` 自动生成 | 每个 MCP 工具 = 一个原子 Skill |
| 组合 Skill | `composite-skills/` | 5 个：周报创建、会议组织、会议纪要、党建投票、信息汇集分析 |
| Bot 管理 | `packages/core/src/bot-manager.ts` | 多机器人生命周期 |
| 事件路由 | `packages/core/src/event-router.ts` | 模板卡片交互 → Skill handler |
| Agent 引擎 | `packages/agent/src/agent.ts` | LLM 意图识别 + Skill 调度 |
| LLM 客户端 | `packages/llm/src/client.ts` | 多 key 轮换、SSE 流式 |

## 角色路由

| 如果你的任务是... | 读取 | 能力目录 |
|------------------|------|---------|
| 修改 Provider 接口、加新平台、改 Agent、改类型 | [framework/AGENTS.md](framework/AGENTS.md) | 下方 framework 能力 |
| 创建/修改组合 Skill | [composite-skills/AGENTS.md](composite-skills/AGENTS.md) | 下方 composite-skills 能力 |
| 创建新 bot、调人设、选 skill | [bots/_template/AGENTS.md](bots/_template/AGENTS.md) | 下方 bots 能力 |
| 测试、验收 | [scripts/tests/AGENTS.md](scripts/tests/AGENTS.md) | 下方测试能力 |

## 项目结构

```
STANDARDS.md            ← 开发测试规范（所有角色必读）
AGENTS.md               ← 本文件
DESIGN.md               ← 方案设计文档（含踩坑记录）
PROMPT_TEMPLATE.md      ← 复用提示词
packages/               ← 源代码（npm workspace）
  core/                 ←  类型、BotManager、EventRouter
  llm/                  ←  LLMClient
  agent/                ←  Agent 引擎
  providers/wecom/      ←  WS 长连接 + MCP 客户端 + Skill Provider
  server/               ←  启动入口
framework/              ← 架构设计文档 + AGENTS.md
composite-skills/       ← 5个组合 Skill + AGENTS.md
bots/                   ← Bot 实例
  _template/            ←  新 bot 模板
  test-bot/             ←  测试 bot
  project-bot/          ←  项目管理 bot
  party-bot/            ←  党建助手 bot
scripts/                ← 测试脚本
  tests/                ←  测试场景 + AGENTS.md
docs/                   ← 官方文档
logs/                   ← 测试日志
```

## 快速命令

```bash
npx vitest run                              # 单元测试（17 tests）
npx tsx scripts/test-all-skills-v3.ts       # 原子 Skill 集成测试（42 个）
npx tsx scripts/test-composite-skills.ts    # 组合 Skill 集成测试（4 个）
npx tsx scripts/test-info-gathering.ts      # 信息汇集分析测试
npx tsx scripts/test-agent-intent.ts        # Agent 意图识别+组合Skill集成
npx tsx scripts/demo-scenarios.ts           # 生产场景演示
npx tsx scripts/test-p2-cli.ts              # MCP CLI 测试
```

## 环境变量

```
WECOM_BOT_ID=aibq5J_h8KtsVYS1WLdKmx_XFa2rcKSrtfg
WECOM_BOT_SECRET=ixdjj3Y7JyCqn5Eqj8qQoRIbILNcksZ5ddjTokImI9g
DEEPSEEK_API_KEY_1/2/3=  (3个key)
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```
