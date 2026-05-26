# 企业微信智能机器人框架 — 开发测试规范

> AI 进入项目时必须遵守本规范。违反任一规则 = 不合格交付。

---

## 一、铁律（不可违反）

### 1.1 文档优先
- **所有企业微信 API 行为必须以 `docs/` 中官方文档为准**
- 涉及新功能时，先下载对应官方文档到 `docs/`，完整学习后再开发
- 不得猜测参数名、参数类型、返回结构 — 一切从文档或 MCP schema 获取
- 文档链接参考：`docs/101463-*`（长连接）、`docs/101032-*`（模板卡片）、`docs/101468-*`（API模式）

### 1.2 不虚构
- 不得编造 API 端点、参数名、消息格式
- 不确定时，通过 MCP `tools/list` 获取准确 schema，或查阅 `docs/` 中官方文档
- 错误消息必须原样透传，不得美化或截断关键信息

### 1.3 测试先行
- 修改 `packages/` 代码后必须跑 `npx vitest run`，全部通过才算完成
- 新增功能必须有对应测试
- 集成测试必须实际操作企业微信验证

### 1.4 不跨边界
- 严格遵守各 AGENTS.md 定义的角色边界
- 改 framework/ 不动 bots/，改 bots/ 不动 framework/
- 跨边界需求 → 找对应角色负责人协调，不自己越界

### 1.5 文档同步
- 每个 Phase 完成后更新 `DESIGN.md` 和 `PROMPT_TEMPLATE.md`
- 新踩的坑记录到对应文档的"踩坑记录"章节
- 关键决策和架构变更必须记录

---

## 二、代码规范

### 2.1 TypeScript
- 使用 `var` 声明变量（项目约定，避免 `let`/`const` 的块作用域问题）
- 使用 `function` 关键字，不使用箭头函数（`() => {}`）
- 字符串拼接用 `+`，避免模板字符串 `${}`（PowerShell 兼容）
- 所有类型定义在 `packages/core/src/types.ts`

### 2.2 错误处理
- MCP 调用必须 try-catch，错误消息包含 category.method 信息
- 非 JSON 响应必须捕获并展示原始内容（便于诊断）
- errcode ≠ 0 必须抛出包含 errcode + errmsg 的错误

### 2.3 接口设计
- 所有 Provider 必须实现 `Provider` 接口的全部方法
- 新方法先加接口定义，再实现
- 接口变更不能破坏现有 bot 配置

---

## 三、测试规范

### 3.1 单元测试
```
位置：packages/*/tests/*.test.ts
框架：vitest
命令：npx vitest run
通过标准：所有 test files passed，0 failed
```

### 3.2 集成测试（原子 Skill）
```
位置：scripts/test-all-skills-v3.ts
方式：依次调用每个原子 Skill，记录 PASS/FAIL/SKIP
通过标准：0 FAIL（SKIP 允许，但需注明原因）
关键原则：参数从 MCP tools/list schema 获取，不猜测
```

### 3.3 场景测试（Bot 验收）
```
每个 bot 上线前至少验证 3 个交互场景：
1. 闲聊场景（bot 应自然回复）
2. 明确意图场景（bot 应识别并执行对应 Skill）
3. 模糊意图场景（bot 应追问澄清，不瞎猜执行）
```

### 3.4 回归测试
```
以下情况必须跑全量回归：
- framework/ 任何文件修改
- 新增 Provider
- 修改 Provider 接口
- 升级依赖
```

---

## 四、文档规范

### 4.1 官方文档管理
```
位置：docs/
命名：{文档编号}-{类型}.{格式}
  例如：101463-rendered.html, 101463-text.txt
新增：下载 → 渲染 → 提取文本 → 归档到 docs/
引用：代码注释中标注参考的文档编号
```

### 4.2 设计文档
```
DESIGN.md：
  - 每个 Phase 完成后更新
  - 包含：完成情况、架构变更、踩坑记录、版本号

PROMPT_TEMPLATE.md：
  - 每个 Phase 完成后更新
  - 包含：可复用的提示词、环境变量清单、测试命令、踩坑记录
  - 目标：其他人粘贴即可复现
```

### 4.3 踩坑记录格式
```markdown
| # | 问题 | 原因 | 解决方案 |
|---|------|------|---------|
| N | 一句话描述现象 | 根因分析 | 具体修复方法 |
```

---

## 五、新增能力规范

