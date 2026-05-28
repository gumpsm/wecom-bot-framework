// 集成测试：验证 contact API 返回格式 + 权限中间件核心逻辑
import dotenv from "dotenv";
import path from "path";
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import { PermissionMiddleware } from "../packages/core/src/permission-middleware";
import { PermissionConfig } from "../packages/core/src/types";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_PA_BOT_ID!;
var BOT_SECRET = process.env.WECOM_PA_BOT_SECRET!;

async function main() {
  console.log("=== 权限中间件集成测试 ===\n");

  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });

  // 1. 验证 contact API 返回格式
  console.log("1. contact.get_userlist 返回格式:");
  try {
    var users = await client.callTool("contact", "get_userlist", {}) as Record<string, unknown>;
    var userList = users.userlist || users.user_list || users.data;
    if (Array.isArray(userList) && userList.length > 0) {
      var first = userList[0] as Record<string, unknown>;
      console.log("   用户数: " + userList.length);
      console.log("   首用户字段: " + Object.keys(first).join(", "));
      console.log("   userid: " + first.userid);
      console.log("   tags 类型: " + typeof first.tags + " = " + JSON.stringify(first.tags).substring(0, 150));
      console.log("   position: " + first.position);
      console.log("   department 类型: " + typeof first.department + " = " + JSON.stringify(first.department).substring(0, 100));
      
      if (Array.isArray(first.tags) && first.tags.length > 0) {
        var tagSample = first.tags[0];
        console.log("   tag 样本: " + JSON.stringify(tagSample));
      }
    }
    console.log("   ✅ contact API 可用\n");
  } catch (e) {
    console.log("   ❌ contact API 失败: " + (e as Error).message + "\n");
    return;
  }

  // 2. 验证权限中间件角色匹配
  console.log("2. 权限中间件角色匹配:");

  // pa-bot 测试配置
  var testConfig: PermissionConfig = {
    roles: {
      "标签:党员": { skills: ["doc.get_doc_content"] },
    },
    defaultRole: { skills: [] },
    denyMessage: "测试拒绝",
  };

  var mw = new PermissionMiddleware(testConfig, client);

  // 查第一个用户的 userid 做测试
  var firstUserId = String((userList as any[])[0].userid || "");
  console.log("   测试用户: " + firstUserId);

  var r1 = await mw.check(firstUserId, "doc.get_doc_content");
  console.log("   检查 doc.get_doc_content: " + (r1.allowed ? "✅ 放行" : "❌ 拒绝"));

  var r2 = await mw.check(firstUserId, "todo.create_todo");
  console.log("   检查 todo.create_todo: " + (r2.allowed ? "✅ 放行" : "❌ 拒绝（预期）"));

  console.log("\n=== 集成测试完成 ===");
}

main().catch(function(e) { console.error(e); process.exit(1); });