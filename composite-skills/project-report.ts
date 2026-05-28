// project-report — 日报/周报/月报自动生成
// 从项目计划表读取数据，LLM 生成结构化报告，创建文档，可选发送到群
// 既可作为组合 Skill 被 Agent 调用，也可被 cron-scheduler 定时触发

import { SkillDefinition } from "../packages/core/src/types";
import { LLMClient } from "./llm-deps";
import { EnhancedCronDeps } from "./cron-scheduler";

export var projectReportDefinition: SkillDefinition = {
  name: "project-report",
  description: "生成项目日报/周报/月报。从项目计划表自动提取数据，LLM生成结构化报告文档。支持手动触发和定时自动执行。",
  parameters: {
    type: "object",
    properties: {
      reportType: { type: "string", description: "报告类型: daily/weekly/monthly", enum: ["daily", "weekly", "monthly"] },
      projectName: { type: "string", description: "项目名称" },
      planDocId: { type: "string", description: "项目计划表 docid" },
      chatId: { type: "string", description: "发送到的群 chatId，不传则只存档不发群" },
      dateRange: { type: "string", description: "日期范围，如 2026-05-28 或 2026-05-22~2026-05-28，不传则自动计算" },
    },
    required: ["reportType", "projectName", "planDocId"],
  },
};

export interface ProjectReportInput {
  reportType: "daily" | "weekly" | "monthly";
  projectName: string;
  planDocId: string;
  chatId?: string;
  dateRange?: string;
}

export interface ProjectReportOutput {
  success: boolean;
  message: string;
  docUrl: string;
  docId: string;
  content: string;
  stats: { total: number; completed: number; blocked: number; newTasks: number };
}

export interface ReportDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
}

// ====== 从计划表读取数据 ======

interface PlanRecord {
  id: string;
  type: string;
  name: string;
  person: string;
  priority: string;
  status: string;
  startDate: string;
  dueDate: string;
  doneDate: string;
  source: string;
  note: string;
  created: string;
}

async function fetchPlanData(deps: ReportDeps, planDocId: string): Promise<PlanRecord[]> {
  var sheetResult = await deps.callTool("doc", "smartsheet_get_sheet", { docid: planDocId }) as Record<string, unknown>;
  var sheetList = (sheetResult.sheet_list || []) as Array<Record<string, unknown>>;
  var sheetId = sheetList[0]?.sheet_id as string;
  if (!sheetId) return [];

  var recordsResult = await deps.callTool("doc", "smartsheet_get_records", {
    docid: planDocId,
    sheet_id: sheetId,
  }) as Record<string, unknown>;

  var records = (recordsResult.records || []) as Array<Record<string, unknown>>;
  return records.map(function(r) {
    var v = (r.values || {}) as Record<string, unknown>;
    return {
      id: extractText(v["ID"]),
      type: extractText(v["类型"]),
      name: extractText(v["名称"]),
      person: extractText(v["负责人"]),
      priority: extractText(v["优先级"]),
      status: extractText(v["状态"]),
      startDate: extractText(v["开始日期"]),
      dueDate: extractText(v["截止日期"]),
      doneDate: extractText(v["完成日期"]),
      source: extractText(v["来源"]),
      note: extractText(v["备注"]),
      created: extractText(v["创建时间"]),
    };
  });
}

function extractText(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    for (var i = 0; i < val.length; i++) {
      var item = val[i] as Record<string, unknown>;
      if (item && item.text) return item.text as string;
    }
  }
  return String(val);
}

// ====== 报告生成核心函数（Agent 和 Cron 共用） ======

