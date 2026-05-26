// Fix and re-test 5 failing tools with correct schemas
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

function today(): string { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function daysLater(n: number): string { var d = new Date(Date.now() + n * 86400000); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  // 1. schedule.update_schedule — needs attendees
  console.log("1. schedule.update_schedule (with attendees)...");
  var schedId = "";
  try {
    var sr = await client.callTool("schedule", "create_schedule", { schedule: { summary: "[fix-test]", start_time: daysLater(1) + " 15:00:00", end_time: daysLater(1) + " 16:00:00" } });
    schedId = sr.schedule_id || "";
    console.log("  created: " + schedId);
    await client.callTool("schedule", "update_schedule", { schedule: { schedule_id: schedId, summary: "[fix-test updated]", attendees: [{ userid: "ShiMeng" }] } });
    console.log("  ✅ schedule.update_schedule PASS");
    await client.callTool("schedule", "cancel_schedule", { schedule_id: schedId });
  } catch (e) { console.log("  ❌ FAIL: " + (e as Error).message); }

  // 2. schedule.check_availability — check_user_list is string array
  console.log("2. schedule.check_availability (string array)...");
  try {
    await client.callTool("schedule", "check_availability", { check_user_list: ["ShiMeng"], start_time: daysLater(1) + " 09:00:00", end_time: daysLater(1) + " 18:00:00" });
    console.log("  ✅ schedule.check_availability PASS");
  } catch (e) { console.log("  ❌ FAIL: " + (e as Error).message); }

  // 3. meeting.create_meeting — invitees is object {userid: string[]}
  console.log("3. meeting.create_meeting (invitees as object)...");
  var meetingId = "";
  try {
    var mr = await client.callTool("meeting", "create_meeting", { title: "[fix-test]", meeting_start_datetime: daysLater(2) + " 10:00", meeting_duration: 3600, invitees: { userid: ["ShiMeng"] } });
    meetingId = mr.meeting_id || mr.meetingid || "";
    console.log("  created: " + meetingId);
    console.log("  ✅ meeting.create_meeting PASS");
    await client.callTool("meeting", "cancel_meeting", { meetingid: meetingId });
  } catch (e) { console.log("  ❌ FAIL: " + (e as Error).message); }

  // 4. doc.get_doc_content — type=2 (Markdown format)
  console.log("4. doc.get_doc_content (type=2 Markdown)...");
  var docId = "";
  try {
    var dr = await client.callTool("doc", "create_doc", { doc_type: 3, doc_name: "[fix-test] " + today() });
    docId = dr.docid || "";
    console.log("  created doc: " + docId.substring(0, 20) + "...");
    var gc = await client.callTool("doc", "get_doc_content", { type: 2, docid: docId });
    console.log("  ✅ doc.get_doc_content PASS (task_id=" + (gc.task_id || "direct") + ")");
  } catch (e) { console.log("  ❌ FAIL: " + (e as Error).message); }

  // 5. doc.edit_doc_content — content_type=1 (Markdown)
  console.log("5. doc.edit_doc_content (content_type=1)...");
  if (docId) {
    try {
      await client.callTool("doc", "edit_doc_content", { content_type: 1, content: "# Fixed\n\nThis content was edited.", docid: docId });
      console.log("  ✅ doc.edit_doc_content PASS");
    } catch (e) { console.log("  ❌ FAIL: " + (e as Error).message); }
  } else { console.log("  ⏭️ no doc"); }

  console.log("\nDone.");
}

main().catch(console.error);
