# 项目 Bot 开发计划

> Bot PM：待指定 | 工具：任意 AI 开发工具 | 凭据：待获取

## 目标
专业项目管理助手，服务于项目经理和团队成员。

## 核心场景（优先级排序）

### 场景 1：组织项目会议（P0）
- **触发**：「开会」「组织会议」「安排评审」
- **流程**：确认主题→时间→参会人→时长 → `organize-meeting`
- **验收**：用户说「明天下午3点组织项目评审会」，Bot 追问参会人后创建会议+日程+待办
- **依赖 Skill**：`organize-meeting`（已有）

### 场景 2：撰写项目周报（P0）
- **触发**：「周报」「本周进展」「项目汇报」
- **流程**：收集进展/计划/风险 → `create-weekly-report` 生成
- **依赖 Skill**：`create-weekly-report`（已有）

### 场景 3：整理会议纪要（P0）
- **触发**：「纪要」「会议记录」
- **流程**：接收内容 → `meeting-minutes` 提取待办 + 生成结构化纪要
- **依赖 Skill**：`meeting-minutes`（已有）

### 场景 4：项目信息汇总（P1）
- **触发**：「项目进展」「汇总分析」
- **流程**：收集多源数据 → `info-gathering` 生成报告
- **依赖 Skill**：`info-gathering`（已有）

### 场景 5：待办管理（P1）
- **触发**：「待办」「任务」「分配」
- **流程**：确认内容/负责人/截止日期 → `todo_create_todo`
- **依赖 Skill**：`todo_create_todo`（已有原子 Skill）

### 场景 6：项目状态报告（P2）
- **触发**：「项目状态」「进度报告」
- **流程**：汇总待办+日程+文档 → LLM 生成综合报告
- **需新增组合 Skill**：`project-status-report`（见 composite-skills/PLAN.md）

## 当前任务
- [x] 等待 `project-status-report` 组合 Skill 开发完成（文件已创建，待 PA 注册）
- [x] 编写 agent.md
- [x] cron-scheduler / project-init / project-close 开发完成
- [x] config.json 技能列表+权限配置
- [x] 配置 config.json skills 列表
- [x] P1: meeting-reminder + meeting-minutes增强 + create-weekly-report增强
- [x] P1: agent.md 会议全流程（冲突检测+确认分层+会前提醒+纪要→计划表）
- [x] P2: project-report + cron-scheduler增强 + project-init集成定时报告
- [x] P3: project-registry + project-matrix 多项目视图
- [x] P4: project-handover 人员交接（冲突检测+确认分层+会前提醒+纪要→计划表）
- [ ] 本地 pa-bot 验证 5 个场景
- [ ] 获取正式 Bot 凭据 → 部署

## 依赖
- composite-skills: `project-status-report`（待开发）
- composite-skills: `organize-meeting`、`create-weekly-report`、`meeting-minutes`、`info-gathering`（已完成）
- framework: v0.2.0+

## 不关心
- party-bot 的具体场景和开发进度
