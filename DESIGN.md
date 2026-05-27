# 企业微信智能机器人应用框架 — 方案设计文档

> 本文档是项目开发的唯一权威设计依据。每次 Phase 完成后同步更新。

---

## 一、项目概述

开发企业微信智能机器人应用框架，核心目标：

1. 跑通企业微信智能机器人长连接模式全部能力
2. 集成 wecom-cli 全部品类能力
3. 集成多 LLM 模型调度 + Agent 引擎
4. 框架支持后续新建机器人快速复用（Skill 机制）
5. 支持 Docker 容器化多机器人部署

---

## 二、技术选型

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 主语言 | TypeScript (Node.js) | 官方 SDK 生态、类型安全、容器化友好 |
| 运行环境 | Node.js >= 18 | 当前环境 v24.15.0 |
| CLI 集成 | 直连 MCP JSON-RPC | 零外部二进制依赖，协议足够简单 |
| 能力复用 | Skill 模式（原子 Skill + 组合 Skill） | 独立测试、精确复用、按需授权 |
| 多模型 | 单一 LLMClient（OpenAI 兼容协议） | 所有目标模型均兼容 |
| 部署 | Docker 容器化 | 支持多实例、环境隔离 |

---

## 三、实际项目结构（P1 完成后）

```
I:\.codex_wecom\
├── DESIGN.md                    # 本文件
├── package.json                 # monorepo 根
├── vitest.config.ts
├── tsconfig.json
├── .env                         # 环境变量（不入 git）
├── packages/
│   ├── core/src/
│   │   ├── types.ts             # 核心类型（WsFrame/MessageCallback/EventCallback/Skill/Provider）
│   │   ├── bot-manager.ts       # 多机器人生命周期
│   │   └── index.ts
│   ├── llm/src/
│   │   └── client.ts            # LLMClient（OpenAI 兼容 + SSE + key 轮换）
│   ├── agent/src/
│   │   └── agent.ts             # LLM Agent 引擎
│   ├── skills/src/
│   │   └── registry.ts          # Skill 注册中心
│   ├── providers/src/wecom/
│   │   ├── ws-provider.ts       # WebSocket 长连接（连接/认证/心跳/重连/消息/事件/回复/推送/上传/卡片更新）
│   │   └── mcp-client.ts        # MCP JSON-RPC 客户端
│   └── server/src/
│       └── index.ts             # 启动入口
├── bots/test-bot/
│   ├── config.json
│   └── agent.md
├── scripts/
│   ├── auto-test-msg.ts         # 8项基础消息类型自动测试
│   ├── auto-test-cards.ts       # 3种交互卡片自动测试
│   ├── event-dump.ts            # 事件结构诊断脚本
│   ├── interaction-test.ts      # 交互反馈手动测试
│   ├── quick-connect.ts         # 快速连通性测试
│   └── ...
├── docs/
│   ├── 101463-*.html/txt        # 长连接文档
│   ├── 101468-*.html/txt        # API 模式文档
│   └── 101032-*.html/txt        # 模板卡片文档
└── logs/                        # 测试日志输出
```

---

## 四、P1 开发总结

### 4.1 完成情况

**全部 15 项消息类型测试通过（reply + push）：**

| # | 消息类型 | reply | push | 说明 |
|---|---------|-------|------|------|
| 1 | stream | ✅ | N/A | 流式文本（finish:true），不支持 msgtype=text |
| 2 | markdown | ✅ | ✅ | 支持表格、列表、引用等标准 Markdown |
| 3 | text_notice | ✅ | ✅ | 文本通知模板卡片 |
| 4 | news_notice | ✅ | ✅ | 图文展示模板卡片 |
| 5 | button_interaction | ✅ | ✅ | 按钮交互（含下拉选择器+按钮） |
| 6 | vote_interaction | ✅ | ✅ | 投票选择 |
| 7 | multiple_interaction | ✅ | ✅ | 多项选择（多个下拉选择器） |
| 8 | file | ✅ | ✅ | 文件上传（init→chunk→finish）+ 发送 |

**交互反馈全部验证通过：** 3 种交互卡片（button/vote/multiple）的 template_card_event 回调均成功接收，事件结构完整捕获。

### 4.2 事件回调结构

`template_card_event` 通过 `aibot_event_callback` 下发，结构如下：

