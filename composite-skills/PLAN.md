# Composite Skills 开发计划

> 角色：Skill 编排者 | 边界：[AGENTS.md](AGENTS.md)

## 当前版本：18 个组合 Skill（稳定）

## 已完成

### 项目场景（project-bot）
- [x] `project-handover` — 人员交接（预览+待办+转移）
- [x] `project-registry` — 项目注册
- [x] `project-matrix` — 多项目视图（视图/人员/里程碑）
- [x] `project-report` — 日报/周报/月报自动生成
- [x] `meeting-reminder` — 会前提醒（封装 cron-scheduler）
- [x] `cron-scheduler` — 通用定时调度器（建议 PA 提到框架层）
- [x] `project-init` — 项目一键启动
- [x] `project-close` — 项目终止/结项
- [x] `create-weekly-report` — 项目周报创建（增强：支持会议纪要汇总）
- [x] `organize-meeting` — 会议组织（创建会议+日程+待办）
- [x] `meeting-minutes` — 会议纪要整理（增强：支持写入计划表planDocId+提取待办+分类）
- [x] `party-vote` — 党建投票推荐（多项选择卡片+结果记录）
- [x] `info-gathering` — 信息汇集分析
- [x] `project-status-report` — 项目状态报告

### 党建场景（party-bot）
- [x] `party-doc-generator` — 党建文档智能生成（11种模板：新闻稿/方案/通知/会议记录/思想汇报/工作总结/思政周报/对照检查/整改清单/考察意见/述职报告）
- [x] `party-fee-collection` — 党费收缴全流程（发起通知→跟踪回复→催缴→汇总）
- [x] `party-points-manager` — 党员积分管理（smartsheet加减分+排名+明细）
- [x] `party-member-tracker` — 党员管理（smartsheet人员档案+发展节点+思想汇报跟踪）
- [x] `party-init` — 党建助手初始化（注册cron定时任务）

## 计划中（按优先级）

### 待评估
- [ ] `multi-source-summary` — 跨文档/表格信息聚合（需智能表格 API 成熟后评估）
- [ ] `meeting-reminder-broadcast` — 会议提醒群发（需消息群发能力）

## 依赖关系
- **依赖**：framework（类型、SkillRegistry、Provider 接口）
- **被依赖**：bot/（各 Bot 通过 config.json 引用组合 Skill 名）
- 新增组合 Skill → 更新本文件 → 通知受影响 Bot 的 PM

## 开发规范
- 每个组合 Skill 必须：Input/Output 类型定义 + 参数校验 + 错误回滚
- 新增 Skill 后必须在本地 pa-bot 验证至少 1 个完整场景
- 变更后通知 bot PM 更新 skill 列表

---

## 最近变更

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-05-28 | party-bot 5个组合Skill开发完成：party-doc-generator/party-fee-collection/party-points-manager/party-member-tracker/party-init | party-bot |
| 2026-05-28 | project-bot 9个组合Skill完成 | project-bot |
| 2026-05-27 | PO/PA/PM/PC 四角色体系正式落地 | 所有角色 |
| 2026-05-27 | 知识同步协议 + prompts 目录 | 所有角色 |