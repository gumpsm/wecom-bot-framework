import { SkillDefinition } from "../packages/core/src/types";

export var organizeMeetingDefinition: SkillDefinition = {
  name: "organize-meeting",
  description: "组织会议：创建会议、同步日程、创建待办提醒。当用户提到开会、安排会议、组织例会、拉会时使用。需收集会议主题、时间、参会人。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "会议主题/标题" },
      startTime: { type: "string", description: "开始时间，格式 YYYY-MM-DD HH:MM:SS" },
      durationMinutes: { type: "string", description: "会议时长（分钟）" },
      invitees: { type: "string", description: "参会人userid列表，逗号分隔" },
      description: { type: "string", description: "会议描述，可选" },
      location: { type: "string", description: "会议地点，可选" },
    },
    required: ["title", "startTime", "durationMinutes", "invitees"],
  },
};

// Composite Skill: 会议组织
// 输入会议信息 → 查询闲忙 → 创建会议 → 创建日程 → 创建待办 → 发送通知
import { LLMClient } from "./llm-deps";

export interface MeetingInput {
  title: string;
  startTime: string;            // "YYYY-MM-DD HH:MM:SS"
  durationMinutes: number;      // 会议时长（分钟）
  invitees: Array<{ userid: string }>;
  description?: string;
  location?: string;
  notifyMessage?: string;       // 自定义通知内容（不传则自动生成）
}

export interface MeetingOutput {
  success: boolean;
  meetingId: string;
  meetingUrl: string;
  scheduleId: string;
  todoIds: string[];
  message: string;
}

export interface MeetingDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  sendMessage?: (chatId: string, chatType: number, body: Record<string, unknown>) => Promise<void>;
  chatId?: string;
  chatType?: number;
}

export async function organizeMeeting(
  input: MeetingInput,
  deps: MeetingDeps
): Promise<MeetingOutput> {
  // 1. 参数校验
  var missing: string[] = [];
  if (!input.title) missing.push("title");
  if (!input.startTime) missing.push("startTime");
  if (!input.durationMinutes) missing.push("durationMinutes");
  if (!input.invitees || input.invitees.length === 0) missing.push("invitees");
  if (missing.length > 0) {
    throw new Error("organizeMeeting: missing required fields: " + missing.join(", "));
  }

  // 2. 计算结束时间（用于闲忙查询和日程创建）
  var start = new Date(input.startTime);
  if (isNaN(start.getTime())) {
    throw new Error("organizeMeeting: invalid startTime format, expected YYYY-MM-DD HH:MM:SS");
  }
  var end = new Date(start.getTime() + input.durationMinutes * 60000);
  var endTimeStr = end.getFullYear() + "-" +
    String(end.getMonth() + 1).padStart(2, "0") + "-" +
    String(end.getDate()).padStart(2, "0") + " " +
    String(end.getHours()).padStart(2, "0") + ":" +
    String(end.getMinutes()).padStart(2, "0") + ":00";

  // meeting API 要求格式: "YYYY-MM-DD HH:mm"（无秒）
  var meetingStartStr = input.startTime.substring(0, 16);

  // 3. 查询闲忙
  var userIds = input.invitees.map(function(i: { userid: string }) { return i.userid; });
  try {
    await deps.callTool("schedule", "check_availability", {
      check_user_list: userIds,
      start_time: input.startTime,
      end_time: endTimeStr,
    });
  } catch (e) {
    console.warn("[organizeMeeting] Availability check warning: " + (e as Error).message);
  }

  // 4. 创建会议
  // meeting_start_datetime: "YYYY-MM-DD HH:mm", invitees: { userid: [...] }
  var meetingResult = await deps.callTool("meeting", "create_meeting", {
    title: input.title,
    meeting_start_datetime: meetingStartStr,
    meeting_duration: input.durationMinutes * 60,
    invitees: { userid: userIds },
    description: input.description || "",
    location: input.location || "",
  }) as Record<string, unknown>;

  var meetingId = meetingResult.meetingid as string;
  var meetingUrl = (meetingResult.url || meetingResult.meeting_url || meetingResult.meetingUrl || "") as string;

  // 5. 创建日程
  var scheduleResult = await deps.callTool("schedule", "create_schedule", {
    schedule: {
      summary: input.title,
      start_time: input.startTime,
      end_time: endTimeStr,
      attendees: userIds.map(function(uid: string) { return { userid: uid }; }),
      description: input.description || "",
      location: input.location || "",
    },
  }) as Record<string, unknown>;

  var scheduleId = scheduleResult.schedule_id as string;

  // 6. 为每个参会人创建待办提醒
  var todoIds: string[] = [];
  var remindTime = new Date(start.getTime() - 15 * 60000); // 提前15分钟提醒
  var remindStr = remindTime.getFullYear() + "-" +
    String(remindTime.getMonth() + 1).padStart(2, "0") + "-" +
    String(remindTime.getDate()).padStart(2, "0") + " " +
    String(remindTime.getHours()).padStart(2, "0") + ":" +
    String(remindTime.getMinutes()).padStart(2, "0") + ":00";

  for (var uid of userIds) {
    try {
      var todoResult = await deps.callTool("todo", "create_todo", {
        content: "[会议提醒] " + input.title + " - " + input.startTime,
        remind_time: remindStr,
      }) as Record<string, unknown>;
      if (todoResult.todo_id) {
        todoIds.push(todoResult.todo_id as string);
      }
    } catch (e) {
      console.warn("[organizeMeeting] Todo creation failed for " + uid + ": " + (e as Error).message);
    }
  }

  // 7. 发送通知消息（如果提供了发送能力）
  var notifyMsg = input.notifyMessage || "";
  if (!notifyMsg) {
    var attendeeNames = userIds.join("、");
    var dateStr = input.startTime.split(" ")[0];
    var timeStr = input.startTime.split(" ")[1] || "";
    notifyMsg = "## 会议通知\n\n" +
      "**会议主题**: " + input.title + "\n" +
      "**时间**: " + dateStr + " " + (timeStr ? timeStr.slice(0, 5) : "") + "（" + input.durationMinutes + "分钟）\n" +
      "**参会人**: " + attendeeNames + "\n" +
      (input.location ? "**地点**: " + input.location + "\n" : "") +
      "\n会议已创建，日程和待办提醒已同步。";
  }

  if (deps.sendMessage && deps.chatId) {
    try {
      await deps.sendMessage(deps.chatId, deps.chatType || 1, {
        msgtype: "markdown",
        markdown: { content: notifyMsg },
      });
    } catch (e) {
      console.warn("[organizeMeeting] Notification send failed: " + (e as Error).message);
    }
  }

  return {
    success: true,
    meetingId: meetingId,
    meetingUrl: meetingUrl,
    scheduleId: scheduleId,
    todoIds: todoIds,
    message: notifyMsg,
  };
}

