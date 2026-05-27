# Composite Skills — PM 工作区（技能编排）

> **你的身份**：项目经理（PM）—— 把原子 Skill 组装成可复用的业务能力。
> **当前 PM 兼任 Skill 编排者**。未来规模扩大后可能拆分为独立角色。
> **先读**：[../STANDARDS.md](../STANDARDS.md) + [../ROADMAP.md](../ROADMAP.md)
> **你的计划**：[PLAN.md](PLAN.md)

## 你可以修改的文件

```
composite-skills/*.ts            ← 组合 Skill 定义和实现
composite-skills/PLAN.md         ← Skill 开发计划
composite-skills/AGENTS.md       ← 本文件
bots/{your-bot}/                 ← 你的 Bot 配置
```

## 你不能修改的文件

```
packages/                        ← PA（架构师）的地盘
framework/                       ← PA 的地盘
bots/其他Bot目录/                 ← 其他 PM 的地盘
```

## 当前能力清单

| Skill | 名称 | 状态 |
|-------|------|------|
| `create-weekly-report` | 周报创建 | ✅ |
| `organize-meeting` | 会议组织 | ✅ |
| `meeting-minutes` | 会议纪要 | ✅ |
| `party-vote` | 投票推荐 | ✅ |
| `info-gathering` | 信息分析 | ✅ |

详见 [PLAN.md](PLAN.md) 中的待开发清单。

## 组合 Skill 开发规范

### 文件结构
```typescript
// 1. 类型定义
export interface XxxInput { ... }
export interface XxxOutput { ... }

// 2. Skill 定义（供 Agent 意图识别）
export var xxxDefinition: SkillDefinition = {
  name: "xxx",
  description: "当用户...时使用。需要...",
  parameters: { ... }
};

// 3. 执行函数
export async function xxx(input: XxxInput, deps: CompositeSkillDeps): Promise<XxxOutput> {
  // 参数校验 → 调用原子 Skill → 错误回滚 → 返回结果
}
```

### 必须满足
- [ ] Input/Output 类型定义完整
- [ ] SkillDefinition 的 description 写清触发条件
- [ ] 参数校验（必填字段检查）
- [ ] 错误回滚
- [ ] 本地 pa-bot 验证至少 1 个完整场景

### 需要新的原子 Skill
→ 找 PA（架构师）。PM 不自己新增原子 Skill。

---

> **历史注记**：原先 `composite-skills/` 有独立的「Skill 编排者」角色。2026-05-27 起 PM 合并该角色。
> 若未来团队扩大需要重新拆分，恢复独立角色即可，本目录的边界和规范不变。
