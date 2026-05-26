// 模板卡片交互反馈测试 — 发送交互卡片并持续监听事件回调
import { WeComWsProvider } from "../packages/providers/src/wecom/ws-provider";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;
var ICON_URL = "https://wework.qpic.cn/wwpic/252813_jOfDHtcISzuodLa_1629280209/0";
var LOG_FILE = path.resolve(__dirname, "..", "logs", "interaction-test.log");
var results: string[] = [];

function log(msg: string) {
  var ts = new Date().toISOString().substring(11, 23);
  var line = "[" + ts + "] " + msg;
  console.log(line);
  results.push(line);
}

function genTaskId(prefix: string): string {
  return prefix + "_" + Date.now().toString(36);
}

async function main() {
  var provider = new WeComWsProvider();
  var eventCount = 0;
  var chatId = "";
  var chatType: "single" | "group" = "single";

  // ====== Event Handler: capture ALL template_card events ======
  provider.onEvent(function(event) {
    log("");
    log("╔══════════════════════════════════════╗");
    log("║  >>> 收到事件回调 #" + (++eventCount) + " <<<");
    log("╠══════════════════════════════════════╣");
    log("║ cmd      = " + event.cmd);
    log("║ msgtype  = " + event.body?.msgtype);

    if (event.body?.msgtype === "template_card_event") {
      var ev = event.body.template_card_event;
      log("║ --- template_card_event ---");
      log("║ card_type    = " + (ev?.card_type || "N/A"));
      log("║ event_key    = " + (ev?.event_key || "N/A"));
      log("║ task_id      = " + (ev?.task_id || "N/A"));
      log("║ response_url = " + (ev?.response_url || "N/A"));
      if (ev?.selected_items) {
        log("║ selected_items:");
        var items = ev.selected_items;
        if (Array.isArray(items)) {
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            log("║   [" + i + "] question_key=" + item.question_key + " option_ids=" + JSON.stringify(item.option_ids || item.option_id));
          }
        } else {
          log("║   " + JSON.stringify(items));
        }
      }
      log("║ RAW: " + JSON.stringify(ev));
    } else if (event.body?.msgtype === "event") {
      var etype = event.body?.event?.eventtype;
      log("║ eventtype = " + (etype || "N/A"));
      if (etype === "enter_chat") log("║ 用户进入会话");
      if (etype === "disconnected_event") log("║ 连接被新连接踢掉");
    } else if (event.body?.msgtype === "feedback_event") {
      log("║ --- feedback_event ---");
      log("║ feedback_id = " + event.body?.feedback_event?.id);
      log("║ type = " + event.body?.feedback_event?.type);
    }
    log("╚══════════════════════════════════════╝");
    log("");

    // Flush to file on each event
    fs.writeFileSync(LOG_FILE, results.join("\n"), "utf-8");
  });

  // ====== Message Handler: send interactive cards ======
  provider.onMessage(async function(frame) {
    var userName = frame.body?.from?.name || "";
    var userMsg = (frame.body?.text?.content || "").trim().toLowerCase();
    chatId = frame.body?.from?.userid || "";
    chatType = frame.body?.chattype || "single";
    var nct = chatType === "group" ? 2 : 1;

    log("=== 收到消息: " + userMsg + " from " + userName + " ===");

    // ---- Send button_interaction card ----
    if (userMsg === "btn" || userMsg.indexOf("btn") >= 0) {
      log("发送 button_interaction 卡片...");
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "button_interaction",
          source: { icon_url: ICON_URL, desc: "按钮交互", desc_color: 1 },
          main_title: { title: "按钮交互测试", desc: "请点击下方按钮，或选择身份后点击按钮" },
          sub_title_text: "选择身份后点击按钮，机器人会收到回调事件",
          button_selection: {
            question_key: "role",
            title: "身份",
            selected_id: "r_user",
            option_list: [
              { id: "r_admin", text: "管理员" },
              { id: "r_user", text: "普通用户" },
              { id: "r_guest", text: "访客" },
            ],
          },
          button_list: [
            { text: "✅ 确认", style: 1, key: "BTN_OK" },
            { text: "❌ 取消", style: 2, key: "BTN_CANCEL" },
            { text: "📋 查看详情", style: 1, key: "BTN_DETAIL" },
          ],
          task_id: genTaskId("btn"),
        },
      });
      log("  button_interaction 卡片已发送");
      return;
    }

    // ---- Send vote_interaction card ----
    if (userMsg === "vote" || userMsg.indexOf("vote") >= 0) {
      log("发送 vote_interaction 卡片...");
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "vote_interaction",
          source: { icon_url: ICON_URL, desc: "投票选择", desc_color: 1 },
          main_title: { title: "投票测试", desc: "请选择一个选项并提交，机器人会收到回调" },
          checkbox: {
            question_key: "poll_q1",
            mode: 0,
            option_list: [
              { id: "opt_a", text: "👍 方案A", is_checked: false },
              { id: "opt_b", text: "❤️ 方案B", is_checked: false },
              { id: "opt_c", text: "🎯 方案C", is_checked: false },
            ],
          },
          submit_button: { text: "🗳 提交投票", key: "VOTE_DONE" },
          task_id: genTaskId("vote"),
        },
      });
      log("  vote_interaction 卡片已发送");
      return;
    }

    // ---- Send multiple_interaction card ----
    if (userMsg === "multi" || userMsg.indexOf("multi") >= 0) {
      log("发送 multiple_interaction 卡片...");
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "multiple_interaction",
          source: { icon_url: ICON_URL, desc: "多项选择", desc_color: 1 },
          main_title: { title: "多项选择测试", desc: "请选择各下拉框的值并提交" },
          select_list: [
            {
              question_key: "priority",
              title: "优先级",
              selected_id: "p2",
              option_list: [
                { id: "p0", text: "🔴 P0 紧急" },
                { id: "p1", text: "🟠 P1 高" },
                { id: "p2", text: "🟡 P2 中" },
                { id: "p3", text: "🟢 P3 低" },
              ],
            },
            {
              question_key: "category",
              title: "分类",
              selected_id: "cat_fe",
              option_list: [
                { id: "cat_fe", text: "前端" },
                { id: "cat_be", text: "后端" },
                { id: "cat_data", text: "数据" },
              ],
            },
          ],
          submit_button: { text: "📤 提交", key: "MULTI_DONE" },
          task_id: genTaskId("multi"),
        },
      });
      log("  multiple_interaction 卡片已发送");
      return;
    }

    // ---- Default: show instructions ----
    log("发送交互卡片...");
    await provider.replyMessage(frame, {
      msgtype: "markdown",
      markdown: {
        content: "# 交互卡片测试\n\n发送以下命令获取对应交互卡片：\n\n- **btn** — 按钮交互卡片\n- **vote** — 投票选择卡片\n- **multi** — 多项选择卡片\n\n收到卡片后请点击/选择/提交，机器人会实时记录回调事件。",
      },
    });
  });

  // Connect
  try {
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    log("=== 模板卡片交互反馈测试 ===");
    log("已连接到企业微信长连接");
    log("");
    log("命令:");
    log("  btn   — 获取 button_interaction 卡片");
    log("  vote  — 获取 vote_interaction 卡片");
    log("  multi — 获取 multiple_interaction 卡片");
    log("");
    log("收到卡片后请进行交互(点击/投票/选择+提交)");
    log("机器人会实时记录回调事件到: " + LOG_FILE);
    log("");

    // Keep alive
    process.on("SIGINT", function() {
      log("Disconnecting...");
      fs.writeFileSync(LOG_FILE, results.join("\n"), "utf-8");
      provider.disconnect();
      process.exit(0);
    });

    // Timeout after 10 minutes
    setTimeout(function() {
      log("超时退出");
      fs.writeFileSync(LOG_FILE, results.join("\n"), "utf-8");
      provider.disconnect();
      process.exit(0);
    }, 600000);
  } catch (e) {
    log("连接失败: " + (e as Error).message);
    process.exit(1);
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
