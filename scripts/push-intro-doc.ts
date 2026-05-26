import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

async function main() {
  var client = new WeComMcpClient({
    botId: process.env.WECOM_BOT_ID as string,
    botSecret: process.env.WECOM_BOT_SECRET as string,
  });
  await client.fetchMcpConfig();

  var content = fs.readFileSync(path.resolve(__dirname, "..", "logs", "_intro_doc.md"), "utf-8");
  var docName = "企业微信智能机器人框架 — 项目介绍 " + new Date().toISOString().split("T")[0];

  console.log("Creating doc: " + docName + " (" + content.length + " chars)");

  var result = await client.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  }) as Record<string, unknown>;

  var docId = result.docid as string;
  var docUrl = result.url as string;
  console.log("Doc created: " + docId);
  console.log("URL: " + docUrl);

  await client.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: content,
    docid: docId,
  });

  console.log("Content written successfully!");
  console.log("");
  console.log("=== SHARE THIS LINK ===");
  console.log(docUrl);
}

main().catch(function(e) {
  console.error("FAILED: " + (e as Error).message);
  process.exit(1);
});
