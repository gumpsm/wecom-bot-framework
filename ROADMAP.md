# 企业微信智能机器人框架 — 项目路线图

> **所有人必读。** 无论你负责哪个角色、用什么 AI 工具，先读本文件了解全局。

---

## 角色定义

| 角色 | 代号 | 职责 | 权限范围 |
|------|------|------|---------|
| 产品总监 | **PO** | 提需求、验收、拍板 | 全部（决策权） |
| 架构师 | **PA** | framework、原子 Skill、规范、生产部署 | `packages/` `framework/` 服务器 |
| 项目经理 | **PM** | Bot 配置 + 组合 Skill 开发 + 本地测试 | `bots/{name}/` `composite-skills/` |
| 运营协调 | **PC** | 日报/周报、宣传材料 | `docs/pc/`（只读其他） |

**权限红线**：
- PA —— 唯一拥有生产环境（腾讯云服务器）部署权限
- PM —— 不能动 `packages/` 和 `framework/`，不能碰生产服务器
- PC —— 不能动任何代码和配置
- PO —— 不直接写代码，负责需求、验收和角色间协调

---

## 当前版本

**v0.2.0** — 框架就绪，正式 Bot 开发阶段

## 当前 Phase：P4 — 正式 Bot 开发

| 模块 | 状态 | 负责角色 | 计划文件 |
|------|------|---------|---------|
| framework | ✅ 稳定 | PA | [framework/PLAN.md](framework/PLAN.md) |
| composite-skills | ✅ 5 个完成 | PM | [composite-skills/PLAN.md](composite-skills/PLAN.md) |
| bot: pa-bot | ✅ 本地测试用 | PM | [bots/pa-bot/PLAN.md](bots/pa-bot/PLAN.md) |
| bot: party-bot | 📋 待开发 | PM | [bots/party-bot/PLAN.md](bots/party-bot/PLAN.md) |
| bot: project-bot | 📋 待开发 | PM | [bots/project-bot/PLAN.md](bots/project-bot/PLAN.md) |
| 腾讯会议 API | 🔍 待调研 | PA | framework/PLAN.md |
| 飞书 CLI | ⏸️ 暂不引入 | — | STANDARDS.md §九 |

## 协作流程

```
PO 提需求
  │
  ├──→ PM 开发 Bot 配置 + 组合 Skill
  │       │
  │       ├── 本地 pa-bot 测试通过
  │       │
  │       └── 验收通过 ──→ 通知 PA 部署
  │
  ├──→ PA 维护框架 + 原子 Skill
  │       │
  │       ├── PM 需要新原子 Skill → 找 PA
  │       └── PM 验证通过 ──→ PA 部署到生产服务器
  │
  └──→ PC 每日汇总进度 → 日报/周报/宣传材料
```

## 多 PM 本地隔离

- 每位 PM 在自己的 Session 中运行独立的本地 server 实例（`npx tsx packages/server/src/index.ts`）
- 使用独立的 pa-bot 凭据（PO 提供），互不冲突
- 代码修改通过 Git 分支隔离，合入时通过 PR
- PM 之间不直接修改对方的 Bot 目录

---

## 开发工具兼容性

所有规范文件为纯 Markdown，兼容 Codex、CloudCode、Cursor 等任何 AI 开发工具。

## 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v0.1.0 | 2026-05-25 | P1 长连接消息收发 + 5 种模板卡片 |
| v0.1.3 | 2026-05-26 | P2 CLI 集成 42 原子 Skill + 5 组合 Skill + P3 Agent 引擎 |
| v0.2.0 | 2026-05-27 | 安全改造 + Docker 部署 + 开发流程规范 + 角色体系 |

## 项目实时数据

参见 **[METRICS.md](METRICS.md)** — 原子Skill/组合Skill/Bot/测试等实时数量，各角色完成工作后更新。
