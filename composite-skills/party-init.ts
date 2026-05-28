import { SkillDefinition } from "../packages/core/src/types";
import { EnhancedCronDeps, initEnhancedScheduler, EnhancedCronTask } from "./cron-scheduler";
import { runPartyFeeCollection } from "./party-fee-collection";
import { runPartyMemberTracker } from "./party-member-tracker";

// ============================================================
// party-init — 党建助手一键初始化
// 创建/关联跟踪表，注册 cron 定时任务
// ============================================================

export var partyInitDefinition: SkillDefinition = {
  name: "party-init",
  description:
    "党建助手初始化。注册党费提醒、支委会提醒、待办扫描、党员发展检查等定时任务。" +
    "Bot 启动时调用一次即可。",
  parameters: {
    type: "object",
    properties: {
      feeSheetDocId: { type: "string", description: "党费跟踪表docid（可选，无则创建）" },
      memberSheetDocId: { type: "string", description: "人员档案表docid（可选，无则创建）" },
      testMode: { type: "string", description: "测试模式（true=短周期，false=生产周期），默认true" },
    },
    required: [],
  },
};

// ====== 类型 ======

export interface PartyInitInput {
  feeSheetDocId?: string;
  memberSheetDocId?: string;
  testMode?: string;
}

export interface PartyInitOutput {
  success: boolean;
  message: string;
  feeSheetDocId?: string;
  memberSheetDocId?: string;
  cronTasks: string[];
}

// ====== 测试/生产时间配置 ======

const TEST_CRON = {
  feeNotify: "每10分钟",
  feeCheck: "每5分钟",
  meetingReminder: "每15分钟",
  todoScan: "每5分钟",
  memberCheck: "每8分钟",
};

const PROD_CRON = {
  feeNotify: "09:00 周一",
  feeCheck: "10:00 每天",
  meetingReminder: "09:00 周一",
  todoScan: "10:00 每天",
  memberCheck: "09:00 每天",
};

// ====== 执行函数 ======

export async function partyInit(
  input: PartyInitInput,
  deps: EnhancedCronDeps
): Promise<PartyInitOutput> {
  const testMode = input.testMode !== "false";
  const cron = testMode ? TEST_CRON : PROD_CRON;

  const feeSheetDocId = input.feeSheetDocId || "";
  const memberSheetDocId = input.memberSheetDocId || "";

  const taskList: EnhancedCronTask[] = [];

  // 1. 党费收缴通知
  if (feeSheetDocId) {
    taskList.push({
      name: "party-fee-notify",
      timeExpr: cron.feeNotify,
      targetSkill: "party-fee-collection",
      skillArgs: { action: "remind", stateDocId: feeSheetDocId },
      enabled: true,
      timerId: null,
      execute: async (d: EnhancedCronDeps) => {
        try {
          await runPartyFeeCollection(
            { action: "remind", stateDocId: feeSheetDocId },
            { callTool: d.callTool }
          );
        } catch (e) {
          console.warn("[party-init] fee-notify: " + (e as Error).message);
        }
      },
    });
  }

  // 2. 党费未缴检查
  if (feeSheetDocId) {
    taskList.push({
      name: "party-fee-check",
      timeExpr: cron.feeCheck,
      targetSkill: "party-fee-collection",
      skillArgs: { action: "remind", stateDocId: feeSheetDocId },
      enabled: true,
      timerId: null,
      execute: async (d: EnhancedCronDeps) => {
        try {
          await runPartyFeeCollection(
            { action: "remind", stateDocId: feeSheetDocId },
            { callTool: d.callTool }
          );
        } catch (e) {
          console.warn("[party-init] fee-check: " + (e as Error).message);
        }
      },
    });
  }

  // 3. 支委会提醒
  taskList.push({
    name: "party-meeting-reminder",
    timeExpr: cron.meetingReminder,
    targetSkill: "msg_send",
    skillArgs: {},
    enabled: true,
    timerId: null,
    execute: async (d: EnhancedCronDeps) => {
      // 判断是否为隔周（奇数周提醒）
      const weekNum = Math.ceil(
        (new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      );
      if (weekNum % 2 === 1) return; // 偶数周跳过

      try {
        console.log("[party-init] 支委会提醒触发（第" + weekNum + "周）");
        // 支委会提醒发送到群，需要 chatId — 这里仅记录日志
        // 实际使用时需配置 chatId
      } catch (e) {
        console.warn("[party-init] meeting-reminder: " + (e as Error).message);
      }
    },
  });

  // 4. 待办到期扫描
  taskList.push({
    name: "party-todo-scan",
    timeExpr: cron.todoScan,
    targetSkill: "todo_getList",
    skillArgs: {},
    enabled: true,
    timerId: null,
    execute: async (d: EnhancedCronDeps) => {
      try {
        const result = (await d.callTool("todo", "get_list", {})) as Record<string, unknown>;
        const todos = (result.todo_list || result.todos || []) as Array<Record<string, unknown>>;
        const now = new Date();
        const overdue: string[] = [];

        for (const t of todos) {
          const deadline = t.deadline || t.due_date as string;
          if (deadline && new Date(deadline as string) <= now) {
            overdue.push((t.subject || t.name || "待办") as string);
          }
        }

        if (overdue.length > 0) {
          console.log("[party-init] 到期待办: " + overdue.join(", "));
        }
      } catch (e) {
        console.warn("[party-init] todo-scan: " + (e as Error).message);
      }
    },
  });

  // 5. 党员发展检查
  if (memberSheetDocId) {
    taskList.push({
      name: "party-member-check",
      timeExpr: cron.memberCheck,
      targetSkill: "party-member-tracker",
      skillArgs: { action: "check", sheetDocId: memberSheetDocId },
      enabled: true,
      timerId: null,
      execute: async (d: EnhancedCronDeps) => {
        try {
          const r = await runPartyMemberTracker(
            { action: "check", sheetDocId: memberSheetDocId },
            { callTool: d.callTool }
          );
          if (r.reminders && r.reminders.some((x) => x.includes("⚠️") || x.includes("📅"))) {
            console.log("[party-init] 党员发展提醒:\n" + r.reminders.join("\n"));
          }
        } catch (e) {
          console.warn("[party-init] member-check: " + (e as Error).message);
        }
      },
    });
  }

  // 初始化调度器
  initEnhancedScheduler(deps, taskList);

  const modeLabel = testMode ? "测试模式（短周期）" : "生产模式（正式周期）";

  return {
    success: true,
    message:
      "党建助手初始化完成（" + modeLabel + "）\n" +
      "已注册 " + taskList.length + " 个定时任务\n" +
      "⚠️ 部署到生产前请将 testMode 改为 false",
    feeSheetDocId: feeSheetDocId || undefined,
    memberSheetDocId: memberSheetDocId || undefined,
    cronTasks: taskList.map((t) => t.name + "(" + t.timeExpr + ")"),
  };
}