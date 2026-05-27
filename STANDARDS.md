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

### 1.3 先讨论后开发
- **绝对禁止在需求未讨论清楚前动手写代码**
- 开发前必须完成：需求确认 → 方案讨论 → 达成共识 → 制定开发计划
- 涉及新技术/新平台（如飞书 CLI、腾讯会议 API）时，必须先研究官方文档，输出对比分析，与产品经理讨论决策后再开发
- 绝不一上来就动生产环境——开发和验证必须在本地完成

### 1.4 测试先行
- 修改 `packages/` 代码后必须跑 `npx vitest run`，全部通过才算完成
- 新增功能必须有对应测试
- 集成测试必须实际操作企业微信验证

### 1.5 不跨边界
- 严格遵守各 AGENTS.md 定义的角色边界
- 改 framework/ 不动 bots/，改 bots/ 不动 framework/
- 跨边界需求 → 找对应角色负责人协调，不自己越界

### 1.6 文档同步
- 每个 Phase 完成后更新 `DESIGN.md` 和 `PROMPT_TEMPLATE.md`
- 新踩的坑记录到对应文档的"踩坑记录"章节
- 关键决策和架构变更必须记录

---

## 二、开发流程规范（企业级）

### 2.1 标准开发循环

```
需求讨论阶段              开发测试阶段                部署验证阶段
┌──────────────┐        ┌──────────────┐          ┌──────────────┐
│ 产品+技术讨论  │   →   │ test-bot 本地  │    →    │ 生产 Bot 云端  │
│ 需求→方案→确认 │        │ 开发+全量测试  │         │ 凭据→部署→验收 │
└──────────────┘        └──────────────┘          └──────────────┘
  人工参与密集              尽量减少人工               人工验证效果
```

### 2.2 各阶段职责

**需求讨论阶段**（人工参与）：
- 产品和需求方定义场景和使用体验
- 技术负责研究官方技术文档，输出可行性分析和方案对比
- 共同确认：做什么、优先级、验收标准
- 输出：开发计划（Plan items）

**开发测试阶段**（AI 为主，人工最小化）：
- 使用 `test-bot` + 本地服务进行开发
- 所有开发在本地完成测试闭环，不碰生产环境
- 测试必须覆盖：单元测试 + 集成测试 + 场景测试
- 人工仅在以下情况介入：提供新凭据/授权、验证交互效果、确认不确定性

**部署验证阶段**（人工验证）：
- 本地全部测试通过 + 人工确认效果 → 创建正式 Bot 凭据
- 拿到凭据后部署到云服务器（Docker）
- 人工发送消息验证生产环境效果

### 2.3 test-bot 定位

- `test-bot` 是**本地开发专用 Bot**，永远在本地环境运行
- 不同阶段可使用不同凭据对接不同测试机器人
- 开发通过后，生产 Bot 从 `bots/_template` 新建，使用独立凭据
- test-bot 的代码、配置不部署到生产服务器

### 2.4 新增能力流程

**新平台接入**（如飞书 CLI、腾讯会议 API）：
1. `docs/` 下下载并学习官方文档
2. 输出对比分析报告（能力、权限、生态适配性）
3. 与产品经理讨论决策是否引入
4. 决策通过后：实现 Provider → 单元测试 → 集成测试 → 更新文档
5. 决策不通过：记录到 DESIGN.md「待评估」清单

**新原子 Skill**：
- 不手写。由 McpSkillProvider 从 MCP tools/list 自动生成
- 如果 CLI 新增了工具，重新运行 `.initialize()` 即可

**新组合 Skill**：
1. 在 `composite-skills/` 创建 `.ts` 文件
2. 必须包含：Input 类型、Output 类型、参数校验、错误回滚
3. 写场景测试验证 → 本地 test-bot 验证
4. 更新 `composite-skills/AGENTS.md` 的能力清单

**新 Bot**：
1. `cp -r bots/_template bots/{name}`
2. 编辑 `config.json`（选 skill）和 `agent.md`（写人设）
3. 写 3 个验收场景 → 本地 test-bot 验证
4. 验证通过 → 创建正式 Bot 凭据 → 服务器部署
5. 更新 `bots/{name}/` 下文档

---

## 三、代码规范