export async function generateProjectReport(
  deps: ReportDeps,
  reportType: "daily" | "weekly" | "monthly",
  projectName: string,
  planDocId: string,
  chatId?: string,
  dateRange?: string
): Promise<ProjectReportOutput> {
  // 1. 读取计划表
  var allData = await fetchPlanData(deps, planDocId);

  // 2. 计算日期范围
  var now = new Date();
  var todayStr = now.toISOString().split("T")[0];

  if (!dateRange) {
    if (reportType === "daily") {
      dateRange = todayStr;
    } else if (reportType === "weekly") {
      var dayOfWeek = now.getDay();
      var monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      var sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      dateRange = monday.toISOString().split("T")[0] + "~" + sunday.toISOString().split("T")[0];
    } else {
      dateRange = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    }
  }

  // 3. 分类统计
  var completedToday: PlanRecord[] = [];
  var inProgress: PlanRecord[] = [];
  var blocked: PlanRecord[] = [];
  var newToday: PlanRecord[] = [];
  var milestones: PlanRecord[] = [];
  var risks: PlanRecord[] = [];

  for (var r of allData) {
    if (r.type === "里程碑") { milestones.push(r); continue; }
    if (r.type === "风险" || r.type === "问题") {
      if (r.status === "跟踪中" || r.status === "解决中") risks.push(r);
      continue;
    }
    if (r.type !== "任务") continue;

    if (r.status === "已完成" && r.doneDate === todayStr) completedToday.push(r);
    else if (r.status === "已阻塞") blocked.push(r);
    else if (r.status !== "已完成" && r.status !== "已取消") inProgress.push(r);

    if (r.created === todayStr) newToday.push(r);
  }

  var stats = {
    total: allData.filter(function(r) { return r.type === "任务"; }).length,
    completed: allData.filter(function(r) { return r.type === "任务" && r.status === "已完成"; }).length,
    blocked: blocked.length,
    newTasks: newToday.length,
  };

  // 4. 根据报告类型生成内容
  var reportContent = "";
  var docName = "";

  if (reportType === "daily") {
    docName = "日报_" + projectName + "_" + todayStr;

    var lines: string[] = [];
    lines.push("# " + projectName + " — 日报 " + todayStr);
    lines.push("");

    lines.push("## 今日完成 (" + completedToday.length + ")");
    if (completedToday.length > 0) {
      for (var ct of completedToday) {
        lines.push("- " + ct.name + " @" + ct.person);
      }
    } else {
      lines.push("(无)");
    }
    lines.push("");

    lines.push("## 进行中 (" + inProgress.length + ")");
    if (inProgress.length > 0) {
      for (var ip of inProgress) {
        var dueTag = ip.dueDate ? " 截止:" + ip.dueDate : "";
        lines.push("- " + ip.name + " @" + ip.person + dueTag);
      }
    } else {
      lines.push("(无)");
    }
    lines.push("");

    if (blocked.length > 0) {
      lines.push("## 阻塞 (" + blocked.length + ")");
      for (var bl of blocked) {
        lines.push("- ⚠️ " + bl.name + " @" + bl.person + (bl.note ? " — " + bl.note : ""));
      }
      lines.push("");
    }

    if (newToday.length > 0) {
      lines.push("## 新增任务 (" + newToday.length + ")");
      for (var nt of newToday) {
        lines.push("- " + nt.name + " @" + nt.person + " | 来源: " + (nt.source || "手动"));
      }
      lines.push("");
    }

    if (risks.length > 0) {
      lines.push("## 风险");
      for (var rk of risks) {
        lines.push("- ⚠️ " + rk.name + " @" + rk.person + (rk.note ? " — " + rk.note : ""));
      }
      lines.push("");
    }

    reportContent = lines.join("\n");
  } else if (reportType === "weekly") {
    docName = "周报_" + projectName + "_" + dateRange.replace(/~/g, "_");

    // 用 LLM 生成结构更丰富的周报
    var dataSummary = "项目: " + projectName + "\n周期: " + dateRange + "\n\n" +
      "完成任务(" + completedToday.length + "): " + completedToday.map(function(r) { return r.name + "@" + r.person; }).join(", ") + "\n" +
      "进行中(" + inProgress.length + "): " + inProgress.map(function(r) { return r.name + "@" + r.person + "(" + (r.dueDate || "无截止") + ")"; }).join(", ") + "\n" +
      "阻塞(" + blocked.length + "): " + blocked.map(function(r) { return r.name + "@" + r.person; }).join(", ") + "\n" +
      "风险(" + risks.length + "): " + risks.map(function(r) { return r.name; }).join(", ");

    try {
      var llmResponse = await deps.llm.chat({
        messages: [{
          role: "user",
          content: "请根据以下项目数据生成周报（Markdown格式）：\n\n" + dataSummary + "\n\n" +
            "要求：\n" +
            "1. ## 本周完成（列表，每条 - 开头）\n" +
            "2. ## 下周计划（根据进行中任务推断）\n" +
            "3. ## 里程碑进度（简要）\n" +
            "4. ## 风险与问题\n" +
            "简洁务实，不编造数据。",
        }],
        temperature: 0.3,
      });
      reportContent = llmResponse.content || dataSummary;
    } catch (e) {
      // LLM 失败时用简单格式
      var fallback: string[] = [];
      fallback.push("# " + projectName + " — 周报 " + dateRange);
      fallback.push("\n## 本周完成\n" + completedToday.map(function(r) { return "- " + r.name; }).join("\n"));
      fallback.push("\n## 进行中\n" + inProgress.map(function(r) { return "- " + r.name; }).join("\n"));
      reportContent = fallback.join("\n");
    }
  } else {
    // monthly
    docName = "月报_" + projectName + "_" + dateRange;

    // 用 LLM 生成
    var monthlyData = "项目: " + projectName + "\n月份: " + dateRange + "\n\n" +
      "完成任务: " + stats.completed + "/" + stats.total + "\n" +
      "进行中: " + inProgress.length + "\n" +
      "阻塞: " + blocked.length + "\n" +
      "风险: " + risks.length;

    try {
      var mlmResponse = await deps.llm.chat({
        messages: [{
          role: "user",
          content: "请根据以下项目数据生成月报（Markdown格式）：\n\n" + monthlyData + "\n\n" +
            "要求：\n" +
            "1. ## 本月摘要\n" +
            "2. ## 关键指标（完成率/阻塞数/风险数）\n" +
            "3. ## 里程碑状态\n" +
            "4. ## 下月重点\n" +
            "简洁务实。",
        }],
        temperature: 0.3,
      });
      reportContent = mlmResponse.content || monthlyData;
    } catch (e) {
      reportContent = "# " + projectName + " — 月报 " + dateRange + "\n\n完成率: " + stats.completed + "/" + stats.total;
    }
  }

  // 5. 创建文档
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  }) as Record<string, unknown>;

  var docId = docResult.docid as string;
  var docUrl = docResult.url as string;

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: reportContent + "\n\n---\n*本报告由 project-bot 自动生成*",
    docid: docId,
  });

  // 6. 可选：发送到群
  if (chatId) {
    var shortMsg = "📊 " + projectName + " " + (reportType === "daily" ? "日报" : reportType === "weekly" ? "周报" : "月报") + "\n" +
      reportType === "daily" ? "今日完成 " + completedToday.length + " 项，进行中 " + inProgress.length + " 项" :
      reportType === "weekly" ? "本周完成 " + completedToday.length + " 项" :
      "本月完成率 " + (stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0) + "%" + "\n" +
      "📄 查看: " + docUrl;

    try {
      await deps.callTool("msg", "send_message", {
        chat_id: chatId,
        chat_type: 2,
        msg_type: "text",
        content: shortMsg,
      });
    } catch (e) {
      console.warn("[project-report] 发送群消息失败: " + (e as Error).message);
    }
  }

  return {
    success: true,
    message: reportType === "daily" ? "日报" : reportType === "weekly" ? "周报" : "月报" + "已生成",
    docUrl: docUrl,
    docId: docId,
    content: reportContent,
    stats: stats,
  };
}

// ====== 组合 Skill 入口（Agent 调用） ======

export async function runProjectReport(
  input: ProjectReportInput,
  deps: ReportDeps
): Promise<ProjectReportOutput> {
  return generateProjectReport(
    deps,
    input.reportType,
    input.projectName,
    input.planDocId,
    input.chatId,
    input.dateRange,
  );
}
