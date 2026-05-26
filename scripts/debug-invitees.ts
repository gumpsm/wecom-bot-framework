import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  // Check schema
  var tools = await client.listTools("meeting");
  var tool = tools.find(function(t: any) { return t.name === "set_invite_meeting_members"; }) as any;
  console.log("Schema:");
  console.log(JSON.stringify(tool.inputSchema, null, 2));

  // Try different invitees formats
  console.log("\n--- Test 1: { userid: [] } ---");
  try { await client.callTool("meeting", "set_invite_meeting_members", { meetingid: "test", invitees: { userid: ["ShiMeng"] } }); } catch(e) { console.log((e as Error).message.substring(0, 200)); }

  console.log("\n--- Test 2: direct array ---");
  try { await client.callTool("meeting", "set_invite_meeting_members", { meetingid: "test", invitees: ["ShiMeng"] }); } catch(e) { console.log((e as Error).message.substring(0, 200)); }

  console.log("\n--- Test 3: { members: [] } ---");
  try { await client.callTool("meeting", "set_invite_meeting_members", { meetingid: "test", invitees: { members: [{ userid: "ShiMeng" }] } }); } catch(e) { console.log((e as Error).message.substring(0, 200)); }
}
main().catch(console.error);
