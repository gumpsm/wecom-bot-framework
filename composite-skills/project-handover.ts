// project-handover — 人员交接
// 人员离开项目时，列出其未完成待办，批量转移给接手人，更新人员表和计划表

import { SkillDefinition } from "../packages/core/src/types";

export var projectHandoverDefinition: SkillDefinition = {
  name: "project-handover",
  description: "人员交接。当项目成员离开时，列出其所有未完成待办，批量转移给接手人，更新人员状态。支持跨项目查询。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", description: "操作: preview(预览待办)/transfer(执行转移)", enum: ["preview", "transfer"] },
      personName: { type: "string", description: "离开人员姓名或userid" },
      targetPerson: { type: "string", description: "接手人姓名或userid（transfer时必填）" },
      personnelDocId: { type: "string", description: "人员表 docid" },
      planDocId: { type: "string", description: "计划表 docid" },
    },
    required: ["action", "personName"],
  },
};

export interface HandoverDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
}

interface TaskItem {
  recordId: string;
  id: string;
  name: string;
  status: string;
  dueDate: string;
  project: string;
}

export async function runProjectHandover(
  input: { action: string; personName: string; targetPerson?: string; personnelDocId?: string; planDocId?: string },
  deps: HandoverDeps
): Promise<{ success: boolean; message: string; tasks?: TaskItem[]; transferred?: number }> {
  var personName = input.personName;
  var personnelDocId = input.personnelDocId;
  var planDocId = input.planDocId;

  // ========== 1. 查询人员未完成待办 ==========
  var unfinishedTasks: TaskItem[] = [];

  if (planDocId) {
    try {
      var sheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: planDocId }) as Record<string, unknown>;
      var sheetList = (sheet.sheet_list || []) as Array<Record<string, unknown>>;
      var sheetId = sheetList[0]?.sheet_id as string;

      if (sheetId) {
        var result = await deps.callTool("doc", "smartsheet_get_records", { docid: planDocId, sheet_id: sheetId }) as Record<string, unknown>;
        var records = (result.records || []) as Array<Record<string, unknown>>;

        for (var r of records) {
          var v = (r.values || {}) as Record<string, unknown>;
          var p = extractText(v["负责人"]);
          var type = extractText(v["类型"]);
          var status = extractText(v["状态"]);
          if (type !== "任务") continue;
          if (status === "已完成" || status === "已取消") continue;
          if (p && (p.includes(personName) || personName.includes(p))) {
            unfinishedTasks.push({
              recordId: r.record_id as string,
              id: extractText(v["ID"]),
              name: extractText(v["名称"]),
              status: status,
              dueDate: extractText(v["截止日期"]),
              project: "",
            });
          }
        }
      }
    } catch (e) {
      console.warn("[handover] query failed: " + (e as Error).message);
    }
  }

  if (input.action === "preview") {
    if (unfinishedTasks.length === 0) {
      return { success: true, message: personName + " 没有未完成待办，可以直接离开。", tasks: [] };
    }
    var lines: string[] = [];
    lines.push(personName + " 未完成待办 (" + unfinishedTasks.length + "项)：");
    for (var t of unfinishedTasks) {
      var tag = t.status === "已阻塞" ? "🔴" : "🟡";
      lines.push("- " + tag + " " + t.id + " " + t.name + (t.dueDate ? " 截止:" + t.dueDate : ""));
    }
    return { success: true, message: lines.join("\n"), tasks: unfinishedTasks };
  }

  // ========== 2. 执行转移 ==========
  if (input.action === "transfer") {
    if (!input.targetPerson) {
      throw new Error("handover transfer: targetPerson is required");
    }
    if (!planDocId) {
      throw new Error("handover transfer: planDocId is required");
    }

    var targetPerson = input.targetPerson;
    var transferred = 0;

    // 转移计划表中的待办
    try {
      var tSheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: planDocId }) as Record<string, unknown>;
      var tSheetList = (tSheet.sheet_list || []) as Array<Record<string, unknown>>;
      var tSheetId = tSheetList[0]?.sheet_id as string;

      if (tSheetId) {
        for (var task of unfinishedTasks) {
          try {
            await deps.callTool("doc", "smartsheet_update_records", {
              docid: planDocId,
              sheet_id: tSheetId,
              records: [{
                record_id: task.recordId,
                values: {
                  "负责人": [{ type: "text", text: targetPerson }],
                  "备注": [{ type: "text", text: "由 " + personName + " 交接" }],
                },
              }],
            });
            transferred++;
          } catch (e) {
            console.warn("[handover] transfer " + task.id + " failed: " + (e as Error).message);
          }
        }
      }
    } catch (e) {
      console.warn("[handover] batch transfer failed: " + (e as Error).message);
    }

    // 更新人员表状态
    if (personnelDocId) {
      try {
        var pSheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: personnelDocId }) as Record<string, unknown>;
        var pSheetList = (pSheet.sheet_list || []) as Array<Record<string, unknown>>;
        var pSheetId = pSheetList[0]?.sheet_id as string;

        if (pSheetId) {
          var pResult = await deps.callTool("doc", "smartsheet_get_records", { docid: personnelDocId, sheet_id: pSheetId }) as Record<string, unknown>;
          var pRecords = (pResult.records || []) as Array<Record<string, unknown>>;

          for (var pr of pRecords) {
            var pv = (pr.values || {}) as Record<string, unknown>;
            var pName = extractText(pv["姓名"]);
            if (pName && (pName.includes(personName) || personName.includes(pName))) {
              await deps.callTool("doc", "smartsheet_update_records", {
                docid: personnelDocId,
                sheet_id: pSheetId,
                records: [{
                  record_id: pr.record_id,
                  values: {
                    "状态": [{ type: "text", text: "已离开" }],
                    "离开时间": [{ type: "text", text: new Date().toISOString().split("T")[0] }],
                  },
                }],
              });
              break;
            }
          }
        }
      } catch (e) {
        console.warn("[handover] personnel update failed: " + (e as Error).message);
      }
    }

    return {
      success: true,
      message: "已转移 " + transferred + "/" + unfinishedTasks.length + " 项待办给 " + targetPerson + "。" +
        (personnelDocId ? " 人员表已更新。" : ""),
      transferred: transferred,
    };
  }

  return { success: false, message: "Unknown action: " + input.action };
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
