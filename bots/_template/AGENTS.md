# Bot 模板 �?PM 工作�?

> **你的身份**：项目经理（PM）。你定义 Bot 的行为和体验，同时开发组�?Skill�?
> **核心原则**：只�?Bot 配置和组�?Skill，不碰框架代码�?
> **先读**：[../STANDARDS.md](../STANDARDS.md) + [../ROADMAP.md](../ROADMAP.md)
> **你的计划**：[../bots/PLAN.md](../PLAN.md)（Bot 总览�? 本目录下�?`PLAN.md`（本 Bot 计划�?
> **组合 Skill**：[../composite-skills/PLAN.md](../composite-skills/PLAN.md)

## 你可以修改的目录

```
bots/{your-bot}/              �?Bot 配置和人设（你的核心工作�?
composite-skills/             �?组合 Skill（PM 负责开发编排）
```

## 你不能修改的目录

```
packages/                     �?PA（架构师）的地盘，绝对不能动
framework/                    �?PA 的地�?
docs/pc/                      �?PC（运营协调）的地�?
bots/其他Bot目录/              �?其他 PM �?Bot，不�?Bot 修改
```

## 新建 Bot 流程

```bash
# 1. 复制模板
cp -r bots/_template bots/my-bot

# 2. 编写计划（必须先做！�?
vim bots/my-bot/PLAN.md   # 场景、依赖、验收标�?

# 3. 配置凭据
#    在根 .env 中添加（详见 .env.example 注释�?
#    WECOM_MY_BOT_BOT_ID=xxx
#    WECOM_MY_BOT_BOT_SECRET=xxx

# 4. 编辑 Bot 定义
#    bots/my-bot/config.json  �?�?skill、配 LLM
#    bots/my-bot/agent.md     �?写人设和行为规则

# 5. 本地 pa-bot 开发测�?�?全部通过

# 6. 通知 PA 部署到生产服务器
```

## 需要新的组�?Skill �?

1. �?`composite-skills/` 下创�?`.ts` 文件（参考现�?Skill 的模式）
2. 必须包含：Input/Output 类型、SkillDefinition、执行函数、参数校验、错误回�?
3. 在本�?pa-bot 验证至少 1 个完整场�?
4. 更新 `composite-skills/PLAN.md` 的状�?
5. 更新 Bot �?`config.json` skills 列表

## 需要新的原�?Skill �?

**�?PA（架构师�?*。PM 不自己写原子 Skill 或修�?MCP 配置�?

## 多个 PM 同时工作�?

- 各自在独�?Session 中运行本�?server
- 使用自己�?pa-bot 凭据（互不干扰）
- 代码通过 Git 分支隔离
- 不直接修改其�?PM �?Bot 目录

## config.json 说明

```json
{
  "systemPrompt": "简短的系统提示词（会被 agent.md 覆盖�?,
  "skills": [
    "meeting_create",     // 原子 skill（品�?方法名）
    "create-weekly-report"        // 组合 skill（来�?composite-skills/�?
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
你是 [角色名]，[一句话定位]�?

# 行为规则
- [规则1：如"所有创建操作必须确认后执行"]
- [规则2：如"缺少信息时主动追�?]

# 可用技�?
- [技�?]：用户说"[触发词]" �?[动作描述]
```

## 质量门禁

- [ ] PLAN.md 已编写（场景 + 依赖 + 验收标准�?
- [ ] config.json �?skills 列表每一项都存在
- [ ] agent.md 不超�?50 �?
- [ ] 至少定义 3 �?trigger-action �?
- [ ] 本地 pa-bot 验证�?3 个场�?
