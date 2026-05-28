import { SkillDefinition } from "../packages/core/src/types";

// ============================================================
// party-points-manager — 党员积分管理
// 基于 smartsheet 实现：加减分、查询排名、查看明细
// ============================================================

export var partyPointsManagerDefinition: SkillDefinition = {
  name: "party-points-manager",
  description:
    "党员积分管理。支持：创建积分表、加减分、查看排名、查看个人明细。" +
    "当用户提到积分、加分、减分、排名时使用。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["init", "add-points", "ranking", "detail"] },
      members: { type: "string", description: "党员名单逗号分隔（init时必填）" },
      rules: { type: "string", description: "积分规则说明（init时选填）" },
      sheetDocId: { type: "string", description: "积分表docid" },
      updates: { type: "string", description: "加减分描述（add-points时必填），格式：姓名 +5分 原因" },
      name: { type: "string", description: "查看明细的党员姓名（detail时必填）" },
    },
    required: ["action"],
  },
};

// ====== 类型 ======

export interface PointsInput {
  action: "init" | "add-points" | "ranking" | "detail";
  members?: string;
  rules?: string;
  sheetDocId?: string;
  updates?: string;
  name?: string;
}

export interface PointsOutput {
  success: boolean;
  message: string;
  sheetDocId?: string;
  sheetId?: string;
  data?: Array<{ name: string; points: number; recordId: string }>;
}

export interface PointsDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
}

// ====== smartsheet 字段常量 ======
const FIELD_POINTS = "积分";
const FIELD_TIME = "更新时间";
const FIELD_REASON = "原因";

async function getSheetId(docId: string, deps: PointsDeps): Promise<string> {
  const sh = (await deps.callTool("doc", "smartsheet_get_sheet", { docid: docId })) as Record<string, unknown>;
  return ((sh.sheet_list as Array<Record<string, unknown>>) || [])[0]?.sheet_id as string;
}

async function getNameFieldTitle(docId: string, sheetId: string, deps: PointsDeps): Promise<string> {
  const f = (await deps.callTool("doc", "smartsheet_get_fields", { docid: docId, sheet_id: sheetId })) as Record<string, unknown>;
  const fields = (f.fields as Array<Record<string, unknown>>) || [];
  return fields[0]?.field_title as string || "文本";
}

async function getAllRecords(
  docId: string, sheetId: string, deps: PointsDeps
): Promise<Array<{ name: string; points: number; recordId: string }>> {
  const nameField = await getNameFieldTitle(docId, sheetId, deps);
  const r = (await deps.callTool("doc", "smartsheet_get_records", { docid: docId, sheet_id: sheetId })) as Record<string, unknown>;
  const records = (r.records as Array<Record<string, unknown>>) || [];
  return records.map((rec: Record<string, unknown>) => {
    const vals = (rec.values || {}) as Record<string, unknown>;
    const nameArr = (vals[nameField] || []) as Array<{ text?: string }>;
    const ptsArr = (vals[FIELD_POINTS] || []) as Array<{ text?: string }>;
    return {
      name: nameArr[0]?.text || "",
      points: parseInt(ptsArr[0]?.text || "0", 10) || 0,
      recordId: rec.record_id as string,
    };
  });
}

// ====== 执行函数 ======

