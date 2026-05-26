# Bot 模板 — Bot PM 工作区

> **你的身份**：Bot 产品经理。你定义 bot 的行为和体验。
> **核心原则**：只改配置不改代码、场景驱动验收、先复用再新建。

## 新建 Bot 流程

```bash
# 1. 复制模板
cp -r bots/_template bots/my-bot

# 2. 编辑两个文件
#    bots/my-bot/config.json  → 选 skill、配 LLM
#    bots/my-bot/agent.md     → 写人设和行为规则

# 3. 告诉测试负责人验收
```

## 你可以修改的文件

```
bots/{your-bot}/config.json   ← bot 配置（skill 列表、LLM 选择）
bots/{your-bot}/agent.md      ← bot 人设 + 行为规则
```

## 你不能修改的文件

```
framework/                    ← 架构负责人的地盘
composite-skills/             ← 找 Skill 编排者提需求，不自己改
```

## config.json 说明

```json
{
  "botId": "从环境变量 WECOM_BOT_ID 读取",
  "botSecret": "从环境变量 WECOM_BOT_SECRET 读取",
  "systemPrompt": "简短的系统提示词（会被 agent.md 覆盖）",
  "skills": [
    "meeting.create_meeting",     // 原子 skill（品类.方法名）
    "schedule.create_schedule",   // 原子 skill
    "todo.create_todo",           // 原子 skill
    "weekly-report"               // 组合 skill（来自 composite-skills/）
  ],
  "llm": {
    "model": "deepseek-chat",
    "temperature": 0.7
  }
}
```

**选择 skill 的原则：**
- 先查 composite-skills/ 有没有现成的组合 skill
- 没有组合 skill 的，直接用原子 skill
- 一次不要选超过 10 个 skill，保证 Agent 意图识别准确

## agent.md 编写规范

```markdown
# 角色
你是 [角色名]，[一句话定位]。

# 行为规则
- [规则1：如"所有创建操作必须确认后执行"]
- [规则2：如"缺少信息时主动追问"]
- [规则3：如"回答简洁，先结论后细节"]

# 可用技能
- [技能1触发词]：用户说"[触发短语]" → [动作描述]
- [技能2触发词]：用户说"[触发短语]" → [动作描述]
```

**写好 agent.md 的原则：**
- 角色定位一句话说清，不要写作文
- 行为规则写"边界"不写"流程"，流程交给 Agent 引擎
- 技能描述写"触发条件"和"执行动作"，让 Agent 能精确匹配

## 质量门禁

- [ ] config.json 的 skills 列表每一项都存在于 framework/skills/ 或 composite-skills/
- [ ] agent.md 不超过 50 行（保持简洁）
- [ ] 至少定义 3 个明确的 trigger-action 对
- [ ] 用真实的企业微信 bot 测试过 3 个场景
