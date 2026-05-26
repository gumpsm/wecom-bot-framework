import { SkillDefinition } from "../packages/core/src/types";

export var meetingMinutesDefinition: SkillDefinition = {
  name: "meeting-minutes",
  description: "整理会议纪要。接收原始会议内容/录音文本，自动整理为结构化会议纪要文档并提取待办事项。当用户发送会议内容、提到整理纪要、会议记录时使用。",
  parameters: {
    type: "object",
    properties: {
      meetingTitle: { type: "string", description: "会议主题" },
      meetingDate: { type: "string", description: "会议日期 YYYY-MM-DD" },
      rawContent: { type: "string", description: "原始会议内容或录音转文字" },
      attendees: { type: "string", description: "参会人员，逗号分隔，可选" },
      template: { type: "string", description: "纪要模板: standard/action-items/decision-log，可选", enum: ["standard", "action-items", "decision-log"] },
    },
    required: ["meetingTitle", "meetingDate", "rawContent"],
  },
};

// Composite Skill: 会议纪要整理
// 输入会议内容/录音文本 → LLM整理为标准纪要 → 创建文档 → 写入内容
import { LLMClient } from "./llm-deps";

export interface MeetingMinutesInput {
  meetingTitle: string;
  meetingDate: string;          // "YYYY-MM-DD"
  attendees: string[];          // 参会人列表
  rawContent: string;           // 原始会议内容/录音转文字
  template?: "standard" | "action-items" | "decision-log";  // 纪要模板类型
}

export interface MeetingMinutesOutput {
  success: boolean;
  docUrl: string;
  docId: string;
  content: string;
  actionItems: Array<{ assignee: string; task: string; deadline: string }>;
}

export interface MeetingMinutesDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
  systemPrompt?: string;
}

export async function createMeetingMinutes(
  input: MeetingMinutesInput,
  deps: MeetingMinutesDeps
): Promise<MeetingMinutesOutput> {
  // 1. 参数校验
  var missing: string[] = [];
  if (!input.meetingTitle) missing.push("meetingTitle");
  if (!input.meetingDate) missing.push("meetingDate");
  if (!input.rawContent) missing.push("rawContent");
  if (missing.length > 0) {
    throw new Error("createMeetingMinutes: missing required fields: " + missing.join(", "));
  }

  // 2. 根据模板类型构造 prompt
  var templateType = input.template || "standard";
  var templateInstruction = "";

  if (templateType === "action-items") {
    templateInstruction = "请重点整理待办事项（Action Items），以表格形式列出：负责人 | 任务 | 截止时间。";
  } else if (templateType === "decision-log") {
    templateInstruction = "请重点整理会议决策（Decisions），列出每项决策及其背景和影响。";
  } else {
    templateInstruction = "请按标准会议纪要格式整理：会议主题、时间、参会人、讨论内容、决议、待办事项。";
  }

  var attendeeList = input.attendees && input.attendees.length > 0 ?
    input.attendees.join("、") : "未提供";
  var systemPrompt = deps.systemPrompt ||
    "你是一个专业的会议纪要整理助手。请根据原始会议内容，生成结构清晰的会议纪要，使用 Markdown 格式。";

  // 3. LLM 整理纪要
  var response = await deps.llm.chat({
    messages: [
      {
        role: "user",
        content: "请整理以下会议纪要：\n\n" +
          "**会议主题**: " + input.meetingTitle + "\n" +
          "**日期**: " + input.meetingDate + "\n" +
          "**参会人**: " + attendeeList + "\n\n" +
          templateInstruction + "\n\n" +
          "---\n原始会议内容:\n" + input.rawContent,
      },
    ],
    systemPrompt: systemPrompt,
    temperature: 0.3,
  });

  var finalContent = response.content || "";
  if (!finalContent) {
    throw new Error("createMeetingMinutes: LLM returned empty content");
  }

  // 4. 再次调用 LLM 提取待办事项（结构化输出）
  var actionItems: Array<{ assignee: string; task: string; deadline: string }> = [];
  try {
    var actionResponse = await deps.llm.chat({
      messages: [
        {
          role: "user",
          content: "从以下会议纪要中提取待办事项列表，每项包含负责人、任务、截止时间。用 JSON 数组格式返回：" +
            "[{assignee: string, task: string, deadline: string}]。只返回 JSON，不要其他内容。\n\n" +
            finalContent,
        },
      ],
      systemPrompt: "你是一个数据提取工具。请只返回 JSON，不要任何解释。",
      temperature: 0.1,
    });

    if (actionResponse.content) {
      var jsonStr = actionResponse.content.trim();
      // 尝试提取 JSON 数组
      var jsonStart = jsonStr.indexOf("[");
      var jsonEnd = jsonStr.lastIndexOf("]");
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        var parsed = JSON.parse(jsonStr.slice(jsonStart, jsonEnd + 1));
        if (Array.isArray(parsed)) {
          actionItems = parsed;
        }
      }
    }
  } catch (e) {
    console.warn("[createMeetingMinutes] Action item extraction failed: " + (e as Error).message);
  }

  // 5. 创建文档
  var docName = "会议纪要_" + input.meetingTitle + "_" + input.meetingDate;
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  }) as Record<string, unknown>;

  var docId = docResult.docid as string;
  var docUrl = docResult.url as string;

  // 6. 写入内容
  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: finalContent + "\n\n---\n> 本纪要由智能机器人自动生成，原始表单将于 " + input.meetingDate + " 归档。",
    docid: docId,
  });

  return {
    success: true,
    docUrl: docUrl,
    docId: docId,
    content: finalContent,
    actionItems: actionItems,
  };
}

