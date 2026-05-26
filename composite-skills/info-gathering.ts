import { SkillDefinition } from "../packages/core/src/types";

export var infoGatheringDefinition: SkillDefinition = {
  name: "info-gathering",
  description: "信息汇集分析。从多源数据（日程、待办、项目进展等）汇集信息，LLM分析后生成分析报告文档或智能表格。当用户提到汇总分析、数据分析、生成报告、信息汇集时使用。",
  parameters: {
    type: "object",
    properties: {
      topic: { type: "string", description: "分析主题，如 Q2项目进度汇总" },
      dataSummary: { type: "string", description: "待分析数据的摘要描述，直接输入要分析的内容" },
      outputFormat: { type: "string", description: "输出格式: report/table/dashboard", enum: ["report", "table", "dashboard"] },
    },
    required: ["topic", "dataSummary"],
  },
};

// Composite Skill: 信息汇集分析
// 从多源收集信息 → LLM分析汇总 → 创建文档/智能表格 → 返回结构化报告
import { LLMClient } from "./llm-deps";

export interface DataSource {
  type: "chat" | "schedule" | "todo" | "meeting" | "doc" | "manual";
  label: string;
  data: string;            // 原始数据文本
}

export interface AnalysisRequest {
  topic: string;           // 分析主题，如 "Q2项目进度汇总"
  sources: DataSource[];
  outputFormat: "report" | "table" | "dashboard";  // 输出格式
  analysisPrompt?: string;  // 自定义分析提示词
}

export interface AnalysisOutput {
  success: boolean;
  summary: string;         // 分析摘要
  docUrl: string;
  docId: string;
  tableUrl?: string;       // 如果输出表格格式，返回智能表格链接
  tableId?: string;
  rawContent: string;
}

export interface AnalysisDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
  systemPrompt?: string;
}

export async function gatherAndAnalyze(
  input: AnalysisRequest,
  deps: AnalysisDeps
): Promise<AnalysisOutput> {
  // 1. 参数校验
  if (!input.topic) throw new Error("gatherAndAnalyze: topic is required");
  if (!input.sources || input.sources.length === 0) throw new Error("gatherAndAnalyze: at least one data source is required");

  // 2. 组装分析上下文
  var contextParts: string[] = [];
  contextParts.push("# 分析主题: " + input.topic);
  contextParts.push("");
  contextParts.push("## 数据来源");

  for (var s of input.sources) {
    contextParts.push("### " + s.label + " (" + s.type + ")");
    contextParts.push(s.data);
    contextParts.push("");
  }

  var context = contextParts.join("\n");

  // 3. 根据输出格式调整分析提示
  var formatInstruction = "";
  if (input.outputFormat === "table") {
    formatInstruction = "请用表格形式输出分析结果，至少包含：指标名称、当前值、趋势、建议。";
  } else if (input.outputFormat === "dashboard") {
    formatInstruction = "请生成仪表盘风格的分析摘要，包含关键指标、状态指示和重点标注。";
  } else {
    formatInstruction = "请生成结构化的分析报告，包含：摘要、关键发现、数据详情、建议。";
  }

  var customPrompt = input.analysisPrompt || "";
  var systemPrompt = deps.systemPrompt ||
    "你是一个专业的数据分析助手。请根据提供的数据源进行分析，生成清晰、准确的分析报告。";

  // 4. LLM 分析
  var response = await deps.llm.chat({
    messages: [
      {
        role: "user",
        content: context + "\n\n" +
          formatInstruction + "\n" +
          (customPrompt ? "\n额外要求: " + customPrompt : "") + "\n\n" +
          "请保持数据准确性，不编造数据。对无法确定的信息标注「待确认」。",
      },
    ],
    systemPrompt: systemPrompt,
    temperature: 0.3,
  });

  var analyzedContent = response.content || "";
  if (!analyzedContent) {
    throw new Error("gatherAndAnalyze: LLM returned empty content");
  }

  // 5. 创建文档
  var docName = "分析报告_" + input.topic.replace(/[\\/:*?"<>|]/g, "_").substring(0, 50);
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  }) as Record<string, unknown>;

  var docId = docResult.docid as string;
  var docUrl = docResult.url as string;

  // 6. 写入内容
  var fullContent = "# " + input.topic + "\n\n" +
    "> 生成时间: " + new Date().toLocaleString() + "\n\n" +
    "---\n\n" +
    analyzedContent + "\n\n" +
    "---\n\n" +
    "## 数据来源清单\n" +
    input.sources.map(function(s: DataSource) { return "- [" + s.type + "] " + s.label; }).join("\n");

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: fullContent,
    docid: docId,
  });

  // 7. 如果是 table 格式，额外创建智能表格
  var tableUrl = "";
  var tableId = "";
  if (input.outputFormat === "table") {
    try {
      var tableResult = await deps.callTool("doc", "create_doc", {
        doc_type: 10,
        doc_name: "数据表_" + input.topic.replace(/[\\/:*?"<>|]/g, "_").substring(0, 30),
      }) as Record<string, unknown>;
      tableId = tableResult.docid as string;
      tableUrl = tableResult.url as string;

      // Get default sheet
      var sh = await deps.callTool("doc", "smartsheet_get_sheet", { docid: tableId }) as Record<string, unknown>;
      var sheetId = ((sh.sheet_list as Array<Record<string, unknown>>) || [])[0]?.sheet_id as string;

      // Get default field and rename it
      var fields = await deps.callTool("doc", "smartsheet_get_fields", {
        docid: tableId,
        sheet_id: sheetId,
      }) as Record<string, unknown>;

      var fieldList = (fields.fields as Array<Record<string, unknown>>) || [];
      if (fieldList.length > 0) {
        var defaultFieldId = fieldList[0].field_id as string;
        await deps.callTool("doc", "smartsheet_update_fields", {
          docid: tableId,
          sheet_id: sheetId,
          fields: [{ field_id: defaultFieldId, field_title: "指标名称" }],
        }).catch(function(e: Error) { console.warn("[gatherAndAnalyze] Field rename: " + e.message); });

        // Add more fields
        await deps.callTool("doc", "smartsheet_add_fields", {
          docid: tableId,
          sheet_id: sheetId,
          fields: [
            { field_title: "当前值", field_type: "FIELD_TYPE_TEXT" },
            { field_title: "趋势", field_type: "FIELD_TYPE_TEXT" },
            { field_title: "建议", field_type: "FIELD_TYPE_TEXT" },
          ],
        }).catch(function(e: Error) { console.warn("[gatherAndAnalyze] Add fields: " + e.message); });
      }
    } catch (e) {
      console.warn("[gatherAndAnalyze] Table creation failed: " + (e as Error).message);
    }
  }

  // 8. 提取摘要（取前 200 字）
  var summary = analyzedContent.substring(0, 200).replace(/#/g, "").trim();

  return {
    success: true,
    summary: summary,
    docUrl: docUrl,
    docId: docId,
    tableUrl: tableUrl || undefined,
    tableId: tableId || undefined,
    rawContent: fullContent,
  };
}

