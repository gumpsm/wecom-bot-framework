# 企业微信智能机器人框架 — Vibecoding 复用提示词

> 本文件是可复用提示词模板。任何人粘贴给 Codex 并配合环境变量，即可从零完成企业微信智能机器人框架的开发测试。
> 最后更新：2026-05-26（P1 完成后复盘修订）

---

## Part A：使用前准备（一次性，粘贴前完成）

### A1. 环境确认

- Windows / macOS / Linux（本方案 Windows 验证通过）
- Node.js >= 18 + npm
- Git（需安装）
- 网络可访问 api.deepseek.com（或其他 LLM API）

### A2. 需要提供的环境变量

```bash
# 必填：企业微信智能机器人凭证
WECOM_BOT_ID=           # 在企业微信管理后台 → 智能机器人 → 配置页面获取
WECOM_BOT_SECRET=       # 长连接专用 Secret（非 Token/EncodingAESKey）

# 必填：LLM API（至少一个）
LLM_API_KEY=            # API Key
LLM_BASE_URL=           # 如 https://api.deepseek.com/v1
LLM_MODEL=              # 如 deepseek-chat

# 可选：额外 LLM Keys（支持多 key 轮换）
LLM_API_KEY_2=
LLM_API_KEY_3=
```

### A3. 授权声明

```
我将提供以下最高授权：
- 允许安装 Node.js 依赖（npm install）
- 允许工作目录下所有文件读写
- 允许网络访问（下载依赖、调用 API、连接企业微信 WS）
- 不允许删除工作目录以外的文件
```

---

## Part B：提示词正文（直接粘贴给 Codex）

```markdown
# 任务：开发企业微信智能机器人应用框架

## 角色
你是一位企业微信开发专家。请严格基于官方文档开发，不虚构不编造。

## Phase 1 目标：长连接核心引擎

### Step 0：环境准备
1. 确认 Node.js >= 18、npm 可用
2. 初始化项目：`I:\.codex_wecom` 目录下 monorepo（npm workspaces）
3. 安装依赖：typescript, tsx, vitest, ws, dotenv, @types/ws, @types/node

### Step 1：LLMClient（packages/llm/）
实现 OpenAI 兼容协议的 LLM 客户端，支持：
- chat() 非流式调用
- streamChat() SSE 流式调用
- 多 key 自动轮换（一个失败换下一个）
- tool_calls 提取

### Step 2：WeCom WebSocket Provider（packages/providers/src/wecom/ws-provider.ts）
实现完整的长连接客户端：

**连接与认证：**
- 连接 wss://openws.work.weixin.qq.com
- 发送 aibot_subscribe（bot_id + secret）
- 30s 心跳 ping，90s 无活动断连

**消息处理：**
- aibot_msg_callback 接收用户消息（text/image/voice/file/video/mixed）
- aibot_event_callback 接收事件（enter_chat/template_card_event/feedback_event/disconnected_event）
- **注意：template_card_event 路径为 body.event.template_card_event，不是 body.template_card_event**

**回复消息（aibot_respond_msg）：**
- stream：流式文本（**不支持 msgtype=text，必须用 stream + finish:true**）
- markdown：Markdown 格式
- template_card：5 种类型（text_notice/news_notice/button_interaction/vote_interaction/multiple_interaction）
- file：需先 uploadMedia 获取 media_id

**主动推送（aibot_send_msg）：**
- 支持 markdown、template_card、file
- 需 chatid + chat_type

**模板卡片更新：**
- replyUpdateCard(frame, body)：通过 WS 的 aibot_respond_update_msg（5秒内）
- updateCardViaUrl(url, card)：通过 HTTP POST 到 response_url（无时间限制）

**文件上传：**
- init → chunk（每片 512KB，base64）→ finish
- errcode 在顶层和 headers 都可能出现，需同时检查

### Step 3：消息类型全面测试

**自动测试脚本模式（推荐）：**
创建 auto-test 脚本，流程：
1. 连接 WS，等待用户发送任意消息触发
2. 收到消息后依次执行所有测试（每项间隔 500ms）
3. 每项记录 PASS/FAIL
4. 完成后写入日志文件并退出

**测试清单（15项）：**
stream reply、markdown reply、text_notice reply、news_notice reply、
button_interaction reply、vote_interaction reply、multiple_interaction reply、
file reply、markdown push、text_notice push、news_notice push、
button_interaction push、vote_interaction push、multiple_interaction push、
file push

**交互反馈测试：**
发送 btn/vote/multi 卡片 → 用户点击/提交 → 验证 template_card_event 回调

**事件诊断（如需）：**
使用 event-dump 脚本打印完整 RAW frame 结构

### 测试运行方式

使用 `cmd /c start /b` 后台运行测试，日志重定向到文件：
```
cmd /c "start /b npx.cmd tsx scripts/test.ts > logs/out.log 2>&1"
```

### 关键踩坑（P1 验证过的）

1. **PowerShell heredoc 问题**：`@''@` 会破坏 TS 模板字符串中的 `${}`。所有 TS 文件必须用 `+` 拼接字符串，或直接用 `Out-File` 写入
2. **回复消息类型**：aibot_respond_msg 不支持 msgtype=text，用 stream（finish:true）
3. **errcode 位置**：subscribe 在 headers.errcode，upload 在顶层 errcode
4. **事件路径**：template_card_event 在 body.event.template_card_event
5. **response_url**：在 body.response_url（顶层），不在 template_card_event 内
6. **同 bot 单连接**：测试前必须 `Stop-Process -Name node` 清理旧连接
7. **模板卡片 task_id**：button/vote/multiple 必须带 task_id，用 `${prefix}_${Date.now().toString(36)}`
8. **模板卡片 card_action**：text_notice/news_notice 需要，button/vote/multiple 不需要
9. **selected_items 结构**：selected_item 数组，每个 item 含 question_key + option_ids.option_id[]
```

