// P2 原子 Skill 全部测试 v2 — 使用 tools/list 获取的准确参数名
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;
var LOG_FILE = path.resolve(__dirname, "..", "logs", "p2-skill-test-v2.log");
var results: string[] = [];
var passCount = 0, failCount = 0, skipCount = 0;

function log(msg: string) { var ts = new Date().toISOString().substring(11, 23); var l = "[" + ts + "] " + msg; console.log(l); results.push(l); fs.appendFileSync(LOG_FILE, l + "\n", "utf-8"); }
function pass(name: string) { passCount++; log("  ✅ " + name); }
function fail(name: string, err: string) { failCount++; log("  ❌ " + name + " — " + err.substring(0, 150)); }
function skip(name: string, r: string) { skipCount++; log("  ⏭️ " + name + " — " + r); }

function today(): string { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function daysAgo(n: number): string { var d = new Date(Date.now() - n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function daysLater(n: number): string { var d = new Date(Date.now() + n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function sleep(ms: number): Promise<void> { return new Promise(function(r) { setTimeout(r, ms); }); }

async function call(client: WeComMcpClient, cat: string, method: string, args: Record<string, unknown>): Promise<any> {
  return client.callTool(cat, method, args);
}

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  log("=== P2 原子 Skill 全部测试 v2（正确参数） ===");
  log("");

  // ========================================================
  // CONTACT
  // ========================================================
  log("━ CONTACT ━");
  try { await call(client, "contact", "get_userlist", {}); pass("contact.get_userlist"); } catch (e) { fail("contact.get_userlist", (e as Error).message); }
  await sleep(200);

  // ========================================================
  // TODO — CRUD cycle with correct param names
  // ========================================================
  log("━ TODO ━");
  var todoId = "";

  // get_todo_list
  try { await call(client, "todo", "get_todo_list", {}); pass("todo.get_todo_list"); } catch (e) { fail("todo.get_todo_list", (e as Error).message); }
  await sleep(200);

  // create_todo
  try {
    var cr = await call(client, "todo", "create_todo", { content: "[P2] skill test " + new Date().toISOString().substring(11, 19), remind_time: daysLater(1) + " 09:00:00" });
    todoId = cr.todo_id || cr.todoid || "";
    if (todoId) pass("todo.create_todo → " + todoId); else fail("todo.create_todo", "no todo_id: " + JSON.stringify(cr).substring(0, 100));
  } catch (e) { fail("todo.create_todo", (e as Error).message); }
  await sleep(200);

  // get_todo_detail (note: todo_id_list, not todoid_list)
  if (todoId) {
    try { await call(client, "todo", "get_todo_detail", { todo_id_list: [todoId] }); pass("todo.get_todo_detail"); } catch (e) { fail("todo.get_todo_detail", (e as Error).message); }
    await sleep(200);
  } else { skip("todo.get_todo_detail", "no todo created"); }

  // update_todo (note: todo_id, not todoid)
  if (todoId) {
    try { await call(client, "todo", "update_todo", { todo_id: todoId, content: "[P2 updated] " + new Date().toISOString().substring(11, 19) }); pass("todo.update_todo"); } catch (e) { fail("todo.update_todo", (e as Error).message); }
    await sleep(200);
  } else { skip("todo.update_todo", "no todo created"); }

  // delete_todo (note: todo_id, not todoid)
  if (todoId) {
    try { await call(client, "todo", "delete_todo", { todo_id: todoId }); pass("todo.delete_todo"); } catch (e) { fail("todo.delete_todo", (e as Error).message); }
    await sleep(200);
  } else { skip("todo.delete_todo", "no todo created"); }

  // change_todo_user_status: skip
  skip("todo.change_todo_user_status", "needs assigned user");

  // ========================================================
  // MSG
  // ========================================================
  log("━ MSG ━");

  // get_msg_chat_list (begin_time must be ≤7 days ago)
  try { await call(client, "msg", "get_msg_chat_list", { begin_time: daysAgo(5) + " 00:00:00", end_time: today() + " 23:59:59" }); pass("msg.get_msg_chat_list"); } catch (e) { fail("msg.get_msg_chat_list", (e as Error).message); }
  await sleep(200);

  // send_message (correct: chat_type=int, chatid, msgtype, text={content})
  try {
    await call(client, "msg", "send_message", { chat_type: 1, chatid: "ShiMeng", msgtype: "text", text: { content: "[P2] skill test message " + new Date().toISOString().substring(11, 19) } });
    pass("msg.send_message");
  } catch (e) { fail("msg.send_message", (e as Error).message); }
  await sleep(200);

  // get_message: needs chat_id from chat_list — use "ShiMeng" single chat
  try {
    var gm = await call(client, "msg", "get_message", { chat_type: 1, chatid: "ShiMeng", begin_time: daysAgo(1) + " 00:00:00", end_time: today() + " 23:59:59" });
    pass("msg.get_message");
  } catch (e) { fail("msg.get_message", (e as Error).message); }
  await sleep(200);

  // get_msg_media: skip (needs file_id)
  skip("msg.get_msg_media", "needs file_id from get_message");

  // ========================================================
  // SCHEDULE — CRUD cycle
  // ========================================================
  log("━ SCHEDULE ━");
  var schedId = "";

  // get_schedule_list_by_range
  try { await call(client, "schedule", "get_schedule_list_by_range", { start_time: daysAgo(7) + " 00:00:00", end_time: today() + " 23:59:59" }); pass("schedule.get_schedule_list_by_range"); } catch (e) { fail("schedule.get_schedule_list_by_range", (e as Error).message); }
  await sleep(300);

  // create_schedule (nested schedule object)
  try {
    var sr = await call(client, "schedule", "create_schedule", {
      schedule: {
        summary: "[P2] skill test schedule",
        start_time: daysLater(1) + " 10:00:00",
        end_time: daysLater(1) + " 11:00:00",
        description: "P2 automated test",
      },
    });
    schedId = sr.schedule_id || sr.id || "";
    if (schedId) pass("schedule.create_schedule → " + schedId); else fail("schedule.create_schedule", "no schedule_id: " + JSON.stringify(sr).substring(0, 100));
  } catch (e) { fail("schedule.create_schedule", (e as Error).message); }
  await sleep(300);

  // get_schedule_detail (schedule_id_list array)
  if (schedId) {
    try { await call(client, "schedule", "get_schedule_detail", { schedule_id_list: [schedId] }); pass("schedule.get_schedule_detail"); } catch (e) { fail("schedule.get_schedule_detail", (e as Error).message); }
    await sleep(200);
  } else { skip("schedule.get_schedule_detail", "no schedule"); }

  // update_schedule (nested schedule with schedule_id)
  if (schedId) {
    try { await call(client, "schedule", "update_schedule", { schedule: { schedule_id: schedId, summary: "[P2 updated] skill test schedule" } }); pass("schedule.update_schedule"); } catch (e) { fail("schedule.update_schedule", (e as Error).message); }
    await sleep(200);
  } else { skip("schedule.update_schedule", "no schedule"); }

  // cancel_schedule (schedule_id string)
  if (schedId) {
    try { await call(client, "schedule", "cancel_schedule", { schedule_id: schedId }); pass("schedule.cancel_schedule"); } catch (e) { fail("schedule.cancel_schedule", (e as Error).message); }
    await sleep(200);
  } else { skip("schedule.cancel_schedule", "no schedule"); }

  // check_availability (check_user_list not userid_list)
  try {
    await call(client, "schedule", "check_availability", { check_user_list: [{ userid: "ShiMeng" }], start_time: daysLater(1) + " 09:00:00", end_time: daysLater(1) + " 18:00:00" });
    pass("schedule.check_availability");
  } catch (e) { fail("schedule.check_availability", (e as Error).message); }
  await sleep(200);

  // add/del_schedule_attendees: skip
  skip("schedule.add_schedule_attendees", "needs schedule");
  skip("schedule.del_schedule_attendees", "needs schedule");

  // ========================================================
  // MEETING — CRUD cycle
  // ========================================================
  log("━ MEETING ━");
  var meetingId = "";

  // list_user_meetings (begin_datetime/end_datetime, not start_time/end_time)
  try { await call(client, "meeting", "list_user_meetings", { begin_datetime: daysAgo(7) + " 00:00", end_datetime: today() + " 23:59" }); pass("meeting.list_user_meetings"); } catch (e) { fail("meeting.list_user_meetings", (e as Error).message); }
  await sleep(300);

  // create_meeting (title, meeting_start_datetime, meeting_duration, invitees)
  try {
    var mr = await call(client, "meeting", "create_meeting", {
      title: "[P2] skill test meeting",
      meeting_start_datetime: daysLater(2) + " 14:00:00",
      meeting_duration: 60,
      invitees: [{ userid: "ShiMeng" }],
    });
    meetingId = mr.meeting_id || mr.meetingid || mr.id || "";
    if (meetingId) pass("meeting.create_meeting → " + meetingId); else fail("meeting.create_meeting", "no meeting_id: " + JSON.stringify(mr).substring(0, 100));
  } catch (e) { fail("meeting.create_meeting", (e as Error).message); }
  await sleep(300);

  // get_meeting_info (meetingid)
  if (meetingId) {
    try { await call(client, "meeting", "get_meeting_info", { meetingid: meetingId }); pass("meeting.get_meeting_info"); } catch (e) { fail("meeting.get_meeting_info", (e as Error).message); }
    await sleep(200);
  } else { skip("meeting.get_meeting_info", "no meeting"); }

  // set_invite_meeting_members (meetingid, invitees)
  if (meetingId) {
    try { await call(client, "meeting", "set_invite_meeting_members", { meetingid: meetingId, invitees: [{ userid: "ShiMeng" }] }); pass("meeting.set_invite_meeting_members"); } catch (e) { fail("meeting.set_invite_meeting_members", (e as Error).message); }
    await sleep(200);
  } else { skip("meeting.set_invite_meeting_members", "no meeting"); }

  // cancel_meeting (meetingid)
  if (meetingId) {
    try { await call(client, "meeting", "cancel_meeting", { meetingid: meetingId }); pass("meeting.cancel_meeting"); } catch (e) { fail("meeting.cancel_meeting", (e as Error).message); }
    await sleep(200);
  } else { skip("meeting.cancel_meeting", "no meeting"); }

  // ========================================================
  // DOC — CRUD + Smartsheet cycle
  // ========================================================
  log("━ DOC ━");
  var docId = "";
  var ssDocId = "";
  var sheetId = "";

  // create_doc (doc_type=3 document)
  try {
    var dr = await call(client, "doc", "create_doc", { doc_type: 3, doc_name: "[P2] skill test doc " + today() });
    docId = dr.docid || dr.doc_id || "";
    if (docId) pass("doc.create_doc → " + docId.substring(0, 20) + "..."); else fail("doc.create_doc", "no docid");
  } catch (e) { fail("doc.create_doc", (e as Error).message); }
  await sleep(500);

  // get_doc_content (needs type param)
  if (docId) {
    try { await call(client, "doc", "get_doc_content", { type: 3, docid: docId }); pass("doc.get_doc_content"); } catch (e) { fail("doc.get_doc_content", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.get_doc_content", "no doc"); }

  // edit_doc_content (needs content_type)
  if (docId) {
    try { await call(client, "doc", "edit_doc_content", { content_type: "markdown", content: "# P2 Test\n\nAutomated skill test content.", docid: docId }); pass("doc.edit_doc_content"); } catch (e) { fail("doc.edit_doc_content", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.edit_doc_content", "no doc"); }

  // create smartpage — skip
  skip("doc.smartpage_create", "separate entity");
  skip("doc.smartpage_export_task", "needs smartpage");
  skip("doc.smartpage_get_export_result", "needs export task");

  // create smartsheet doc (doc_type=10)
  try {
    var ssr = await call(client, "doc", "create_doc", { doc_type: 10, doc_name: "[P2] smartsheet test " + today() });
    ssDocId = ssr.docid || ssr.doc_id || "";
    if (ssDocId) pass("doc.create_doc(smartsheet) → " + ssDocId.substring(0, 20) + "..."); else fail("doc.create_doc(smartsheet)", "no docid");
  } catch (e) { fail("doc.create_doc(smartsheet)", (e as Error).message); }
  await sleep(500);

  // smartsheet_get_sheet
  if (ssDocId) {
    try {
      var shr = await call(client, "doc", "smartsheet_get_sheet", { docid: ssDocId });
      var sheets: any[] = shr.sheet_list || shr.sheets || [];
      if (sheets.length > 0) sheetId = sheets[0].sheet_id || sheets[0].id || "";
      pass("doc.smartsheet_get_sheet (" + sheets.length + " sheets, id=" + sheetId + ")");
    } catch (e) { fail("doc.smartsheet_get_sheet", (e as Error).message); }
    await sleep(300);
  } else { skip("doc.smartsheet_get_sheet", "no ss doc"); }

  // smartsheet_get_fields (sheet_id required)
  if (sheetId) {
    try { await call(client, "doc", "smartsheet_get_fields", { sheet_id: sheetId, docid: ssDocId }); pass("doc.smartsheet_get_fields"); } catch (e) { fail("doc.smartsheet_get_fields", (e as Error).message); }
    await sleep(300);
  } else { skip("doc.smartsheet_get_fields", "no sheet"); }

  // smartsheet_add_fields (field_title + field_type)
  if (sheetId) {
    try {
      await call(client, "doc", "smartsheet_add_fields", { sheet_id: sheetId, docid: ssDocId, fields: [{ field_title: "[P2] TextCol", field_type: "FIELD_TYPE_TEXT" }] });
      pass("doc.smartsheet_add_fields");
    } catch (e) { fail("doc.smartsheet_add_fields", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.smartsheet_add_fields", "no sheet"); }

  // smartsheet_add_records
  if (sheetId) {
    try {
      await call(client, "doc", "smartsheet_add_records", { sheet_id: sheetId, docid: ssDocId, records: [{ values: { "[P2] TextCol": [{ type: "text", text: "test record" }] } }] });
      pass("doc.smartsheet_add_records");
    } catch (e) { fail("doc.smartsheet_add_records", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.smartsheet_add_records", "no sheet"); }

  // smartsheet_get_records (sheet_id required)
  if (sheetId) {
    try { await call(client, "doc", "smartsheet_get_records", { sheet_id: sheetId, docid: ssDocId }); pass("doc.smartsheet_get_records"); } catch (e) { fail("doc.smartsheet_get_records", (e as Error).message); }
    await sleep(300);
  } else { skip("doc.smartsheet_get_records", "no sheet"); }

  // smartsheet_add_sheet (properties.title)
  if (ssDocId) {
    try { await call(client, "doc", "smartsheet_add_sheet", { docid: ssDocId, properties: { title: "[P2] New Sheet" } }); pass("doc.smartsheet_add_sheet"); } catch (e) { fail("doc.smartsheet_add_sheet", (e as Error).message); }
    await sleep(500);
  } else { skip("doc.smartsheet_add_sheet", "no ss doc"); }

  // Remaining destructive skips
  skip("doc.smartsheet_update_fields", "needs field ids");
  skip("doc.smartsheet_delete_fields", "destructive");
  skip("doc.smartsheet_update_records", "needs record ids");
  skip("doc.smartsheet_delete_records", "destructive");
  skip("doc.smartsheet_update_sheet", "needs sheet_id");
  skip("doc.smartsheet_delete_sheet", "destructive");

  // ========================================================
  // SUMMARY
  // ========================================================
  var total = passCount + failCount + skipCount;
  log("");
  log("=".repeat(50));
  log("  ✅ PASS:  " + passCount);
  log("  ❌ FAIL:  " + failCount);
  log("  ⏭️ SKIP: " + skipCount + " (需要前置条件/破坏性操作)");
  log("  TOTAL:   " + total);
  log("=".repeat(50));
}

main().catch(function(e) { console.error(e); process.exit(1); });
