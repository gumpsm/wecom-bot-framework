# 企业微信智能机器人应用框架

> 一套可复用的企业微信智能机器人开发框架。基于 Vibecoding 模式，42 个原子 Skill + 5 个组合 Skill，支持多 Bot 并行部署。

[![Tests](https://img.shields.io/badge/tests-17%20passed-success)]()
[![Skills](https://img.shields.io/badge/skills-42%20atomic%20+%205%20composite-blue)]()
[![Version](https://img.shields.io/badge/version-1.3-informational)]()

---

## 项目概述

这个框架解决的核心问题：**企业微信智能机器人开发中，消息收发、CLI 能力调用、大模型集成、多 Bot 管理的重复造轮子问题。**

你只需要写两个文件（`config.json` + `agent.md`），定义 Bot 的人设和可用技能，框架自动处理：
- WebSocket 长连接（消息收发 + 事件回调）
- 企业微信 CLI 能力（42 个 MCP 工具覆盖通讯录/待办/日程/会议/文档/消息）
- LLM 调用（DeepSeek / 智谱 / 私有化 Qwen，多 Key 轮换）
- 意图识别（LLM Function Calling，自动选 Skill + 追问补全缺失信息）

## 快速开始

### 环境要求

- Node.js >= 18
- 企业微信智能机器人 Bot ID + Secret
- DeepSeek API Key（或其他 OpenAI 兼容的 LLM）

### 1. 安装

```bash
git clone <repo-url>
cd wecom-bot-framework
npm install
```

### 2. 配置

```bash
cp .env.example .env
# 编辑 .env，填入你的凭据
```

### 3. 跑通测试

```bash
npx vitest run                        # 单元测试（17 个）
npx tsx scripts/test-composite-skills.ts  # 组合 Skill 集成测试
npx tsx scripts/test-agent-intent.ts      # Agent 意图识别测试
```

### 4. 创建你的第一个 Bot

```bash
cp -r bots/_template bots/my-first-bot
# 编辑 bots/my-first-bot/config.json  → 选 Skill
# 编辑 bots/my-first-bot/agent.md     → 写人设
```

## 架构

```
┌────────────────────────┐
│  Bot 配置层             │  ← 你只需写这两个文件
│  config.json + agent.md │
├────────────────────────┤
│  Agent 引擎             │  ← LLM Function Calling 意图识别
├────────────────────────┤
│  LLM 客户端             │  ← 多模型 / 多 Key / SSE 流式
├────────────────────────┤
│  Skill 注册中心          │  ← 42 原子（MCP 自动生成）+ 5 组合（DI 桥接）
├────────────────────────┤
│  Provider 层            │  ← WS 长连接 + MCP JSON-RPC
└────────────────────────┘
```

## 项目结构

```
.
├── STANDARDS.md          ← 开发测试规范 + 安全管理规范
├── DESIGN.md             ← 方案设计 + 踩坑记录 + 需求讨论
├── README.md             ← 本文件
├── .env.example          ← 环境变量模板
├── packages/             ← 源代码（npm workspace）
│   ├── core/             ←   类型定义 / BotManager / EventRouter
│   ├── llm/              ←   LLMClient（OpenAI 兼容）
│   ├── agent/            ←   Agent 引擎
│   ├── skills/           ←   SkillRegistry + CompositeSkillAdapter
│   ├── providers/wecom/  ←   WS Provider + MCP Client
│   └── server/           ←   启动入口
├── composite-skills/     ← 5 个组合 Skill
├── bots/                 ← Bot 实例
│   ├── _template/        ←   新 Bot 模板
│   ├── test-bot/         ←   测试 Bot
│   ├── project-bot/      ←   项目管理 Bot
│   └── party-bot/        ←   党建助手 Bot
├── scripts/              ← 测试脚本
├── docs/                 ← 官方文档（101463/101468/101032）
└── logs/                 ← 测试日志（.gitignore）
```

## 核心能力

### 消息类型（15 种）

| 类型 | 回复 | 推送 | 说明 |
|------|:---:|:---:|------|
| stream / markdown / file | ✅ | ✅ | 基础消息 |
| text_notice / news_notice | ✅ | ✅ | 模板卡片 |
| button / vote / multiple_interaction | ✅ | ✅ | 交互卡片 |

### 原子 Skill（42 个 / 6 品类）

| 品类 | 数量 | 说明 |
|------|:---:|------|
| contact | 1 | 通讯录成员查询 |
| todo | 6 | 待办 CRUD |
| msg | 4 | 消息会话与收发 |
| schedule | 8 | 日程 CRUD + 闲忙 |
| meeting | 5 | 会议 CRUD + 参与人 |
| doc | 18 | 文档 + 智能表格全套 |

### 组合 Skill（5 个）

| Skill | 说明 |
|-------|------|
| 周报创建 | 信息收集 → LLM 润色 → 创建文档 |
| 会议组织 | 闲忙查询 → 创建会议 → 日程 → 待办 |
| 会议纪要 | 原始内容 → LLM 整理 → 文档 + 待办提取 |
| 党建投票 | 投票卡片 → 交互收集 → 统计 → 文档 |
| 信息汇集分析 | 多源数据 → LLM 分析 → 报告/智能表格 |

## 开发历程

### 需求讨论关键决策

经过 10+ 轮讨论，明确了以下核心共识（详见 [DESIGN.md](DESIGN.md)）：

1. **Skill 粒度**：做细不做粗。原子 Skill 精确到单次 API 调用，组合 Skill 编排多步流程
2. **多模型策略**：单一 `LLMClient` 适配所有 OpenAI 兼容协议，多 Key 轮换
3. **平台扩展**：Provider 接口平台无关，飞书接入只需实现同一套方法
4. **权限模型**：Bot 核心配置只由 PM 调整，操作结果推送待办确认
5. **部署模式**：Docker 容器化，一容器一 Bot

### 开发过程

| 阶段 | 内容 | 踩坑 |
|------|------|:---:|
| P1 | WebSocket 长连接 + 15 种消息 + 5 种模板卡片 | 10 条 |
| P2 | MCP 42 原子 Skill + EventRouter + BotManager | 3 条 |
| P3 | 5 组合 Skill + Agent 意图识别 + 3 Bot 示例 | 3 条 |

全程 **Vibecoding**：人提需求审设计 → AI 编码测试 → 人验收。测试中仅需发一条触发消息，脚本自动执行全量用例。

## 安全

- `.env` 不提交 Git，提供 `.env.example` 模板
- 代码中零硬编码凭据
- LLM Key 多轮换 + 日志脱敏
- 详见 [STANDARDS.md §八](STANDARDS.md)

## 加入开发

四种角色，各有明确的 AGENTS.md 边界：

| 角色 | 你需要做什么 | 代码量 |
|------|------------|:---:|
| **Bot PM** | 写 config.json + agent.md | 零代码 |
| **Skill 编排者** | 写 composite-skills/*.ts | 少量 TS |
| **架构负责人** | 改 framework/ Provider/Agent | 全栈 |
| **测试负责人** | 列场景清单 | 零代码 |

详细规则见各目录下的 `AGENTS.md`。

## 下一步

- [ ] Docker 容器化部署
- [ ] 飞书 CLI 接入（FeishuProvider）
- [ ] 多模型路由优化
- [ ] 权限与审批流

## 相关文档

| 文档 | 用途 |
|------|------|
| [DESIGN.md](DESIGN.md) | 方案设计 + 全部踩坑记录 + 需求讨论记录 |
| [STANDARDS.md](STANDARDS.md) | 开发测试规范 + 安全管理规范 |
| [AGENTS.md](AGENTS.md) | AI 入口：角色路由 + 能力总览 |
| [PROMPT_TEMPLATE.md](PROMPT_TEMPLATE.md) | Vibecoding 复用提示词 |

> 项目仓库：`I:\.codex_wecom` | 框架版本：v1.3 | 2026-05-26
