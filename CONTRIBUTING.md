# 贡献指南

## 开发模式

本项目采用 **Vibecoding** 模式：人类定义需求和审查设计，AI（Codex 等工具）负责编码和测试。

## 角色体系

开发前请先阅读对应目录的 `AGENTS.md`，明确你的角色边界：

| 角色 | AGENTS.md | 可以改 | 不能碰 |
|------|-----------|--------|--------|
| 架构负责人 | `framework/AGENTS.md` | `packages/` | `bots/` `composite-skills/` |
| Skill 编排者 | `composite-skills/AGENTS.md` | `composite-skills/` | `packages/` `bots/` |
| Bot PM | `bots/_template/AGENTS.md` | `bots/{name}/config.json` + `agent.md` | `packages/` |
| 测试负责人 | `scripts/tests/AGENTS.md` | `scripts/tests/` | `packages/` |

## 分支策略（GitHub Flow）

```
main           ← 生产就绪，只接受 PR 合入
  ├─ develop   ← 集成分支，日常开发合入这里
  │   ├─ feature/xxx   ← 新功能分支
  │   ├─ fix/xxx       ← 缺陷修复
  │   └─ skill/xxx     ← 新增 Skill
  └─ release/v1.x  ← 发布分支
```

### 分支命名

- `feature/<描述>` — 新功能（如 `feature/feishu-provider`）
- `fix/<描述>` — 缺陷修复（如 `fix/meeting-invitees-format`）
- `skill/<skill名>` — 新增 Skill（如 `skill/weekly-report`）
- `bot/<bot名>` — 新增 Bot 实例（如 `bot/project-bot`）
- `docs/<描述>` — 文档更新

### AI 开发者分支约定

当 AI 工具（Codex 等）进行开发时，建议使用分支名格式：

```
ai/<role>/<task>
```

例如：`ai/skill-dev/create-weekly-report`、`ai/architect/add-feishu-provider`

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <描述>

feat(agent): 添加意图识别缺失追问逻辑
fix(meeting): 修正 create_meeting invitees 格式为字典
test(composite): 新增组织会议组合 Skill 测试
docs(standards): 新增安全管理章节
refactor(bot-manager): 提取 CompositeSkill 注册逻辑
```

类型：`feat` `fix` `test` `docs` `refactor` `chore` `security`

## PR 流程

1. 从 `develop` 创建功能分支
2. 开发 + 本地测试通过（`npx vitest run`）
3. 提交 PR 到 `develop`
4. PR 必须满足的检查：
   - [ ] 单元测试 100% 通过
   - [ ] 新增功能有对应测试
   - [ ] 无硬编码凭据（运行安全自检）
   - [ ] 相关 AGENTS.md / STANDARDS.md / DESIGN.md 已更新
   - [ ] 未跨角色边界修改文件
5. 至少一人 Review 后合入

## 安全自检

提交前运行：

```bash
# 检查硬编码凭据
grep -r "sk-[a-zA-Z0-9]\{20,\}" packages/ scripts/ --include="*.ts"

# 检查环境变量引用
grep -r "process\.env" packages/ --include="*.ts" | wc -l
```

## AI 生成代码的特殊要求

- AI 必须在提交信息中标注生成方式：`[AI: Codex] feat(composite): 新增信息汇集分析 Skill`
- AI 生成的代码必须经过人类 Review 后才能合入 `main`
- AI 不得修改 `STANDARDS.md` 中的铁律条款（仅人类架构负责人可修改）
