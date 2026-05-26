# Composite Skills — Skill 编排者工作区

> **你的身份**：Skill 编排者。你把原子 Skill 组装成可复用的业务能力。
> **先读 [../STANDARDS.md](../STANDARDS.md)**。

## 规则

- 只修改 `composite-skills/*.ts`
- 不改 `packages/`、`bots/`
- 参数从 MCP schema 获取，不猜测
- 多步骤操作必须有回滚

## 可用能力目录

### 原子 Skill（42 个，调用方式：`client.callTool(category, method, args)`）

| 品类 | 方法 | 用途 |
|------|------|------|
| **contact** | get_userlist | 获取通讯录成员 |
| **todo** | get_todo_list | 获取待办列表 |
| | create_todo | 创建待办（content, remind_time） |
| | get_todo_detail | 查询待办详情（todo_id_list） |
| | update_todo | 更新待办（todo_id） |
| | delete_todo | 删除待办（todo_id） |
| **msg** | get_msg_chat_list | 获取会话列表 |
| | get_message | 拉取消息（chat_type, chatid, begin_time, end_time） |
| | send_message | 发送文本（chat_type:1/2, chatid, msgtype:"text", text:{content}） |
| **schedule** | get_schedule_list_by_range | 按时间查日程 |
| | create_schedule | 创建日程（schedule:{summary, start_time, end_time}） |
| | get_schedule_detail | 查日程详情（schedule_id_list） |
| | update_schedule | 更新日程（schedule:{schedule_id, ...}） |
| | cancel_schedule | 取消日程（schedule_id） |
| | check_availability | 闲忙查询（check_user_list:["userid"], start_time, end_time） |
| **meeting** | list_user_meetings | 用户会议列表 |
| | create_meeting | 创建会议（title, meeting_start_datetime, meeting_duration:秒, invitees:{userid:[]}） |
| | get_meeting_info | 会议详情（meetingid） |
| | set_invite_meeting_members | 更新参与人（meetingid, invitees:[{userid}]） |
| | cancel_meeting | 取消会议（meetingid） |
| **doc** | create_doc | 创建文档（doc_type:3文档/10智能表格, doc_name） |
| | get_doc_content | 获取内容（type:2=Markdown, docid） |
| | edit_doc_content | 编辑内容（content_type:1=Markdown, content, docid） |
| | smartsheet_* | 智能表格全套 CRUD |

**参数 schema 查询命令：** `npx tsx scripts/check-schemas.ts`

### WeCom Provider（消息收发）

```typescript
// 通过 ws-provider 可用的能力：
provider.sendMessage(chatId, chatType, body)     // 主动推送
provider.replyMessage(frame, body)               // 回复消息
provider.updateCardViaUrl(responseUrl, card)     // 更新模板卡片
```

### LLM 调用

```typescript
// 组合 skill 中可以调用 LLM 做内容生成
// 由调用方通过 Dependency Injection 注入 LLMClient 实例
import { LLMClient } from "./llm-deps";
```

### EventRouter

```typescript
// 发送交互卡片后注册回调
eventRouter.register(taskId, async (event, cardEvent) => {
  // cardEvent.selected_items → 用户的选择数据
  // event.body.response_url → 用于更新卡片
});
```

## 已有组合 Skill

| Skill | 文件 | 说明 | 原子 Skill 调用 | 状态 |
|-------|------|------|----------------|:----:|
| 周报创建 | `create-weekly-report.ts` | 输入项目信息 → LLM润色 → 创建文档 → 写入内容 | doc.create_doc, doc.edit_doc_content | ✅ |
| 会议组织 | `organize-meeting.ts` | 查询闲忙 → 创建会议 → 创建日程 → 创建待办 → 通知 | schedule.check_availability, meeting.create_meeting, schedule.create_schedule, todo.create_todo | ✅ |
| 会议纪要 | `meeting-minutes.ts` | 输入原始内容 → LLM整理 → 提取待办 → 创建文档 | doc.create_doc, doc.edit_doc_content | ✅ |
| 党建投票 | `party-vote.ts` | 发送多项选择卡片 → 收集交互反馈 → 统计 → 写入文档 | doc.create_doc, doc.edit_doc_content + EventRouter | ✅ |
| 信息汇集分析 | `info-gathering.ts` | 多源数据 → LLM分析 → 文档+智能表格 | doc.create_doc, doc.edit_doc_content, smartsheet_* | ✅ |

## 组合 Skill 设计规范

每个组合 Skill 遵循统一的 DI（Dependency Injection）模式：

```typescript
// 1. Input 类型：明确调用方需要提供什么
export interface XxxInput { /* 必填字段 + 可选字段 */ }

// 2. Output 类型：明确返回什么
export interface XxxOutput { success: boolean; /* 结果字段 */ }

// 3. Deps 类型：声明依赖（由调用方注入）
export interface XxxDeps {
  callTool: (category, method, args) => Promise<unknown>;  // MCP 调用
  llm?: LLMClient;           // LLM（内容生成类 skill 需要）
  sendMessage?: Function;     // 消息推送（通知类 skill 需要）
  registerEventHandler?: Function;  // 事件路由（交互类 skill 需要）
  chatId?: string;            // 会话上下文
}

// 4. 执行函数：参数校验 → 调用原子 skill → 失败回滚 → 返回结果
export async function execute(input: XxxInput, deps: XxxDeps): Promise<XxxOutput> { ... }
```

## 如何新增组合 Skill

1. 在 `composite-skills/` 创建 `{name}.ts`
2. 定义 Input / Output / Deps 接口
3. 实现 execute 函数：校验 → 编排原子 Skill → 回滚 → 返回
4. 写场景测试：`scripts/test-composite-{name}.ts`
5. 更新本文件的能力清单（上方表格）

## 质量门禁

- [ ] 参数从 MCP schema 获取，不猜测
- [ ] 多步骤有回滚（或至少 warn 并继续）
- [ ] 测试通过（创建→验证→清理）
- [ ] 本文件能力清单已更新（新 skill 加入表格）
