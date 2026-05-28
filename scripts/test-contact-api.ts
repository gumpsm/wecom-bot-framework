import dotenv from "dotenv";
import path from "path";
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_PA_BOT_ID!;
var BOT_SECRET = process.env.WECOM_PA_BOT_SECRET!;

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });

  // 1. 获取 MCP 配置，列出所有品类
  var cats = await client.fetchMcpConfig();
  console.log("=== MCP 品类列表 ===");
  cats.forEach(function(url, cat) { console.log("  " + cat + " → " + url.substring(0, 50) + "..."); });
  console.log("");

  // 2. 列出 contact 品类的所有工具
  console.log("=== contact 品类工具列表 ===");
  try {
    var tools = await client.listTools("contact");
    tools.forEach(function(t: any) {
      console.log("  " + t.name + ": " + (t.description || "").substring(0, 80));
      if (t.inputSchema && t.inputSchema.properties) {
        console.log("    参数: " + Object.keys(t.inputSchema.properties).join(", "));
      }
    });
  } catch (e) {
    console.log("  错误: " + (e as Error).message);
  }
  console.log("");

  // 3. 详细查看用户信息
  console.log("=== contact.get_userlist 完整返回 ===");
  var users = await client.callTool("contact", "get_userlist", {}) as Record<string, unknown>;
  console.log("  顶层键: " + Object.keys(users).join(", "));
  var userList = users.userlist as any[] || [];
  console.log("  用户数: " + userList.length);
  if (userList.length > 0) {
    console.log("  首用户完整数据: " + JSON.stringify(userList[0], null, 2));
  }

  // 4. 尝试其他可能的 contact 工具
  console.log("\n=== 尝试获取用户详情 ===");
  var firstUserId = userList[0]?.userid || "";
  if (firstUserId) {
    // 尝试 contact 品类下所有工具
    var catTools = await client.listTools("contact");
    for (var t of catTools) {
      if (t.name === "get_userlist") continue;
      try {
        console.log("  尝试 " + t.name + "...");
        var r = await client.callTool("contact", t.name, { userid: firstUserId });
        console.log("   ✅ " + t.name + " 返回: " + JSON.stringify(r).substring(0, 300));
      } catch (e) {
        console.log("   ❌ " + t.name + " 失败: " + (e as Error).message);
      }
    }
  }

  console.log("\n=== 完成 ===");
}

main().catch(function(e) { console.error(e); process.exit(1); });