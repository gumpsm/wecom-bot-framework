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

## 当前任务

### 无紧急变更 — 框架处于稳定期

如 Bot 开发过程中发现框架缺陷（类型缺失、Provider 接口不足等），架构负责人按需响应。

## 计划中

- [ ] **腾讯会议 API 调研**（优先级：中）
  - 下载官方 API 文档
  - 输出对比分析：企微会议 vs 腾讯会议
  - 决策是否接入
- [ ] **API 模式 Provider**（优先级：低）
  - 实现 `ApiProvider` 实现 `Provider` 接口
  - 支持 HTTP webhook 回调模式（非长连接）
- [ ] **飞书 Provider 接口预留**（优先级：低）
  - 不实现具体逻辑，仅预留 `FeishuProvider` 类型和接口

## 依赖关系

- **被依赖方**：bot/ 和 composite-skills/ 依赖本模块
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
