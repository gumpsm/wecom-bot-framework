// 模板卡片类型补充测试 — button_interaction, vote_interaction, multiple_interaction
import { WeComWsProvider } from "../packages/providers/src/wecom/ws-provider";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;
var ICON_URL = "https://wework.qpic.cn/wwpic/252813_jOfDHtcISzuodLa_1629280209/0";
var LOG_FILE = path.resolve(__dirname, "..", "logs", "card-test-result.log");
var results: string[] = [];

function log(msg: string) {
  var ts = new Date().toISOString().substring(11, 19);
  var line = "[" + ts + "] " + msg;
  console.log(line);
  results.push(line);
}

function genTaskId(prefix: string): string {
  return prefix + "_" + Date.now().toString(36);
}

function sleep(ms: number): Promise<void> {
  return new Promise(function(r) { return setTimeout(r, ms); });
}

async function main() {
  var provider = new WeComWsProvider();
  
  // Register event handler for template_card events
  provider.onEvent(function(event) {
    log(">>> EVENT: cmd=" + event.cmd + " msgtype=" + event.body?.msgtype);
    if (event.body?.msgtype === "template_card_event") {
      var ev = event.body.template_card_event;
      log("  card_type=" + ev?.card_type + " event_key=" + ev?.event_key + " task_id=" + ev?.task_id);
      if (ev?.selected_items) {
        log("  selected_items=" + JSON.stringify(ev.selected_items));
      }
    }
  });

  provider.onMessage(async function(frame) {
    var chatId = frame.body?.from?.userid || "";
    var chatType = frame.body?.chattype || "single";
    var nct = chatType === "group" ? 2 : 1;
    var userName = frame.body?.from?.name || chatId;

    log("=== 收到消息，开始测试剩余3种模板卡片类型 ===");
    log("chatId=" + chatId + " chatType=" + chatType);

    // ===== Test 1: button_interaction reply =====
    log("--- Test C1/3: button_interaction reply ---");
    try {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "button_interaction",
          source: { icon_url: ICON_URL, desc: "按钮交互测试", desc_color: 1 },
          main_title: { title: "按钮交互模板卡片", desc: "button_interaction 类型 — 含按钮和下拉选择器" },
          sub_title_text: "请选择身份并点击按钮",
          button_selection: {
            question_key: "identity_key",
            title: "你的身份",
            disable: false,
            selected_id: "opt_2",
            option_list: [
              { id: "opt_1", text: "管理员" },
              { id: "opt_2", text: "普通用户" },
              { id: "opt_3", text: "访客" },
            ],
          },
          button_list: [
            { text: "确认", style: 1, key: "BTN_CONFIRM" },
            { text: "取消", style: 2, key: "BTN_CANCEL" },
          ],
          horizontal_content_list: [
            { keyname: "卡片类型", value: "button_interaction" },
            { keyname: "方式", value: "aibot_respond_msg" },
          ],
          task_id: genTaskId("btn"),
        },
      });
      log("  button_interaction reply: PASS");
    } catch (e) {
      log("  button_interaction reply: FAIL — " + (e as Error).message);
    }
    await sleep(800);

    // ===== Test 2: vote_interaction reply =====
    log("--- Test C2/3: vote_interaction reply ---");
    try {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "vote_interaction",
          source: { icon_url: ICON_URL, desc: "投票测试", desc_color: 1 },
          main_title: { title: "投票选择模板卡片", desc: "vote_interaction 类型 — 单选投票" },
          checkbox: {
            question_key: "vote_q1",
            disable: false,
            mode: 0,
            option_list: [
              { id: "v_opt_1", text: "选项A：方案一", is_checked: false },
              { id: "v_opt_2", text: "选项B：方案二", is_checked: false },
              { id: "v_opt_3", text: "选项C：方案三", is_checked: false },
            ],
          },
          submit_button: { text: "提交投票", key: "VOTE_SUBMIT" },
          task_id: genTaskId("vote"),
        },
      });
      log("  vote_interaction reply: PASS");
    } catch (e) {
      log("  vote_interaction reply: FAIL — " + (e as Error).message);
    }
    await sleep(800);

    // ===== Test 3: multiple_interaction reply =====
    log("--- Test C3/3: multiple_interaction reply ---");
    try {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "multiple_interaction",
          source: { icon_url: ICON_URL, desc: "多项选择测试", desc_color: 1 },
          main_title: { title: "多项选择模板卡片", desc: "multiple_interaction 类型 — 多个下拉选择器" },
          select_list: [
            {
              question_key: "sel_q1",
              title: "优先级",
              disable: false,
              selected_id: "pri_2",
              option_list: [
                { id: "pri_1", text: "P0 紧急" },
                { id: "pri_2", text: "P1 高" },
                { id: "pri_3", text: "P2 中" },
                { id: "pri_4", text: "P3 低" },
              ],
            },
            {
              question_key: "sel_q2",
              title: "模块",
              disable: false,
              selected_id: "mod_1",
              option_list: [
                { id: "mod_1", text: "前端" },
                { id: "mod_2", text: "后端" },
                { id: "mod_3", text: "数据" },
              ],
            },
          ],
          submit_button: { text: "提交", key: "MULTI_SUBMIT" },
          task_id: genTaskId("multi"),
        },
      });
      log("  multiple_interaction reply: PASS");
    } catch (e) {
      log("  multiple_interaction reply: FAIL — " + (e as Error).message);
    }
    await sleep(800);

    // ===== Push tests for same 3 types =====
    log("--- Test C4: push button_interaction ---");
    try {
      await provider.sendMessage(chatId, nct, {
        msgtype: "template_card",
        template_card: {
          card_type: "button_interaction",
          source: { icon_url: ICON_URL, desc: "主动推送-按钮交互", desc_color: 1 },
          main_title: { title: "主动推送按钮交互", desc: "通过 aibot_send_msg 推送 button_interaction" },
          sub_title_text: "请选择并点击按钮",
          button_list: [
            { text: "同意", style: 1, key: "PUSH_AGREE" },
            { text: "拒绝", style: 2, key: "PUSH_REJECT" },
          ],
          task_id: genTaskId("push_btn"),
        },
      });
      log("  push button_interaction: PASS");
    } catch (e) {
      log("  push button_interaction: FAIL — " + (e as Error).message);
    }
    await sleep(800);

    log("--- Test C5: push vote_interaction ---");
    try {
      await provider.sendMessage(chatId, nct, {
        msgtype: "template_card",
        template_card: {
          card_type: "vote_interaction",
          source: { icon_url: ICON_URL, desc: "主动推送-投票", desc_color: 1 },
          main_title: { title: "主动推送投票", desc: "通过 aibot_send_msg 推送 vote_interaction" },
          checkbox: {
            question_key: "push_vote_q",
            mode: 0,
            option_list: [
              { id: "pv_1", text: "赞成", is_checked: false },
              { id: "pv_2", text: "反对", is_checked: false },
              { id: "pv_3", text: "弃权", is_checked: false },
            ],
          },
          submit_button: { text: "提交", key: "PUSH_VOTE_SUBMIT" },
          task_id: genTaskId("push_vote"),
        },
      });
      log("  push vote_interaction: PASS");
    } catch (e) {
      log("  push vote_interaction: FAIL — " + (e as Error).message);
    }
    await sleep(800);

    log("--- Test C6: push multiple_interaction ---");
    try {
      await provider.sendMessage(chatId, nct, {
        msgtype: "template_card",
        template_card: {
          card_type: "multiple_interaction",
          source: { icon_url: ICON_URL, desc: "主动推送-多项选择", desc_color: 1 },
          main_title: { title: "主动推送多项选择", desc: "通过 aibot_send_msg 推送 multiple_interaction" },
          select_list: [
            {
              question_key: "psel_1",
              title: "类型",
              disable: false,
              selected_id: "ps_t1",
              option_list: [
                { id: "ps_t1", text: "需求" },
                { id: "ps_t2", text: "缺陷" },
                { id: "ps_t3", text: "任务" },
              ],
            },
          ],
          submit_button: { text: "提交", key: "PUSH_MULTI_SUBMIT" },
          task_id: genTaskId("push_multi"),
        },
      });
      log("  push multiple_interaction: PASS");
    } catch (e) {
      log("  push multiple_interaction: FAIL — " + (e as Error).message);
    }

    // Summary
    log("");
    log("========== 模板卡片补充测试完成 ==========");
    var passCount = 0, failCount = 0;
    for (var i = 0; i < results.length; i++) {
      if (results[i].indexOf(": PASS") > 0) passCount++;
      if (results[i].indexOf(": FAIL") > 0) failCount++;
    }
    log("通过: " + passCount + " / 失败: " + failCount + " / 共 6 项");
    log("=========================================");

    fs.writeFileSync(LOG_FILE, results.join("\n"), "utf-8");
    log("结果已写入 " + LOG_FILE);

    await sleep(3000);
    provider.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
  });

  try {
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    log("已连接到企业微信长连接");
    log("Bot ID: " + BOT_ID.substring(0, 10) + "...");
    log("");
    log("请向机器人发送任意消息，将自动测试 3 种交互模板卡片(reply+push 共6项)...");
    log("");

    setTimeout(function() {
      log("超时: 5分钟未收到消息");
      fs.writeFileSync(LOG_FILE, results.join("\n"), "utf-8");
      provider.disconnect();
      process.exit(1);
    }, 300000);
  } catch (e) {
    log("连接失败: " + (e as Error).message);
    process.exit(1);
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