---

## Part C：实际测试命令速查（P1 验证通过的流程）

### 连接测试
```bash
cd I:\.codex_wecom
npx tsx scripts/quick-connect.ts
# 期望：[WS] Connected & subscribed → CONNECTED OK
```

### 全量消息类型自动测试
```bash
# 启动（后台）
cmd /c "start /b npx.cmd tsx scripts/auto-test-msg.ts > logs\auto-test.log 2>&1"
# 向机器人发任意消息 → 8项测试自动执行 → 检查 logs/auto-test.log
```

### 模板卡片补充测试
```bash
cmd /c "start /b npx.cmd tsx scripts/auto-test-cards.ts > logs\card-test.log 2>&1"
# 向机器人发消息 → 6项卡片测试自动执行 → 检查 logs/card-test.log
```

### 交互反馈测试
```bash
cmd /c "start /b npx.cmd tsx scripts/event-dump.ts > logs\event-dump-stdout.log 2>&1"
# 发 btn/vote/multi → 交互 → 检查 logs/event-raw.log
```

### 运行所有单元测试
```bash
npx vitest run
# 期望：3 files passed, 17 tests passed
```

### 清理所有 node 进程
```bash
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## Part D：项目结构速查

```
I:\.codex_wecom\
├── DESIGN.md              # 方案设计（含踩坑记录）
├── PROMPT_TEMPLATE.md     # 本文件
├── .env                   # 环境变量
├── packages/
│   ├── core/src/types.ts        # 核心类型定义
│   ├── llm/src/client.ts        # LLMClient
│   ├── agent/src/agent.ts       # Agent 引擎
│   ├── providers/src/wecom/
│   │   ├── ws-provider.ts       # WS 长连接（完整实现）
│   │   └── mcp-client.ts        # MCP 客户端
│   └── server/src/index.ts      # 启动入口
├── scripts/               # 测试脚本
│   ├── auto-test-msg.ts   # 8项基础消息类型测试
│   ├── auto-test-cards.ts # 6项交互卡片测试
│   ├── event-dump.ts      # 事件结构诊断
│   └── quick-connect.ts   # 连通性测试
├── docs/                  # 官方文档（101463/101468/101032）
└── logs/                  # 测试日志
```

---


---

## Part E：Phase 2 — CLI 能力集成（P2 验证通过的流程）

### MCP 连接测试
```bash
npx tsx scripts/test-mcp.ts
# 期望：6 categories found, 42 total tools
```

### MCP Skill Provider 自动生成
```typescript
import { McpSkillProvider } from "./packages/providers/src/wecom/mcp-skill-provider";

