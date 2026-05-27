# Composite Skills 开发计划

> 角色：Skill 编排者 | 边界：[AGENTS.md](AGENTS.md)

## 当前版本：5 个组合 Skill（稳定）

## 已完成
- [x] `create-weekly-report` — 项目周报创建
- [x] `organize-meeting` — 会议组织（创建会议 + 日程 + 待办）
- [x] `meeting-minutes` — 会议纪要整理（提取待办 + 分类）
- [x] `party-vote` — 党建投票推荐（多项选择卡片 + 结果记录）
- [x] `info-gathering` — 信息汇集分析

## 计划中（按优先级）

### P4-1: 党建场景（为 party-bot）
- [ ] `party-news-draft` — 党建新闻稿生成（收集活动信息 → LLM 生成 → 创建文档）
- [ ] `party-plan-draft` — 党建活动方案生成
- **依赖**：`doc.create_doc`、`doc.edit_doc_content`（已有原子 Skill）

### P4-2: 项目场景（为 project-bot）
- [ ] `project-status-report` — 项目状态报告（汇总待办 + 日程 + 文档 → 生成报告）
- **依赖**：`schedule.get_schedule_list_by_range`、`todo.*`、`doc.get_doc_content`

### 待评估
- [ ] `multi-source-summary` — 跨文档/表格信息聚合（需智能表格 API 成熟后评估）
- [ ] `meeting-reminder-broadcast` — 会议提醒群发（需消息群发能力）

## 依赖关系
- **依赖**：framework（类型、SkillRegistry、Provider 接口）
- **被依赖**：bot/（各 Bot 通过 config.json 引用组合 Skill 名）
- 新增组合 Skill → 更新本文件 → 通知受影响 Bot 的 PM

## 开发规范
- 每个组合 Skill 必须：Input/Output 类型定义 + 参数校验 + 错误回滚
- 新增 Skill 后必须在本地 test-bot 验证至少 1 个完整场景
- 变更后通知 bot PM 更新 skill 列表