### 5.1 新平台接入（如飞书）
```
1. docs/ 下创建飞书文档目录，下载官方文档
2. packages/providers/ 下创建 feishu/ 目录
3. 实现 Provider 接口全部方法
4. 写单元测试（vitest）
5. 写集成测试（连接飞书验证）
6. 更新 DESIGN.md + PROMPT_TEMPLATE.md
7. 更新 packages/core/src/types.ts（如需新类型）
```

### 5.2 新原子 Skill
```
不手写。由 McpSkillProvider 从 MCP tools/list 自动生成。
如果 CLI 新增了工具，只需重新运行 .initialize()。
```

### 5.3 新组合 Skill
```
1. 在 composite-skills/ 创建 .ts 文件
2. 必须包含：Input 类型、Output 类型、参数校验、错误回滚
3. 写场景测试验证
4. 更新 composite-skills/AGENTS.md 的能力清单
```

### 5.4 新 Bot
```
1. cp -r bots/_template bots/{name}
2. 编辑 config.json（选 skill）和 agent.md（写人设）
3. 写 3 个验收场景
4. 跑场景测试
5. 更新 bots/{name}/ 下文档
```

---

## 六、P1/P2 已验证的质量实践

| 实践 | 来源 | 说明 |
|------|------|------|
| 参数从 MCP schema 获取 | P2 教训 | v1 猜测参数 → 11 fail；v3 查 schema → 0 fail |
| 自动测试脚本 | P1 经验 | 一次触发全量测试，结果记日志 |
| event-dump 诊断 | P1 经验 | 不确定事件结构时，先 dump RAW 再解析 |
| CRUD 闭环测试 | P2 经验 | 创建→查询→更新→删除，确保每个操作都验证 |
| 清理即创建 | P2 经验 | 测试资源即时清理，不残留 |


## 八、安全管理规范（企业级）

### 8.1 凭据管理

- **绝对禁止**在源代码中硬编码任何密钥、Token、密码
- 所有凭据通过 `.env` 文件注入，`.env` 已加入 `.gitignore`，不可提交
- 项目提供 `.env.example` 模板，新开发者复制后填入自己的凭据
- 生产环境凭据通过服务器环境变量或密钥管理服务（如 HashiCorp Vault）注入

### 8.2 API Key 安全

- LLM API Key 使用多 Key 轮换机制（`LLMClient` 内置），降低单 Key 泄露风险
- 日志中禁止输出完整 API Key，仅输出前 8 位用于调试（`key.slice(0,8)+'...'`）
- 错误消息中禁止包含凭据信息

### 8.3 输入校验

- 所有 MCP 调用参数必须从 MCP `tools/list` schema 获取，不得猜测类型
- 用户消息（来自企业微信）视为不可信输入，不直接拼接到系统命令
- LLM 返回的 `tool_calls.arguments` 必须 JSON.parse 后校验必填字段
- 文件上传前校验类型和大小

### 8.4 错误信息安全

- 面向用户的错误消息使用通用提示（"抱歉，服务暂时不可用"），不暴露内部错误详情
- 内部错误日志可包含完整诊断信息，但写入 `logs/` 目录（已在 `.gitignore` 中）
- `errcode` 和 `errmsg` 原样记录到日志，但不在用户回复中展示

### 8.5 网络安全

- WebSocket 连接使用 `wss://`（TLS 加密），不可降级为 `ws://`
- MCP 请求签名使用 SHA256，验证响应完整性
- 公网部署时，服务器需配置防火墙规则，仅开放必要端口

### 8.6 代码审查检查点

新增 Skill 或修改 Provider 时，必须检查：
- [ ] 无硬编码凭据
- [ ] 用户输入经过校验
- [ ] 错误消息不泄露内部信息
- [ ] 日志输出脱敏
- [ ] `.env.example` 已更新（如新增环境变量）

### 8.7 开发者安全自检

```bash
# 提交前运行安全扫描
grep -r "sk-[a-zA-Z0-9]\{20,\}" packages/ scripts/ --include="*.ts" && echo "❌ 发现疑似 API Key" || echo "✅ 无硬编码凭据"
grep -r "secret\|password\|token" packages/ --include="*.ts" | grep -v "process.env\|\.env\|\.example" && echo "⚠️ 检查硬编码" || echo "✅ 通过"
```

---

## 七、禁止事项

- ❌ 猜测 API 参数名或类型
- ❌ 跳过测试直接交付
- ❌ 修改其他角色的文件
- ❌ 忽略 errcode 检查
- ❌ 在错误消息中截断关键诊断信息
- ❌ 使用未在官方文档中出现的 API
- ❌ 在 bot 配置中引用不存在的 skill 名