### 3.1 TypeScript
- 使用 `var` 声明变量（项目约定，避免 `let`/`const` 的块作用域问题）
- 使用 `function` 关键字，不使用箭头函数（`() => {}`）
- 字符串拼接用 `+`，避免模板字符串 `${}`（PowerShell 兼容）
- 所有类型定义在 `packages/core/src/types.ts`

### 3.2 错误处理
- MCP 调用必须 try-catch，错误消息包含 category.method 信息
- 非 JSON 响应必须捕获并展示原始内容（便于诊断）
- errcode ≠ 0 必须抛出包含 errcode + errmsg 的错误

### 3.3 接口设计
- 所有 Provider 必须实现 `Provider` 接口的全部方法
- 新方法先加接口定义，再实现
- 接口变更不能破坏现有 bot 配置

---

## 四、测试规范

### 4.1 单元测试
```
位置：packages/*/tests/*.test.ts
框架：vitest
命令：npx vitest run
通过标准：所有 test files passed，0 failed
```

### 4.2 集成测试（原子 Skill）
```
位置：scripts/test-all-skills-v3.ts
方式：依次调用每个原子 Skill，记录 PASS/FAIL/SKIP
通过标准：0 FAIL（SKIP 允许，但需注明原因）
关键原则：参数从 MCP tools/list schema 获取，不猜测
```

### 4.3 场景测试（Bot 验收）
```
每个 bot 上线前至少验证 3 个交互场景：
1. 闲聊场景（bot 应自然回复）
2. 明确意图场景（bot 应识别并执行对应 Skill）
3. 模糊意图场景（bot 应追问澄清，不瞎猜执行）
```

### 4.4 回归测试
```
以下情况必须跑全量回归：
- framework/ 任何文件修改
- 新增 Provider
- 修改 Provider 接口
- 升级依赖
```

---

## 五、文档规范

### 5.1 官方文档管理
```
位置：docs/
命名：{文档编号}-{类型}.{格式}
  例如：101463-rendered.html, 101463-text.txt
新增：下载 → 渲染 → 提取文本 → 归档到 docs/
引用：代码注释中标注参考的文档编号
```

### 5.2 设计文档
```
DESIGN.md：
  - 每个 Phase 完成后更新
  - 包含：完成情况、架构变更、踩坑记录、版本号
  - 包含：待评估清单（暂不引入的技术/平台及原因）

PROMPT_TEMPLATE.md：
  - 每个 Phase 完成后更新
  - 包含：可复用的提示词、环境变量清单、测试命令、踩坑记录
  - 目标：其他人粘贴即可复现
```

### 5.3 踩坑记录格式
```markdown
| # | 问题 | 原因 | 解决方案 |
|---|------|------|---------|
| N | 一句话描述现象 | 根因分析 | 具体修复方法 |
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


## 七、安全管理规范（企业级）

### 7.1 凭据管理
- **绝对禁止**在源代码中硬编码任何密钥、Token、密码
- 所有凭据通过 `.env` 文件注入，`.env` 已加入 `.gitignore`，不可提交
- 项目提供 `.env.example` 模板，新开发者复制后填入自己的凭据
- 生产环境每个 Bot 使用独立 `.env` 文件（`bots/{name}/.env`）
- 服务器端 `.env` 文件权限必须为 `600`

### 7.2 API Key 安全
- LLM API Key 使用多 Key 轮换机制（`LLMClient` 内置），降低单 Key 泄露风险
- 日志中禁止输出完整 API Key，仅输出前 8 位用于调试（`key.slice(0,8)+'...'`）
- 错误消息中禁止包含凭据信息

### 7.3 输入校验
- 所有 MCP 调用参数必须从 MCP `tools/list` schema 获取，不得猜测类型
- 用户消息（来自企业微信）视为不可信输入，不直接拼接到系统命令
- LLM 返回的 `tool_calls.arguments` 必须 JSON.parse 后校验必填字段
- 文件上传前校验类型和大小

### 7.4 错误信息安全
- 面向用户的错误消息使用通用提示（"抱歉，服务暂时不可用"），不暴露内部错误详情
- 内部错误日志可包含完整诊断信息，但写入 `logs/` 目录（已在 `.gitignore` 中）
- `errcode` 和 `errmsg` 原样记录到日志，但不在用户回复中展示

### 7.5 网络安全
- WebSocket 连接使用 `wss://`（TLS 加密），不可降级为 `ws://`
- MCP 请求签名使用 SHA256，验证响应完整性
- 公网部署时，服务器需配置防火墙规则，仅开放必要端口（建议 IP 白名单）