export async function runPartyPointsManager(
  input: PointsInput,
  deps: PointsDeps
): Promise<PointsOutput> {
  switch (input.action) {

    // -------- init --------
    case "init": {
      if (!input.members) throw new Error("points: init 需要 members");
      const memberList = input.members.split(",").map((m) => m.trim()).filter(Boolean);

      // 创建智能表格
      const docR = (await deps.callTool("doc", "create_doc", {
        doc_type: 10,
        doc_name: "党员积分管理表",
      })) as Record<string, unknown>;

      const docId = docR.docid as string;
      const sheetId = await getSheetId(docId, deps);

      // 添加字段（默认字段保留作为 姓名）
      await deps.callTool("doc", "smartsheet_add_fields", {
        docid: docId, sheet_id: sheetId,
        fields: [
          { field_title: FIELD_POINTS, field_type: "FIELD_TYPE_TEXT" },
          { field_title: FIELD_TIME, field_type: "FIELD_TYPE_TEXT" },
          { field_title: FIELD_REASON, field_type: "FIELD_TYPE_TEXT" },
        ],
      });

      // 用动态获取的字段名
      const nameField = await getNameFieldTitle(docId, sheetId, deps);

      // 添加初始记录
      const records = memberList.map((name: string) => {
        const vals: Record<string, unknown> = {};
        vals[nameField] = [{ type: "text", text: name }];
        vals[FIELD_POINTS] = [{ type: "text", text: "0" }];
        vals[FIELD_TIME] = [{ type: "text", text: "" }];
        vals[FIELD_REASON] = [{ type: "text", text: "" }];
        return { values: vals };
      });

      await deps.callTool("doc", "smartsheet_add_records", {
        docid: docId, sheet_id: sheetId, records,
      });

      return {
        success: true,
        message: "积分管理表已创建，共" + memberList.length + "名党员（初始0分）\n" + (docR.url || ""),
        sheetDocId: docId, sheetId,
      };
    }

    // -------- add-points --------
    case "add-points": {
      if (!input.sheetDocId) throw new Error("points: add-points 需要 sheetDocId");
      if (!input.updates) throw new Error("points: add-points 需要 updates");

      const sheetId = input.sheetId || await getSheetId(input.sheetDocId, deps);
      const all = await getAllRecords(input.sheetDocId, sheetId, deps);

      // 解析 updates: "张三 +5 参加活动, 李四 -3 缺席"
      const changes: Array<{ name: string; delta: number; reason: string }> = [];
      const parts = input.updates.split(/[,，]/);
      for (const part of parts) {
        const m = part.trim().match(/(.+?)\s*([+-]\d+)\s*(.*)/);
        if (m) {
          changes.push({ name: m[1].trim(), delta: parseInt(m[2], 10), reason: m[3].trim() || "" });
        }
      }
      if (changes.length === 0) throw new Error("points: 无法解析加减分：" + input.updates);

      const results: string[] = [];
      const currentTime = new Date().toISOString().slice(0, 16);

      for (const ch of changes) {
        const rec = all.find((r) => r.name === ch.name);
        if (!rec) {
          results.push("⚠️ 未找到：" + ch.name);
          continue;
        }
        const newPts = rec.points + ch.delta;
        await deps.callTool("doc", "smartsheet_update_records", {
          docid: input.sheetDocId,
          sheet_id: sheetId,
          records: [{
            record_id: rec.recordId,
            values: {
              [FIELD_POINTS]: [{ type: "text", text: String(newPts) }],
              [FIELD_TIME]: [{ type: "text", text: currentTime }],
              [FIELD_REASON]: [{ type: "text", text: ch.reason }],
            },
          }],
        });
        results.push(ch.name + " " + rec.points + "→" + newPts + (ch.reason ? "（" + ch.reason + "）" : ""));
      }

      return {
        success: true,
        message: "已更新：\n" + results.join("\n"),
        sheetDocId: input.sheetDocId, sheetId,
      };
    }

    // -------- ranking --------
    case "ranking": {
      if (!input.sheetDocId) throw new Error("points: ranking 需要 sheetDocId");
      const sheetId = input.sheetId || await getSheetId(input.sheetDocId, deps);
      const all = await getAllRecords(input.sheetDocId, sheetId, deps);

      all.sort((a, b) => b.points - a.points);

      let msg = "🏆 党员积分榜\n";
      for (let i = 0; i < all.length; i++) {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + ".";
        msg += medal + " " + all[i].name + "  " + all[i].points + "分\n";
      }

      return { success: true, message: msg, sheetDocId: input.sheetDocId, sheetId, data: all };
    }

    // -------- detail --------
    case "detail": {
      if (!input.sheetDocId) throw new Error("points: detail 需要 sheetDocId");
      if (!input.name) throw new Error("points: detail 需要 name");
      const sheetId = input.sheetId || await getSheetId(input.sheetDocId, deps);
      const all = await getAllRecords(input.sheetDocId, sheetId, deps);

      const target = all.find((r) => r.name === input.name);
      if (!target) return { success: false, message: "未找到：" + input.name };

      return {
        success: true,
        message: input.name + " 当前积分：" + target.points + "分",
        sheetDocId: input.sheetDocId, sheetId,
        data: [target],
      };
    }

    default:
      throw new Error("points: 未知操作");
  }
}