// 事件结构诊断 — 捕获完整raw事件用于解析
import { WeComWsProvider } from "../packages/providers/src/wecom/ws-provider";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;
var ICON_URL = "https://wework.qpic.cn/wwpic/252813_jOfDHtcISzuodLa_1629280209/0";
var LOG_FILE = path.resolve(__dirname, "..", "logs", "event-raw.log");

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + "\n", "utf-8");
}

function genTaskId(p: string): string { return p + "_" + Date.now().toString(36); }

async function main() {
  var provider = new WeComWsProvider();
  var evCount = 0;

  // Dump FULL raw event to understand structure
  provider.onEvent(function(event) {
    evCount++;
    log("");
    log("========== EVENT #" + evCount + " ==========");
    log("RAW FRAME: " + JSON.stringify(event, null, 2));
    log("");
    log("--- Parsed ---");
    var etype = event.body?.event?.eventtype;
    log("eventtype = " + (etype || "N/A"));
    
    if (etype === "template_card_event") {
      var tce = event.body?.event?.template_card_event;
      log("template_card_event.card_type = " + (tce?.card_type || "N/A"));
      log("template_card_event.event_key = " + (tce?.event_key || "N/A"));
      log("template_card_event.task_id = " + (tce?.task_id || "N/A"));
      log("template_card_event.response_url = " + (tce?.response_url || "N/A"));
      if (tce?.selected_items) {
        log("selected_items = " + JSON.stringify(tce.selected_items));
      }
    }
    log("================================");
    log("");
  });

  provider.onMessage(async function(frame) {
    var userMsg = (frame.body?.text?.content || "").trim().toLowerCase();
    var chatId = frame.body?.from?.userid || "";
    var nct = (frame.body?.chattype || "single") === "group" ? 2 : 1;

    log("MSG: " + userMsg);

    if (userMsg === "btn") {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "button_interaction",
          source: { icon_url: ICON_URL, desc: "按钮交互", desc_color: 1 },
          main_title: { title: "按钮交互测试", desc: "选择身份后点击按钮" },
          sub_title_text: "点击按钮将触发 template_card_event 回调",
          button_selection: {
            question_key: "identity",
            title: "身份",
            selected_id: "id_user",
            option_list: [
              { id: "id_admin", text: "管理员" },
              { id: "id_user", text: "普通用户" },
            ],
          },
          button_list: [
            { text: "确认", style: 1, key: "BTN_OK" },
            { text: "取消", style: 2, key: "BTN_CANCEL" },
          ],
          task_id: genTaskId("btn"),
        },
      });
      return;
    }

    if (userMsg === "vote") {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "vote_interaction",
          source: { icon_url: ICON_URL, desc: "投票", desc_color: 1 },
          main_title: { title: "投票测试", desc: "选择后提交触发回调" },
          checkbox: {
            question_key: "poll",
            mode: 0,
            option_list: [
              { id: "v_a", text: "方案A", is_checked: false },
              { id: "v_b", text: "方案B", is_checked: false },
            ],
          },
          submit_button: { text: "提交", key: "VOTE_SUBMIT" },
          task_id: genTaskId("vote"),
        },
      });
      return;
    }

    if (userMsg === "multi") {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "multiple_interaction",
          source: { icon_url: ICON_URL, desc: "多项选择", desc_color: 1 },
          main_title: { title: "多项选择测试", desc: "选择后提交触发回调" },
          select_list: [
            {
              question_key: "type",
              title: "类型",
              selected_id: "t_a",
              option_list: [
                { id: "t_a", text: "需求" },
                { id: "t_b", text: "缺陷" },
              ],
            },
          ],
          submit_button: { text: "提交", key: "MULTI_SUBMIT" },
          task_id: genTaskId("multi"),
        },
      });
      return;
    }

    // Default guidance
    await provider.replyMessage(frame, {
      msgtype: "stream",
      stream: { id: "g_" + Date.now().toString(36), finish: true, content: "发送 btn/vote/multi 获取交互卡片，交互后查看事件回调" },
    });
  });

  try {
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    log("已连接 — 发送 btn/vote/multi 并交互");
    log("事件日志: " + LOG_FILE);

    setTimeout(function() { provider.disconnect(); process.exit(0); }, 600000);
  } catch (e) {
    log("FAIL: " + (e as Error).message);
    process.exit(1);
  }
}

main().catch(console.error);
