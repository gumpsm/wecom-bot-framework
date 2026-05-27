// 生产环境典型场景演示 — 创建真实资源供用户验证，不做自动清理
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

function today(): string { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function daysLater(n: number): string { var d = new Date(Date.now() + n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

var CREATED: string[] = []; // track all created resources

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();
  var ts = today();

  console.log("═══════════════════════════════════════════");
  console.log("  企业微信智能机器人 — 生产环境场景演示");
  console.log("  日期: " + ts);
  console.log("═══════════════════════════════════════════\n");

  // ================================================================
  // 场景 1: 创建文档 + 写入内容
  // ================================================================
  console.log("【场景 1】创建文档并写入内容");
  var docUrl = "";
  try {
    var d1 = await client.callTool("doc", "create_doc", { doc_type: 3, doc_name: "[P2演示] 项目周报模板 " + ts }) as any;
    var docId = d1.docid || "";
    docUrl = d1.url || "";
    console.log("  docid: " + docId);
    console.log("  url:   " + docUrl);

    await client.callTool("doc", "edit_doc_content", {
      content_type: 1,
      content: [
        "# 项目周报",
        "",
        "## 本周进展",
        "- 完成企业微信长连接核心引擎开发",
        "- 实现 5 种模板卡片类型的消息回复与推送",
        "- 完成 MCP CLI 全部 6 品类 42 工具集成",
        "",
        "## 下周计划",
        "- 完成 API 模式兼容开发",
        "- 实现组合 Skill 编排引擎",
        "- 部署测试环境验证",
        "",
        "## 风险与问题",
        "| 风险 | 等级 | 应对 |",
        "|------|------|------|",
        "| LLM API 限流 | 中 | 多 key 轮换 + 退避 |",
        "| 企业微信接口变更 | 低 | MCP schema 动态获取 |",
        "",
        "> 生成时间: " + new Date().toLocaleString(),
      ].join("\n"),
      docid: docId,
    });
    console.log("  ✅ 文档已创建并写入内容");
    CREATED.push("doc:" + docId);
  } catch (e) { console.log("  ❌ 失败: " + (e as Error).message); }

  // ================================================================
  // 场景 2: 创建智能表格 + 添加字段和记录
  // ================================================================
  console.log("\n【场景 2】创建智能表格并录入数据");
  try {
    var d2 = await client.callTool("doc", "create_doc", { doc_type: 10, doc_name: "[P2演示] 任务看板 " + ts }) as any;
    var ssId = d2.docid || "";
    var ssUrl = d2.url || "";
    console.log("  docid: " + ssId);
    console.log("  url:   " + ssUrl);

    // Get sheet
    var sh = await client.callTool("doc", "smartsheet_get_sheet", { docid: ssId }) as any;
    var sheetId = (sh.sheet_list || [])[0]?.sheet_id || "";

    // Add fields
    await client.callTool("doc", "smartsheet_add_fields", {
      sheet_id: sheetId, docid: ssId,
      fields: [
        { field_title: "任务名称", field_type: "FIELD_TYPE_TEXT" },
        { field_title: "负责人", field_type: "FIELD_TYPE_TEXT" },
        { field_title: "状态", field_type: "FIELD_TYPE_SINGLE_SELECT" },
        { field_title: "优先级", field_type: "FIELD_TYPE_SINGLE_SELECT" },
        { field_title: "截止日期", field_type: "FIELD_TYPE_DATE_TIME" },
      ],
    });
    console.log("  已添加 5 个字段");

    // Add records
    await client.callTool("doc", "smartsheet_add_records", {
      sheet_id: sheetId, docid: ssId,
      records: [
        { values: { "任务名称": [{ type: "text", text: "完成长连接核心引擎" }], "负责人": [{ type: "text", text: "师蒙" }], "状态": [{ type: "text", text: "已完成" }], "优先级": [{ type: "text", text: "P0" }] } },
        { values: { "任务名称": [{ type: "text", text: "实现模板卡片消息" }], "负责人": [{ type: "text", text: "师蒙" }], "状态": [{ type: "text", text: "已完成" }], "优先级": [{ type: "text", text: "P0" }] } },
        { values: { "任务名称": [{ type: "text", text: "集成 CLI MCP" }], "负责人": [{ type: "text", text: "师蒙" }], "状态": [{ type: "text", text: "已完成" }], "优先级": [{ type: "text", text: "P1" }] } },
        { values: { "任务名称": [{ type: "text", text: "API 模式开发" }], "负责人": [{ type: "text", text: "待分配" }], "状态": [{ type: "text", text: "待开始" }], "优先级": [{ type: "text", text: "P1" }] } },
        { values: { "任务名称": [{ type: "text", text: "组合 Skill 引擎" }], "负责人": [{ type: "text", text: "待分配" }], "状态": [{ type: "text", text: "待开始" }], "优先级": [{ type: "text", text: "P2" }] } },
      ],
    });
    console.log("  已录入 5 条任务记录");
    console.log("  ✅ 智能表格已创建并填充数据");
    CREATED.push("smartsheet:" + ssId);
  } catch (e) { console.log("  ❌ 失败: " + (e as Error).message); }

  // ================================================================
  // 场景 3: 创建会议
  // ================================================================
  console.log("\n【场景 3】创建预约会议");
  try {
    var m1 = await client.callTool("meeting", "create_meeting", {
      title: "[P2演示] 项目周会 — 第22周",
      meeting_start_datetime: daysLater(2) + " 10:00",
      meeting_duration: 3600,
      invitees: { userid: ["ShiMeng"] },
      description: "本周议题：\n1. P2 CLI 集成回顾\n2. P3 API 模式方案讨论\n3. 部署方案评审",
      location: "线上 — 企业微信会议",
    }) as any;
    var mtgId = m1.meeting_id || m1.meetingid || "";
    console.log("  会议ID: " + mtgId);
    console.log("  时间:   " + daysLater(2) + " 10:00-11:00");
    console.log("  时长:   60 分钟");
    console.log("  ✅ 会议已创建（2天后）");
    CREATED.push("meeting:" + mtgId);
  } catch (e) { console.log("  ❌ 失败: " + (e as Error).message); }

  // ================================================================
  // 场景 4: 创建日程
  // ================================================================
  console.log("\n【场景 4】创建日程");
  try {
    var s1 = await client.callTool("schedule", "create_schedule", {
      schedule: {
        summary: "[P2演示] 代码审查 — P2 交付物",
        start_time: daysLater(1) + " 14:00:00",
        end_time: daysLater(1) + " 15:30:00",
        description: "审查范围：\n- ws-provider.ts\n- mcp-client.ts\n- mcp-skill-provider.ts\n- event-router.ts",
      },
    }) as any;
    var schedId = s1.schedule_id || "";
    console.log("  日程ID: " + schedId);
    console.log("  时间:   " + daysLater(1) + " 14:00-15:30");
    console.log("  ✅ 日程已创建（明天下午）");
    CREATED.push("schedule:" + schedId);
  } catch (e) { console.log("  ❌ 失败: " + (e as Error).message); }

  // ================================================================
  // 场景 5: 创建待办
  // ================================================================
  console.log("\n【场景 5】创建待办");
  try {
    var t1 = await client.callTool("todo", "create_todo", {
      content: "[P2演示] 完成 DESIGN.md 更新",
      remind_time: daysLater(1) + " 09:00:00",
    }) as any;
    var todoId = t1.todo_id || "";
    console.log("  待办ID: " + todoId);
    console.log("  内容:   完成 DESIGN.md 更新");
    console.log("  提醒:   " + daysLater(1) + " 09:00");
    console.log("  ✅ 待办已创建");
    CREATED.push("todo:" + todoId);

    var t2 = await client.callTool("todo", "create_todo", {
      content: "[P2演示] 准备 P3 API 模式技术方案",
      remind_time: daysLater(2) + " 10:00:00",
    }) as any;
    console.log("  ✅ 第二个待办已创建: " + (t2.todo_id || ""));
    CREATED.push("todo:" + (t2.todo_id || ""));
  } catch (e) { console.log("  ❌ 失败: " + (e as Error).message); }

  // ================================================================
  // 场景 6: 发送通知消息
  // ================================================================
  console.log("\n【场景 6】发送文本通知");
  try {
    await client.callTool("msg", "send_message", {
      chat_type: 1, chatid: "ShiMeng", msgtype: "text",
      text: { content: "[P2演示] 以下资源已创建，请在企业微信中查看：\n📄 文档：项目周报模板\n📊 智能表格：任务看板\n📅 会议：第22周项目周会\n📆 日程：代码审查\n✅ 待办：2项\n\n请验证后通知机器人清理。" },
    });
    console.log("  ✅ 通知消息已发送");
  } catch (e) { console.log("  ❌ 失败: " + (e as Error).message); }

  // ================================================================
  // Summary
  // ================================================================
  console.log("\n═══════════════════════════════════════════");
  console.log("  已创建资源清单（供清理用）:");
  for (var r of CREATED) console.log("    " + r);
  console.log("═══════════════════════════════════════════");
  console.log("\n请在企业微信中验证以上资源。");
  console.log("确认无误后发送 \"cleanup\" 通知机器人清理。");

  // Save cleanup list
  fs.writeFileSync(path.resolve(__dirname, "..", "logs", "cleanup-list.json"), JSON.stringify(CREATED, null, 2), "utf-8");
}

main().catch(console.error);
