# 贡献指南

## 开发模式

本项目采用 **Vibecoding** 模式：人类定义需求和审查设计，AI（Codex、CloudCode、Cursor 等）负责编码和测试。

## 多工具兼容

本项目规范文件全部使用纯 Markdown，不依赖任何特定 AI 工具。无论你用什么工具：
1. 工具进入项目后，首先读取 `AGENTS.md` → 自动路由到对应角色
2. 遵守 `STANDARDS.md` 中的铁律和规范
3. 通过 `ROADMAP.md` 了解全局进度
4. 通过 `{模块}/PLAN.md` 了解自己的任务
5. 通过 `{模块}/AGENTS.md` 了解自己的边界

## 角色体系

| 角色 | AGENTS.md | 可以改 | 不能碰 |
|------|-----------|--------|--------|
| 架构负责人 | `framework/AGENTS.md` | `packages/` | `bots/` `composite-skills/` |
| Skill 编排者 | `composite-skills/AGENTS.md` | `composite-skills/` | `packages/` `bots/` |
| Bot PM | `bots/_template/AGENTS.md` | 自己 Bot 的 `config.json` + `agent.md` | 其他 Bot 目录、`packages/` |
| 测试负责人 | `scripts/tests/AGENTS.md` | `scripts/tests/` | `packages/` |

**跨角色边界不可逾越**。需要跨角色协作时：
- Bot PM 需要新 Skill → 向 Skill 编排者提需求，不自己写
- Skill 编排者需要框架变更 → 向架构负责人提需求
- 所有协调通过 GitHub Issue 或 ROADMAP.md 进行

## 分支策略

```
main           ← 生产就绪，只接受 PR 合入
  ├─ develop   ← 集成分支
  │   ├─ feature/<描述>   ← 新功能
  │   ├─ fix/<描述>       ← 缺陷修复
  │   ├─ skill/<名称>     ← 新增 Skill
  │   └─ bot/<名称>       ← 新增 Bot
  └─ release/v<版本>      ← 发布分支
```

### AI 开发者分支命名
```
ai/<role>/<task>
```
- `ai/architect/add-provider`
- `ai/skill-dev/create-weekly-report`
- `ai/bot-pm/party-bot`

## 开发流程

```
需求讨论 → 本地 test-bot 开发 → 全量测试通过 → 人工验证 → 生产部署
```

1. **需求讨论**（人工参与）：明确场景、方案、验收标准，更新对应 PLAN.md
2. **本地开发**（AI 为主）：使用 test-bot + 本地服务，跑通所有测试
3. **测试验证**：`npx vitest run` + 集成测试 + 场景测试
4. **人工验证**：在企业微信中实际交互验证效果
5. **生产部署**：创建正式 Bot 凭据 → Docker 部署 → 验收

## 提交规范

```
<type>(<scope>): <描述>

[AI: <tool>]
```

类型：`feat` `fix` `test` `docs` `refactor` `chore` `security`

## PR 流程

1. 从 `develop` 创建功能分支
2. 开发 + 本地测试通过
3. 提交 PR 到 `develop`
4. PR 检查清单：
   - [ ] 单元测试 100% 通过
   - [ ] 新增功能有对应测试
   - [ ] 无硬编码凭据（运行安全自检）
   - [ ] 相关 AGENTS.md / PLAN.md / STANDARDS.md / DESIGN.md 已更新
   - [ ] 未跨角色边界修改文件
   - [ ] Commit 格式正确
5. 至少一人 Review 后合入

## 多开发者并行

当多人同时开发不同模块时：
- **Bot PM A** 开发 `party-bot` → 只看 `bots/party-bot/` + `composite-skills/PLAN.md`（了解可用 Skill）
- **Bot PM B** 开发 `project-bot` → 只看 `bots/project-bot/`
- **Skill 编排者** 开发新组合 Skill → 只看 `composite-skills/`
- **架构负责人** 维护框架 → 只看 `packages/` + `framework/`
- 所有人通过 `ROADMAP.md` 了解彼此进度
- 代码冲突通过 Git 正常解决，合入时跑全量测试

## 安全自检

```bash
# 提交前运行
grep -r "sk-[a-zA-Z0-9]\{20,\}" packages/ scripts/ --include="*.ts" && echo "❌ 发现疑似 API Key" || echo "✅ 无硬编码凭据"
```
