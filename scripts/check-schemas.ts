// 查询失败工具的准确参数 schema
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

// Tools that failed — check their actual parameter schemas
var FAILED_TOOLS = [
  { cat: "todo", method: "get_todo_detail" },
  { cat: "todo", method: "update_todo" },
  { cat: "todo", method: "delete_todo" },
  { cat: "msg", method: "send_message" },
  { cat: "schedule", method: "create_schedule" },
  { cat: "schedule", method: "check_availability" },
  { cat: "meeting", method: "create_meeting" },
  { cat: "doc", method: "get_doc_content" },
  { cat: "doc", method: "edit_doc_content" },
];

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  for (var i = 0; i < FAILED_TOOLS.length; i++) {
    var ft = FAILED_TOOLS[i];
    var tools = await client.listTools(ft.cat);
    var tool = tools.find(function(t: any) { return t.name === ft.method; });
    if (tool) {
      console.log("=== " + ft.cat + "." + ft.method + " ===");
      console.log("required: " + JSON.stringify((tool.inputSchema as any).required || []));
      console.log("properties: " + JSON.stringify(Object.keys((tool.inputSchema as any).properties || {})));
      console.log("");
    } else {
      console.log("=== " + ft.cat + "." + ft.method + " === NOT FOUND");
    }
  }
}

main().catch(console.error);
