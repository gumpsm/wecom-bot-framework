import dotenv from "dotenv";
import path from "path";
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

async function main() {
  var client = new WeComMcpClient({
    botId: process.env.WECOM_BOT_ID as string,
    botSecret: process.env.WECOM_BOT_SECRET as string,
  });
  await client.fetchMcpConfig();
  var tools = await client.listTools("meeting");
  for (var t of tools) {
    if (t.name === "create_meeting") {
      console.log(JSON.stringify(t.inputSchema, null, 2));
    }
  }
}
main().catch(function(e) { console.error(e); process.exit(1); });
