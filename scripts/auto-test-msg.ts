// 自动消息类型测试 — 收到任意消息后依次测试所有类型并记录结果
import { WeComWsProvider } from "../packages/providers/src/wecom/ws-provider";
import dotenv from "dotenv";
import path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;
var ICON_URL = "https://wework.qpic.cn/wwpic/252813_jOfDHtcISzuodLa_1629280209/0";
var CARD_URL = "https://work.weixin.qq.com";
var IMG_URL = "https://wework.qpic.cn/wwpic/354393_4zpkKXd7SrGMvfg_1629280616/0";
var LOG_FILE = path.resolve(__dirname, "..", "logs", "auto-test-result.log");
var results: string[] = [];

function log(msg: string) {
  var ts = new Date().toISOString().substring(11, 19);
  var line = "[" + ts + "] " + msg;
  console.log(line);
  results.push(line);
}

function genStreamId(): string {
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);
}

function sleep(ms: number): Promise<void> {
  return new Promise(function(r) { return setTimeout(r, ms); });
}

async function main() {
  var provider = new WeComWsProvider();

  provider.onMessage(async function(frame) {
    var chatId = frame.body?.from?.userid || "";
    var chatType = frame.body?.chattype || "single";
    var nct = chatType === "group" ? 2 : 1;
    var userName = frame.body?.from?.name || chatId;

    log("=== 收到来自 " + userName + " 的消息，开始自动测试所有消息类型 ===");
    log("chatId=" + chatId + " chatType=" + chatType);

    // ===== Test 1: Stream reply =====
    log("--- Test 1/8: stream reply ---");
    try {
      var sid1 = genStreamId();
      await provider.replyMessage(frame, { msgtype: "stream", stream: { id: sid1, finish: true, content: "[测试 1/8] 流式消息回复 ✅ PASS" } });
      log("  stream reply: PASS");
    } catch (e) {
      log("  stream reply: FAIL — " + (e as Error).message);
    }
    await sleep(500);

    // ===== Test 2: Markdown reply =====
    log("--- Test 2/8: markdown reply ---");
    try {
      await provider.replyMessage(frame, {
        msgtype: "markdown",
        markdown: { content: "# 测试 2/8\n**Markdown 回复消息** ✅ PASS\n\n- 无序列表\n- 代码块\n\n> 引用文字" },
      });
      log("  markdown reply: PASS");
    } catch (e) {
      log("  markdown reply: FAIL — " + (e as Error).message);
    }
    await sleep(500);

    // ===== Test 3: template_card text_notice reply =====
    log("--- Test 3/8: template_card text_notice reply ---");
    try {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "text_notice",
          source: { icon_url: ICON_URL, desc: "测试" },
          main_title: { title: "测试 3/8", desc: "text_notice 模板卡片回复" },
          sub_title_text: "文本通知模板卡片",
          emphasis_content: { title: "✅", desc: "PASS" },
          horizontal_content_list: [
            { keyname: "类型", value: "text_notice" },
            { keyname: "方式", value: "aibot_respond_msg" },
          ],
          jump_list: [{ type: 1, title: "官网", url: CARD_URL }],
          card_action: { type: 1, url: CARD_URL },
        },
      });
      log("  template_card text_notice reply: PASS");
    } catch (e) {
      log("  template_card text_notice reply: FAIL — " + (e as Error).message);
    }
    await sleep(500);

    // ===== Test 4: template_card news_notice reply =====
    log("--- Test 4/8: template_card news_notice reply ---");
    try {
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "news_notice",
          source: { icon_url: ICON_URL, desc: "测试" },
          main_title: { title: "测试 4/8", desc: "news_notice 图文展示模板卡片" },
          card_image: { url: IMG_URL, aspect_ratio: 2.25 },
          horizontal_content_list: [
            { keyname: "类型", value: "news_notice" },
            { keyname: "方式", value: "aibot_respond_msg" },
            { keyname: "状态", value: "✅ PASS" },
          ],
          jump_list: [{ type: 1, title: "官网", url: CARD_URL }],
          card_action: { type: 1, url: CARD_URL },
        },
      });
      log("  template_card news_notice reply: PASS");
    } catch (e) {
      log("  template_card news_notice reply: FAIL — " + (e as Error).message);
    }
    await sleep(500);

    // ===== Test 5: File reply =====
    log("--- Test 5/8: file reply ---");
    try {
      var fc = "企业微信智能机器人 — 文件消息测试\n时间: " + new Date().toISOString() + "\n\n测试内容: aibot_respond_msg 文件回复";
      var fb = Buffer.from(fc, "utf-8");
      log("  上传文件 (" + fb.length + " bytes)...");
      var fr = await provider.uploadMedia(fb, "test-file-" + Date.now() + ".txt", "file");
      log("  upload OK, media_id=" + fr.media_id);
      await provider.replyMessage(frame, { msgtype: "file", file: { media_id: fr.media_id } });
      log("  file reply: PASS (media_id=" + fr.media_id + ")");
    } catch (e) {
      log("  file reply: FAIL — " + (e as Error).message);
    }
    await sleep(500);

    // ===== Test 6: Push Markdown =====
    log("--- Test 6/8: push markdown ---");
    try {
      await provider.sendMessage(chatId, nct, {
        msgtype: "markdown",
        markdown: { content: "# 测试 6/8\n**主动推送 Markdown** ✅ PASS\n\n通过 aibot_send_msg 发送" },
      });
      log("  push markdown: PASS");
    } catch (e) {
      log("  push markdown: FAIL — " + (e as Error).message);
    }
    await sleep(500);

    // ===== Test 7: Push template_card text_notice =====
    log("--- Test 7/8: push template_card text_notice ---");
    try {
      await provider.sendMessage(chatId, nct, {
        msgtype: "template_card",
        template_card: {
          card_type: "text_notice",
          source: { icon_url: ICON_URL, desc: "主动推送" },
          main_title: { title: "测试 7/8", desc: "主动推送 text_notice 模板卡片" },
          sub_title_text: "通过 aibot_send_msg 推送",
          horizontal_content_list: [
            { keyname: "类型", value: "text_notice" },
            { keyname: "方式", value: "aibot_send_msg" },
            { keyname: "状态", value: "✅ PASS" },
          ],
          jump_list: [{ type: 1, title: "官网", url: CARD_URL }],
          card_action: { type: 1, url: CARD_URL },
        },
      });
      log("  push template_card text_notice: PASS");
    } catch (e) {
      log("  push template_card text_notice: FAIL — " + (e as Error).message);
    }
    await sleep(500);

    // ===== Test 8: Push file =====
    log("--- Test 8/8: push file ---");
    try {
      var fc2 = "主动推送文件测试\n时间: " + new Date().toISOString() + "\n通过 aibot_send_msg 发送";
      var fb2 = Buffer.from(fc2, "utf-8");
      var fr2 = await provider.uploadMedia(fb2, "push-file-" + Date.now() + ".txt", "file");
      log("  upload OK, media_id=" + fr2.media_id);
      await provider.sendMessage(chatId, nct, { msgtype: "file", file: { media_id: fr2.media_id } });
      log("  push file: PASS (media_id=" + fr2.media_id + ")");
    } catch (e) {
      log("  push file: FAIL — " + (e as Error).message);
    }

    // ===== Summary =====
    log("");
    log("========== 测试完成 ==========");
    var passCount = 0, failCount = 0;
    for (var i = 0; i < results.length; i++) {
      if (results[i].indexOf(": PASS") > 0) passCount++;
      if (results[i].indexOf(": FAIL") > 0) failCount++;
    }
    log("通过: " + passCount + " / 失败: " + failCount + " / 共 8 项");
    log("==============================");

    // Write to file
    fs.writeFileSync(LOG_FILE, results.join("\n"), "utf-8");
    log("结果已写入 " + LOG_FILE);

    // Disconnect and exit after 3s
    await sleep(3000);
    provider.disconnect();
    process.exit(failCount > 0 ? 1 : 0);
  });

  // Connect
  try {
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    log("已连接到企业微信长连接");
    log("Bot ID: " + BOT_ID.substring(0, 10) + "...");
    log("");
    log("请向机器人发送任意消息，将自动执行所有 8 项消息类型测试...");
    log("");

    // Timeout: exit after 5 minutes if no message received
    setTimeout(function() {
      log("超时: 5分钟内未收到消息，退出");
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
