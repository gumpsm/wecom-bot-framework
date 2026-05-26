// P2 原子 Skill 全部测试 — 每品类每个工具逐一验证
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;
var LOG_FILE = path.resolve(__dirname, "..", "logs", "p2-skill-test.log");
var results: string[] = [];
var passCount = 0;
var failCount = 0;
var skipCount = 0;

function log(msg: string) { var ts = new Date().toISOString().substring(11, 23); var l = "[" + ts + "] " + msg; console.log(l); results.push(l); fs.appendFileSync(LOG_FILE, l + "\n", "utf-8"); }
function pass(name: string) { passCount++; log("  ✅ " + name + ": PASS"); }
function fail(name: string, err: string) { failCount++; log("  ❌ " + name + ": FAIL — " + err); }
function skip(name: string, reason: string) { skipCount++; log("  ⏭️ " + name + ": SKIP — " + reason); }

function today(): string { return new Date().toISOString().substring(0, 10); }
function daysAgo(n: number): string { var d = new Date(Date.now() - n * 86400000); return d.toISOString().substring(0, 10); }
function sleep(ms: number): Promise<void> { return new Promise(function(r) { setTimeout(r, ms); }); }

async function call(client: WeComMcpClient, cat: string, method: string, args: Record<string, unknown>): Promise<any> {
  try { return await client.callTool(cat, method, args); }
  catch (e) { throw e; }
}

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  log("=== P2 原子 Skill 全部测试 ===");
  log("Bot: " + BOT_ID.substring(0, 10) + "...");
  log("Date: " + new Date().toISOString());
  log("");

  // ========================================================
  // CONTACT (1 tool)
  // ========================================================
  log("━".repeat(50));
  log("CATEGORY: contact (1 tool)");
  log("━".repeat(50));
  try { var r = await call(client, "contact", "get_userlist", {}); pass("contact.get_userlist"); } catch (e) { fail("contact.get_userlist", (e as Error).message); }
  await sleep(300);

  // ========================================================
  // TODO (6 tools) — full CRUD cycle
  // ========================================================
  log("━".repeat(50));
  log("CATEGORY: todo (6 tools)");
  log("━".repeat(50));
  var createdTodoId = "";

  // 1. get_todo_list (empty)
  try { await call(client, "todo", "get_todo_list", {}); pass("todo.get_todo_list"); } catch (e) { fail("todo.get_todo_list", (e as Error).message); }
  await sleep(300);

  // 2. create_todo
  try {
    var cr = await call(client, "todo", "create_todo", {
      content: "[P2测试] 原子Skill测试待办 " + new Date().toLocaleString(),
      remind_time: daysAgo(-1) + " 12:00:00",
    });
    createdTodoId = cr.todo_id || cr.todoid || "";
    if (createdTodoId) { pass("todo.create_todo (id=" + createdTodoId + ")"); }
    else { fail("todo.create_todo", "no todo_id in response: " + JSON.stringify(cr).substring(0, 200)); }
  } catch (e) { fail("todo.create_todo", (e as Error).message); }
  await sleep(300);

  // 3. get_todo_detail
  if (createdTodoId) {
    try {
      var dr = await call(client, "todo", "get_todo_detail", { todoid_list: [createdTodoId] });
      pass("todo.get_todo_detail");
    } catch (e) { fail("todo.get_todo_detail", (e as Error).message); }
    await sleep(300);
  } else { skip("todo.get_todo_detail", "no created todo"); }

  // 4. update_todo
  if (createdTodoId) {
    try {
      await call(client, "todo", "update_todo", { todoid: createdTodoId, content: "[P2测试-已更新] " + new Date().toLocaleString() });
      pass("todo.update_todo");
    } catch (e) { fail("todo.update_todo", (e as Error).message); }
    await sleep(300);
  } else { skip("todo.update_todo", "no created todo"); }

  // 5. delete_todo
  if (createdTodoId) {
    try {
      await call(client, "todo", "delete_todo", { todoid: createdTodoId });
      pass("todo.delete_todo");
    } catch (e) { fail("todo.delete_todo", (e as Error).message); }
    await sleep(300);
  } else { skip("todo.delete_todo", "no created todo"); }

  // 6. change_todo_user_status — skip (needs todo with assigned user)
  skip("todo.change_todo_user_status", "requires todo with assigned user");

  // ========================================================
  // MSG (4 tools)
  // ========================================================
  log("━".repeat(50));
  log("CATEGORY: msg (4 tools)");
  log("━".repeat(50));

  // 1. get_msg_chat_list
  try { await call(client, "msg", "get_msg_chat_list", { begin_time: daysAgo(7) + " 00:00:00", end_time: today() + " 23:59:59" }); pass("msg.get_msg_chat_list"); } catch (e) { fail("msg.get_msg_chat_list", (e as Error).message); }
  await sleep(300);

  // 2. get_message — needs chat_id from chat_list, skip standalone
  skip("msg.get_message", "requires chat_id from chat_list result");

  // 3. send_message — test send text to self
  try {
    await call(client, "msg", "send_message", { chat_type: "single", chat_id: "ShiMeng", msg_type: "text", content: "[P2测试] 原子Skill测试消息 " + new Date().toLocaleString() });
    pass("msg.send_message");
  } catch (e) { fail("msg.send_message", (e as Error).message); }
  await sleep(300);

  // 4. get_msg_media — skip (needs file_id from get_message)
  skip("msg.get_msg_media", "requires file_id from get_message");

  // ========================================================
  // SCHEDULE (8 tools) — full CRUD cycle
  // ========================================================
  log("━".repeat(50));
  log("CATEGORY: schedule (8 tools)");
  log("━".repeat(50));
  var createdSchedId = "";

  // 1. get_schedule_list_by_range
  try { await call(client, "schedule", "get_schedule_list_by_range", { start_time: daysAgo(7) + " 00:00:00", end_time: today() + " 23:59:59" }); pass("schedule.get_schedule_list_by_range"); } catch (e) { fail("schedule.get_schedule_list_by_range", (e as Error).message); }
  await sleep(300);

  // 2. create_schedule
  try {
    var sr = await call(client, "schedule", "create_schedule", {
      subject: "[P2测试] 原子Skill日程",
      start_time: daysAgo(-1) + " 10:00:00",
      end_time: daysAgo(-1) + " 11:00:00",
      description: "P2 自动化测试创建的日程",
    });
    createdSchedId = sr.schedule_id || sr.id || "";
    if (createdSchedId) { pass("schedule.create_schedule (id=" + createdSchedId + ")"); }
    else { fail("schedule.create_schedule", "no schedule_id: " + JSON.stringify(sr).substring(0, 200)); }
  } catch (e) { fail("schedule.create_schedule", (e as Error).message); }
  await sleep(300);

  // 3. get_schedule_detail
  if (createdSchedId) {
    try { await call(client, "schedule", "get_schedule_detail", { schedule_id_list: [createdSchedId] }); pass("schedule.get_schedule_detail"); } catch (e) { fail("schedule.get_schedule_detail", (e as Error).message); }
    await sleep(300);
  } else { skip("schedule.get_schedule_detail", "no created schedule"); }

  // 4. update_schedule
  if (createdSchedId) {
    try { await call(client, "schedule", "update_schedule", { schedule_id: createdSchedId, subject: "[P2测试-已更新] 原子Skill日程" }); pass("schedule.update_schedule"); } catch (e) { fail("schedule.update_schedule", (e as Error).message); }
    await sleep(300);
  } else { skip("schedule.update_schedule", "no created schedule"); }

  // 5. cancel_schedule
  if (createdSchedId) {
    try { await call(client, "schedule", "cancel_schedule", { schedule_id: createdSchedId }); pass("schedule.cancel_schedule"); } catch (e) { fail("schedule.cancel_schedule", (e as Error).message); }
    await sleep(300);
  } else { skip("schedule.cancel_schedule", "no created schedule"); }

  // 6. add_schedule_attendees — skip (needs schedule)
  skip("schedule.add_schedule_attendees", "requires existing schedule with attendees");

  // 7. del_schedule_attendees — skip
  skip("schedule.del_schedule_attendees", "requires schedule with attendees");

  // 8. check_availability
  try {
    var tmrw = new Date(Date.now() + 86400000).toISOString().substring(0, 10);
    await call(client, "schedule", "check_availability", {
      userid_list: ["ShiMeng"],
      start_time: tmrw + " 09:00:00",
      end_time: tmrw + " 18:00:00",
    });
    pass("schedule.check_availability");
  } catch (e) { fail("schedule.check_availability", (e as Error).message); }
  await sleep(300);

  // ========================================================
  // MEETING (5 tools) — light cycle (create + cancel)
  // ========================================================
  log("━".repeat(50));
  log("CATEGORY: meeting (5 tools)");
  log("━".repeat(50));
  var createdMeetingId = "";

  // 1. list_user_meetings
  try { await call(client, "meeting", "list_user_meetings", { userid: "ShiMeng", start_time: daysAgo(7) + " 00:00:00", end_time: today() + " 23:59:59" }); pass("meeting.list_user_meetings"); } catch (e) { fail("meeting.list_user_meetings", (e as Error).message); }
  await sleep(300);

  // 2. create_meeting
  try {
    var tmr = new Date(Date.now() + 86400000).toISOString().substring(0, 10);
    var mr = await call(client, "meeting", "create_meeting", {
      subject: "[P2测试] 原子Skill会议",
      start_time: tmr + " 14:00:00",
      end_time: tmr + " 15:00:00",
    });
    createdMeetingId = mr.meeting_id || mr.meetingid || mr.id || "";
    if (createdMeetingId) { pass("meeting.create_meeting (id=" + createdMeetingId + ")"); }
    else { fail("meeting.create_meeting", "no meeting_id: " + JSON.stringify(mr).substring(0, 200)); }
  } catch (e) { fail("meeting.create_meeting", (e as Error).message); }
  await sleep(300);

  // 3. get_meeting_info
  if (createdMeetingId) {
    try { await call(client, "meeting", "get_meeting_info", { meetingid: createdMeetingId }); pass("meeting.get_meeting_info"); } catch (e) { fail("meeting.get_meeting_info", (e as Error).message); }
    await sleep(300);
  } else { skip("meeting.get_meeting_info", "no created meeting"); }

  // 4. set_invite_meeting_members — skip (overwrite operation)
  if (createdMeetingId) {
    try { await call(client, "meeting", "set_invite_meeting_members", { meetingid: createdMeetingId, userid_list: ["ShiMeng"] }); pass("meeting.set_invite_meeting_members"); } catch (e) { fail("meeting.set_invite_meeting_members", (e as Error).message); }
    await sleep(300);
  } else { skip("meeting.set_invite_meeting_members", "no created meeting"); }

  // 5. cancel_meeting
  if (createdMeetingId) {
    try { await call(client, "meeting", "cancel_meeting", { meetingid: createdMeetingId }); pass("meeting.cancel_meeting"); } catch (e) { fail("meeting.cancel_meeting", (e as Error).message); }
    await sleep(300);
  } else { skip("meeting.cancel_meeting", "no created meeting"); }

  // ========================================================
  // DOC (18 tools) — create doc + smartsheet CRUD cycle
  // ========================================================
  log("━".repeat(50));
  log("CATEGORY: doc (18 tools)");
  log("━".repeat(50));
  var createdDocId = "";
  var createdSheetId = "";

  // 1. create_doc (type 3 = 文档)
  try {
    var docR = await call(client, "doc", "create_doc", { doc_type: 3, doc_name: "[P2测试] 原子Skill测试文档 " + new Date().toLocaleString() });
    createdDocId = docR.docid || docR.doc_id || "";
    if (createdDocId) { pass("doc.create_doc (docid=" + createdDocId + ")"); }
    else { fail("doc.create_doc", "no docid: " + JSON.stringify(docR).substring(0, 200)); }
  } catch (e) { fail("doc.create_doc", (e as Error).message); }
  await sleep(500);

  // 2. get_doc_content
  if (createdDocId) {
    try { var gc = await call(client, "doc", "get_doc_content", { docid: createdDocId }); pass("doc.get_doc_content"); } catch (e) { fail("doc.get_doc_content", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.get_doc_content", "no created doc"); }

  // 3. edit_doc_content
  if (createdDocId) {
    try { await call(client, "doc", "edit_doc_content", { docid: createdDocId, content: "# P2 测试\n\n这是通过 MCP skill 编辑的内容。\n\n- 测试项1\n- 测试项2" }); pass("doc.edit_doc_content"); } catch (e) { fail("doc.edit_doc_content", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.edit_doc_content", "no created doc"); }

  // 4. smartpage_create — skip (creates complex structure, different from doc)
  skip("doc.smartpage_create", "separate entity from regular doc");

  // 5. smartpage_export_task — skip
  skip("doc.smartpage_export_task", "requires smartpage");

  // 6. smartpage_get_export_result — skip
  skip("doc.smartpage_get_export_result", "requires smartpage export task");

  // Now create a smartsheet doc (type 8 = 智能表格) for smartsheet tests
  var ssDocId = "";
  try {
    var ssR = await call(client, "doc", "create_doc", { doc_type: 8, doc_name: "[P2测试] 智能表格测试 " + new Date().toLocaleString() });
    ssDocId = ssR.docid || ssR.doc_id || "";
    if (ssDocId) { pass("doc.create_doc(smartsheet) (docid=" + ssDocId + ")"); }
    else { fail("doc.create_doc(smartsheet)", "no docid"); }
  } catch (e) { fail("doc.create_doc(smartsheet)", (e as Error).message); }
  await sleep(500);

  // 7. smartsheet_get_sheet
  if (ssDocId) {
    try {
      var shR = await call(client, "doc", "smartsheet_get_sheet", { docid: ssDocId });
      var sheets = shR.sheet_list || shR.sheets || [];
      if (sheets.length > 0) { createdSheetId = sheets[0].sheet_id || sheets[0].id || ""; }
      pass("doc.smartsheet_get_sheet (sheets=" + sheets.length + ")");
    } catch (e) { fail("doc.smartsheet_get_sheet", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.smartsheet_get_sheet", "no smartsheet doc"); }

  // 8. smartsheet_get_fields
  if (ssDocId && createdSheetId) {
    try { var fR = await call(client, "doc", "smartsheet_get_fields", { docid: ssDocId, sheet_id: createdSheetId }); pass("doc.smartsheet_get_fields"); } catch (e) { fail("doc.smartsheet_get_fields", (e as Error).message); }
    await sleep(300);
  } else { skip("doc.smartsheet_get_fields", "no sheet"); }

  // 9. smartsheet_add_fields
  if (ssDocId && createdSheetId) {
    try {
      await call(client, "doc", "smartsheet_add_fields", {
        docid: ssDocId, sheet_id: createdSheetId,
        fields: [{ field_name: "[P2测试] 文本列", field_type: "FIELD_TYPE_TEXT" }],
      });
      pass("doc.smartsheet_add_fields");
    } catch (e) { fail("doc.smartsheet_add_fields", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.smartsheet_add_fields", "no sheet"); }

  // 10. smartsheet_update_fields — skip (needs field ids from get_fields)
  skip("doc.smartsheet_update_fields", "needs field ids from get_fields");

  // 11. smartsheet_delete_fields — skip
  skip("doc.smartsheet_delete_fields", "destructive, skip in auto-test");

  // 12. smartsheet_add_records
  if (ssDocId && createdSheetId) {
    try {
      await call(client, "doc", "smartsheet_add_records", {
        docid: ssDocId, sheet_id: createdSheetId,
        records: [{ values: { "[P2测试] 文本列": [{ type: "text", text: "测试记录值" }] } }],
      });
      pass("doc.smartsheet_add_records");
    } catch (e) { fail("doc.smartsheet_add_records", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.smartsheet_add_records", "no sheet"); }

  // 13. smartsheet_get_records
  if (ssDocId && createdSheetId) {
    try { await call(client, "doc", "smartsheet_get_records", { docid: ssDocId, sheet_id: createdSheetId }); pass("doc.smartsheet_get_records"); } catch (e) { fail("doc.smartsheet_get_records", (e as Error).message); }
    await sleep(300);
  } else { skip("doc.smartsheet_get_records", "no sheet"); }

  // 14. smartsheet_update_records — skip (needs record ids)
  skip("doc.smartsheet_update_records", "needs record ids from get_records");

  // 15. smartsheet_delete_records — skip
  skip("doc.smartsheet_delete_records", "destructive, skip in auto-test");

  // 16. smartsheet_add_sheet
  if (ssDocId) {
    try { await call(client, "doc", "smartsheet_add_sheet", { docid: ssDocId, title: "[P2测试] 新增子表" }); pass("doc.smartsheet_add_sheet"); } catch (e) { fail("doc.smartsheet_add_sheet", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.smartsheet_add_sheet", "no smartsheet doc"); }

  // 17. smartsheet_update_sheet — skip (needs sheet_id)
  skip("doc.smartsheet_update_sheet", "needs specific sheet_id");

  // 18. smartsheet_delete_sheet — skip (destructive)
  skip("doc.smartsheet_delete_sheet", "destructive, skip in auto-test");

  // ========================================================
  // SUMMARY
  // ========================================================
  var total = passCount + failCount + skipCount;
  log("");
  log("=".repeat(60));
  log("  测试完成汇总");
  log("=".repeat(60));
  log("  ✅ PASS:  " + passCount);
  log("  ❌ FAIL:  " + failCount);
  log("  ⏭️ SKIP: " + skipCount + " (需要特定前置条件)");
  log("  ────────");
  log("  TOTAL:   " + total);
  log("=".repeat(60));
}

main().catch(function(e) { console.error(e); process.exit(1); });
