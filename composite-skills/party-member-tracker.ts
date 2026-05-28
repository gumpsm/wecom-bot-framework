import { SkillDefinition } from "../packages/core/src/types";

// ============================================================
// party-member-tracker — 党员管理
// smartsheet 维护人员档案，跟踪发展节点
// ============================================================

export var partyMemberTrackerDefinition: SkillDefinition = {
  name: "party-member-tracker",
  description:
    "党员管理。维护支部人员档案（支委/正式党员/预备党员/积极分子/申请人），跟踪发展节点和思想汇报进度。" +
    "当用户提到党员管理、人员档案、发展进度、思想汇报时使用。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["init", "add", "update", "check", "list"] },
      members: { type: "string", description: "初始化人员列表（init时用），格式：姓名,类别" },
      sheetDocId: { type: "string", description: "人员档案表docid" },
      name: { type: "string", description: "人员姓名" },
      category: { type: "string", description: "类别：支委/正式党员/预备党员/积极分子/申请人" },
      field: { type: "string", description: "要更新的字段名" },
      value: { type: "string", description: "要更新的值" },
    },
    required: ["action"],
  },
};

// ====== 类型 ======

export interface MemberInput {
  action: "init" | "add" | "update" | "check" | "list";
  members?: string;
  sheetDocId?: string;
  name?: string;
  category?: string;
  field?: string;
  value?: string;
}

export interface MemberOutput {
  success: boolean;
  message: string;
  sheetDocId?: string;
  sheetId?: string;
  reminders?: string[];
  data?: Array<Record<string, string>>;
}

export interface MemberDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
}

// ====== smartsheet 字段定义 ======
const CATEGORY_FIELD = "类别";
const JOIN_TIME_FIELD = "入党时间";
const APPLY_TIME_FIELD = "申请时间";
const ACTIVIST_TIME_FIELD = "积极分子时间";
const CANDIDATE_TIME_FIELD = "发展对象时间";
const PROBATION_TIME_FIELD = "预备时间";
const CONVERT_TIME_FIELD = "转正时间";
const REPORT_STATUS_FIELD = "思想汇报状态";
const NOTE_FIELD = "备注";

async function getSheetId(docId: string, deps: MemberDeps): Promise<string> {
  const sh = (await deps.callTool("doc", "smartsheet_get_sheet", { docid: docId })) as Record<string, unknown>;
  return ((sh.sheet_list as Array<Record<string, unknown>>) || [])[0]?.sheet_id as string;
}

async function getNameField(docId: string, sheetId: string, deps: MemberDeps): Promise<string> {
  const f = (await deps.callTool("doc", "smartsheet_get_fields", { docid: docId, sheet_id: sheetId })) as Record<string, unknown>;
  return ((f.fields as Array<Record<string, unknown>>) || [])[0]?.field_title as string || "文本";
}

async function getAllMembers(
  docId: string, sheetId: string, deps: MemberDeps
): Promise<Array<Record<string, string> & { recordId: string }>> {
  const nameField = await getNameField(docId, sheetId, deps);
  const r = (await deps.callTool("doc", "smartsheet_get_records", { docid: docId, sheet_id: sheetId })) as Record<string, unknown>;
  const records = (r.records as Array<Record<string, unknown>>) || [];
  return records.map((rec: Record<string, unknown>) => {
    const vals = (rec.values || {}) as Record<string, unknown>;
    const getText = (key: string) => ((vals[key] || []) as Array<{ text?: string }>)[0]?.text || "";
    return {
      recordId: rec.record_id as string,
      name: getText(nameField),
      category: getText(CATEGORY_FIELD),
      joinTime: getText(JOIN_TIME_FIELD),
      applyTime: getText(APPLY_TIME_FIELD),
      activistTime: getText(ACTIVIST_TIME_FIELD),
      candidateTime: getText(CANDIDATE_TIME_FIELD),
      probationTime: getText(PROBATION_TIME_FIELD),
      convertTime: getText(CONVERT_TIME_FIELD),
      reportStatus: getText(REPORT_STATUS_FIELD),
      note: getText(NOTE_FIELD),
    };
  });
}

// ====== 执行函数 ======

