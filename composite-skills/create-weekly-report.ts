import { SkillDefinition } from "../packages/core/src/types";

export var weeklyReportDefinition: SkillDefinition = {
  name: "create-weekly-report",
  description: "创建项目周报文档。当用户提到写周报、本周总结、本周进展、项目周报时使用。需要收集项目名称、本周进展列表、下周计划列表。可选接收会议纪要内容作为数据源。",
  parameters: {
    type: "object",
    properties: {
      projectName: { type: "string", description: "项目名称" },
      weekRange: { type: "string", description: "周期范围，如 2026-05-26 ~ 2026-05-30" },
      progress: { type: "string", description: "本周进展，多条用换行分隔" },
      nextPlan: { type: "string", description: "下周计划，多条用换行分隔" },
      risks: { type: "string", description: "风险描述，JSON数组格式，可选" },
      members: { type: "string", description: "项目成员，逗号分隔，可选" },
      minutesContent: { type: "string", description: "会议纪要内容，可选。提供后LLM会从纪要中提取进展和计划" },
    },
    required: ["projectName", "weekRange"],
  },
};

import { LLMClient, LLMClientConfig } from "./llm-deps";

export interface WeeklyReportInput {
  projectName: string;
  weekRange: string;
  progress: string[];
  nextPlan: string[];
  risks?: Array<{ item: string; level: string; solution: string }>;
  members?: string[];
  minutesContent?: string;
}

export interface WeeklyReportOutput {
  success: boolean;
  docUrl: string;
  docId: string;
  content: string;
}

export interface WeeklyReportDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
  systemPrompt?: string;
}

export async function createWeeklyReport(
  input: WeeklyReportInput,
  deps: WeeklyReportDeps
): Promise<WeeklyReportOutput> {
  var missing: string[] = [];
  if (!input.projectName) missing.push("projectName");
  if (!input.weekRange) missing.push("weekRange");
  if (missing.length > 0) {
    throw new Error("createWeeklyReport: missing required fields: " + missing.join(", "));
  }

  // 风险
  var riskSection = "";
  if (input.risks && input.risks.length > 0) {
    riskSection = "\n\n## 风险与问题\n| 风险 | 等级 | 应对 |\n|------|------|------|\n";
    for (var r of input.risks) {
      riskSection += "| " + r.item + " | " + r.level + " | " + r.solution + " |\n";
    }
  }

  // 成员
  var memberSection = "";
  if (input.members && input.members.length > 0) {
    memberSection = "\n\n## 项目成员\n" + input.members.map(function(m: string) { return "- " + m; }).join("\n");
  }

  // 如果提供了纪要内容，用 LLM 从纪要中提取进展和计划
  var progressText = "";
  var planText = "";

  if (input.minutesContent) {
    // 从纪要+已有进展/计划中生成周报
    var existingProgress = input.progress && input.progress.length > 0 ?
      input.progress.map(function(p: string) { return "- " + p; }).join("\n") : "";
    var existingPlan = input.nextPlan && input.nextPlan.length > 0 ?
      input.nextPlan.map(function(p: string) { return "- " + p; }).join("\n") : "";

    try {
      var llmPrompt = "请根据以下信息生成项目周报的「本周进展」和「下周计划」两个章节（Markdown格式）：\n\n" +
        "## 会议纪要\n" + input.minutesContent + "\n\n" +
        (existingProgress ? "## 已有进展记录\n" + existingProgress + "\n\n" : "") +
        (existingPlan ? "## 已有计划记录\n" + existingPlan + "\n\n" : "") +
        "请合并会议纪要中的信息，生成结构清晰的进展和计划。每项一行，以 - 开头。只返回两个章节，不要其他内容。";

      var llmResponse = await deps.llm.chat({
        messages: [{ role: "user", content: llmPrompt }],
        temperature: 0.3,
      });

      var llmContent = llmResponse.content || "";
      // 拆分为进展和计划
      var progressIdx = llmContent.indexOf("本周进展");
      var planIdx = llmContent.indexOf("下周计划");
      if (progressIdx >= 0 && planIdx > progressIdx) {
        progressText = llmContent.slice(progressIdx + 6, planIdx).trim();
        planText = llmContent.slice(planIdx + 6).trim();
      } else {
        // fallback: 整个作为进展
        progressText = existingProgress || llmContent;
        planText = existingPlan || "";
      }
    } catch (e) {
      console.warn("[createWeeklyReport] LLM extraction failed: " + (e as Error).message);
      progressText = existingProgress;
      planText = existingPlan;
    }
  } else {
    progressText = input.progress && input.progress.length > 0 ?
      input.progress.map(function(p: string) { return "- " + p; }).join("\n") : "";
    planText = input.nextPlan && input.nextPlan.length > 0 ?
      input.nextPlan.map(function(p: string) { return "- " + p; }).join("\n") : "";
  }

  var rawContent = "# " + input.projectName + " 周报\n\n" +
    "**周期**: " + input.weekRange + "\n\n" +
    "## 本周进展\n" + progressText + "\n\n" +
    "## 下周计划\n" + planText +
    riskSection + memberSection + "\n\n> 生成时间: " + new Date().toLocaleString();

  // 创建文档
  var docName = "周报_" + input.projectName + "_" + input.weekRange.replace(/[\\/:*?"<>|]/g, "-");
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  }) as Record<string, unknown>;

  var docId = docResult.docid as string;
  var docUrl = docResult.url as string;

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: rawContent,
    docid: docId,
  });

  return {
    success: true,
    docUrl: docUrl,
    docId: docId,
    content: rawContent,
  };
}
