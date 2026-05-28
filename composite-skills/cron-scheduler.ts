// cron-scheduler — 通用定时调度器
// 不依赖第三方 cron 库，自解析时间表达式
// 设计为独立组合 Skill，project-bot / party-bot 均可复用
//
// 建议 PA 后续提到框架层，使所有 Bot 共享调度能力。

import { SkillDefinition } from "../packages/core/src/types";

export var cronSchedulerDefinition: SkillDefinition = {
  name: "cron-scheduler",
  description: "通用定时调度器。注册/移除/列出定时任务，到点自动调用指定 Skill。时间表达式支持：HH:MM 每天、HH:MM 工作日、HH:MM 周N、每N分钟、MM-DD HH:MM。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", description: "操作: add/remove/list/init", enum: ["add", "remove", "list", "init"] },
      taskName: { type: "string", description: "任务名称（add/remove 时必填）" },
      timeExpr: { type: "string", description: "时间表达式（add 时必填）" },
      targetSkill: { type: "string", description: "目标 Skill 名（add 时必填）" },
      skillArgs: { type: "string", description: "Skill 参数 JSON 字符串（add 时选填）" },
    },
    required: ["action"],
  },
};

// ====== 类型定义 ======

export interface CronTask {
  name: string;
  timeExpr: string;
  targetSkill: string;
  skillArgs: Record<string, unknown>;
  enabled: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
}

export interface CronDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface EnhancedCronDeps extends CronDeps {
  llm: import("./llm-deps").LLMClient;
}

export interface EnhancedCronTask extends CronTask {
  execute?: (deps: EnhancedCronDeps) => Promise<void>;
}

// ====== 内部状态 ======

var tasks: Map<string, CronTask> = new Map();
var initialized = false;

// ====== 时间表达式解析 ======

interface ParsedTime {
  type: "daily" | "weekday" | "weekly" | "interval" | "once";
  hour?: number;
  minute?: number;
  dayOfWeek?: number;   // 0=周日, 1-6
  intervalMinutes?: number;
  month?: number;
  day?: number;
}

function parseTimeExpr(expr: string): ParsedTime {
  // "每N分钟"
  var intervalMatch = expr.match(/^每(\d+)分钟$/);
  if (intervalMatch) {
    return { type: "interval", intervalMinutes: parseInt(intervalMatch[1], 10) };
  }

  // "MM-DD HH:MM" 单次
  var onceMatch = expr.match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (onceMatch) {
    return {
      type: "once",
      month: parseInt(onceMatch[1], 10),
      day: parseInt(onceMatch[2], 10),
      hour: parseInt(onceMatch[3], 10),
      minute: parseInt(onceMatch[4], 10),
    };
  }

  // "HH:MM 工作日" | "HH:MM 每天" | "HH:MM 周N"
  var timeMatch = expr.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
  if (!timeMatch) throw new Error("cron-scheduler: 无法解析时间表达式: " + expr);

  var hour = parseInt(timeMatch[1], 10);
  var minute = parseInt(timeMatch[2], 10);
  var suffix = timeMatch[3].trim();

  if (suffix === "每天" || suffix === "每日") {
    return { type: "daily", hour: hour, minute: minute };
  }
  if (suffix === "工作日") {
    return { type: "weekday", hour: hour, minute: minute };
  }

  var weekMatch = suffix.match(/^周([一二三四五六日])$/);
  if (weekMatch) {
    var weekMap: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0 };
    return { type: "weekly", hour: hour, minute: minute, dayOfWeek: weekMap[weekMatch[1]] };
  }

  // 兼容 "周一"~"周日"
  var altWeekMatch = suffix.match(/^周(1|2|3|4|5|6|7)$/);
  if (altWeekMatch) {
    var d = parseInt(altWeekMatch[1], 10);
    return { type: "weekly", hour: hour, minute: minute, dayOfWeek: d === 7 ? 0 : d };
  }

  throw new Error("cron-scheduler: 无法解析时间表达式后缀: " + suffix);
}

// ====== 计算下一次触发时间 ======

