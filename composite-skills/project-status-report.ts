import { SkillDefinition } from "../packages/core/src/types";

export var projectStatusReportDefinition: SkillDefinition = {
  name: "project-status-report",
  description: "项目状态报告。汇总项目的待办、日程、文档等信息，LLM分析后生成综合项目状态报告。当用户提到项目状态、进度报告、项目概览时使用。",
  parameters: {
    type: "object",
    properties: {
      projectName: { type: "string", description: "项目名称" },
      dateRange: { type: "string", description: "统计时间范围，如 本周/本月/Q2，默认本周" },
      includeTodos: { type: "string", description: "是否包含待办统计，默认 true" },
      includeSchedules: { type: "string", description: "是否包含日程统计，默认 true" },
    },
    required: ["projectName"],
  },
};

// Composite Skill: 项目状态报告
// 获取待办统计 → 获取日程列表 → LLM 综合分析 → 创建文档
import { LLMClient } from "./llm-deps";

export interface StatusReportInput {
  projectName: string;
  dateRange?: string;          // "本周" | "本月" | "Q2" 等
  includeTodos?: boolean;
  includeSchedules?: boolean;
}

export interface StatusReportOutput {
  success: boolean;
  summary: string;
  docUrl: string;
  docId: string;
  todoStats: { total: number; completed: number; pending: number };
}

export interface StatusReportDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
  systemPrompt?: string;
}

export async function generateProjectStatusReport(
  input: StatusReportInput,
  deps: StatusReportDeps
): Promise<StatusReportOutput> {
  // 1. 参数校验
  if (!input.projectName) throw new Error("generateProjectStatusReport: projectName is required");

  var dateRange = input.dateRange || "本周";
  var includeTodos = input.includeTodos !== false;
  var includeSchedules = input.includeSchedules !== false;

  var dataSections: string[] = [];
  dataSections.push("# 项目状态报告: " + input.projectName);
  dataSections.push("统计范围: " + dateRange);
  dataSections.push("");

  var todoStats = { total: 0, completed: 0, pending: 0 };

  // 2. 获取待办数据
  if (includeTodos) {
    try {
      var todoResult = await deps.callTool("todo", "query_todo", {}) as Record<string, unknown>;
      var todoList = (todoResult.todo_list || []) as Array<Record<string, unknown>>;
      todoStats.total = todoList.length;
      todoStats.completed = todoList.filter(function(t: Record<string, unknown>) { return t.status === 1 || t.status === "completed"; }).length;
      todoStats.pending = todoStats.total - todoStats.completed;

      dataSections.push("## 待办统计");
      dataSections.push("- 总数: " + todoStats.total);
      dataSections.push("- 已完成: " + todoStats.completed);
      dataSections.push("- 待处理: " + todoStats.pending);
      dataSections.push("");

      if (todoList.length > 0) {
        dataSections.push("### 待办详情");
        for (var t of todoList.slice(0, 20)) {
          var statusLabel = (t.status === 1 || t.status === "completed") ? "[✓]" : "[ ]";
          var assignee = t.assignee_name || t.creator_name || "";
          var dueDate = t.due_time || t.deadline || "";
          var title = t.summary || t.title || t.name || "";
          dataSections.push("- " + statusLabel + " " + title + (assignee ? " @" + assignee : "") + (dueDate ? " 截止:" + dueDate : ""));
        }
        dataSections.push("");
      }
    } catch (e) {
      dataSections.push("## 待办统计");
      dataSections.push("(获取失败: " + (e as Error).message + ")");
      dataSections.push("");
    }
  }

  // 3. 获取日程数据
  if (includeSchedules) {
    try {
      var now = new Date();
      var endDate = new Date();
      if (dateRange === "本月") {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (dateRange === "Q2" || dateRange === "本季度") {
        endDate.setMonth(endDate.getMonth() + 3);
      } else {
        // 默认本周
        endDate.setDate(endDate.getDate() + 7);
      }
      var startStr = now.toISOString().split("T")[0] + " 00:00:00";
      var endStr = endDate.toISOString().split("T")[0] + " 23:59:59";

      var scheduleResult = await deps.callTool("schedule", "get_schedule_list_by_range", {
        start_time: startStr,
        end_time: endStr,
      }) as Record<string, unknown>;
      var scheduleList = (scheduleResult.schedule_list || []) as Array<Record<string, unknown>>;

      dataSections.push("## 日程统计 (" + startStr.split(" ")[0] + " ~ " + endStr.split(" ")[0] + ")");
      dataSections.push("- 日程总数: " + scheduleList.length);
      dataSections.push("");

      if (scheduleList.length > 0) {
        dataSections.push("### 日程详情");
        for (var s of scheduleList.slice(0, 15)) {
          var sTime = s.start_time || s.schedule_date || "";
          var sTitle = s.summary || s.subject || s.title || "";
          var sLoc = s.location || "";
          dataSections.push("- " + sTime + " " + sTitle + (sLoc ? " @ " + sLoc : ""));
        }
        dataSections.push("");
      }
    } catch (e) {
      dataSections.push("## 日程统计");
      dataSections.push("(获取失败: " + (e as Error).message + ")");
      dataSections.push("");
    }
  }

  // 4. LLM 分析生成报告
  var context = dataSections.join("\n");
  var systemPrompt = deps.systemPrompt || "你是一个专业的项目管理助手。请根据项目数据生成清晰、结构化的项目状态报告。";
  var analysisPrompt = "请基于以上数据生成项目状态报告，包含：\n" +
    "1. 项目总体状态（正常/有风险/严重滞后）\n" +
    "2. 关键指标（待办完成率、日程密度等）\n" +
    "3. 风险与问题识别\n" +
    "4. 改进建议\n" +
    "请保持数据准确，不编造信息。对不确定的标注「待确认」。";

  var response = await deps.llm.chat({
    messages: [{ role: "user", content: context + "\n\n" + analysisPrompt }],
    systemPrompt: systemPrompt,
    temperature: 0.3,
  });

  var analyzedContent = response.content || "";
  if (!analyzedContent) {
    throw new Error("generateProjectStatusReport: LLM returned empty content");
  }

  // 5. 创建文档
  var docName = "项目状态报告_" + input.projectName.replace(/[\\/:*?"<>|]/g, "_").substring(0, 40);
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  }) as Record<string, unknown>;

  var docId = docResult.docid as string;
  var docUrl = docResult.url as string;

  // 6. 写入完整报告
  var fullContent = "# " + input.projectName + " 项目状态报告\n\n" +
    "> 统计范围: " + dateRange + " | 生成时间: " + new Date().toLocaleString() + "\n\n" +
    "---\n\n" +
    "## 数据摘要\n" +
    "- 待办: " + todoStats.total + "个 (" + todoStats.completed + "已完成 / " + todoStats.pending + "待处理)\n\n" +
    "---\n\n" +
    analyzedContent + "\n\n" +
    "---\n\n" +
    "*本报告由 project-bot 自动生成*";

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: fullContent,
    docid: docId,
  });

  // 7. 提取摘要
  var summary = analyzedContent.substring(0, 200).replace(/#/g, "").trim();

  return {
    success: true,
    summary: summary,
    docUrl: docUrl,
    docId: docId,
    todoStats: todoStats,
  };
}
