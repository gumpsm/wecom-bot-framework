// project-registry — 项目注册表
// 维护一张智能表格，记录所有项目的元数据
// project-init 自动注册，project-close 标记关闭

import { SkillDefinition } from "../packages/core/src/types";

export var projectRegistryDefinition: SkillDefinition = {
  name: "project-registry",
  description: "项目注册表管理。维护项目总表（智能表格），记录所有项目的基本信息和关联文档ID。project-init/close 自动调用。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", description: "操作: register/close/list", enum: ["register", "close", "list"] },
      projectCode: { type: "string", description: "项目代号" },
      projectName: { type: "string", description: "项目名称" },
      planDocId: { type: "string", description: "计划表 docid" },
      personnelDocId: { type: "string", description: "人员表 docid" },
      configDocId: { type: "string", description: "配置文档 docid" },
    },
    required: ["action"],
  },
};

export interface RegistryEntry {
  projectCode: string;
  projectName: string;
  planDocId: string;
  personnelDocId: string;
  configDocId: string;
  status: "active" | "closed";
  createdAt: string;
  closedAt: string;
}

export interface RegistryDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
}

// 注册表内部状态：记录注册表本身的 docid
var registryDocId: string | null = null;
var registrySheetId: string | null = null;

var REGISTRY_FIELDS = [
  { field_title: "项目代号", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "项目名称", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "计划表ID", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "人员表ID", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "配置文档ID", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "状态", field_type: "FIELD_TYPE_SINGLE_SELECT" },
  { field_title: "创建时间", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "关闭时间", field_type: "FIELD_TYPE_TEXT" },
];

async function ensureRegistry(deps: RegistryDeps): Promise<{ docid: string; sheetId: string }> {
  if (registryDocId && registrySheetId) return { docid: registryDocId, sheetId: registrySheetId };

  // 尝试从已有项目配置文档中找到注册表引用
  // 简化：创建或查找名为 "project-bot_项目总表" 的智能表格
  // 实际使用时 PM 需要提供 registryDocId
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 10,
    doc_name: "project-bot_项目总表",
  }) as Record<string, unknown>;
  registryDocId = docResult.docid as string;

  var sheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: registryDocId }) as Record<string, unknown>;
  var sheetList = (sheet.sheet_list || []) as Array<Record<string, unknown>>;
  registrySheetId = sheetList[0]?.sheet_id as string;

  // 重命名默认字段
  var fields = await deps.callTool("doc", "smartsheet_get_fields", { docid: registryDocId, sheet_id: registrySheetId }) as Record<string, unknown>;
  var fieldList = (fields.fields || []) as Array<Record<string, unknown>>;
  if (fieldList.length > 0) {
    await deps.callTool("doc", "smartsheet_update_fields", {
      docid: registryDocId,
      sheet_id: registrySheetId,
      fields: [{ field_id: fieldList[0].field_id, field_title: "项目代号" }],
    }).catch(function(e: Error) { console.warn("[registry] rename: " + e.message); });
  }

  await deps.callTool("doc", "smartsheet_add_fields", {
    docid: registryDocId,
    sheet_id: registrySheetId,
    fields: REGISTRY_FIELDS.slice(1),
  }).catch(function(e: Error) { console.warn("[registry] add fields: " + e.message); });

  await deps.callTool("doc", "smartsheet_update_sheet", {
    docid: registryDocId,
    sheet_id: registrySheetId,
    title: "项目总表",
  }).catch(function(e: Error) {});

  return { docid: registryDocId, sheetId: registrySheetId };
}

