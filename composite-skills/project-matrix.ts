// project-matrix — 多项目矩阵视图
// 跨项目待办汇总、人员负荷、里程碑对比

import { SkillDefinition } from "../packages/core/src/types";
import { listProjects, RegistryEntry } from "./project-registry";

export var projectMatrixDefinition: SkillDefinition = {
  name: "project-matrix",
  description: "多项目矩阵视图。跨项目汇总待办、查看人员负荷、对比里程碑进度。当用户提到所有项目、多项目、某某在忙什么时使用。",
  parameters: {
    type: "object",
    properties: {
      viewType: { type: "string", description: "视图类型: all-todos/person-workload/milestones/overview", enum: ["all-todos", "person-workload", "milestones", "overview"] },
      personFilter: { type: "string", description: "按人员筛选（person-workload 时使用）" },
    },
    required: ["viewType"],
  },
};

export interface MatrixDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
}

interface PlanRecord {
  recordId: string;
  id: string;
  type: string;
  name: string;
  person: string;
  project: string;
  priority: string;
  status: string;
  dueDate: string;
  doneDate: string;
}

async function fetchAllPlanData(deps: MatrixDeps, projects: RegistryEntry[]): Promise<PlanRecord[]> {
  var allRecords: PlanRecord[] = [];

  for (var p of projects) {
    if (p.status !== "active") continue;
    if (!p.planDocId) continue;

    try {
      var sheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: p.planDocId }) as Record<string, unknown>;
      var sheetList = (sheet.sheet_list || []) as Array<Record<string, unknown>>;
      var sheetId = sheetList[0]?.sheet_id as string;
      if (!sheetId) continue;

      var result = await deps.callTool("doc", "smartsheet_get_records", { docid: p.planDocId, sheet_id: sheetId }) as Record<string, unknown>;
      var records = (result.records || []) as Array<Record<string, unknown>>;

      for (var r of records) {
        var v = (r.values || {}) as Record<string, unknown>;
        allRecords.push({
          recordId: r.record_id as string,
          id: extractText(v["ID"]),
          type: extractText(v["类型"]),
          name: extractText(v["名称"]),
          person: extractText(v["负责人"]),
          project: p.projectName,
          priority: extractText(v["优先级"]),
          status: extractText(v["状态"]),
          dueDate: extractText(v["截止日期"]),
          doneDate: extractText(v["完成日期"]),
        });
      }
    } catch (e) {
      console.warn("[matrix] failed to fetch " + p.projectName + ": " + (e as Error).message);
    }
  }

  return allRecords;
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

