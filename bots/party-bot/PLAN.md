# 党建 Bot 开发计划

> Bot PM：待指定 | 工具：任意 AI 开发工具 | 凭据：待获取

## 目标
企业党支部智能助手，服务于支部书记和党务工作者。

## 核心场景（优先级排序）

### 场景 1：党建文档编写（P0）
- **触发**：「写新闻稿」「写活动方案」「写学习心得」「写工作总结」
- **流程**：确认类型 → 收集信息 → LLM 生成 → `doc.create_doc` + `doc.edit_doc_content`
- **验收**：用户说「写一份主题党日活动新闻稿」，Bot 追问活动详情后生成文档并返回链接
- **依赖 Skill**：`doc.create_doc`、`doc.edit_doc_content`
- **需新增组合 Skill**：`party-news-draft`、`party-plan-draft`（见 composite-skills/PLAN.md）

### 场景 2：党建投票推荐（P0）
- **触发**：「投票」「推荐」「评选」「推优」
- **流程**：确认主题 → 收集候选人 → 发送投票卡片 → 记录结果
- **验收**：用户说「推荐优秀党员」，Bot 收集候选人后发送多项选择卡片，投票结果记录到文档
- **依赖 Skill**：`party-vote`（已有）

### 场景 3：周报/工作总结（P1）
- **触发**：「党建周报」「季度总结」「工作汇报」
- **流程**：收集内容 → `create-weekly-report` 生成
- **依赖 Skill**：`create-weekly-report`（已有）

### 场景 4：活动/会议日程（P1）
- **触发**：「安排党员大会」「主题党日活动」
- **流程**：确认时间/参与人 → `schedule.create_schedule`
- **依赖 Skill**：`schedule.create_schedule`（已有）

## 当前任务
- [ ] 等待 `party-news-draft`、`party-plan-draft` 组合 Skill 开发完成
- [ ] 编写 agent.md（参考 _template/AGENTS.md 规范）
- [ ] 配置 config.json skills 列表
- [ ] 本地 test-bot 验证 4 个场景
- [ ] 获取正式 Bot 凭据 → 部署

## 依赖
- composite-skills: `party-news-draft`（待开发）、`party-plan-draft`（待开发）
- composite-skills: `party-vote`、`create-weekly-report`（已完成）
- framework: v0.2.0+

## 不关心
- project-bot 的具体场景和开发进度（只需知道它在做）
- framework 内部实现细节