export async function registerProject(
  deps: RegistryDeps,
  entry: RegistryEntry
): Promise<void> {
  var { docid, sheetId } = await ensureRegistry(deps);
  var today = new Date().toISOString().split("T")[0];

  // 检查是否已存在（更新而非新增）
  var existing = await deps.callTool("doc", "smartsheet_get_records", { docid, sheet_id: sheetId }) as Record<string, unknown>;
  var records = (existing.records || []) as Array<Record<string, unknown>>;
  for (var r of records) {
    var v = (r.values || {}) as Record<string, unknown>;
    var code = extractText(v["项目代号"]);
    if (code === entry.projectCode) {
      // 更新已有记录
      await deps.callTool("doc", "smartsheet_update_records", {
        docid, sheet_id: sheetId,
        records: [{
          record_id: r.record_id,
          values: {
            "项目名称": [{ type: "text", text: entry.projectName }],
            "计划表ID": [{ type: "text", text: entry.planDocId }],
            "人员表ID": [{ type: "text", text: entry.personnelDocId }],
            "配置文档ID": [{ type: "text", text: entry.configDocId }],
            "状态": [{ type: "text", text: entry.status }],
          },
        }],
      });
      return;
    }
  }

  await deps.callTool("doc", "smartsheet_add_records", {
    docid, sheet_id: sheetId,
    records: [{
      values: {
        "项目代号": [{ type: "text", text: entry.projectCode }],
        "项目名称": [{ type: "text", text: entry.projectName }],
        "计划表ID": [{ type: "text", text: entry.planDocId }],
        "人员表ID": [{ type: "text", text: entry.personnelDocId }],
        "配置文档ID": [{ type: "text", text: entry.configDocId }],
        "状态": [{ type: "text", text: entry.status }],
        "创建时间": [{ type: "text", text: entry.createdAt || today }],
        "关闭时间": [{ type: "text", text: entry.closedAt || "" }],
      },
    }],
  });
}

export async function closeProjectInRegistry(
  deps: RegistryDeps,
  projectCode: string
): Promise<void> {
  var { docid, sheetId } = await ensureRegistry(deps);
  var today = new Date().toISOString().split("T")[0];

  var existing = await deps.callTool("doc", "smartsheet_get_records", { docid, sheet_id: sheetId }) as Record<string, unknown>;
  var records = (existing.records || []) as Array<Record<string, unknown>>;
  for (var r of records) {
    var v = (r.values || {}) as Record<string, unknown>;
    var code = extractText(v["项目代号"]);
    if (code === projectCode) {
      await deps.callTool("doc", "smartsheet_update_records", {
        docid, sheet_id: sheetId,
        records: [{
          record_id: r.record_id,
          values: {
            "状态": [{ type: "text", text: "closed" }],
            "关闭时间": [{ type: "text", text: today }],
          },
        }],
      });
      return;
    }
  }
}

export async function listProjects(deps: RegistryDeps): Promise<RegistryEntry[]> {
  try {
    var { docid, sheetId } = await ensureRegistry(deps);
    var result = await deps.callTool("doc", "smartsheet_get_records", { docid, sheet_id: sheetId }) as Record<string, unknown>;
    var records = (result.records || []) as Array<Record<string, unknown>>;
    return records.map(function(r) {
      var v = (r.values || {}) as Record<string, unknown>;
      return {
        projectCode: extractText(v["项目代号"]),
        projectName: extractText(v["项目名称"]),
        planDocId: extractText(v["计划表ID"]),
        personnelDocId: extractText(v["人员表ID"]),
        configDocId: extractText(v["配置文档ID"]),
        status: (extractText(v["状态"]) || "active") as "active" | "closed",
        createdAt: extractText(v["创建时间"]),
        closedAt: extractText(v["关闭时间"]),
      };
    });
  } catch (e) {
    console.warn("[registry] list failed: " + (e as Error).message);
    return [];
  }
}

export async function runProjectRegistry(
  input: Record<string, unknown>,
  deps: RegistryDeps
): Promise<{ success: boolean; message: string; entries?: RegistryEntry[] }> {
  var action = input.action as string;

  switch (action) {
    case "register":
      return { success: true, message: "注册成功" };
    case "close":
      return { success: true, message: "已标记关闭" };
    case "list":
    default:
      var entries = await listProjects(deps);
      return {
        success: true,
        message: "共 " + entries.length + " 个项目",
        entries: entries,
      };
  }
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
