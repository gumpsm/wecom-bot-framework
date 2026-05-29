# 党建 Bot 开发计划

> Bot PM：PM | 工具：Codex | 模型：deepseek-v4-pro

## 目标
企业党支部智能助手，服务支部书记、组织委员、宣传委员和党务工作者。

## 设计原则
- **Bot 做机器的活**：生成文档、发通知、记数据、跟踪状态、定时提醒
- **人做人的活**：主持、讲话、决策、审阅、上报、签字
- **按需 + 定时双模式**：人随时可触发，cron 到点自动执行

---

## 七个场景

### 场景1：党建活动组织

```
入口A（人贴通知 @bot）:
  人贴公司党委通知 → Bot 分析判断是活动
  → 追问时间/地点/人员/流程
  → 生成活动方案(docType: plan) → 人审阅确认
  → 生成活动通知(docType: notice) → 发到党员群
  → 创建日程(schedule_create) + 注册一次性cron

cron触发（活动次日）:
  → Bot 自动生成新闻稿(docType: news) → 发给人审阅
  → 确认后发到党员群

产出物: 活动方案文档 / 活动通知 / 日程 / 新闻稿
依赖Skill: party-doc-generator, schedule_create, cron-scheduler
```

### 场景2：党建信息反馈

```
入口: 人贴一段话/excel/word @bot + "按XX要求填写/补充/反馈"
  → Bot 理解要求 → 提取内容 → 按模板补充
  → 初稿 → 人审阅 → 修改 → 终稿

产出物: 填报完成的文档
依赖Skill: party-doc-generator（按实际docType生成）
```

### 场景3：党建会议安排

```
支委会（周期型）:
  cron每周触发 → Skill判断是否隔周
  → Bot @组织委员 "本周支委会时间？议题？"
  → 人回复 → 确认 → 创建日程 + 发通知

党员大会（临时型）:
  人@bot "下周X午开党员大会，主题XX"
  → Bot生成通知(docType: notice) → 确认 → 发群

产出物: 会议通知 / 日程
依赖Skill: party-doc-generator, schedule_create, cron-scheduler
```

### 场景4：党建任务安排

```
入口: 人贴公司党委通知 @bot
  → Bot 分析类型:
    ├─ 是活动 → 走场景1
    ├─ 是反馈 → 走场景2
    └─ 是工作部署 → "谁来办？"
        → 支部书记确认责任人(组织委员/宣传委员/党小组长)
        → 创建待办(todo_create)
        → cron每日扫描 → 到期追问 "完成了吗？"

产出物: 待办任务 / 到期提醒
依赖Skill: party-task-router, todo_create, cron-scheduler
```

### 场景5：党费缴纳通知

```
cron自动触发:
  → Skill判断本月首周 → 群内发通知(不含金额)
  → 党员@bot "已缴纳" → Bot登记

cron每日检查:
  → 截止日 → @未缴纳党员提醒

人手动:
  @bot "发起本月党费收缴" / "党费缴纳进度"

产出物: 群通知 / 缴纳汇总文档 / 未缴提醒
依赖Skill: party-fee-collection, cron-scheduler
```

### 场景6：积分管理

```
入口: 组织委员@bot "张三参加主题党日+5，李四发言+3"
  → Bot更新smartsheet → 确认变更

查询: "积分排名" "张三积分明细" "本月谁加了最多分"

产出物: smartsheet积分表 / 排名 / 明细
依赖Skill: party-points-manager, doc.smartsheet_*
```

### 场景7：党员管理

```
smartsheet维护:
  支委 / 正式党员 / 预备党员 / 积极分子 / 申请人

跟踪发展节点:
  申请书递交 → 积极分子确定 → 发展对象确定 → 预备接收 → 转正
  每个节点: 记录时间、检查思想汇报提交

cron每日检查（Skill内判断每月1号）:
  - "XX同志距转正还有X月，请关注"
  - "XX同志本季度思想汇报未按时提交"
  - "XX同志已离职，请通知转出党组织关系"(需人告知Bot)

产出物: smartsheet人员档案 / 发展节点提醒
依赖Skill: party-member-tracker, doc.smartsheet_*, cron-scheduler
```

---

