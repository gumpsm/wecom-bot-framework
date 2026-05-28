// project-close — 项目终止/结项
// 支持正常结项和异常终止两种模式

import { SkillDefinition } from "../packages/core/src/types";
import { LLMClient } from "./llm-deps";

export var projectCloseDefinition: SkillDefinition = {
  name: "project-close",
  description: "项目终止或结项。归档项目计划表、取消未完成日程、生成总结报告（含异常终止原因分析）、通知项目群。",
  parameters: {
    type: "object",
    properties: {
      projectName: { type: "string", description: "项目名称" },
      projectCode: { type: "string", description: "项目代号" },
      closeType: { type: "string", description: "终止类型: normal(正常结项) / abnormal(异常终止)", enum: ["normal", "abnormal"] },
      reason: { type: "string", description: "终止原因（abnormal 时必填）" },
      personnelDocId: { type: "string", description: "人员表 docid" },
      planDocId: { type: "string", description: "计划表 docid" },
      configDocId: { type: "string", description: "配置文档 docid" },
      chatId: { type: "string", description: "项目群 chatId（通知用）" },
    },
    required: ["projectName", "projectCode", "closeType", "planDocId"],
  },
};

export interface ProjectCloseInput {
  projectName: string;
  projectCode: string;
  closeType: "normal" | "abnormal";
  reason?: string;
  personnelDocId?: string;
  planDocId: string;
  configDocId?: string;
  chatId?: string;
}

export interface ProjectCloseOutput {
  success: boolean;
  message: string;
  summaryDocId: string;
  archiveDocId: string;
}

export interface CloseDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
}