function calcNextTrigger(parsed: ParsedTime): Date {
  var now = new Date();
  var next = new Date(now);

  if (parsed.type === "interval") {
    return new Date(now.getTime() + (parsed.intervalMinutes || 1) * 60 * 1000);
  }

  if (parsed.type === "once") {
    var target = new Date(now.getFullYear(), (parsed.month || 1) - 1, parsed.day, parsed.hour, parsed.minute, 0, 0);
    if (target <= now) {
      // 已过期，推到明年
      target.setFullYear(target.getFullYear() + 1);
    }
    return target;
  }

  next.setHours(parsed.hour || 0, parsed.minute || 0, 0, 0);

  if (parsed.type === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (parsed.type === "weekday") {
    if (next <= now) next.setDate(next.getDate() + 1);
    // 推到下一个工作日
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  } else if (parsed.type === "weekly") {
    var targetDay = parsed.dayOfWeek || 1;
    var currentDay = next.getDay();
    var daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
      daysUntil += 7;
    }
    next.setDate(next.getDate() + daysUntil);
  }

  return next;
}

function getIntervalMs(parsed: ParsedTime): number {
  if (parsed.type === "interval") return (parsed.intervalMinutes || 1) * 60 * 1000;
  if (parsed.type === "daily" || parsed.type === "weekday") return 24 * 60 * 60 * 1000;
  if (parsed.type === "weekly") return 7 * 24 * 60 * 60 * 1000;
  return 0; // once: no repeat
}

// ====== 执行定时任务 ======

async function executeTask(task: CronTask, deps: CronDeps): Promise<void> {
  console.log("[cron-scheduler] 执行定时任务: " + task.name + " -> " + task.targetSkill);
  try {
    // 优先使用 Enhanced execute 函数
    var enhancedTask = task as EnhancedCronTask;
    if (enhancedTask.execute && (deps as EnhancedCronDeps).llm) {
      await enhancedTask.execute(deps as EnhancedCronDeps);
      console.log("[cron-scheduler] 任务完成(enhanced): " + task.name);
      return;
    }
    var parts = task.targetSkill.split(".");
    if (parts.length === 2) {
      await deps.callTool(parts[0], parts[1], task.skillArgs);
    } else {
      console.warn("[cron-scheduler] 组合 Skill 不支持 cron 直接调用: " + task.targetSkill);
    }
    console.log("[cron-scheduler] 任务完成: " + task.name);
  } catch (e) {
    console.error("[cron-scheduler] 任务失败: " + task.name + " | " + (e as Error).message);
  }
}

function scheduleTask(task: CronTask, deps: CronDeps): void {
  var parsed = parseTimeExpr(task.timeExpr);
  var nextTime = calcNextTrigger(parsed);
  var delay = nextTime.getTime() - Date.now();

  console.log("[cron-scheduler] 注册任务: " + task.name + " | 下次触发: " + nextTime.toLocaleString() + " | 延迟: " + Math.round(delay / 1000 / 60) + " 分钟");

  var intervalMs = getIntervalMs(parsed);

  if (intervalMs > 0) {
    // 先 setTimeout 到第一次，然后 setInterval 循环
    task.timerId = setTimeout(function() {
      executeTask(task, deps);
      task.timerId = setInterval(function() {
        executeTask(task, deps);
      }, intervalMs);
    }, delay);
  } else {
    // 一次性任务
    task.timerId = setTimeout(function() {
      executeTask(task, deps);
      tasks.delete(task.name);
    }, delay);
  }
}

// ====== 公共 API ======

export function initEnhancedScheduler(deps: EnhancedCronDeps, taskList: EnhancedCronTask[]): void {
  if (initialized) {
    for (var t of taskList) {
      if (!tasks.has(t.name)) {
        t.timerId = null;
        tasks.set(t.name, t);
        scheduleTask(t, deps);
      }
    }
    return;
  }
  initialized = true;
  for (var t of taskList) {
    t.timerId = null;
    tasks.set(t.name, t);
    scheduleTask(t, deps);
  }
  console.log("[cron-scheduler] 已初始化 " + tasks.size + " 个定时任务 (enhanced)");
}

