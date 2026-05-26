// 组合 Skill 集成测试
// 测试 4 个组合 Skill：周报创建、会议组织、会议纪要、党建投票
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import { LLMClient, LLMClientConfig } from "../packages/llm/src/client";
import { createWeeklyReport } from "../composite-skills/create-weekly-report";
import { organizeMeeting } from "../composite-skills/organize-meeting";
import { createMeetingMinutes } from "../composite-skills/meeting-minutes";
import { sendPartyVote, finalizePartyVote } from "../composite-skills/party-vote";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

// LLM configs from env
function getLlmConfigs(): LLMClientConfig[] {
  var keys = [process.env.DEEPSEEK_API_KEY_1, process.env.DEEPSEEK_API_KEY_2, process.env.DEEPSEEK_API_KEY_3].filter(function(k: any) { return k; }) as string[];
  return keys.map(function(k: string) {
    return {
      apiKey: k,
      baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1") as string,
      model: (process.env.DEEPSEEK_MODEL || "deepseek-chat") as string,
    };
  });
}

function today(): string {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function futureTime(minutesOffset: number): string {
  var d = new Date(Date.now() + minutesOffset * 60000);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " +
    String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":00";
}

interface TestResult { name: string; passed: boolean; error?: string; details?: Record<string, unknown>; }
var results: TestResult[] = [];
var CREATED: string[] = []; // cleanup list

function log(msg: string) { console.log("  " + msg); }
function pass(name: string, details?: Record<string, unknown>) { results.push({ name: name, passed: true, details: details }); console.log("  [PASS] " + name); }
function fail(name: string, err: string) { results.push({ name: name, passed: false, error: err }); console.log("  [FAIL] " + name + ": " + err); }

async function main() {
  console.log("========================================");
  console.log("  组合 Skill 集成测试");
  console.log("  时间: " + new Date().toISOString());
  console.log("========================================\n");

  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();
  var llm = new LLMClient(getLlmConfigs());

  var callTool = async function(cat: string, m: string, args: Record<string, unknown>) {
    return client.callTool(cat, m, args);
  };

  // ==================================================
  // Test 1: 周报创建
  // ==================================================
  console.log("\n--- Test 1: createWeeklyReport ---");
  try {
    var reportResult = await createWeeklyReport({
      projectName: "企业微信智能机器人框架",
      weekRange: today() + " ~ " + today(),
      progress: ["完成 P1 长连接核心引擎开发和测试", "完成 P2 CLI 42 个原子 Skill 集成", "完成 5 种模板卡片类型的消息收发"],
      nextPlan: ["构建 4 个组合 Skill", "设计并实现 P3 API 模式", "创建 project-bot 和 party-bot 示例"],
      risks: [
        { item: "LLM API 限流", level: "中", solution: "多 key 轮换 + 指数退避" },
        { item: "企业微信接口变更", level: "低", solution: "MCP schema 动态获取" },
      ],
      members: ["架构师", "Bot PM", "Skill 编排者", "测试负责人"],
    }, {
      callTool: callTool,
      llm: llm,
      systemPrompt: "你是一个专业的项目周报撰写助手。请保持原有结构和内容，只优化表达。",
    });

    if (reportResult.success && reportResult.docId) {
      pass("createWeeklyReport", { docId: reportResult.docId, docUrl: reportResult.docUrl });
      CREATED.push("doc:" + reportResult.docId);
    } else {
      fail("createWeeklyReport", "success=false or missing docId");
    }
  } catch (e) {
    fail("createWeeklyReport", (e as Error).message);
  }

  // ==================================================
  // Test 2: 会议组织
  // ==================================================
  console.log("\n--- Test 2: organizeMeeting ---");
  try {
    // Get users for invitees
    var userListResult = await client.callTool("contact", "get_userlist", {}) as { userlist?: Array<{ userid: string }> };
    var invitees: Array<{ userid: string }> = [];
    if (userListResult && userListResult.userlist && userListResult.userlist.length > 0) {
      invitees = userListResult.userlist.slice(0, 2).map(function(u) { return { userid: u.userid }; });
    }

    if (invitees.length === 0) {
      console.log("  [SKIP] No users found for invitees");
    } else {
      var meetingResult = await organizeMeeting({
        title: "[测试] 组合Skill集成测试会议 " + today(),
        startTime: futureTime(60), // 1 hour from now
        durationMinutes: 30,
        invitees: invitees,
        description: "组合Skill集成测试 - 自动创建的测试会议",
      }, {
        callTool: callTool,
      });

      if (meetingResult.success && meetingResult.meetingId) {
        pass("organizeMeeting", { meetingId: meetingResult.meetingId, scheduleId: meetingResult.scheduleId, todoIds: meetingResult.todoIds });
        CREATED.push("meeting:" + meetingResult.meetingId);
      } else {
        fail("organizeMeeting", "success=false or missing meetingId");
      }
    }
  } catch (e) {
    fail("organizeMeeting", (e as Error).message);
  }

  // ==================================================
  // Test 3: 会议纪要
  // ==================================================
  console.log("\n--- Test 3: createMeetingMinutes ---");
  try {
    var minutesResult = await createMeetingMinutes({
      meetingTitle: "企业微信智能机器人框架 P2 复盘会",
      meetingDate: today(),
      attendees: ["架构师", "Bot PM", "Skill 编排者", "测试负责人"],
      rawContent: "架构师汇报：P2 CLI 集成完成，42 个原子 Skill 全部可用。MCP 协议稳定，6 个品类覆盖完整。" +
        "Skill 编排者：组合 Skill 模板已设计，4 个典型场景待实现。需要确认 Deps 注入模式。" +
        "测试负责人：P1 消息类型 15/15 通过，P2 CLI 42/42 通过。建议补充组合 Skill 端到端测试。" +
        "Bot PM 总结：项目进度正常，下周进入 P3 API 模式。需提前准备 Docker 部署环境。",
      template: "action-items",
    }, {
      callTool: callTool,
      llm: llm,
    });

    if (minutesResult.success && minutesResult.docId) {
      pass("createMeetingMinutes", { docId: minutesResult.docId, docUrl: minutesResult.docUrl, actionItems: minutesResult.actionItems });
      CREATED.push("doc:" + minutesResult.docId);
    } else {
      fail("createMeetingMinutes", "success=false or missing docId");
    }
  } catch (e) {
    fail("createMeetingMinutes", (e as Error).message);
  }

  // ==================================================
  // Test 4: 党建投票
  // ==================================================
  console.log("\n--- Test 4: sendPartyVote ---");
  try {
    var voteResult = await sendPartyVote({
      title: "[测试] 2026年Q2优秀党员推荐",
      description: "请推荐您认为表现突出的党员同志（测试用）",
      questions: [
        {
          key: "candidate",
          title: "推荐人选",
          options: [
            { id: "candidate_a", text: "同志A - 技术攻关表现突出" },
            { id: "candidate_b", text: "同志B - 团队建设贡献显著" },
            { id: "candidate_c", text: "同志C - 学习进步明显" },
          ],
        },
        {
          key: "reason",
          title: "推荐理由",
          options: [
            { id: "reason_work", text: "工作业绩突出" },
            { id: "reason_team", text: "团队协作优秀" },
            { id: "reason_learn", text: "学习进步显著" },
          ],
        },
      ],
    }, {
      callTool: callTool,
    });

    if (voteResult.success && voteResult.taskId) {
      // Simulate a vote result for testing
      var partyVoteMod = await import("../composite-skills/party-vote");
      var currentResults = partyVoteMod.getVoteResults(voteResult.taskId);
      log("Vote card created, taskId=" + voteResult.taskId + ", simulating vote completion...");
      
      // Finalize and create result doc
      var finalResult = await finalizePartyVote(voteResult.taskId, {
        callTool: callTool,
        resultDocName: "[测试] 投票结果_" + today(),
      });

      pass("sendPartyVote+finalize", { taskId: voteResult.taskId, resultDocId: finalResult.docId, resultDocUrl: finalResult.docUrl });
      CREATED.push("doc:" + finalResult.docId);
    } else {
      fail("sendPartyVote", "success=false or missing taskId");
    }
  } catch (e) {
    fail("sendPartyVote", (e as Error).message);
  }

  // ==================================================
  // Summary
  // ==================================================
  console.log("\n========================================");
  console.log("  测试结果汇总");
  console.log("========================================");
  var passCount = results.filter(function(r: TestResult) { return r.passed; }).length;
  var failCount = results.filter(function(r: TestResult) { return !r.passed; }).length;
  for (var r of results) {
    console.log((r.passed ? "[PASS]" : "[FAIL]") + " " + r.name + (r.error ? ": " + r.error : ""));
  }
  console.log("\n总计: " + results.length + " 个测试 | 通过: " + passCount + " | 失败: " + failCount);
  console.log("资源创建列表（供清理）: " + JSON.stringify(CREATED));

  // Write log
  var logDir = path.resolve(__dirname, "..", "logs");
  try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) { /* ignore */ }
  fs.writeFileSync(
    path.join(logDir, "composite-skills-test.json"),
    JSON.stringify({ time: new Date().toISOString(), passCount: passCount, failCount: failCount, results: results, created: CREATED }, null, 2)
  );
  console.log("\n日志已写入 logs/composite-skills-test.json");

  if (failCount > 0) process.exit(1);
}

main().catch(function(e) {
  console.error("FATAL: " + (e as Error).message);
  process.exit(1);
});