export async function runPartyMemberTracker(
  input: MemberInput,
  deps: MemberDeps
): Promise<MemberOutput> {
  switch (input.action) {

    // -------- init --------
    case "init": {
      if (!input.members) throw new Error("member-tracker: init 需要 members");

      const docR = (await deps.callTool("doc", "create_doc", {
        doc_type: 10,
        doc_name: "支部人员档案",
      })) as Record<string, unknown>;

      const docId = docR.docid as string;
      const sheetId = await getSheetId(docId, deps);

      // 添加字段
      await deps.callTool("doc", "smartsheet_add_fields", {
        docid: docId, sheet_id: sheetId,
        fields: [
          { field_title: CATEGORY_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: JOIN_TIME_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: APPLY_TIME_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: ACTIVIST_TIME_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: CANDIDATE_TIME_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: PROBATION_TIME_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: CONVERT_TIME_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: REPORT_STATUS_FIELD, field_type: "FIELD_TYPE_TEXT" },
          { field_title: NOTE_FIELD, field_type: "FIELD_TYPE_TEXT" },
        ],
      });

      const nameField = await getNameField(docId, sheetId, deps);

      // 解析成员列表：姓名,类别
      const lines = input.members.split(/[,，\n]+/).map((s) => s.trim()).filter(Boolean);
      const memberEntries: Array<{ name: string; category: string }> = [];
      for (let i = 0; i < lines.length; i += 2) {
        if (lines[i + 1]) {
          memberEntries.push({ name: lines[i], category: lines[i + 1] });
        }
      }

      const records = memberEntries.map((m) => {
        const vals: Record<string, unknown> = {};
        vals[nameField] = [{ type: "text", text: m.name }];
        vals[CATEGORY_FIELD] = [{ type: "text", text: m.category }];
        vals[JOIN_TIME_FIELD] = [{ type: "text", text: m.category.includes("正式") || m.category.includes("支委") ? "已入党" : "" }];
        return { values: vals };
      });

      await deps.callTool("doc", "smartsheet_add_records", {
        docid: docId, sheet_id: sheetId, records,
      });

      const count = { 支委: 0, 正式党员: 0, 预备党员: 0, 积极分子: 0, 申请人: 0 } as Record<string, number>;
      for (const m of memberEntries) { count[m.category] = (count[m.category] || 0) + 1; }

      let msg = "人员档案已创建（" + docR.url + "）\n";
      for (const [cat, n] of Object.entries(count)) {
        if (n > 0) msg += cat + "：" + n + "人\n";
      }

      return { success: true, message: msg, sheetDocId: docId, sheetId };
    }

    // -------- add --------
    case "add": {
      if (!input.sheetDocId || !input.name || !input.category) throw new Error("member-tracker: add 需要 sheetDocId/name/category");
      const sheetId = input.sheetId || await getSheetId(input.sheetDocId, deps);
      const nameField = await getNameField(input.sheetDocId, sheetId, deps);

      const vals: Record<string, unknown> = {};
      vals[nameField] = [{ type: "text", text: input.name }];
      vals[CATEGORY_FIELD] = [{ type: "text", text: input.category }];

      await deps.callTool("doc", "smartsheet_add_records", {
        docid: input.sheetDocId, sheet_id: sheetId,
        records: [{ values: vals }],
      });

      return { success: true, message: "已添加：" + input.name + "（" + input.category + "）", sheetDocId: input.sheetDocId, sheetId };
    }

    // -------- update --------
    case "update": {
      if (!input.sheetDocId || !input.name || !input.field || input.value === undefined) {
        throw new Error("member-tracker: update 需要 sheetDocId/name/field/value");
      }
      const sheetId = input.sheetId || await getSheetId(input.sheetDocId, deps);
      const all = await getAllMembers(input.sheetDocId, sheetId, deps);
      const target = all.find((m) => m.name === input.name);
      if (!target) return { success: false, message: "未找到：" + input.name };

      const updateVals: Record<string, unknown> = {};
      updateVals[input.field] = [{ type: "text", text: input.value }];

      await deps.callTool("doc", "smartsheet_update_records", {
        docid: input.sheetDocId, sheet_id: sheetId,
        records: [{ record_id: target.recordId, values: updateVals }],
      });

      return {
        success: true,
        message: input.name + " " + input.field + " → " + input.value,
        sheetDocId: input.sheetDocId, sheetId,
      };
    }

    // -------- check --------
    case "check": {
      if (!input.sheetDocId) throw new Error("member-tracker: check 需要 sheetDocId");
      const sheetId = input.sheetId || await getSheetId(input.sheetDocId, deps);
      const all = await getAllMembers(input.sheetDocId, sheetId, deps);
      const reminders: string[] = [];
      const now = new Date();

      for (const m of all) {
        // 检查思想汇报（积极分子和预备党员每季度需提交）
        if ((m.category.includes("积极分子") || m.category.includes("预备")) && m.reportStatus.includes("待交")) {
          reminders.push("⚠️ " + m.name + "（" + m.category + "）思想汇报待提交");
        }

        // 检查预备党员转正（预备期满一年）
        if (m.probationTime && m.category.includes("预备")) {
          const probationDate = new Date(m.probationTime);
          const monthsSince = (now.getFullYear() - probationDate.getFullYear()) * 12 + (now.getMonth() - probationDate.getMonth());
          if (monthsSince >= 11 && !m.convertTime) {
            reminders.push("📅 " + m.name + " 预备期将满" + monthsSince + "个月，请准备转正事宜");
          }
        }

        // 检查确定积极分子（申请后6个月）
        if (m.applyTime && m.category.includes("申请人") && !m.activistTime) {
          const applyDate = new Date(m.applyTime);
          const monthsSince = (now.getFullYear() - applyDate.getFullYear()) * 12 + (now.getMonth() - applyDate.getMonth());
          if (monthsSince >= 6) {
            reminders.push("📅 " + m.name + " 申请已" + monthsSince + "个月，可讨论确定为积极分子");
          }
        }
      }

      if (reminders.length === 0) reminders.push("✅ 当前无待处理事项");

      return {
        success: true,
        message: reminders.join("\n"),
        sheetDocId: input.sheetDocId, sheetId,
        reminders,
      };
    }

    // -------- list --------
    case "list": {
      if (!input.sheetDocId) throw new Error("member-tracker: list 需要 sheetDocId");
      const sheetId = input.sheetId || await getSheetId(input.sheetDocId, deps);
      const all = await getAllMembers(input.sheetDocId, sheetId, deps);

      const byCategory: Record<string, string[]> = {};
      for (const m of all) {
        const cat = m.category || "未分类";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(m.name);
      }

      let msg = "📋 支部人员档案\n";
      for (const [cat, names] of Object.entries(byCategory)) {
        msg += "\n" + cat + "（" + names.length + "人）：" + names.join("、");
      }

      return { success: true, message: msg, sheetDocId: input.sheetDocId, sheetId };
    }

    default:
      throw new Error("member-tracker: 未知操作");
  }
}