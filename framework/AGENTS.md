# Framework — 架构负责人工作区

> **你的身份**：架构负责人。负责框架核心的稳定性和扩展性。
> **先读**：[../STANDARDS.md](../STANDARDS.md) + [../ROADMAP.md](../ROADMAP.md)
> **你的计划**：[PLAN.md](PLAN.md)

## 你可以修改的文件

```
packages/core/src/types.ts        ← 类型定义（全项目共享）
packages/core/src/bot-manager.ts  ← 多机器人生命周期
packages/core/src/event-router.ts ← 模板卡片交互路由
packages/agent/src/agent.ts       ← Agent 引擎（意图识别 + Skill 调度）
packages/llm/src/client.ts        ← LLM 客户端（多 key 轮换）
packages/providers/src/           ← Provider 实现
packages/server/src/index.ts      ← 服务入口
framework/PLAN.md                 ← 框架开发计划
```

## 你不能修改的文件

```
bots/                             ← Bot PM 的地盘
composite-skills/                 ← Skill 编排者的地盘
```

## 架构约束

### 接口变更必须向下兼容
- 修改 `Provider` 接口 → 影响所有 Bot → 必须先评估影响范围 → 全量回归测试
- 修改 `SkillDefinition` → 影响所有 Skill → 同上
- 新增接口 → 先在 `types.ts` 定义 → 再实现

### 类型定义规范
- 所有共享类型在 `packages/core/src/types.ts`
- 新类型必须导出（`export interface` / `export type`）
- 类型名称使用 PascalCase

## 当前任务

详见 [PLAN.md](PLAN.md)。

关键进行中：
- 腾讯会议 API 调研
- 框架稳定维护（响应下游需求）

## 被依赖关系
- bot/ 和 composite-skills/ 依赖 framework
- 变更前检查：是否影响现有 Bot？是否影响现有 Skill？
- 发布新版本后通知所有角色负责人
