# Framework — 架构负责人工作区

> **你的身份**：架构负责人。负责框架核心的稳定性和扩展性。
> **先读 [../STANDARDS.md](../STANDARDS.md)**。

## ⚠️ 规则

- 极低变更频率、极高测试标准、绝对向后兼容
- 只改 `packages/` 下对应模块，不动 `bots/`、`composite-skills/`
- 接口变更不破坏现有 bot 配置

## 当前能力清单

### packages/core/ — 核心类型与组件

| 文件 | 能力 | 关键接口 |
|------|------|---------|
| `types.ts` | 全部类型定义 | WsFrame, MessageCallback, EventCallback, TemplateCardEvent, SelectedItems, Skill, Provider, BotConfig |
| `bot-manager.ts` | 多机器人生命周期 | startBot(config), stopBot(id), enableMcp(config), getEventRouter() |
| `event-router.ts` | 模板卡片事件路由 | register(taskId, handler, ttl), handleEvent(event) → boolean |

### packages/llm/ — LLM 客户端

| 文件 | 能力 |
|------|------|
| `client.ts` | LLMClient — OpenAI 兼容协议、多 key 轮换、SSE 流式、tool_calls 提取 |

### packages/agent/ — Agent 引擎

| 文件 | 能力 |
|------|------|
| `agent.ts` | 意图识别 + Skill 调度 + 槽位填充 + 会话历史管理 |

### packages/providers/wecom/ — 企业微信接入

| 文件 | 能力 | 关键方法 |
|------|------|---------|
| `ws-provider.ts` | WebSocket 长连接 | connect, disconnect, replyMessage, sendMessage, replyUpdateCard, updateCardViaUrl, uploadMedia, callTool |
| `mcp-client.ts` | MCP JSON-RPC 客户端 | fetchMcpConfig, listTools, callTool（签名算法 SHA256） |
| `mcp-skill-provider.ts` | 自动 Skill 生成器 | initialize() → 42 个原子 Skill |

### 消息类型支持矩阵

| 类型 | reply | push | 备注 |
|------|:---:|:---:|------|
| stream | ✅ | — | 普通文本需用 stream+finish:true |
| markdown | ✅ | ✅ | |
| text_notice | ✅ | ✅ | 模板卡片 |
| news_notice | ✅ | ✅ | 模板卡片 |
| button_interaction | ✅ | ✅ | 需 task_id |
| vote_interaction | ✅ | ✅ | 需 task_id |
| multiple_interaction | ✅ | ✅ | 需 task_id |
| file | ✅ | ✅ | 需 upload |

### 事件回调类型

| 事件 | eventtype | 处理方式 |
|------|-----------|---------|
| 进入会话 | enter_chat | replyWelcome |
| 模板卡片 | template_card_event | EventRouter → handler |
| 用户反馈 | feedback_event | 日志记录 |
| 连接断开 | disconnected_event | 不重连 |

## 工作流

### 加新 Provider
```
1. 下载平台文档 → docs/
2. packages/providers/ 下新建目录
3. 实现 Provider 接口全部方法
4. 单元测试 → 集成测试
5. 更新 types.ts（如需新类型）
6. 更新 DESIGN.md
```

### 改 Provider 接口
```
1. 先在 types.ts 加定义
2. 更新所有现有 Provider 实现
3. 全量回归测试
4. 通知 Bot PM（如有破坏性变更）
```

### 改 Agent 引擎
```
1. 读现有 agent.ts 逻辑
2. 方案写在注释里
3. 实现 → 跑 agent tests
4. 检查所有现有 bot 的 agent.md 兼容性
```

## 质量门禁

- [ ] `npx vitest run` 全部通过（当前 17 tests）
- [ ] 接口变更不破坏现有 bot
- [ ] 新功能有测试
- [ ] DESIGN.md 已更新
- [ ] STANDARDS.md 规则已遵守

## 关键接口（不可随意变更）

```typescript
interface Provider {
  connect(config): Promise<void>;
  disconnect(): void;
  onMessage(handler): void;
  onEvent(handler): void;
  replyMessage(frame, body): Promise<void>;
  replyUpdateCard(frame, body): Promise<void>;
  sendMessage(chatId, chatType, body): Promise<void>;
  uploadMedia(buffer, filename, type): Promise<{media_id}>;
  updateCardViaUrl(url, card): Promise<void>;
  callTool(category, method, args): Promise<unknown>;
}

interface Skill {
  definition: SkillDefinition;
  execute(args): Promise<unknown>;
}
```