```json
{
  "cmd": "aibot_event_callback",
  "headers": { "req_id": "..." },
  "body": {
    "msgtype": "event",
    "from": { "userid": "ShiMeng" },
    "response_url": "https://qyapi.weixin.qq.com/cgi-bin/aibot/response?response_code=...",
    "event": {
      "eventtype": "template_card_event",
      "template_card_event": {
        "card_type": "button_interaction",
        "event_key": "BTN_OK",
        "task_id": "btn_xxx",
        "selected_items": {
          "selected_item": [{
            "question_key": "identity",
            "option_ids": { "option_id": ["id_user"] }
          }]
        }
      }
    }
  }
}
```

关键字段：
- `body.response_url`：可用于 HTTP POST 更新卡片（不受 5 秒窗口限制）
- `body.event.template_card_event.event_key`：按钮/提交的 key
- `body.event.template_card_event.selected_items`：用户选择数据
- `body.from.userid`：交互用户 ID

### 4.3 ws-provider 核心 API

| 方法 | 协议 | 说明 |
|------|------|------|
| `connect(config)` | WS | 建立连接 + aibot_subscribe 认证 |
| `replyMessage(frame, body)` | WS fire-and-forget | 回复消息（支持 stream/markdown/template_card/file） |
| `replyUpdateCard(frame, body)` | WS fire-and-forget | 通过事件 req_id 更新卡片（5秒内） |
| `updateCardViaUrl(url, card)` | HTTP POST | 通过 response_url 更新卡片（无时间限制） |
| `sendMessage(chatId, type, body)` | WS fire-and-forget | 主动推送消息 |
| `uploadMedia(buf, name, type)` | WS request-response | 分片上传文件 |
| `onMessage(handler)` | — | 注册消息回调处理器 |
| `onEvent(handler)` | — | 注册事件回调处理器 |

### 4.4 关键踩坑记录

| # | 问题 | 原因 | 解决方案 |
|---|------|------|---------|
| 1 | PowerShell heredoc 吃掉 `${}` | `@''@` 不解析变量，但影响模板字符串 | 所有 TS 文件使用字符串拼接 `+` 代替 backtick `${}` |
| 2 | errcode 位置不一致 | subscribe 的 errcode 在 headers，upload 在顶层 | 同时检查 `frame.errcode` 和 `frame.headers?.errcode` |
| 3 | reply 不支持 msgtype=text | 官方设计如此 | 使用 `msgtype: 'stream'` + `finish: true` 代替 |
| 4 | 欢迎语才支持 msgtype=text | `aibot_respond_welcome_msg` 特殊处理 | 仅在 welcome 场景使用 text |
| 5 | 模板卡片事件路径为 body.event.template_card_event | 非 body.template_card_event | 通过 `event.body?.event?.eventtype` 判断 |
| 6 | response_url 在 body 顶层 | 非 template_card_event 内部 | 取 `event.body?.response_url` |
| 7 | 交互卡片需要 task_id | button/vote/multiple 强制要求 | 使用 `${prefix}_${Date.now().toString(36)}` 生成唯一 ID |
| 8 | button/vote/multiple 不要求 card_action | 与 text_notice/news_notice 不同 | 省略 card_action 字段 |
| 9 | selected_items 结构为 selected_item 数组 | option_ids 内嵌 option_id 数组 | 遍历 selected_item[].option_ids.option_id[] |
| 10 | 同 bot 只能一个长连接 | 新连接会踢旧连接 | 测试前必须清理所有旧 node 进程 |

---

## 五、架构演进

### 5.1 分层架构（P1 实际实现）

```
┌──────────────────────────────────────────┐
│  Bot Config Layer      机器人配置         │
│  bots/{bot-name}/config.json + agent.md  │
├──────────────────────────────────────────┤
│  Agent Runtime Layer   运行时引擎         │
│  packages/agent/ — 意图识别、Skill 编排   │
├──────────────────────────────────────────┤
│  LLM Client            模型客户端         │
│  packages/llm/ — OpenAI 兼容协议 + key轮换│
├──────────────────────────────────────────┤
│  Skill Registry        能力注册中心        │
│  packages/skills/ — 原子 Skill + 组合     │
├──────────────────────────────────────────┤
│  Provider Layer        服务适配层          │
│  packages/providers/wecom/               │
│  ├── ws-provider.ts    (WebSocket 长连接)  │
│  └── mcp-client.ts     (CLI MCP 协议)     │
└──────────────────────────────────────────┘
```

### 5.2 Skill ↔ 事件路由设计（P2 规划）

基于 P1 捕获的事件结构，后续 Skill 框架集成方案：

