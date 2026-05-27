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
AGENTS.md               ← 本文件（AI 入口 + 角色路由）
DESIGN.md               ← 方案设计文档（含踩坑记录）
PROMPT_TEMPLATE.md      ← 复用提示词
CONTRIBUTING.md         ← 贡献指南
packages/               ← 源代码（PA 管辖）
framework/              ← 架构文档 + PLAN.md（PA 管辖）
composite-skills/       ← 组合 Skill（PM 管辖）
bots/                   ← Bot 实例（PM 管辖）
  _template/            ←  新 bot 模板
  test-bot/             ←  本地开发测试专用
  party-bot/            ←  党建助手
  project-bot/          ←  项目管理
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

1. 📖 读取本文件 → 确认自己角色
2. 📖 读取 [STANDARDS.md](STANDARDS.md) → 了解铁律
3. 📖 读取 [ROADMAP.md](ROADMAP.md) → 了解全局进度
4. 📖 读取对应角色的 AGENTS.md + PLAN.md → 开始工作

---

## Session 启动提示词

每个角色有专用的 Session 启动提示词，位于 `prompts/` 目录。新开 AI 工具 Session 时，直接复制对应文件内容粘贴即可：

| 角色 | 提示词文件 | 说明 |
|------|-----------|------|
| PA (架构师) | [prompts/PA.md](prompts/PA.md) | 无变量，直接使用 |
| PM (项目经理) | [prompts/PM.md](prompts/PM.md) | 需替换 `{BOT_NAME}` 为实际 Bot 名 |
| PC (运营协调) | [prompts/PC.md](prompts/PC.md) | 无变量，直接使用 |

详见 [prompts/README.md](prompts/README.md)。