### 7.6 代码审查检查点
新增 Skill 或修改 Provider 时，必须检查：
- [ ] 无硬编码凭据
- [ ] 用户输入经过校验
- [ ] 错误消息不泄露内部信息
- [ ] 日志输出脱敏
- [ ] `.env.example` 已更新（如新增环境变量）

### 7.7 开发者安全自检
```bash
# 提交前运行安全扫描
grep -r "sk-[a-zA-Z0-9]\{20,\}" packages/ scripts/ --include="*.ts" && echo "❌ 发现疑似 API Key" || echo "✅ 无硬编码凭据"
grep -r "secret\|password\|token" packages/ --include="*.ts" | grep -v "process.env\|\.env\|\.example" && echo "⚠️ 检查硬编码" || echo "✅ 通过"
```

---

## 八、禁止事项

- ❌ 猜测 API 参数名或类型
- ❌ 跳过测试直接交付
- ❌ 修改其他角色的文件
- ❌ 忽略 errcode 检查
- ❌ 在错误消息中截断关键诊断信息
- ❌ 使用未在官方文档中出现的 API
- ❌ 在 bot 配置中引用不存在的 skill 名
- ❌ 需求未讨论清楚就开始写代码
- ❌ 未经本地测试直接动生产环境
- ❌ 不参考官方技术文档编造实现
- ❌ 测试偷懒只做部分

---

## 九、待评估清单

记录已调研但暂不引入的技术/平台，供后续决策参考：

| 技术 | 调研时间 | 能力优势 | 暂缓原因 |
|------|---------|---------|---------|
| 飞书 CLI / MCP | 2026-05-27 | 文档 Block 级编辑、Bitable 多维表格（公式/视图/自动化） | 企业微信生态内飞书需额外账号，用户侧摩擦大。企微 CLI doc 能力已满足当前场景 |
| 腾讯会议 API | 待调研 | — | — |

新增待评估项时，参考上述格式记录到本表。

---

## 十、跨工具协作规范（多 AI 开发工具兼容）

本项目支持多种 AI 开发工具并行开发（Codex、CloudCode、Cursor 等），以下规则保证兼容性。

### 10.1 文件格式
- 所有规范文件使用 **纯 Markdown**（`.md`），不依赖任何工具特定语法
- 禁止在 AGENTS.md/PLAN.md/STANDARDS.md 中使用工具特定指令（如 `@codex`、`!cloudcode`）
- 行为规则用「做什么」描述，不指定「用哪个工具怎么做」
- 文件编码：UTF-8 without BOM

### 10.2 角色路由（AGENTS.md 体系）
```
项目根 AGENTS.md         ← 任何 AI 工具进入项目的第一入口
  ├── 角色路由表          ← AI 根据任务类型自动找到自己的 AGENTS.md
  ├── framework/AGENTS.md ← PA 角色
  ├── composite-skills/AGENTS.md ← PM 角色（Skill 编排）
  ├── bots/_template/AGENTS.md   ← PM 角色（Bot 配置）
  ├── docs/pc/AGENTS.md          ← PC 角色
  └── scripts/tests/AGENTS.md    ← 测试
```

### 10.3 计划路由（PLAN.md 体系）
```
ROADMAP.md              ← 全局路线图（所有人必读）
  ├── framework/PLAN.md
  ├── composite-skills/PLAN.md
  ├── bots/PLAN.md      ← Bot 总览
  │   ├── bots/test-bot/PLAN.md
  │   ├── bots/party-bot/PLAN.md
  │   └── bots/project-bot/PLAN.md
  └── 各模块 AGENTS.md  → 引用对应的 PLAN.md
```

### 10.4 AI 工具进入项目后的标准流程
1. 读取 `AGENTS.md` → 了解项目能力 + 确定自己角色
2. 读取 `STANDARDS.md` → 了解铁律和规范
3. 读取 `ROADMAP.md` → 了解全局进度
4. 读取 `METRICS.md` → 了解实时数据
5. 读取对应模块的 `AGENTS.md` → 了解角色边界
6. 读取对应模块的 `PLAN.md` → 了解当前任务
7. 开始工作