export function initScheduler(deps: CronDeps, taskList: CronTask[]): void {
  if (initialized) {
    // 增量添加，不重复初始化已有任务
    for (var t of taskList) {
      if (!tasks.has(t.name)) {
        t.timerId = null;
        tasks.set(t.name, t);
        scheduleTask(t, deps);
      }
    }
    return;
  }
  initialized = true;
  for (var t of taskList) {
    t.timerId = null;
    tasks.set(t.name, t);
    scheduleTask(t, deps);
  }
  console.log("[cron-scheduler] 已初始化 " + tasks.size + " 个定时任务");
}

export function addEnhancedTask(deps: EnhancedCronDeps, task: EnhancedCronTask): string {
  if (tasks.has(task.name)) {
    removeTask(task.name);
  }
  task.timerId = null;
  tasks.set(task.name, task);
  scheduleTask(task, deps);
  return task.name;
}

export function addTask(deps: CronDeps, task: CronTask): string {
  if (tasks.has(task.name)) {
    removeTask(task.name);
  }
  task.timerId = null;
  tasks.set(task.name, task);
  scheduleTask(task, deps);
  return task.name;
}

export function removeTask(taskName: string): void {
  var task = tasks.get(taskName);
  if (!task) return;
  if (task.timerId) {
    clearTimeout(task.timerId);
    clearInterval(task.timerId);
  }
  tasks.delete(taskName);
  console.log("[cron-scheduler] 已移除任务: " + taskName);
}

export function listTasks(): CronTask[] {
  var result: CronTask[] = [];
  tasks.forEach(function(t) {
    result.push({
      name: t.name,
      timeExpr: t.timeExpr,
      targetSkill: t.targetSkill,
      skillArgs: t.skillArgs,
      enabled: t.enabled,
      timerId: t.timerId,
    });
  });
  return result;
}

export async function runCronScheduler(
  input: Record<string, unknown>,
  deps: CronDeps
): Promise<{ success: boolean; message: string; tasks?: CronTask[] }> {
  var action = (input.action as string) || "list";

  switch (action) {
    case "add": {
      var taskName = input.taskName as string;
      var timeExpr = input.timeExpr as string;
      var targetSkill = input.targetSkill as string;
      var rawArgs = input.skillArgs as string;
      if (!taskName || !timeExpr || !targetSkill) {
        throw new Error("cron-scheduler add: taskName/timeExpr/targetSkill 必填");
      }
      var skillArgs: Record<string, unknown> = {};
      if (rawArgs) {
        try { skillArgs = JSON.parse(rawArgs); } catch (e) {
          throw new Error("cron-scheduler add: skillArgs JSON 解析失败: " + (e as Error).message);
        }
      }
      var task: CronTask = {
        name: taskName,
        timeExpr: timeExpr,
        targetSkill: targetSkill,
        skillArgs: skillArgs,
        enabled: true,
        timerId: null,
      };
      addTask(deps, task);
      return { success: true, message: "任务已添加: " + taskName + " (" + timeExpr + " -> " + targetSkill + ")" };
    }

    case "remove": {
      var removeName = input.taskName as string;
      if (!removeName) throw new Error("cron-scheduler remove: taskName 必填");
      removeTask(removeName);
      return { success: true, message: "任务已移除: " + removeName };
    }

    case "init": {
      var taskListStr = input.skillArgs as string;
      if (!taskListStr) throw new Error("cron-scheduler init: skillArgs (任务列表JSON) 必填");
      var taskList: CronTask[];
      try { taskList = JSON.parse(taskListStr); } catch (e) {
        throw new Error("cron-scheduler init: skillArgs JSON 解析失败");
      }
      var cleanedList = taskList.map(function(t) { return { name: t.name, timeExpr: t.timeExpr, targetSkill: t.targetSkill, skillArgs: t.skillArgs || {}, enabled: t.enabled !== false, timerId: null as ReturnType<typeof setTimeout> | null }; });
      initScheduler(deps, cleanedList);
      return { success: true, message: "调度器已初始化 " + cleanedList.length + " 个任务", tasks: listTasks() };
    }

    case "list":
    default:
      return { success: true, message: "当前 " + tasks.size + " 个定时任务", tasks: listTasks() };
  }
}