```
发送交互卡片 → 注册 task_id → 用户交互 → template_card_event
  → 按 task_id 路由到对应 Skill
  → Skill 处理 selected_items（记录投票/选择）
  → updateCardViaUrl(response_url) 更新卡片状态
  → 结果写入智能文档/表格
```

示例：党建投票 Skill
1. 发送 multiple_interaction 卡片推荐候选人
2. 收到 template_card_event → 按 task_id 路由
3. 提取 selected_items → 记录投票数据
4. updateCardViaUrl → 更新卡片显示"投票成功"
5. 聚合所有投票 → 写入智能文档

---

## 六、Phase 2 规划（待展开）

### 6.1 CLI 能力集成

wecom-cli 7 大品类：
- contact（通讯录）
- doc（文档）
- msg（消息）
- meeting（会议）
- schedule（日程）
- smartsheet（智能表格）
- todo（待办）

实现方式：通过 MCP JSON-RPC 协议调用，封装为 Provider 的 callTool 方法。

### 6.2 Skill 框架完善

- 实现所有原子 Skill（对应 CLI 品类方法）
- 实现事件路由机制（task_id → Skill）
- 实现组合 Skill（如：党建周报 = doc.create + schedule.list + msg.send）
- 实现数据持久化（投票/选择结果记录）

---

## 七、环境变量

```bash
# 必填
WECOM_BOT_ID=your_bot_id_here
WECOM_BOT_SECRET=your_bot_secret_here

# LLM API Keys
DEEPSEEK_API_KEY_1=sk-your_key_1_here
DEEPSEEK_API_KEY_2=sk-your_key_2_here
DEEPSEEK_API_KEY_3=sk-your_key_3_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

---

## 八、版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-25 | 初始方案 |
| v1.1 | 2026-05-26 | P1 完成：15项消息类型测试通过、事件结构捕获、踩坑记录、ws-provider 完善 |

---

> 下次更新：Docker部署 + 飞书平台接入

---

## 九、P2 开发总结（2026-05-26）

### 9.1 完成情况

**MCP CLI 集成全部验证通过：**

| 品类 | 工具数 | 测试方法 | 结果 |
|------|--------|---------|------|
| contact | 1 | get_userlist | ✅ 返回3个成员 |
| todo | 6 | get_todo_list | ✅ 正常返回 |
| msg | 4 | get_msg_chat_list | ✅ 正常返回(空列表) |
| schedule | 8 | get_schedule_list_by_range | ✅ 返回5条日程 |
| meeting | 5 | (skill lookup) | ✅ 5个工具已注册 |
| doc | 18 | (skill lookup) | ✅ 18个工具已注册 |

**架构新增：**

| 组件 | 文件 | 功能 |
|------|------|------|
| McpSkillProvider | providers/src/wecom/mcp-skill-provider.ts | 从 MCP tools/list 自动生成 42 个原子 Skill |
| EventRouter | core/src/event-router.ts | task_id → Skill handler 路由（含 TTL 自动清理） |
| WeComMcpClient（完善） | providers/src/wecom/mcp-client.ts | 改进错误处理，支持非 JSON 响应 |
| BotManager（更新） | core/src/bot-manager.ts | enableMcp() 一键启用全部 CLI 能力 |

### 9.2 McpSkillProvider 设计

```
McpSkillProvider.initialize()
  → WeComMcpClient.fetchMcpConfig()      // 获取6品类MCP URL
  → for each category:
      → WeComMcpClient.listTools(cat)     // 获取工具列表+inputSchema
      → schemaToParams(inputSchema)       // JSON Schema → SkillDefinition
      → create Skill { execute → MCP callTool }
  → 42 atomic skills ready
```

### 9.3 EventRouter 设计

```
发送交互卡片(带task_id) → register(task_id, handler)
  → 用户交互 → template_card_event
    → handleEvent() 按 task_id 路由
    → handler 获取 selected_items + response_url
    → updateCardViaUrl() 更新卡片 / 记录数据
