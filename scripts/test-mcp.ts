// MCP client connectivity test
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });

  console.log("=== Fetching MCP config ===");
  try {
    var categories = await client.fetchMcpConfig();
    console.log("Categories found: " + categories.size);
    for (var entry of categories.entries()) {
      console.log("  " + entry[0] + " → " + entry[1].substring(0, 60) + "...");
    }
  } catch (e) {
    console.error("MCP config FAILED: " + (e as Error).message);
    process.exit(1);
  }

  console.log("\n=== Listing tools per category ===");
  var catNames = Array.from(categories.keys());
  var totalTools = 0;
  for (var i = 0; i < catNames.length; i++) {
    var cat = catNames[i];
    try {
      var tools = await client.listTools(cat);
      console.log("\n--- " + cat + " (" + tools.length + " tools) ---");
      for (var j = 0; j < tools.length; j++) {
        var t = tools[j];
        console.log("  " + t.name + ": " + (t.description || "(no desc)").substring(0, 80));
        totalTools++;
      }
    } catch (e) {
      console.log("  FAILED: " + (e as Error).message);
    }
  }
  console.log("\n=== Total tools: " + totalTools + " ===");
}

main().catch(function(e) { console.error(e); process.exit(1); });