var provider = new McpSkillProvider({ botId: BOT_ID, botSecret: BOT_SECRET });
await provider.initialize();
// → 42 skills across 6 categories auto-generated from MCP tools/list

// Use a skill
var skill = provider.getSkill("contact.get_userlist");
var result = await skill.execute({});
```

### EventRouter 使用
```typescript
import { EventRouter } from "./packages/core/src/event-router";

var router = new EventRouter();

// When sending an interactive card:
router.register(taskId, async (event, cardEvent) => {
  // cardEvent.selected_items — user's selections
  // cardEvent.event_key — which button was clicked
  // event.body.response_url — for updating the card
  await provider.updateCardViaUrl(event.body.response_url, { card_type: "text_notice", ... });
});
```

### BotManager 启用 CLI
```typescript
var botManager = new BotManager(llmConfigs);
await botManager.enableMcp({ botId: BOT_ID, botSecret: BOT_SECRET });
// → All 42 CLI tools registered as skills, available via Agent
```

### P2 集成测试
```bash
npx tsx scripts/test-p2-cli.ts
# 测试: McpSkillProvider init + 4 categories tool calls + EventRouter
```

### P2 关键踩坑
11. **MCP 参数类型严格**：时间参数必须是字符串 "YYYY-MM-DD HH:MM:SS"，不是数字 timestamp
12. **MCP 错误返回非 JSON**：参数校验失败时返回纯文本，需 try-catch JSON.parse
13. **callTool 的 errcode 检查**：业务层 errcode≠0 也会抛异常，需要 catch 处理
14. **task_id 路由是一次性的**：EventRouter 在 handler 调用后自动删除注册

---

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-25 | 初稿 |
| v1.1 | 2026-05-26 | P1 复盘 |
| v1.2 | 2026-05-26 | P2 复盘 |
| v1.3 | 2026-05-26 | P3 复盘：5组合Skill+3Bot示例+角色体系+DI模式 |

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-25 | 初稿 |
| v1.1 | 2026-05-26 | P1 复盘修订：补充实际测试流程、10条踩坑记录、事件结构文档 |


---

## Part F：Phase 3 — 组合 Skill 与 API 模式（P3 验证通过的流程）

### 组合 Skill 开发模式

每个组合 Skill 遵循 DI（Dependency Injection）模式：Input 类型 -> Output 类型 -> Deps 注入 -> execute 函数。

### 已有组合 Skill 及测试

| Skill | 文件 | 测试 |
|-------|------|------|
| createWeeklyReport | composite-skills/create-weekly-report.ts | npx tsx scripts/test-composite-skills.ts |
| organizeMeeting | composite-skills/organize-meeting.ts | 同上 |
| createMeetingMinutes | composite-skills/meeting-minutes.ts | 同上 |
| sendPartyVote | composite-skills/party-vote.ts | 同上 |
| gatherAndAnalyze | composite-skills/info-gathering.ts | npx tsx scripts/test-info-gathering.ts |

### 新建 Bot 流程
1. cp -r bots/_template bots/my-bot
2. 编辑 config.json（选skill）+ agent.md（写人设）
3. 3个验收场景：闲聊/明确意图/模糊意图

### P3 关键踩坑
14. meeting.create_meeting invitees: { userid: [...] }（字典）
15. meeting_start_datetime: "YYYY-MM-DD HH:mm"（空格+无秒）
16. smartsheet默认字段重命名可能失败，warn继续

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-25 | 初稿 |
| v1.1 | 2026-05-26 | P1 复盘 |
| v1.2 | 2026-05-26 | P2 复盘 |
| v1.3 | 2026-05-26 | P3 复盘：5组合Skill+3Bot+角色体系+DI模式 |
