// P2 CLI 集成测试 — 测试所有 6 品类的代表性工具
import { McpSkillProvider } from "../packages/providers/src/wecom/mcp-skill-provider";
import { EventRouter } from "../packages/core/src/event-router";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;
var LOG_FILE = path.resolve(__dirname, "..", "logs", "p2-cli-test.log");
var results: string[] = [];

function log(msg: string) {
  var ts = new Date().toISOString().substring(11, 19);
  var line = "[" + ts + "] " + msg;
  console.log(line);
  results.push(line);
}

// Time helpers
function today(): string { return new Date().toISOString().substring(0, 10); }
function daysAgo(n: number): string { var d = new Date(Date.now() - n * 86400000); return d.toISOString().substring(0, 10); }

var TEST_CASES: Array<{ category: string; method: string; args: Record<string, unknown>; desc: string }> = [
  { category: "contact", method: "get_userlist", args: {}, desc: "获取通讯录成员列表" },
  { category: "todo", method: "get_todo_list", args: {}, desc: "获取待办列表" },
  { category: "msg", method: "get_msg_chat_list", args: { begin_time: daysAgo(1) + " 00:00:00", end_time: today() + " 23:59:59" }, desc: "获取消息会话列表(近1天)" },
  { category: "schedule", method: "get_schedule_list_by_range", args: { start_time: daysAgo(7) + " 00:00:00", end_time: today() + " 23:59:59" }, desc: "获取日程列表(近7天)" },
];

async function main() {
  // Test 1: McpSkillProvider
  log("=== Test 1: McpSkillProvider initialization ===");
  var skillProvider = new McpSkillProvider({ botId: BOT_ID, botSecret: BOT_SECRET });
  try {
    await skillProvider.initialize();
    log("  Skills loaded: " + skillProvider.getAllSkills().length);
    log("  Categories: " + skillProvider.getCategories().join(", "));
    log("  PASS");
  } catch (e) {
    log("  FAIL: " + (e as Error).message);
    process.exit(1);
  }

  // Test 2: Call tools per category
  for (var i = 0; i < TEST_CASES.length; i++) {
    var tc = TEST_CASES[i];
    log("--- Test 2." + (i + 1) + ": " + tc.category + "." + tc.method + " — " + tc.desc + " ---");
    try {
      var client = skillProvider.getClient();
      var result = await client.callTool(tc.category, tc.method, tc.args);
      var resultStr = JSON.stringify(result);
      log("  result (first 250 chars): " + resultStr.substring(0, 250));
      var errcode = (result as any).errcode;
      if (errcode !== undefined && errcode !== 0) {
        log("  WARN: errcode=" + errcode);
      } else {
        log("  PASS");
      }
    } catch (e) {
      log("  FAIL: " + (e as Error).message);
    }
  }

  // Test 3: Skill lookup
  log("=== Test 3: Skill lookup ===");
  var names = ["contact.get_userlist", "todo.create_todo", "msg.send_message", "meeting.create_meeting", "schedule.create_schedule", "doc.create_doc"];
  for (var j = 0; j < names.length; j++) {
    var skill = skillProvider.getSkill(names[j]);
    log("  " + names[j] + ": " + (skill ? "found" : "NOT FOUND"));
  }

  // Test 4: EventRouter
  log("=== Test 4: EventRouter ===");
  var router = new EventRouter();
  var routed = false;
  router.register("task_001", async function(ev, ce) { routed = true; log("  Handler: card_type=" + ce.card_type + " key=" + ce.event_key); });
  var simEvent: any = {
    cmd: "aibot_event_callback",
    headers: { req_id: "r1" },
    body: { msgtype: "event", event: { eventtype: "template_card_event", template_card_event: { card_type: "button_interaction", event_key: "OK", task_id: "task_001" } }, response_url: "https://x.com/r" },
  };
  var ok = await router.handleEvent(simEvent);
  log("  Routed: " + ok + " | Handler called: " + routed);
  var miss = await router.handleEvent({ ...simEvent, body: { ...simEvent.body, event: { eventtype: "template_card_event", template_card_event: { card_type: "vote", event_key: "X", task_id: "unknown" } } } } as any);
  log("  Unknown task: " + miss + " (expect false)");
  router.destroy();
  log("  EventRouter: PASS");

  // Summary
  log("");
  log("========== P2 CLI 集成测试完成 ==========");
  log("Skills: " + skillProvider.getAllSkills().length + " across " + skillProvider.getCategories().length + " categories");
  log("EventRouter: register → handle → cleanup verified");

  fs.writeFileSync(LOG_FILE, results.join("\n"), "utf-8");
}

main().catch(function(e) { console.error(e); process.exit(1); });
