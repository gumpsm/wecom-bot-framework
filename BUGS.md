# Bug 追踪表

> 所有在开发和测试中发现的 Bug，修复后必须记录到此表。
> PM 和 PA 遇到问题时，先查此表是否有已有解决方案。

---

## 已修复

| 日期 | 模块 | 症状 | 根因 | 修复 | 影响 |
|------|------|------|------|------|------|
| 2026-05-28 | agent.ts | 权限配置写了但不生效，所有人可调用所有 skill | `permissionCheck` 回调传入 AgentConfig 但 handleMessage() 中从未调用 | handleMessage() 和 handleMessageStream() 工具执行前加入权限拦截 | 所有 PM |
| 2026-05-28 | permission-middleware.ts | `"用户:ShiMeng"` 角色配置后不生效，无法按 userId 匹配 | `matchRolesAsync()` 只处理了 标签/岗位/部门 三种类型，缺少 用户 分支 | 新增 `type === '用户'` 分支，按 `userInfo.userId === value` 匹配 | 所有 PM |
| 2026-05-28 | agent.ts | 工具调用时 DeepSeek 报错 "Invalid tools[N].function.name: string does not match pattern" | DeepSeek 要求 function name 仅 `a-zA-Z0-9_-`，但 MCP skill 名含 `.`（如 `doc.create_doc`） | agent.ts 发送前 `.` → `_`，返回后 `_` → `.` 自动还原 | 所有 PM |
| 2026-05-28 | agent.ts + llm/client.ts | 工具调用第二次 LLM 请求报错 "reasoning_content must be passed back" | deepseek-v4-flash 开启 thinking 模式，assistant 消息需包含 reasoning_content 字段 | LLMResponse 和 ChatMessage 新增 reasoning_content 字段，agent 在历史中传递 | 所有 PM |
| 2026-05-28 | mcp-skill-provider.ts | 所有MCP skill被路由到get_msg_media（日程创建/待办查询等全部失败），LLM编造成功回复 | McpSkillProvider闭包变量用var声明，函数作用域导致42个skill全部捕获最后一个category/method(msg/get_msg_media) | var→const（块作用域，每次迭代创建新绑定） | 所有PM |
| 2026-05-28 | pa-bot config | pa-bot 返回原始 tool call XML 而非人类可读文本 | deepseek-v4-flash 对 tool calling 支持不稳定，输出 tool call 格式文本而非结构化调用 | pa-bot 模型改为 deepseek-chat（与 PM bot 一致） | PA |

| 2026-05-28 | mcp-skill-provider.ts | DeepSeek 合并重复词：schedule_get_schedule_detail → schedulegetschedule_detail，工具调用失败 | Skill 名中品类词和方法名重复，LLM tokenizer 合并 _ 分隔符 | CamelCase 重构：schedule_getDetail（仅1个_，方法内部 CamelCase，去掉重复品类词） | 所有 PM |
---

## 已修复

| 2026-05-28 | bot-manager.ts | config.llm.model 配置被忽略，所有 Bot 共用全局模型 | startBot() 中 llmClient 始终用 this.llmClient，不读 config.llm | 新增 getBotLlmClient()，检测 config.llm.model 并创建专用 LLMClient | 所有 PM |
| 2026-05-28 | agent.ts | detailRule 中 skill 名不匹配实际CamelCase命名 | 复合Skill命名重构后schedule_get_list→schedule_getListByRange | 更新 detailRule 中的实际 skill 名 | 所有 PM |
| 2026-05-28 | agent.ts | DeepSeek 间歇性输出原始 XML (<invoke>)而非结构化 tool_call | 直接回复路径未过滤 | 检测 reply 中的<⚛/<invoke/<tool_calls>，替换为友好提示 | 所有 PM |

已修复

| 2026-05-28 | agent.ts | 日程/待办查询返回原始 XML (<⚛>)，<invoke> 标签直接暴露给用户 | 第二次 LLM 调用未传 tools参数，LLM无法结构化调用getDetail | 第二次调用传入 tools + 多轮循环（最多3轮）, 2处 XML 过滤做安全兜底 | 所有 PM |

待修复

（暂无）

---

## 记录规则

- 发现 Bug → 修复 → 更新此表
- 跨边界 Bug → 通知对应角色负责人 → 负责人修复后记录
- Phase 结束时 PA 汇总到 ROADMAP.md