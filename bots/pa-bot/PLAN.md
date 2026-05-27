# pa-bot — PA 架构师测试 Bot

> 归属：PA（架构师）
> 用途：框架功能验证（WS 连接、MCP 工具、原子 Skill、事件路由、消息类型）
> 环境：仅本地运行，不部署生产

## 场景

| # | 场景 | 说明 | 状态 |
|---|------|------|:--:|
| 1 | WS 连通性 | 连接 + subscribe + 心跳 | ✅ |
| 2 | 消息类型全量 | stream/markdown/5种模板卡片/file | ✅ |
| 3 | 模板卡片交互 | btn/vote/multi 回调 | ✅ |
| 4 | 原子 Skill 全量 | 42 个 MCP 工具逐一调用 | ✅ |
| 5 | 事件路由 | EventRouter register → handle | ✅ |
| 6 | 组合 Skill | 周报/会议/纪要/投票/分析 | ✅ |
| 7 | Agent 意图识别 | 闲聊/明确/模糊 | ✅ |

## 依赖

- 原子 Skill：全部 42 个（MCP 自动注册）
- 组合 Skill：全部 5 个
- LLM：deepseek

## 验收标准

- [x] npx vitest run → 17/17
- [x] npx tsx scripts/test-all-skills-v3.ts → 30/0/13
- [x] npx tsx scripts/test-composite-skills.ts → 4/4
- [x] npx tsx scripts/test-agent-intent.ts → 全部通过
- [x] npx tsx scripts/test-p2-cli.ts → 全部通过
