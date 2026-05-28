// project-init — 项目一键启动
// 创建人员表 + 项目计划表 + 项目配置文档 + 注册日报/周报定时任务

import { SkillDefinition } from "../packages/core/src/types";
import { LLMClient } from "./llm-deps";
import { initEnhancedScheduler, EnhancedCronTask } from "./cron-scheduler";
import { generateProjectReport } from "./project-report";
import { registerProject } from "./project-registry";

export var projectInitDefinition: SkillDefinition = {
  name: "project-init",
  description: "项目一键启动。创建项目人员表、项目计划表（智能表格）、项目配置文档，可选注册日报/周报定时任务。项目经理只需提供项目名和成员。",
  parameters: {
    type: "object",
    properties: {
      projectName: { type: "string", description: "项目全称，如 智慧园区二期" },
      projectCode: { type: "string", description: "项目代号，如 zhihui-p2，用于文件命名" },
      members: { type: "string", description: "成员列表，格式：部门-姓名,部门-姓名 或用企微 userid 逗号分隔" },
      dailyReportTime: { type: "string", description: "日报时间，如 18:00。不填则不启用日报定时" },
      weeklyReportDay: { type: "string", description: "周报时间，如 周五 17:00。不填则不启用周报定时" },
      meetingDay: { type: "string", description: "周例会时间，如 周三 15:00。不填则默认周三15:00" },
    },
    required: ["projectName", "projectCode"],
  },
};

// ====== 类型 ======

export interface ProjectInitInput {
  projectName: string;
  projectCode: string;
  members?: string;
  dailyReportTime?: string;
  weeklyReportDay?: string;
  meetingDay?: string;
}

export interface ProjectInitOutput {
  success: boolean;
  message: string;
  personnelDocId: string;
  planDocId: string;
  configDocId: string;
  cronTasks: string[];
}

export interface InitDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
}

// ====== 字段定义 ======

var PERSONNEL_FIELDS = [
  { field_title: "姓名", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "企业微信ID", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "部门", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "角色", field_type: "FIELD_TYPE_SINGLE_SELECT" },
  { field_title: "状态", field_type: "FIELD_TYPE_SINGLE_SELECT" },
  { field_title: "加入时间", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "离开时间", field_type: "FIELD_TYPE_TEXT" },
];

var PLAN_FIELDS = [
  { field_title: "ID", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "类型", field_type: "FIELD_TYPE_SINGLE_SELECT" },
  { field_title: "名称", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "负责人", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "优先级", field_type: "FIELD_TYPE_SINGLE_SELECT" },
  { field_title: "状态", field_type: "FIELD_TYPE_SINGLE_SELECT" },
  { field_title: "开始日期", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "截止日期", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "完成日期", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "关联ID", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "来源", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "备注", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "创建时间", field_type: "FIELD_TYPE_TEXT" },
  { field_title: "更新时间", field_type: "FIELD_TYPE_TEXT" },
];

// ====== 主函数 ======

