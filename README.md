# 企业微信智能机器人应用框架

> 支持多 AI 工具（Codex / CloudCode / Cursor）协作开发的企业微信智能机器人框架。
> 采用 PO → PA → PM → PC 角色体系，实现 Vibecoding 全流程闭环。

## 30 秒上手

**AI 开发者**：让 AI 读取项目根目录的 `AGENTS.md`，自动识别角色、加载工作流程和权限边界。

**人类开发者**：看下面。

---

## 项目能力

| 能力 | 说明 |
|------|------|
| 长连接消息 | 15 种消息类型 + 5 种模板卡片（文本通知/图文展示/按钮交互/投票/多项选择） |
| CLI 集成 | 6 品类 42 个原子 Skill（文档/智能表格/会议/日程/待办/通讯录） |
| 组合 Skill | 周报创建、会议组织、会议纪要、党建投票、信息汇集分析 |
| Agent 引擎 | LLM 意图识别 + Skill 调度 + 槽位填充 + 缺参追问 |
| 多 LLM 供应商 | DeepSeek / MiniMax / GLM / 私有化 Qwen，Bot 按需选用 |
| 按 Bot 分组配置 | 一个 .env 文件，每个 Bot 一个配置块（凭据+LLM+部署目标） |
| 安全 | 凭据禁令（永不传递明文）+ 预提交自动扫描 + 每 Bot 独立凭据 |
| Docker 部署 | 一容器一 Bot，`docker compose up -d` 即用 |

## 角色体系

```
PO（产品总监，你）—— 提需求、验收、拍板
  |
  +-- PA（架构师）—— framework + 原子Skill + 生产部署
  +-- PM（项目经理）—— Bot配置 + 组合Skill + 本地测试
  +-- PC（运营协调）—— 日报/周报/宣传材料
```

| 角色 | 管什么 | 不能碰 | Session 提示词 |
|------|--------|--------|:--:|
| **PA** | `packages/` `framework/` + 生产服务器 | `bots/` `composite-skills/` | `prompts/PA.md` |
| **PM** | `bots/{name}/` `composite-skills/` | `packages/` `framework/` 其他Bot | `prompts/PM.md` |
| **PC** | `docs/pc/` | 所有代码和配置 | `prompts/PC.md` |

当前 Bot：
| Bot | 目录 | 归属 | 用途 |
|-----|------|------|------|
| pa-bot | `bots/pa-bot/` | PA | 框架测试（WS/MCP/EventRouter） |
| party-bot | `bots/party-bot/` | PM | 党建助手 |
| project-bot | `bots/project-bot/` | PM | 项目管理助手 |

## 文档导航

| 文件 | 谁看 | 用途 |
|------|------|------|
| `AGENTS.md` | AI 工具 | **入口文件**（AI 先读这个） |
| `STANDARDS.md` | 所有人 | 开发测试铁律 + 安全规范（含凭据禁令 §7.1.1） |
| `ROADMAP.md` | 所有人 | 路线图、Phase 进度、角色分工 |
| `DESIGN.md` | 技术 | 方案设计 + 踩坑记录（23 条） |
| `.env.example` | 所有人 | 环境变量模板（按 Bot 分组） |
| `prompts/PA.md` | PA | 架构师启动提示词 |
| `prompts/PM.md` | PM | 项目经理启动提示词（替换 {BOT_NAME}） |
| `prompts/PC.md` | PC | 运营协调启动提示词 |

## 环境变量格式（.env）

```bash
# 每个 Bot 一个配置块
WECOM_PA_BOT_ID=xxx          # pa-bot 凭据
WECOM_PA_BOT_SECRET=xxx
PA_BOT_LLM=deepseek          # 选用哪个 LLM 供应商
PA_BOT_DEPLOY=localhost      # 部署目标（localhost=本地，IP=生产）

WECOM_PARTY_BOT_ID=xxx       # party-bot 凭据
WECOM_PARTY_BOT_SECRET=xxx
PARTY_BOT_LLM=deepseek
PARTY_BOT_DEPLOY=localhost

# LLM 供应商密钥池（底部共享）
DEEPSEEK_KEY_1=sk-xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

详细说明见 `.env.example` 文件注释。

## 安全机制

1. **凭据禁令**（STANDARDS.md §7.1.1）：任何人都不得通过明文传递凭据给 AI，PO 唯一提供方式是直接写入 `.env`
2. **预提交扫描**：`npx tsx scripts/pre-commit-scan.ts` —— 自动检测硬编码密钥、Bot ID、服务器 IP
3. **.gitignore 防护**：`.env` 永远不提交，`.env.example` 只含占位符

## 常用命令

```bash
# 测试
npx vitest run                              # 单元测试（17 tests）
npx tsx scripts/test-all-skills-v3.ts       # 原子 Skill 集成测试（42 个）
npx tsx scripts/test-composite-skills.ts    # 组合 Skill 集成测试
npx tsx scripts/test-agent-intent.ts        # Agent 意图识别测试
npx tsx scripts/test-p2-cli.ts              # CLI 集成测试

# 安全
npx tsx scripts/pre-commit-scan.ts          # 提交前安全扫描

# 运行
npx tsx packages/server/src/index.ts        # 启动本地服务（多 Bot 模式）
$env:BOT_NAME="party-bot"; npx tsx packages/server/src/index.ts  # 单 Bot 模式
```

## 开发流程

```
需求讨论（PO+PM）→ 本地开发（PM, test-bot）→ 全量测试 → PO 验收 → PA 生产部署
```

- PM 不碰生产环境，不碰他人 Bot，不碰框架代码
- PA 不碰 Bot 配置，不碰组合 Skill
- 所有人提交前跑安全扫描
- 所有人完成后更新对应 PLAN.md + METRICS.md

## 技术栈

TypeScript · Node.js 22 · npm workspaces · WebSocket · DeepSeek API · MiniMax · GLM · Docker · 企业微信 MCP CLI
