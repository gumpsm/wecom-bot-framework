import { SkillDefinition } from "../packages/core/src/types";

export var weeklyReportDefinition: SkillDefinition = {
  name: "create-weekly-report",
  description: "创建项目周报文档。当用户提到写周报、本周总结、项目进展、项目周报时使用。需收集项目名称、本周进展、下周计划。",
  parameters: {
    type: "object",
    properties: {
      projectName: { type: "string", description: "项目名称" },
      weekRange: { type: "string", description: "周期范围，如 2026-05-26 ~ 2026-05-30" },
      progress: { type: "string", description: "本周进展，多条用换行分隔" },
      nextPlan: { type: "string", description: "下周计划，多条用换行分隔" },
    },
    required: ["projectName", "weekRange", "progress", "nextPlan"],
  },
};

import { SkillDefinition } from "../packages/core/src/types";

export var weeklyReportDefinition: SkillDefinition = {
  name: "create-weekly-report",
  description: "创建项目周报文档。当用户提到写周报、本周总结、本周进展、项目周报时使用。需要收集项目名称、本周进展列表、下周计划列表。",
  parameters: {
    type: "object",
    properties: {
      projectName: { type: "string", description: "项目名称" },
      weekRange: { type: "string", description: "周期范围，如 2026-05-26 ~ 2026-05-30" },
      progress: { type: "string", description: "本周进展，多条用换行分隔" },
      nextPlan: { type: "string", description: "下周计划，多条用换行分隔" },
      risks: { type: "string", description: "风险描述，JSON数组格式，可选" },
      members: { type: "string", description: "项目成员，逗号分隔，可选" },
    },
    required: ["projectName", "weekRange", "progress", "nextPlan"],
  },
};

// Composite Skill: 周报创建
// 输入项目信息 → LLM生成周报内容 → 创建文档 → 写入内容 → 返回文档链接
import { LLMClient, LLMClientConfig } from "./llm-deps";

export interface WeeklyReportInput {
  projectName: string;
  weekRange: string;           // e.g. "2026-05-26 ~ 2026-06-01"
  progress: string[];          // 本周进展列表
  nextPlan: string[];          // 下周计划列表
  risks?: Array<{ item: string; level: string; solution: string }>;
  members?: string[];          // 项目成员
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
  // 1. 参数校验
  var missing: string[] = [];
  if (!input.projectName) missing.push("projectName");
  if (!input.weekRange) missing.push("weekRange");
  if (!input.progress || input.progress.length === 0) missing.push("progress");
  if (!input.nextPlan || input.nextPlan.length === 0) missing.push("nextPlan");
  if (missing.length > 0) {
    throw new Error("createWeeklyReport: missing required fields: " + missing.join(", "));
  }

  // 2. 用 LLM 生成周报内容
  var riskSection = "";
  if (input.risks && input.risks.length > 0) {
    riskSection = "\n\n## 风险与问题\n| 风险 | 等级 | 应对 |\n|------|------|------|\n";
    for (var r of input.risks) {
      riskSection += "| " + r.item + " | " + r.level + " | " + r.solution + " |\n";
    }
  }

  var memberSection = "";
  if (input.members && input.members.length > 0) {
    memberSection = "\n\n## 项目成员\n" + input.members.map(function(m: string) { return "- " + m; }).join("\n");
  }

  var progressText = input.progress.map(function(p: string) { return "- " + p; }).join("\n");
  var planText = input.nextPlan.map(function(p: string) { return "- " + p; }).join("\n");

  var rawContent = "# " + input.projectName + " 周报\n\n" +
    "**周期**: " + input.weekRange + "\n\n" +
    "## 本周进展\n" + progressText + "\n\n" +
    "## 下周计划\n" + planText +
    riskSection + memberSection + "\n\n> 生成时间: " + new Date().toLocaleString();

  // 3. 用 LLM 润色（如果 systemPrompt 提供了角色设定）
  var finalContent = rawContent;
  if (deps.systemPrompt) {
    try {
      var response = await deps.llm.chat({
        messages: [
          {
            role: "user",
            content: "请根据以下信息，整理成一份专业格式的项目周报，保持原有结构和内容，只优化表达：" +
              rawContent
          }
        ],
        systemPrompt: deps.systemPrompt,
        temperature: 0.5,
      });
      if (response.content) {
        finalContent = response.content;
      }
    } catch (e) {
      console.warn("[createWeeklyReport] LLM polish failed, using raw content: " + (e as Error).message);
    }
  }

  // 4. 创建文档
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: input.projectName + " 周报 " + input.weekRange.split("~")[0].trim(),
  }) as Record<string, unknown>;

  var docId = docResult.docid as string;
  var docUrl = docResult.url as string;

  // 5. 写入内容
  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: finalContent,
    docid: docId,
  });

  return {
    success: true,
    docUrl: docUrl,
    docId: docId,
    content: finalContent,
  };
}


