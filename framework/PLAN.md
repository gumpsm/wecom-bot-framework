# Framework 开发计划

> 角色：架构负责人 | 边界：[AGENTS.md](AGENTS.md)

## 当前版本：v0.2.0（稳定）

## 已完成
- [x] WS 长连接 Provider（`WeComWsProvider`）
- [x] MCP 客户端（`WeComMcpClient`）+ Skill Provider（`McpSkillProvider`）
- [x] BotManager 多 Bot 生命周期
- [x] EventRouter 模板卡片交互
- [x] Agent 引擎（意图识别 + Skill 调度）
- [x] LLM 客户端（多 Key 轮换 + SSE 流式）
- [x] 类型系统（`types.ts`）
- [x] Dockerfile + docker-compose（一容器一 Bot）
- [x] 安全：每 Bot 独立 .env、BOT_NAME 单容器模式
- [x] 腾讯会议 API 调研 — 已确认：MCP `meeting` CLI 品类已完整覆盖

---

## Phase 路线图

| Phase | 主题 | 状态 | 交付物 | 对接 PM |
|-------|------|------|--------|---------|
| P1-P3 | 核心框架 | ✅ 已完成 | 长连接/MCP/Agent/Docker | — |
| **P4** | **Agent 上下文 + 权限体系** | 🔧 当前 | 时间注入/用户识别/RBAC 权限 | PM 开发 Bot 的基础设施 |
| P5 | CLI/MCP 生态扩展（1期） | 📋 计划中 | 金融数据/网页采集/文档处理 | PM 的新原子 Skill |
| P6 | CLI/MCP 生态扩展（2期） | 📋 计划中 | 搜索/图表/记忆/知识库 | PM 的新原子 Skill |
| P7 | 跨平台 Provider | 📋 远期 | API模式/飞书预留 | — |

---

## P4: Agent ????? + ????

> ??: PM ?? Bot ???????/????/???????

### P4-1: Agent ??????? ?
- [x] ?????: ?? HandleMessage ??????
- [x] ?????: userId ?? system prompt
- [x] ????: ???????????

### P4-2: RBAC ???? ?
- [x] PermissionMiddleware: Agent tool ?????, ????=???
- [x] ????: ??:userid ??? + ????????
- [x] ???: * = ???, doc.* = ?????
- [x] ??: ?? 10min, ?? 2min
- [x] Bot ?? _template/config.json ???

### P4-3: ???? + PM ??? ?
- [x] ??: npx tsx scripts/list-skills.ts [bot-name]
- [x] PM.md ??????????
- [x] ????: PermissionConfig/RoleEntry/SheetRoleSource

### P4-4: ContactSync??????
- [x] ????REST API ??????????????????
- [x] ?????? + ??:userid ???????

### P4-5: ???? ?
- [x] pa-bot ????: MCP 42 skills, WS ??
- [x] contact API ???????
- [x] ???? 25/25 ??, ??????

## P5：CLI/MCP 生态扩展（1期）— 待 P4 完成后讨论

> 方向：金融数据、网页采集、文档处理类 MCP Server，数据源必须权威可靠。

---

## P6：CLI/MCP 生态扩展（2期）— 远期

> 方向：搜索、图表、知识图谱记忆等。

---

## P7：跨平台 Provider — 远期

- [ ] API 模式 Provider（HTTP webhook 回调，非长连接）
- [ ] 飞书 Provider 接口预留

---

## 依赖关系

- **被依赖方**：bot/ 和 composite-skills/ 依赖本模块
- **P4 权限体系**：PM 开发阶段即需要，是最紧迫的基础设施
- 框架变更会影响所有下游 → 变更前需评估影响范围
- 新增接口 → 先加类型定义 → 再实现 → 全量回归测试

## 环境变量

```
# 框架级（所有 Bot 共享）
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# Bot 级（每个 Bot 独立 .env）
WECOM_BOT_ID=...
WECOM_BOT_SECRET=...
DEEPSEEK_API_KEY_1=...
```

---

## 最近变更

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-05-27 | PO/PA/PM/PC 四角色体系正式落地 | 所有角色 |
| 2026-05-27 | 知识同步协议 + prompts 目录 | 所有角色 |
| 2026-05-27 | 腾讯会议 API 调研关闭 | 所有 PM |
| 2026-05-27 | Phase 重构：P4=权限体系, P5/P6=CLI扩展, P7=跨平台 | 所有角色 |
| 2026-05-28 | P4-1~4-3 完成：时间注入+权限体系+技能目录+提示词 | 所有 PM |
| 2026-05-28 | P4-4 ContactSync 进行中：待 PO 提供 corp 凭据 | 所有 PM |
| 待更新 | — | — |