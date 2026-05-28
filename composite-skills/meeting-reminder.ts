// meeting-reminder �?会前提醒
// 封装 cron-scheduler，注册一条一次性会议提醒任�?

import { SkillDefinition } from "../packages/core/src/types";
import { addTask, initScheduler, CronTask } from "./cron-scheduler";

export var meetingReminderDefinition: SkillDefinition = {
  name: "meeting-reminder",
  description: "会前提醒。在会议开始前指定分钟数发送提醒消息到群。自动计算提醒时间并注册�?cron-scheduler�?,
  parameters: {
    type: "object",
    properties: {
      meetingTitle: { type: "string", description: "会议主题" },
      meetingTime: { type: "string", description: "会议时间，格�?YYYY-MM-DD HH:MM" },
      remindBefore: { type: "string", description: "提前多少分钟提醒，默�?15" },
      chatId: { type: "string", description: "提醒发送的�?chatId" },
      attendees: { type: "string", description: "参会人，逗号分隔（提醒消息里@用）" },
    },
    required: ["meetingTitle", "meetingTime"],
  },
};

export interface ReminderInput {
  meetingTitle: string;
  meetingTime: string;       // "YYYY-MM-DD HH:MM"
  remindBefore?: number;     // 默认 15 分钟
  chatId?: string;
  attendees?: string;
}

export interface ReminderOutput {
  success: boolean;
  message: string;
  taskName: string;
  reminderTime: string;
}

export interface ReminderDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
}

export async function setMeetingReminder(
  input: ReminderInput,
  deps: ReminderDeps
): Promise<ReminderOutput> {
  var meetingTitle = input.meetingTitle;
  var meetingTime = input.meetingTime;
  var remindBefore = input.remindBefore || 15;
  var chatId = input.chatId || "";
  var attendees = input.attendees || "";

  // 计算提醒时间
  var meetingDate = new Date(meetingTime.replace(" ", "T") + ":00");
  if (isNaN(meetingDate.getTime())) {
    throw new Error("meeting-reminder: 无法解析会议时间: " + meetingTime);
  }

  var reminderDate = new Date(meetingDate.getTime() - remindBefore * 60 * 1000);
  var now = new Date();

  if (reminderDate <= now) {
    return {
      success: false,
      message: "提醒时间已过，不注册提醒任务。会议时�? " + meetingTime + "，提醒时�? " + reminderDate.toLocaleString(),
      taskName: "",
      reminderTime: reminderDate.toLocaleString(),
    };
  }

  // 生成 cron 时间表达�? "MM-DD HH:MM"
  var month = String(reminderDate.getMonth() + 1).padStart(2, "0");
  var day = String(reminderDate.getDate()).padStart(2, "0");
  var hour = String(reminderDate.getHours()).padStart(2, "0");
  var minute = String(reminderDate.getMinutes()).padStart(2, "0");
  var timeExpr = month + "-" + day + " " + hour + ":" + minute;

  var taskName = "提醒_" + meetingTitle.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "_").substring(0, 20);

  // 构建提醒消息内容
  var attendeeText = attendees ? " @" + attendees.replace(/,/g, " @") : "";
  var notifyText = "📢 会议提醒\n" +
    "�? + meetingTitle + "」将�?" + meetingTime + " 开始（" + remindBefore + "分钟后）\n" +
    "参会�?" + (attendees || "全员") + "\n" +
    "请准时参加！";

  var task: CronTask = {
    name: taskName,
    timeExpr: timeExpr,
    targetSkill: "msg_send_message",
    skillArgs: {
      chat_id: chatId,
      chat_type: 2,
      msg_type: "text",
      content: notifyText,
    },
    enabled: true,
    timerId: null,
  };

  addTask(deps, task);

  return {
    success: true,
    message: "已注册会前提�? " + meetingTitle + " | 提醒时间: " + reminderDate.toLocaleString() + " (提前" + remindBefore + "分钟)",
    taskName: taskName,
    reminderTime: reminderDate.toLocaleString(),
  };
}
