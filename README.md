# 企业微信智能机器人应用框架

> 一个支持多 AI 工具（Codex / CloudCode / Cursor）协作开发的企业微信智能机器人框架。

## 🚀 30 秒上手

**如果你用 AI 开发工具，把下面这句话发给你当前项目目录下的 AI：**

> 请完整阅读项目根目录的 AGENTS.md，然后按里面的引导执行。

AI 会自动：
1. 👋 向你介绍项目概况和架构
2. ❓ 询问你想扮演什么角色（架构师 / 项目经理 / 运营协调）
3. 📋 根据你的选择，加载对应的工作流程和权限边界
4. 🔧 开始干活

**如果你不用 AI 工具**，直接看下面的内容了解项目。

---

## 项目能力

| 能力 | 说明 |
|------|------|
| 🔌 长连接消息 | 15 种消息类型 + 5 种模板卡片，WebSocket 实时收发 |
| 🔧 CLI 集成 | 6 品类 42 个原子能力（文档/智能表格/会议/日程/待办/通讯录） |
| 🧩 组合 Skill | 周报创建、会议组织、会议纪要、投票推荐、信息汇集分析 |
| 🤖 Agent 引擎 | LLM 意图识别 + Skill 调度 + 槽位填充 |
| 🐳 Docker 部署 | 一容器一 Bot，`docker compose up -d` 即用 |
| 🔐 安全 | 每 Bot 独立凭据、非 root 运行、日志脱敏 |

## 角色体系

```
PO（产品总监，你）
  │
  ├── PA（架构师）→ framework + 原子Skill + 生产部署
  ├── PM（项目经理）→ Bot配置 + 组合Skill + 本地测试
  └── PC（运营协调）→ 日报/周报/宣传材料
```

| 角色 | 管什么 | 不能碰 |
|------|--------|--------|
| **PA** | `packages/` `framework/` + 服务器 | `bots/` `composite-skills/` |
| **PM** | `bots/{name}/` `composite-skills/` | `packages/` `framework/` |
| **PC** | `docs/pc/` | 所有代码 |

## 文档导航

| 文件 | 谁看 | 用途 |
|------|------|------|
| `AGENTS.md` | 🤖 AI 工具 | **入口文件**（AI 先读这个） |
| `STANDARDS.md` | 所有人 | 开发测试铁律 |
| `ROADMAP.md` | 所有人 | 路线图和角色分工 |
| `DESIGN.md` | 技术 | 方案设计 + 踩坑记录 |
| `prompts/PA.md` | PA | 架构师 Session 启动提示词 |
| `prompts/PM.md` | PM | 项目经理 Session 启动提示词（需替换 Bot 名） |
| `prompts/PC.md` | PC | 运营协调 Session 启动提示词 |

## 本地命令

```bash
npx vitest run                           # 17 单元测试
npx tsx packages/server/src/index.ts     # 启动本地服务
```

## 技术栈

TypeScript · Node.js 22 · npm workspaces · WebSocket · DeepSeek API · Docker · 企业微信 MCP CLI
