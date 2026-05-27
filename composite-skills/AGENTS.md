# Composite Skills — Skill 编排者工作区

> **你的身份**：Skill 编排者。你把原子 Skill 组装成可复用的业务能力。
> **先读**：[../STANDARDS.md](../STANDARDS.md) + [../ROADMAP.md](../ROADMAP.md)
> **你的计划**：[PLAN.md](PLAN.md)

## 你可以修改的文件

```
composite-skills/*.ts            ← 组合 Skill 定义和实现
composite-skills/PLAN.md         ← Skill 开发计划
composite-skills/AGENTS.md       ← 本文件
```

## 你不能修改的文件

```
packages/                        ← 架构负责人的地盘
bots/                            ← Bot PM 的地盘
```

## 当前能力清单

| Skill | 名称 | 输入 | 输出 | 状态 |
|-------|------|------|------|------|
| create-weekly-report | 周报创建 | 项目名/周期/进展/计划 | 文档链接 | ✅ |
| organize-meeting | 会议组织 | 主题/时间/参会人 | 会议+日程+待办 | ✅ |
| meeting-minutes | 会议纪要 | 内容/日期/参会人 | 结构化纪要文档 | ✅ |
| party-vote | 投票推荐 | 主题/候选人 | 投票卡片+结果文档 | ✅ |
| info-gathering | 信息分析 | 主题/数据源 | 分析报告/智能表格 | ✅ |

详见 [PLAN.md](PLAN.md) 中的完整计划和待开发清单。

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
- [ ] 错误回滚（原子 Skill 调用失败时清理已创建资源）
- [ ] 在本地 test-bot 验证至少 1 个完整场景

### 依赖注入
- `CompositeSkillDeps` 提供：`callAtomic(category, method, args)` + `llmClient`
- 不直接导入 `WeComMcpClient`，通过 DI 调用原子 Skill

## 协作方式
- Bot PM 提 Skill 需求 → Skill 编排者评估可行性 → 开发 → 通知 Bot PM
- 框架接口变更 → 架构负责人通知 → Skill 编排者适配
- 新增 Skill → 更新本文件 + PLAN.md + 通知所有 Bot PM
