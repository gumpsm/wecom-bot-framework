// 查询 smartsheet 和 msg 工具的准确 schema
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

var MORE_TOOLS = [
  { cat: "doc", method: "create_doc" },
  { cat: "doc", method: "smartsheet_add_sheet" },
  { cat: "doc", method: "smartsheet_get_sheet" },
  { cat: "doc", method: "smartsheet_add_fields" },
  { cat: "doc", method: "smartsheet_get_fields" },
  { cat: "doc", method: "smartsheet_add_records" },
  { cat: "doc", method: "smartsheet_get_records" },
  { cat: "msg", method: "get_msg_chat_list" },
  { cat: "msg", method: "get_message" },
  { cat: "meeting", method: "list_user_meetings" },
  { cat: "meeting", method: "get_meeting_info" },
  { cat: "meeting", method: "set_invite_meeting_members" },
  { cat: "meeting", method: "cancel_meeting" },
  { cat: "schedule", method: "get_schedule_detail" },
  { cat: "schedule", method: "update_schedule" },
  { cat: "schedule", method: "cancel_schedule" },
];

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  for (var i = 0; i < MORE_TOOLS.length; i++) {
    var mt = MORE_TOOLS[i];
    var tools = await client.listTools(mt.cat);
    var tool = tools.find(function(t: any) { return t.name === mt.method; });
    if (tool) {
      var schema = tool.inputSchema as any;
      var props = schema.properties || {};
      console.log("=== " + mt.cat + "." + mt.method + " ===");
      console.log("required: " + JSON.stringify(schema.required || []));
      // Show key property details for complex types
      for (var k of Object.keys(props).slice(0, 10)) {
        var p = props[k];
        var extra = "";
        if (p.type === "object" && p.properties) extra = " → sub-keys: " + JSON.stringify(Object.keys(p.properties)).substring(0, 100);
        if (p.enum) extra = " → enum: " + JSON.stringify(p.enum);
        if (p.description) extra += " (" + (p.description as string).substring(0, 60) + ")";
        console.log("  " + k + ": " + p.type + extra);
      }
      console.log("");
    }
  }
}

main().catch(console.error);
