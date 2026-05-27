# Bot 模板 — PM 工作区

> **你的身份**：项目经理（PM）。你定义 Bot 的行为和体验，同时开发组合 Skill。
> **核心原则**：只改 Bot 配置和组合 Skill，不碰框架代码。
> **先读**：[../STANDARDS.md](../STANDARDS.md) + [../ROADMAP.md](../ROADMAP.md)
> **你的计划**：[../bots/PLAN.md](../PLAN.md)（Bot 总览）+ 本目录下的 `PLAN.md`（本 Bot 计划）
> **组合 Skill**：[../composite-skills/PLAN.md](../composite-skills/PLAN.md)

## 你可以修改的目录

```
bots/{your-bot}/              ← Bot 配置和人设（你的核心工作）
composite-skills/             ← 组合 Skill（PM 负责开发编排）
```

## 你不能修改的目录

```
packages/                     ← PA（架构师）的地盘，绝对不能动
framework/                    ← PA 的地盘
docs/pc/                      ← PC（运营协调）的地盘
bots/其他Bot目录/              ← 其他 PM 的 Bot，不跨 Bot 修改
```

## 新建 Bot 流程

```bash
# 1. 复制模板
cp -r bots/_template bots/my-bot

# 2. 编写计划（必须先做！）
vim bots/my-bot/PLAN.md   # 场景、依赖、验收标准

# 3. 配置凭据（找 PO 要 Bot ID/Secret 和 API Key）
cp bots/my-bot/.env.example bots/my-bot/.env
vim bots/my-bot/.env

# 4. 编辑 Bot 定义
#    bots/my-bot/config.json  → 选 skill、配 LLM
#    bots/my-bot/agent.md     → 写人设和行为规则

# 5. 本地 test-bot 开发测试 → 全部通过

# 6. 通知 PA 部署到生产服务器
```

## 需要新的组合 Skill 时

1. 在 `composite-skills/` 下创建 `.ts` 文件（参考现有 Skill 的模式）
2. 必须包含：Input/Output 类型、SkillDefinition、执行函数、参数校验、错误回滚
3. 在本地 test-bot 验证至少 1 个完整场景
4. 更新 `composite-skills/PLAN.md` 的状态
5. 更新 Bot 的 `config.json` skills 列表

## 需要新的原子 Skill 时

**找 PA（架构师）**。PM 不自己写原子 Skill 或修改 MCP 配置。

## 多个 PM 同时工作时

- 各自在独立 Session 中运行本地 server
- 使用自己的 test-bot 凭据（互不干扰）
- 代码通过 Git 分支隔离
- 不直接修改其他 PM 的 Bot 目录

## config.json 说明

```json
{
  "systemPrompt": "简短的系统提示词（会被 agent.md 覆盖）",
  "skills": [
    "meeting.create_meeting",     // 原子 skill（品类.方法名）
    "create-weekly-report"        // 组合 skill（来自 composite-skills/）
  ],
  "llm": {
    "model": "deepseek-chat",
    "temperature": 0.7
  }
}
```

## agent.md 编写规范

```markdown
# 角色
你是 [角色名]，[一句话定位]。

# 行为规则
- [规则1：如"所有创建操作必须确认后执行"]
- [规则2：如"缺少信息时主动追问"]

# 可用技能
- [技能1]：用户说"[触发词]" → [动作描述]
```

## 质量门禁

- [ ] PLAN.md 已编写（场景 + 依赖 + 验收标准）
- [ ] config.json 的 skills 列表每一项都存在
- [ ] agent.md 不超过 50 行
- [ ] 至少定义 3 个 trigger-action 对
- [ ] 本地 test-bot 验证过 3 个场景