### 10.5 代码合并兼容性
- 不同 AI 工具生成的代码必须通过同样的测试（`npx vitest run`）
- 所有代码提交前必须运行安全自检
- PR 合入前必须通过所有测试 + 人类 Review
- 本项目统一使用 `var` 声明变量（避免不同工具对 `let`/`const` 的差异处理）

---

## 十一、分支命名与 Commit 规范

### 11.1 分支策略（GitHub Flow）
```
main           ← 生产就绪，只接受 PR 合入
  ├─ develop   ← 集成分支
  │   ├─ feature/<描述>   ← 新功能
  │   ├─ fix/<描述>       ← 缺陷修复
  │   ├─ skill/<名称>     ← 新增 Skill
  │   └─ bot/<名称>       ← 新增 Bot
  └─ release/v<版本>      ← 发布分支
```

### 11.2 AI 开发者分支命名
```
ai/<role>/<task>
```
示例：`ai/architect/add-provider`、`ai/bot-pm/party-bot`

### 11.3 Commit 格式（Conventional Commits）
```
<type>(<scope>): <描述>
[AI: <tool>] [影响: <角色>]
```
类型：`feat` | `fix` | `test` | `docs` | `refactor` | `chore` | `security`

### 11.4 提交前检查清单
- [ ] 运行 `npx vitest run`（全部通过）
- [ ] 运行安全自检（无硬编码凭据）
- [ ] Commit message 格式正确
- [ ] 未跨角色边界修改文件
- [ ] 相关 PLAN.md / METRICS.md 状态已更新

---

## 十二、版本号规范（SemVer）

### 12.1 格式：`v<MAJOR>.<MINOR>.<PATCH>`

### 12.2 变更规则
| 变更类型 | 版本号变化 |
|---------|-----------|
| Bug 修复 | PATCH +1 |
| 新功能（向后兼容） | MINOR +1, PATCH 归零 |
| 破坏性变更 | MAJOR +1, MINOR/PATCH 归零 |

### 12.3 破坏性变更定义
- 修改 Provider 接口、修改 SkillDefinition 类型、修改 config.json 格式、删除已有 Skill、修改环境变量名称

### 12.4 版本记录位置
- `package.json` 的 `version` 字段
- `ROADMAP.md` 版本历史表
- Git tag：`git tag v0.2.0`

---

## 十三、计划体系与协作架构

### 13.1 三层计划
```
ROADMAP.md              ← 全局层：Phase 进度、角色分工
  └── {模块}/PLAN.md    ← 模块层：模块级任务、依赖关系
      └── {Bot}/PLAN.md ← Bot 层：Bot 级场景、验收标准
```

### 13.2 信息隔离原则
- PM 只需知道其他 Bot **在做什么**（通过 ROADMAP.md），不需了解**怎么做**
- PA/Skill 开发者**不知道具体 Bot 的场景**，只提供通用能力
- 跨角色协调通过 ROADMAP.md 的「依赖」列声明

---

## 十四、角色体系（PO / PA / PM / PC）

本项目的角色定义和权限边界。所有 AI 工具必须严格遵守。

### 14.1 角色定义

| 代号 | 角色 | 职责 | 管辖范围 |
|------|------|------|---------|
| **PO** | 产品总监 | 提需求、验收效果、角色间协调 | 全部（决策权，不直接写代码） |
| **PA** | 架构师 | framework、原子Skill配置、规范维护、**生产环境部署** | `packages/` `framework/` 服务器 |
| **PM** | 项目经理 | Bot配置 + 组合Skill开发 + 本地test-bot测试 | `bots/{name}/` `composite-skills/` |
| **PC** | 运营协调 | 日报/周报、宣传材料 | `docs/pc/`（只读其他目录） |

### 14.2 权限红线

- **PA 独占生产服务器部署权限** —— PM 验证通过后通知 PA，PA 执行部署
- **PM 不能动 `packages/` 和 `framework/`** —— 需要新原子Skill或框架变更，找 PA
- **PC 不能动任何代码** —— 只能读写 `docs/pc/`，其他目录只读
- **PO 不直接写代码** —— 负责需求和验收

### 14.3 多 PM 本地隔离

- 每位 PM 在自己的 Session 中运行独立的 `packages/server` 实例
- 使用独立的 test-bot 凭据（PO 提供）
- 代码通过 Git 分支隔离，合入通过 PR

### 14.4 协作流程

