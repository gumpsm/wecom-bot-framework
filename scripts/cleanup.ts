// 清理演示场景创建的所有资源
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

async function main() {
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();

  var list = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "logs", "cleanup-list.json"), "utf-8")) as string[];
  console.log("清理 " + list.length + " 项资源...\n");

  for (var item of list) {
    var parts = item.split(":");
    var type = parts[0];
    var id = parts.slice(1).join(":");

    try {
      if (type === "meeting") {
        await client.callTool("meeting", "cancel_meeting", { meetingid: id });
        console.log("  ✅ 会议已取消: " + id.substring(0, 20) + "...");
      } else if (type === "schedule") {
        await client.callTool("schedule", "cancel_schedule", { schedule_id: id });
        console.log("  ✅ 日程已取消: " + id.substring(0, 20) + "...");
      } else if (type === "todo") {
        await client.callTool("todo", "delete_todo", { todo_id: id });
        console.log("  ✅ 待办已删除: " + id);
      } else if (type === "doc" || type === "smartsheet") {
        // 文档/表格没有删除 API，跳过
        console.log("  ⏭️ " + type + " 无删除API，需手动删除: " + id.substring(0, 20) + "...");
      }
    } catch (e) {
      console.log("  ❌ " + type + " " + id.substring(0, 20) + "... 失败: " + (e as Error).message);
    }
  }

  console.log("\n✅ 会议/日程/待办已清理完毕。");
  console.log("📄 文档和智能表格需在企业微信中手动删除（MCP 无删除 API）。");
}

main().catch(console.error);