export async function projectInit(
  input: ProjectInitInput,
  deps: InitDeps
): Promise<ProjectInitOutput> {
  var projectName = input.projectName;
  var projectCode = input.projectCode;
  var members = input.members || "";
  var dailyTime = input.dailyReportTime || "";
  var weeklyTime = input.weeklyReportDay || "";
  var meetingTime = input.meetingDay || "周三 15:00";

  var results: string[] = [];
  var cronTaskNames: string[] = [];

  // ========== 1. 创建项目人员表 ==========
  var personnelResult = await deps.callTool("doc", "create_doc", {
    doc_type: 10,  // 智能表格
    doc_name: projectCode + "_人员表",
  }) as Record<string, unknown>;
  var personnelDocId = personnelResult.docid as string;
  var personnelUrl = personnelResult.url as string;
  results.push("人员表: " + personnelUrl);

  // 获取默认 sheet
  var pSheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: personnelDocId }) as Record<string, unknown>;
  var pSheetList = (pSheet.sheet_list || []) as Array<Record<string, unknown>>;
  var pSheetId = pSheetList[0]?.sheet_id as string;

  // 重命名默认字段为 "姓名"
  var pFields = await deps.callTool("doc", "smartsheet_get_fields", { docid: personnelDocId, sheet_id: pSheetId }) as Record<string, unknown>;
  var pFieldList = (pFields.fields || []) as Array<Record<string, unknown>>;
  if (pFieldList.length > 0) {
    await deps.callTool("doc", "smartsheet_update_fields", {
      docid: personnelDocId,
      sheet_id: pSheetId,
      fields: [{ field_id: pFieldList[0].field_id, field_title: "姓名" }],
    }).catch(function(e: Error) { console.warn("[project-init] 人员表重命名: " + e.message); });
  }

  // 添加其余字段
  var remainingPersonnelFields = PERSONNEL_FIELDS.slice(1);
  await deps.callTool("doc", "smartsheet_add_fields", {
    docid: personnelDocId,
    sheet_id: pSheetId,
    fields: remainingPersonnelFields,
  }).catch(function(e: Error) { console.warn("[project-init] 人员表加字段: " + e.message); });

  // 如果传了成员，写入首条记录（项目经理自己）
  if (members) {
    var memberList = members.split(/[,，\s]+/).filter(function(s: string) { return s.trim(); });
    var records = memberList.map(function(m: string) {
      var parts = m.split("-");
      var name = parts.length > 1 ? parts[1] : m;
      var dept = parts.length > 1 ? parts[0] : "";
      return {
        values: {
          "姓名": [{ type: "text", text: name }],
          "部门": [{ type: "text", text: dept }],
          "企业微信ID": [{ type: "text", text: m }],
          "角色": [{ type: "text", text: memberList.indexOf(m) === 0 ? "项目经理" : "核心成员" }],
          "状态": [{ type: "text", text: "在项目中" }],
          "加入时间": [{ type: "text", text: new Date().toISOString().split("T")[0] }],
          "离开时间": [{ type: "text", text: "" }],
        },
      };
    });
    if (records.length > 0) {
      await deps.callTool("doc", "smartsheet_add_records", {
        docid: personnelDocId,
        sheet_id: pSheetId,
        records: records,
      }).catch(function(e: Error) { console.warn("[project-init] 人员表加记录: " + e.message); });
    }
  }

  // 重命名 sheet 为 "人员表"
  await deps.callTool("doc", "smartsheet_update_sheet", {
    docid: personnelDocId,
    sheet_id: pSheetId,
    title: "人员表",
  }).catch(function(e: Error) { console.warn("[project-init] 人员表改sheet名: " + e.message); });

  // ========== 2. 创建项目计划表 ==========
  var planResult = await deps.callTool("doc", "create_doc", {
    doc_type: 10,
    doc_name: projectCode + "_计划表",
  }) as Record<string, unknown>;
  var planDocId = planResult.docid as string;
  var planUrl = planResult.url as string;
  results.push("计划表: " + planUrl);

  var plSheet = await deps.callTool("doc", "smartsheet_get_sheet", { docid: planDocId }) as Record<string, unknown>;
  var plSheetList = (plSheet.sheet_list || []) as Array<Record<string, unknown>>;
  var plSheetId = plSheetList[0]?.sheet_id as string;

  // 重命名默认字段
  var plFields = await deps.callTool("doc", "smartsheet_get_fields", { docid: planDocId, sheet_id: plSheetId }) as Record<string, unknown>;
  var plFieldList = (plFields.fields || []) as Array<Record<string, unknown>>;
  if (plFieldList.length > 0) {
    await deps.callTool("doc", "smartsheet_update_fields", {
      docid: planDocId,
      sheet_id: plSheetId,
      fields: [{ field_id: plFieldList[0].field_id, field_title: "ID" }],
    }).catch(function(e: Error) { console.warn("[project-init] 计划表重命名: " + e.message); });
  }

  await deps.callTool("doc", "smartsheet_add_fields", {
    docid: planDocId,
    sheet_id: plSheetId,
    fields: PLAN_FIELDS.slice(1),
  }).catch(function(e: Error) { console.warn("[project-init] 计划表加字段: " + e.message); });

  await deps.callTool("doc", "smartsheet_update_sheet", {
    docid: planDocId,
    sheet_id: plSheetId,
    title: "计划表",
  }).catch(function(e: Error) { console.warn("[project-init] 计划表改sheet名: " + e.message); });

  // ========== 3. 创建项目配置文档 ==========
  var configContent = [
    "# " + projectName + " — 项目配置",
    "",
    "## 基本信息",
    "- 项目名称: " + projectName,
    "- 项目代号: " + projectCode,
    "- 创建时间: " + new Date().toLocaleString(),
    "- 人员表: " + personnelUrl + " (docid: " + personnelDocId + ")",
    "- 计划表: " + planUrl + " (docid: " + planDocId + ")",
  ];

  if (members) {
    configContent.push("- 成员: " + members);
  }

  configContent.push("");
  configContent.push("## 自动化设置");

  if (dailyTime) {
    configContent.push("- 日报: 每个工作日 " + dailyTime + " 自动生成");
  } else {
    configContent.push("- 日报: 未启用");
  }

  if (weeklyTime) {
    configContent.push("- 周报: 每" + weeklyTime + " 自动生成");
  } else {
    configContent.push("- 周报: 未启用");
  }

  configContent.push("- 周例会: 每" + meetingTime);
  configContent.push("");
  configContent.push("## 定时任务");
  configContent.push("以下任务由 cron-scheduler 管理，Bot 启动后自动注册。");
  configContent.push("");

  if (dailyTime) {
    configContent.push("- 日报生成: " + dailyTime + " 工作日 -> project-sync(daily)");
  }
  if (weeklyTime) {
    configContent.push("- 周报生成: " + weeklyTime + " -> project-sync(weekly)");
  }
  configContent.push("- 会前提醒: " + meetingTime + " 前15分钟 -> msg.send_message");

  var configResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: projectCode + "_项目配置",
  }) as Record<string, unknown>;
  var configDocId = configResult.docid as string;
  var configUrl = configResult.url as string;
  results.push("项目配置: " + configUrl);

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: configContent.join("\n"),
    docid: configDocId,
  }).catch(function(e: Error) { console.warn("[project-init] 配置写入: " + e.message); });

  // ========== 4. 注册定时任务 ==========
  // 使用 EnhancedCronTask，直接调用 generateProjectReport
  var enhancedTasks: EnhancedCronTask[] = [];
  var now = new Date();
  var todayStr = now.toISOString().split("T")[0];

  if (dailyTime) {
    enhancedTasks.push({
      name: "日报_" + projectCode,
      timeExpr: dailyTime + " 工作日",
      targetSkill: "project-report",
      skillArgs: { reportType: "daily", projectName: projectName, planDocId: planDocId, chatId: "" },
      enabled: true,
      timerId: null,
      execute: function(deps) {
        return generateProjectReport(deps, "daily", projectName, planDocId, "");
      },
    });
    cronTaskNames.push("日报(" + dailyTime + " 工作日)");
  }

  if (weeklyTime) {
    enhancedTasks.push({
      name: "周报_" + projectCode,
      timeExpr: weeklyTime,
      targetSkill: "project-report",
      skillArgs: { reportType: "weekly", projectName: projectName, planDocId: planDocId, chatId: "" },
      enabled: true,
      timerId: null,
      execute: function(deps) {
        return generateProjectReport(deps, "weekly", projectName, planDocId, "");
      },
    });
    cronTaskNames.push("周报(" + weeklyTime + ")");
  }

  // 会前提醒任务（一次性，在组织会议时由 meeting-reminder 注册）
  cronTaskNames.push("例会提醒(" + meetingTime + "，由 meeting-reminder 注册)");

  // 注册增强定时任务
  if (enhancedTasks.length > 0) {
    initEnhancedScheduler(
      { callTool: deps.callTool, llm: deps.llm },
      enhancedTasks
    );
    console.log("[project-init] 已注册 " + enhancedTasks.length + " 个增强定时任务");
  }

  return {
    success: true,
    message: results.join("\n"),
    personnelDocId: personnelDocId,
    planDocId: planDocId,
    configDocId: configDocId,
    cronTasks: cronTaskNames,
  };
}