```
PO 提需求
  │
  ├──→ PM 开发 Bot 配置 + 组合 Skill
  │       ├── 本地 test-bot 测试通过
  │       └── PO 验收 ──→ 通知 PA
  │
  ├──→ PA 维护框架 + 原子 Skill
  │       ├── PM 需要新的原子Skill → 找 PA
  │       └── PO 验收 ──→ PA 执行生产部署
  │
  └──→ PC 读取 ROADMAP.md + commit log → 生成日报/周报/宣传材料
```

### 14.5 PM 兼任 Skill 编排

当前阶段 PM 同时负责组合 Skill 的开发和 Bot 配置。`composite-skills/` 目录归 PM 管辖。若未来团队扩大需要拆分出独立的 Skill 编排角色，从 PM 中分离即可，目录边界不变。

---

## 十五、知识同步协议（Knowledge Sync）

### 15.1 原则
各角色独立工作，但**能力变更必须对所有角色可见**。通过更新 PLAN.md、ROADMAP.md、METRICS.md 实现知识共享。

### 15.2 变更通知规则

| 变更事件 | 谁负责更新 | 更新文件 | 影响谁 |
|---------|-----------|---------|--------|
| PM 新增/修改组合 Skill | PM | `composite-skills/PLAN.md` + `METRICS.md` | 所有 PM、PA |
| PM 完成 Bot 场景验证 | PM | `bots/{name}/PLAN.md` | PO、PA |
| PA 新增原子 Skill | PA | `framework/PLAN.md` + `METRICS.md` | 所有 PM |
| PA 框架接口变更 | PA | `framework/PLAN.md` + `ROADMAP.md`（标注破坏性） | 所有 PM |
| PA 执行生产部署 | PA | `ROADMAP.md` + `METRICS.md` | 所有人 |
| 新建 Bot | PM | `bots/PLAN.md` + `METRICS.md` + `ROADMAP.md` | 所有人 |
| Phase 完成 | PA | `ROADMAP.md` 版本历史表 | 所有人 |
| 决策变更 | 决策者 | `ROADMAP.md` + `STANDARDS.md` §九 | 所有人 |

### 15.3 AI Session 启动时的同步检查

每次 AI Session 启动后，在开始工作前，必须执行以下检查：

1. 读取 `ROADMAP.md` → 检查 Phase 和各模块状态是否变化
2. 读取 `METRICS.md` → 检查 Skill/Bot/测试数量是否变化
3. 读取自己角色的 `PLAN.md` → 检查任务是否更新
4. 读取依赖角色的 `PLAN.md` → 检查可用的新能力
   - PM 读 `composite-skills/PLAN.md` → 看是否有新的组合 Skill 可用
   - PM 读 `framework/PLAN.md` → 看是否有新的原子 Skill 或框架变更
   - PA 读 `composite-skills/PLAN.md` → 了解 Skill 开发进度
5. 如发现变化，主动向用户汇报：`📢 自上次以来，[模块] 发生了 [变化]，[影响说明]`

### 15.4 完成工作后的同步步骤

1. 更新对应 PLAN.md 的状态（把 `[ ]` 改为 `[x]`）
2. 更新 `METRICS.md` 对应指标（见 METRICS.md 更新规则表）
3. 如果变更影响其他角色，更新 `ROADMAP.md`
4. Commit 信息中注明影响范围

### 15.5 METRICS.md 更新

- `METRICS.md` 存放项目实时数据（Skill 数、Bot 数、测试数等）
- 各角色完成工作后必须更新对应指标
- Session 启动时 AI 必须从此文件读取最新数据，不能使用硬编码数值
- 忘记更新 = 下一个启动的人看到过期数据

### 1.7 越界即停
- 当 AI 检测到自己即将修改其他角色的文件时，**必须立即停止并报告用户**
- 报告格式：`⚠️ 越界警告: 即将修改 [文件路径]，该文件属于 [角色] 的管辖范围。确认要执行吗？`
- 不得以「顺手」「方便」「影响不大」为由绕过
- 用户明确确认后才能继续

## 八、禁止事项（补充）

- ❌ 跨角色边界修改文件（即使「顺手改一下」也不行）
- ❌ 检测到越界意图却不停止——必须先向用户报告并等待确认
- ❌ 忘记更新 METRICS.md / PLAN.md / ROADMAP.md（= 制造信息孤岛）
- ❌ 在欢迎信息或文档中使用硬编码的可变数据（应从源文件动态读取）