export async function runProjectMatrix(
  input: { viewType: string; personFilter?: string },
  deps: MatrixDeps
): Promise<{ success: boolean; viewType: string; content: string; data: Record<string, unknown> }> {
  var projects = await listProjects(deps);
  var activeProjects = projects.filter(function(p) { return p.status === "active"; });

  if (activeProjects.length === 0) {
    return { success: true, viewType: input.viewType, content: "暂无活跃项目", data: {} };
  }

  var allData = await fetchAllPlanData(deps, activeProjects);
  var tasks = allData.filter(function(r) { return r.type === "任务"; });
  var milestones = allData.filter(function(r) { return r.type === "里程碑"; });
  var risks = allData.filter(function(r) { return r.type === "风险" || r.type === "问题"; });

  switch (input.viewType) {
    case "all-todos": {
      // 所有项目待办汇总
      var pending = tasks.filter(function(r) { return r.status !== "已完成" && r.status !== "已取消"; });
      var overdue = pending.filter(function(r) {
        return r.dueDate && r.dueDate < new Date().toISOString().split("T")[0];
      });

      // 按项目分组
      var byProject: Record<string, PlanRecord[]> = {};
      for (var t of pending) {
        if (!byProject[t.project]) byProject[t.project] = [];
        byProject[t.project].push(t);
      }

      var lines: string[] = [];
      lines.push("## 多项目待办总览");
      lines.push("");
      lines.push("活跃项目: " + activeProjects.length + " | 待办总数: " + pending.length + " | 超期: " + overdue.length);
      lines.push("");

      for (var projName of Object.keys(byProject)) {
        var items = byProject[projName];
        var oCount = items.filter(function(r) { return r.status === "已阻塞"; }).length;
        lines.push("### " + projName + " (" + items.length + "项" + (oCount > 0 ? " / " + oCount + "阻塞" : "") + ")");
        for (var r of items) {
          var tags: string[] = [];
          if (r.status === "已阻塞") tags.push("🔴");
          else if (r.dueDate && r.dueDate < new Date().toISOString().split("T")[0]) tags.push("⚠️超期");
          else tags.push("🟡");
          lines.push("- " + tags[0] + " " + r.name + " @" + r.person + (r.dueDate ? " 截止:" + r.dueDate : ""));
        }
        lines.push("");
      }

      return { success: true, viewType: "all-todos", content: lines.join("\n"), data: { pending: pending.length, overdue: overdue.length, projects: activeProjects.length } };
    }

    case "person-workload": {
      var person = input.personFilter || "";
      // 按人员汇总
      var byPerson: Record<string, { tasks: PlanRecord[]; projects: Set<string> }> = {};
      for (var t of tasks) {
        if (!t.person) continue;
        if (person && !t.person.includes(person)) continue;
        if (!byPerson[t.person]) byPerson[t.person] = { tasks: [], projects: new Set() };
        byPerson[t.person].tasks.push(t);
        byPerson[t.person].projects.add(t.project);
      }

      var pLines: string[] = [];
      pLines.push(person ? "## " + person + " 的工作负荷" : "## 团队工作负荷");
      pLines.push("");

      for (var pName of Object.keys(byPerson)) {
        var info = byPerson[pName];
        var active = info.tasks.filter(function(r) { return r.status !== "已完成" && r.status !== "已取消"; });
        pLines.push("- **" + pName + "**: " + active.length + "项进行中 跨" + info.projects.size + "个项目");
        for (var t of active) {
          var statusTag = t.status === "已阻塞" ? "🔴" : "🟡";
          pLines.push("  - " + statusTag + " " + t.name + " [" + t.project + "]" + (t.dueDate ? " 截止:" + t.dueDate : ""));
        }
      }

      return { success: true, viewType: "person-workload", content: pLines.join("\n"), data: { personCount: Object.keys(byPerson).length } };
    }

    case "milestones": {
      var mLines: string[] = [];
      mLines.push("## 里程碑总览");
      mLines.push("");

      var byProj: Record<string, PlanRecord[]> = {};
      for (var m of milestones) {
        if (!byProj[m.project]) byProj[m.project] = [];
        byProj[m.project].push(m);
      }

      for (var pn of Object.keys(byProj)) {
        var ms = byProj[pn];
        mLines.push("### " + pn);
        for (var m of ms) {
          var tag = m.status === "已完成" ? "✅" : m.status === "进行中" ? "🟡" : "⬜";
          mLines.push("- " + tag + " " + m.name + (m.dueDate ? " 目标:" + m.dueDate : ""));
        }
        mLines.push("");
      }

      return { success: true, viewType: "milestones", content: mLines.join("\n"), data: { totalMilestones: milestones.length } };
    }

    case "overview":
    default: {
      var oLines: string[] = [];
      oLines.push("## 项目总览");
      oLines.push("");

      for (var p of activeProjects) {
        var pTasks = tasks.filter(function(r) { return r.project === p.projectName; });
        var completed = pTasks.filter(function(r) { return r.status === "已完成"; }).length;
        var blocked = pTasks.filter(function(r) { return r.status === "已阻塞"; }).length;
        var total = pTasks.length;
        var pMilestones = milestones.filter(function(r) { return r.project === p.projectName; });
        var msDone = pMilestones.filter(function(r) { return r.status === "已完成"; }).length;
        var pRisks = risks.filter(function(r) { return r.project === p.projectName && (r.status === "跟踪中" || r.status === "解决中"); });

        var rate = total > 0 ? Math.round(completed / total * 100) : 0;
        var bar = "█".repeat(Math.round(rate / 10)) + "░".repeat(10 - Math.round(rate / 10));

        oLines.push("### " + p.projectName);
        oLines.push("- 进度: " + bar + " " + rate + "% (" + completed + "/" + total + ")");
        oLines.push("- 里程碑: " + msDone + "/" + pMilestones.length);
        if (blocked > 0) oLines.push("- ⚠️ 阻塞: " + blocked + "项");
        if (pRisks.length > 0) oLines.push("- 🔴 风险: " + pRisks.length + "项");
        oLines.push("");
      }

      return { success: true, viewType: "overview", content: oLines.join("\n"), data: { totalProjects: activeProjects.length } };
    }
  }
}
