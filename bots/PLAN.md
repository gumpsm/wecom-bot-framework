# Bots 总览

> 角色：Bot PM | 边界：每个 Bot 独立开发，不跨 Bot 修改文件

## Bot 清单

| Bot | 状态 | 计划文件 | 凭据 | 部署 |
|-----|------|---------|------|------|
| pa-bot | ✅ 本地开发测试用 | [PLAN.md](pa-bot/PLAN.md) | 已有 | 本地 |
| party-bot | 📋 待开发 | [PLAN.md](party-bot/PLAN.md) | 待创建 | 待部署 |
| project-bot | 📋 待开发 | [PLAN.md](project-bot/PLAN.md) | 待创建 | 待部署 |

## 新建 Bot 流程（所有开发者遵守）
1. `cp -r bots/_template bots/{name}`
2. 编写 `PLAN.md`（场景 + 依赖 + 验收标准）
3. 编写 `agent.md`（人设 + 行为规则）
4. 编辑 `config.json`（选 skill）
5. 本地 pa-bot 开发测试 → 全部通过
6. 人工验证效果
7. 获取正式 Bot 凭据 → 部署到云服务器
8. 更新 ROADMAP.md 状态

## Bot 间协作
- 各 Bot PM 只改自己 Bot 的目录，不动其他 Bot
- 需要新增组合 Skill → 找 Skill 编排者
- 需要框架变更 → 找架构负责人
- Bot 间的技能复用通过 composite-skills/ 实现，不直接引用其他 Bot 的配置

---

## 最近变更

| 日期 | Bot | 变更 | 影响 |
|------|-----|------|------|
| 2026-05-27 | 全部 | 角色体系重构，PM 同时管 Bot 和 composite-skills | 所有 PM |
| 待更新 | — | — | — |
