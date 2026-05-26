import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

var FAILING = [
  { cat: "schedule", method: "update_schedule" },
  { cat: "schedule", method: "check_availability" },
  { cat: "meeting", method: "create_meeting" },
  { cat: "doc", method: "get_doc_content" },
  { cat: "doc", method: "edit_doc_content" },
];

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  for (var f of FAILING) {
    var tools = await client.listTools(f.cat);
    var tool = tools.find(function(t: any) { return t.name === f.method; }) as any;
    if (!tool) { console.log(f.method + " NOT FOUND"); continue; }
    console.log("=== " + f.cat + "." + f.method + " ===");
    var s = tool.inputSchema;
    console.log("required: " + JSON.stringify(s.required));
    for (var k of Object.keys(s.properties || {})) {
      var p = s.properties[k];
      var extra = "";
      if (p.type === "object" && p.properties) {
        extra = " → sub: " + JSON.stringify(Object.keys(p.properties));
        // Show sub-properties too
        for (var sk of Object.keys(p.properties)) {
          var sp = p.properties[sk];
          extra += "\n      ." + sk + ": " + sp.type + (sp.items ? "(items:" + JSON.stringify(sp.items).substring(0, 60) + ")" : "") + (sp.description ? " — " + sp.description.substring(0, 60) : "");
        }
      }
      if (p.enum) extra = " → enum: " + JSON.stringify(p.enum);
      if (p.items) extra += " → items: " + JSON.stringify(p.items).substring(0, 100);
      if (p.description) extra += " — " + p.description.substring(0, 80);
      console.log("  " + k + ": " + p.type + extra);
    }
    console.log("");
  }
}
main().catch(console.error);