export async function projectClose(
  input: ProjectCloseInput,
  deps: CloseDeps
): Promise<ProjectCloseOutput> {
  var projectName = input.projectName;
  var projectCode = input.projectCode;
  var isAbnormal = input.closeType === "abnormal";
  var reason = input.reason || "";

  if (isAbnormal && !reason) {
    throw new Error("project-close: 异常终止必须提供原因");
  }

  var stats = { total: 0, completed: 0, blocked: 0, pending: 0, cancelled: 0 };
  var unfinishedTasks: Array<Record<string, string>> = [];
  var riskItems: string[] = [];

  // ========== 1. 读取计划表，统计任务 ==========
  try {
    var planSheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: input.planDocId }) as Record<string, unknown>;
    var planSheetList = (planSheet.sheet_list || []) as Array<Record<string, unknown>>;
    var planSheetId = planSheetList[0]?.sheet_id as string;

    if (planSheetId) {
      var planRecords = await deps.callTool("doc", "smartsheet_get_records", {
        docid: input.planDocId,
        sheet_id: planSheetId,
      }) as Record<string, unknown>;
      var records = (planRecords.records || []) as Array<Record<string, unknown>>;

      for (var r of records) {
        var values = (r.values || {}) as Record<string, unknown>;
        var type = extractText(values["类型"]);
        var status = extractText(values["状态"]);
        var name = extractText(values["名称"]);
        var person = extractText(values["负责人"]);
        var id = extractText(values["ID"]);

        if (type === "任务") {
          stats.total++;
          if (status === "已完成") stats.completed++;
          else if (status === "已阻塞") stats.blocked++;
          else if (status === "已取消") stats.cancelled++;
          else stats.pending++;

          if (status !== "已完成" && status !== "已取消") {
            unfinishedTasks.push({ id: id, name: name, status: status, person: person });
          }
        }
        if (type === "风险" && (status === "跟踪中")) {
          riskItems.push(name + " (负责人: " + person + ")");
        }
      }
    }
  } catch (e) {
    console.warn("[project-close] 读取计划表失败: " + (e as Error).message);
  }

  // ========== 2. 取消未完成日程 ==========
  try {
    var now = new Date();
    var endStr = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] + " 23:59:59";
    var startStr = now.toISOString().split("T")[0] + " 00:00:00";
    var schedResult = await deps.callTool("schedule", "get_schedule_list_by_range", {
      start_time: startStr,
      end_time: endStr,
    }) as Record<string, unknown>;
    var scheduleList = (schedResult.schedule_list || []) as Array<Record<string, unknown>>;
    var cancelledCount = 0;
    for (var s of scheduleList) {
      try {
        var scheduleId = s.schedule_id as string;
        if (scheduleId) {
          await deps.callTool("schedule", "cancel_schedule", { schedule_id: scheduleId });
          cancelledCount++;
        }
      } catch (e) {
        // 忽略单个取消失败
      }
    }
    if (cancelledCount > 0) {
      console.log("[project-close] 已取消 " + cancelledCount + " 条日程");
    }
  } catch (e) {
    console.warn("[project-close] 取消日程失败: " + (e as Error).message);
  }

  // ========== 3. 生成总结报告 ==========
  var completionRate = stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0;
  var closeLabel = isAbnormal ? "异常终止" : "正常结项";
  var closeTypeLabel = isAbnormal ? "异常终止" : "正常结项";

  var reportParts: string[] = [];
  reportParts.push("# " + projectName + " — 项目总结报告");
  reportParts.push("");
  reportParts.push("> 项目代号: " + projectCode + " | 结项类型: " + closeTypeLabel + " | 结项日期: " + new Date().toISOString().split("T")[0]);
  reportParts.push("");

  if (isAbnormal && reason) {
    reportParts.push("## 终止原因");
    reportParts.push(reason);
    reportParts.push("");
  }

  reportParts.push("## 任务统计");
  reportParts.push("- 总任务数: " + stats.total);
  reportParts.push("- 已完成: " + stats.completed + " (" + completionRate + "%)");
  reportParts.push("- 已阻塞: " + stats.blocked);
  reportParts.push("- 已取消: " + stats.cancelled);
  reportParts.push("- 未完成: " + stats.pending);
  reportParts.push("");

  if (unfinishedTasks.length > 0) {
    reportParts.push("## 未完成任务");
    reportParts.push("| 任务 | 状态 | 负责人 |");
    reportParts.push("|------|------|--------|");
    for (var t of unfinishedTasks) {
      reportParts.push("| " + t.name + " | " + t.status + " | " + t.person + " |");
    }
    reportParts.push("");
  }

  if (riskItems.length > 0) {
    reportParts.push("## 遗留风险");
    for (var ri of riskItems) {
      reportParts.push("- " + ri);
    }
    reportParts.push("");
  }

  // LLM 生成经验教训总结
  if (stats.total > 0) {
    try {
      var llmPrompt = "请根据以下项目数据，生成简短的经验教训总结（3-5条，每条一句话）：\n" +
        "项目名称: " + projectName + "\n" +
        "结项类型: " + closeTypeLabel + "\n" +
        "任务完成率: " + completionRate + "%\n" +
        "完成任务数: " + stats.completed + "/" + stats.total + "\n" +
        (isAbnormal ? "终止原因: " + reason + "\n" : "") +
        "未完成任务: " + unfinishedTasks.map(function(t) { return t.name; }).join(", ") + "\n" +
        "请用中文输出，每条以 - 开头。";

      var llmResponse = await deps.llm.chat({
        messages: [{ role: "user", content: llmPrompt }],
        temperature: 0.3,
      });
      var llmContent = llmResponse.content || "";
      if (llmContent) {
        reportParts.push("## 经验教训");
        reportParts.push(llmContent);
        reportParts.push("");
      }
    } catch (e) {
      console.warn("[project-close] LLM 总结失败: " + (e as Error).message);
    }
  }

  reportParts.push("---");
  reportParts.push("*本报告由 project-bot 自动生成*");

  // 创建总结报告文档
  var summaryResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: projectCode + "_总结报告",
  }) as Record<string, unknown>;
  var summaryDocId = summaryResult.docid as string;
  var summaryUrl = summaryResult.url as string;

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: reportParts.join("\n"),
    docid: summaryDocId,
  });

  // ========== 4. 生成归档索引 ==========
  var archiveParts: string[] = [];
  archiveParts.push("# " + projectName + " — 项目归档索引");
  archiveParts.push("");
  archiveParts.push("> 归档日期: " + new Date().toISOString().split("T")[0] + " | 结项类型: " + closeTypeLabel);
  archiveParts.push("");

  archiveParts.push("## 文档清单");
  archiveParts.push("- 项目计划表 (docid: " + input.planDocId + ")");
  if (input.personnelDocId) archiveParts.push("- 项目人员表 (docid: " + input.personnelDocId + ")");
  if (input.configDocId) archiveParts.push("- 项目配置文档 (docid: " + input.configDocId + ")");
  archiveParts.push("- 项目总结报告 (docid: " + summaryDocId + ")");
  archiveParts.push("");

  archiveParts.push("## 数据统计");
  archiveParts.push("- 任务总数: " + stats.total);
  archiveParts.push("- 完成率: " + completionRate + "%");
  archiveParts.push("");

  archiveParts.push("---");
  archiveParts.push("*本索引由 project-bot 自动生成*");

  var archiveResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: projectCode + "_归档索引",
  }) as Record<string, unknown>;
  var archiveDocId = archiveResult.docid as string;

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: archiveParts.join("\n"),
    docid: archiveDocId,
  });

  // ========== 5. 发送通知 ==========
  var notifyMsg = "📦 项目「" + projectName + "」已" + closeLabel + "\n" +
    "✅ 任务完成率: " + completionRate + "% (" + stats.completed + "/" + stats.total + ")\n" +
    "📄 总结报告: " + summaryUrl + "\n" +
    "📁 归档索引已生成";

  if (input.chatId) {
    try {
      await deps.callTool("msg", "send_message", {
        chat_id: input.chatId,
        chat_type: 2,  // 群聊
        msg_type: "text",
        content: notifyMsg,
      });
    } catch (e) {
      console.warn("[project-close] 发送通知失败: " + (e as Error).message);
    }
  }

  return {
    success: true,
    message: "项目「" + projectName + "」已" + closeLabel + "。完成率: " + completionRate + "%。总结报告已生成。",
    summaryDocId: summaryDocId,
    archiveDocId: archiveDocId,
  };
}

// ====== 工具函数 ======

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