## Skill 架构

```
Layer 1: party-templates.ts          纯数据，11个文档模板
Layer 2: party-doc-generator.ts      一个Skill生成所有党建文档
Layer 3: agent.md                    Mode A/B 交互编排

独立组合Skill:
  party-fee-collection.ts   党费收缴全流程
  party-points-manager.ts   积分管理
  party-member-tracker.ts   党员管理
  party-task-router.ts      通知分发/待办路由
  party-init.ts             cron任务初始化
```

---

## Cron 定时任务

### 测试模式（本地验证用）

| 任务 | 时间表达式 | 触发动作 |
|------|-----------|---------|
| 党费收缴通知 | `每10分钟` | Skill内判断首周→发通知 |
| 党费未缴检查 | `每5分钟` | Skill内判断截止日→提醒 |
| 支委会提醒 | `每15分钟` | Skill内判断隔周→@组织委员 |
| 待办到期扫描 | `每5分钟` | 扫描→追问责任人 |
| 党员发展检查 | `每8分钟` | Skill内判断每月1号→检查节点 |
| 活动次日新闻稿 | `每2分钟` | 活动创建后注册，到点生成 |

### 生产模式（部署后切换）

| 任务 | 时间表达式 | 触发动作 |
|------|-----------|---------|
| 党费收缴通知 | `09:00 周一` | Skill内判断首周→发通知 |
| 党费未缴检查 | `10:00 每天` | Skill内判断截止日→提醒 |
| 支委会提醒 | `09:00 周一` | Skill内判断隔周→@组织委员 |
| 待办到期扫描 | `10:00 每天` | 扫描→追问责任人 |
| 党员发展检查 | `09:00 每天` | Skill内判断每月1号→检查节点 |
| 活动次日新闻稿 | `MM-DD 09:00` | 活动创建时注册一次性任务 |

> ⚠️ PO 注意：部署到生产前，需将 party-init.ts 中的 cron 时间表达式从测试模式切换为生产模式。

---

## config.json 计划

```json
组合Skill（需新增注册）:
  party-doc-generator, party-fee-collection, party-points-manager,
  party-member-tracker, party-task-router, cron-scheduler,
  organize-meeting, meeting-minutes, meeting-reminder

原子Skill（需新增注册）:
  doc.smartsheetGetSheet, doc.smartsheetGetRecords,
  doc.smartsheetAddRecords, doc.smartsheetAddFields,
  doc.smartsheetGetFields, doc.smartsheetUpdateFields,
  todo.create, todo.getList, msg.send, contact.getUserlist

已注册（保留）:
  party-vote, create-weekly-report,
  doc.create, doc.editContent, doc.getContent,
  schedule.create, schedule.getListByRange
```

---

## 开发顺序

| # | 内容 | 产出 | 验证方式 |
|---|------|------|---------|
| 1 | `party-doc-generator.ts` | 1个组合Skill | "写新闻稿"→追问→生成文档 |
| 2 | 更新 `agent.md` | 交互行为规则 | 场景1/2/3完整对话 |
| 3 | 更新 `config.json` | 注册新Skill | 启动加载无误 |
| 4 | `party-fee-collection.ts` | 1个组合Skill | "发起党费收缴"→通知→回复→统计 |
| 5 | `party-points-manager.ts` | 1个组合Skill | "张三+5"→更新表格→查排名 |
| 6 | `party-task-router.ts` | 1个组合Skill | 贴通知→判断类型→分配待办 |
| 7 | `party-member-tracker.ts` | 1个组合Skill | 建人员表→检查节点→提醒 |
| 8 | `party-init.ts` | cron任务初始化 | 启动时注册全部定时任务 |
| 9 | 全场景联调 | 7个场景跑通 | 老王企业微信验证 |

---

## 依赖
- composite-skills: `party-doc-generator` `party-fee-collection` `party-points-manager` `party-member-tracker` `party-task-router` `party-init`（均待开发）
- composite-skills: `party-vote` `create-weekly-report`（已完成）
- framework: cron-scheduler, smartsheet, todo, schedule, doc, msg
- framework: v0.4.3+

## 不关心
- project-bot 的具体场景和开发进度
- framework 内部实现细节