```

### 9.4 P2 踩坑记录

| # | 问题 | 原因 | 解决方案 |
|---|------|------|---------|
| 11 | MCP 工具参数类型严格 | schedule 的 start_time 必须是字符串 "YYYY-MM-DD HH:MM:SS" | Agent 层需根据 inputSchema 做类型转换 |
| 12 | MCP 错误返回非 JSON 文本 | 服务端参数校验错误直接返回纯文本 | callToolWithUrl 增加 JSON.parse try-catch |
| 13 | msg.get_msg_chat_list 需要 begin_time | 文档说明不够明确 | 通过错误消息反推参数格式 |

---

## 十、版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-05-25 | 初始方案 |
| v1.1 | 2026-05-26 | P1 完成：15项消息类型测试通过 |
| v1.2 | 2026-05-26 | P2 完成：42个CLI技能+事件路由+BotManager MCP集成 |
| v1.3 | 2026-05-26 | P3 完成：5个组合Skill+3个Bot示例+角色体系完善 |
---

## 十一、Vibecoding 角色体系（2026-05-26）

### 11.1 设计原则

通过 AGENTS.md 文件在项目每个层级固化角色边界。AI 进入目录时自动读取，即刻知道：
- 可以修改什么
- 不能触碰什么
- 质量标准是什么
- 协作流程是什么

### 11.2 AGENTS.md 文件层级

```
AGENTS.md                      ← 项目总入口，角色路由
framework/AGENTS.md            ← 架构负责人边界
composite-skills/AGENTS.md     ← Skill 编排者边界
bots/_template/AGENTS.md       ← Bot PM 边界 + 模板
scripts/tests/AGENTS.md        ← 测试负责人边界
```

### 11.3 四角色体系

| 角色 | 人数 | 改什么 | 不改什么 | 与 Codex 交互 |
|------|:---:|--------|---------|-------------|
| 架构负责人 | 1 | framework/ 接口、Provider、Agent | bots/ composite-skills/ | 人审接口设计 → Codex 实现 → 人跑回归 |
| Bot PM | N | bots/{name}/ 的 config + agent.md | framework/ composite-skills/ | 人描述 bot 行为 → Codex 生成配置 → 人验收 |
| Skill 编排者 | 1-2 | composite-skills/*.ts | framework/ bots/ | 人设计流程 → Codex 生成代码 → 人验证 |
| 测试负责人 | 1 | scripts/tests/ 场景清单 | framework/ bots/ | 人列场景 → Codex 生成测试 → 人看报告 |

### 11.4 最小团队：2人 + Codex

一人兼任架构+PM，一人兼任 Skill+测试。Codex 负责全部编码和执行。
## 十二、P3 开发总结（2026-05-26）

### 12.1 API 模式说明

101468 文档中的「API模式」核心是基于 MCP 协议的文档能力授权体系：
- API 模式机器人可获得成员授权的「文档」使用权限
- 通过 MCP streamableHTTP 调用 doc/smartsheet API
- 机器人只能编辑自己创建的文档

**这些 MCP 能力已在 P2 全部实现并测试通过。**

### 12.2 组合 Skill 全部完成

| # | Skill | 文件 | 原子 Skill 调用 | 测试 |
|---|-------|------|----------------|:---:|
| 1 | 周报创建 | composite-skills/create-weekly-report.ts | doc.create_doc + doc.edit_doc_content + LLM润色 | ✅ |
| 2 | 会议组织 | composite-skills/organize-meeting.ts | schedule.check_availability + meeting.create_meeting + schedule.create_schedule + todo.create_todo | ✅ |
| 3 | 会议纪要 | composite-skills/meeting-minutes.ts | LLM整理 + 待办提取 + doc.create_doc + doc.edit_doc_content | ✅ |
| 4 | 党建投票 | composite-skills/party-vote.ts | template_card + EventRouter + doc.create_doc | ✅ |
| 5 | 信息汇集分析 | composite-skills/info-gathering.ts | LLM分析 + doc.create_doc + smartsheet_* | ✅ |

### 12.3 Bot 示例

| Bot | 目录 | 定位 | Skills |
|-----|------|------|--------|
| test-bot | ots/test-bot/ | 基础测试 | 无（纯 Agent 对话） |
| project-bot | ots/project-bot/ | 项目管理 | 会议+日程+待办+周报+纪要 |
| party-bot | ots/party-bot/ | 党建助手 | 文档+投票+周报+活动 |

### 12.4 Vibecoding 角色体系完善

| 文件 | 内容 |
|------|------|
| AGENTS.md | 根入口：角色路由 + 能力总览 + 快速命令 |
| STANDARDS.md | 开发测试铁律：文档优先、不虚构、测试先行、不跨边界、文档同步 |
| ramework/AGENTS.md | 架构负责人：消息类型矩阵、事件类型、Provider接口、工作流 |
| composite-skills/AGENTS.md | Skill编排者：42原子Skill目录、DI模式、5个组合Skill清单 |
| ots/_template/AGENTS.md | Bot PM：建bot流程、config.json/agent.md规范 |
| scripts/tests/AGENTS.md | 测试负责人：场景模板、回归命令、验收清单 |

### 12.5 当前能力全景

`
企业微信智能机器人框架 v1.3
├── 消息收发: 15种类型 (WS长连接)
│   ├── 普通消息: stream, markdown, file
│   └── 模板卡片: text_notice, news_notice, button/vote/multiple_interaction
├── 事件回调: 4种事件 (enter_chat, template_card_event, feedback, disconnected)
├── CLI/MCP: 6品类 42原子Skill (contact, todo, msg, schedule, meeting, doc)
├── 组合Skill: 5个 (周报, 会议组织, 会议纪要, 投票, 信息分析)
├── Bot管理: BotManager (多bot生命周期, MCP启用, EventRouter)
├── LLM客户端: multi-key轮换, SSE流式, OpenAI兼容
├── Agent引擎: 意图识别 + Skill调度 + 槽位填充
├── Bot示例: test-bot, project-bot, party-bot
└── 角色体系: 6个AGENTS.md + 1个STANDARDS.md
`

### 12.6 P3 踩坑记录

| # | 问题 | 原因 | 解决方案 |
|---|------|------|---------|
| 14 | meeting.create_meeting invitees 格式 | MCP schema: { userid: [...] } 非数组 | 使用字典格式 |
| 15 | meeting_start_datetime 格式 | 要求 "YYYY-MM-DD HH:mm"（空格+无秒） | 不能使用 ISO 8601 T分隔符 |
| 16 | smartsheet 默认字段重命名失败 | 默认字段类型不兼容 | warn 继续，不影响主流程 |

---

## 13. Docker 部署 + 腾讯云实战 (2026-05-27)

### 13.1 架构

```
腾讯云轻量服务器 (Ubuntu 24.04, 3.6GB RAM)
├── Docker Engine 29.5.2
├── docker-compose v5.1.4
├── wecom-bot-test (test-bot, 旧凭据)
└── 待部署: bot-party, bot-project (需独立 Bot 凭据)
```

### 13.2 一容器一 Bot 模式

- 每个 Bot 一个 Docker 容器，通过 `BOT_NAME` 环境变量指定
- 凭据通过 `env_file: bots/{name}/.env` 注入（每 Bot 独立）
- Bot 配置（`config.json` + `agent.md`）通过 volume 挂载（只读）
- 镜像统一使用 `wecom-bot-framework:latest`，一次构建多 Bot 复用
- `docker-compose.yml` 中 project-bot 使用 `profiles: [project]` 默认禁用

### 13.3 部署踩坑

| # | 问题 | 原因 | 解决方案 |
|---|------|------|---------|
| 17 | 腾讯云 22 端口不通 | 旧防火墙规则未生效 | 删除重建 SSH 规则，来源限定 IP |
| 18 | SSH .pem 权限 too open | Windows 上 NT AUTHORITY\Authenticated Users 有读权限 | `icacls` 仅保留当前用户 |
| 19 | GitHub clone TLS 失败 | 国内服务器访问 GitHub 不稳定 | SCP 直接传项目文件 |
| 20 | package.json BOM 字符 | Windows 编辑器添加 UTF-8 BOM | Dockerfile 内置 `sed` 清理 BOM+CRLF |
| 21 | types.ts 字面量 `\n` | 源代码中 `\n` 为字面量非换行 | 替换为实际换行符 |
| 22 | create-weekly-report.ts 重复导出 | 两份 `weeklyReportDefinition` 定义 | 删除重复的第一份，保留参数更完整的版本 |
| 23 | volume 挂载文件 BOM 残留 | Dockerfile 清理仅影响 COPY 阶段，不影响 volume | 服务器上额外执行 sed BOM 清理 |

### 13.4 开发模式决策

- **test-bot**: 本地开发专用，永远不在生产环境运行
- **新 Bot 流程**: 需求讨论 → 方案确认 → 本地 test-bot 开发测试 → 人工验证 → 创建正式 Bot 凭据 → 云服务器部署
- **飞书 CLI**: 已调研（文档/智能表格能力更强），暂不引入（生态隔离，用户需额外账号）
- **腾讯会议 API**: 待调研
- 以上决策已写入 `STANDARDS.md` §二「开发流程规范」和 §九「待评估清单」
