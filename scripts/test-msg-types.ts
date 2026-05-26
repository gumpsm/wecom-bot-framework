// 企业微信智能机器人 — 消息类型综合测试
// 覆盖: stream(普通文本), markdown, template_card(text_notice/news_notice), file
// 覆盖: reply(aibot_respond_msg) + push(aibot_send_msg)

import { WeComWsProvider } from "../packages/providers/src/wecom/ws-provider";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

var ICON_URL = "https://wework.qpic.cn/wwpic/252813_jOfDHtcISzuodLa_1629280209/0";
var CARD_URL = "https://work.weixin.qq.com";

function genStreamId(): string {
  return "stream_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
}

// ====== Help text ======
var HELP = "\n" +
  "=== 消息类型测试命令 ===\n" +
  "回复消息(aibot_respond_msg):\n" +
  "  stream    — 流式文本回复\n" +
  "  markdown  — Markdown消息回复\n" +
  "  card1     — 模板卡片 text_notice 回复\n" +
  "  card2     — 模板卡片 news_notice 回复\n" +
  "  file      — 文件消息回复(上传+发送)\n" +
  "主动推送(aibot_send_msg):\n" +
  "  push md   — 主动推送 Markdown\n" +
  "  push c1   — 主动推送 text_notice\n" +
  "  push c2   — 主动推送 news_notice\n" +
  "  push file — 主动推送文件\n" +
  "  status    — 查看连接状态\n" +
  "  help      — 显示本帮助\n" +
  "========================\n";

async function main() {
  var provider = new WeComWsProvider();
  var lastMsgTime = Date.now();

  provider.onMessage(async function(frame) {
    var userMsg = (frame.body?.text?.content || "").trim().toLowerCase();
    var chatId = frame.body?.from?.userid || "";
    var chatType = frame.body?.chattype || "single";
    var numericChatType = chatType === "group" ? 2 : 1;

    console.log("[MSG] from=" + (frame.body?.from?.name || chatId) + " chat=" + chatType + " msg=" + userMsg);
    lastMsgTime = Date.now();

    // ---- Stream (text) reply ----
    if (userMsg === "stream") {
      console.log(">>> Testing STREAM reply");
      var sid = genStreamId();
      await provider.replyMessage(frame, {
        msgtype: "stream",
        stream: { id: sid, finish: true, content: "✅ 流式消息测试通过\n\n这是一条 stream 类型的回复消息。\n文档规定 aibot_respond_msg 不支持 msgtype=text，普通文本必须用 stream。" },
      });
      console.log("  stream reply sent (stream.id=" + sid + ")");
      return;
    }

    // ---- Markdown reply ----
    if (userMsg === "markdown") {
      console.log(">>> Testing MARKDOWN reply");
      await provider.replyMessage(frame, {
        msgtype: "markdown",
        markdown: {
          content:
            "# Markdown 消息测试\n\n" +
            "## 二级标题\n\n" +
            "**加粗文字** *斜体文字*\n" +
            "~~删除线~~ `行内代码`\n\n" +
            "- 无序列表项1\n" +
            "- 无序列表项2\n\n" +
            "1. 有序列表项1\n" +
            "2. 有序列表项2\n\n" +
            "> 引用文本：这是一段引用\n\n" +
            "| 列A | 列B | 列C |\n" +
            "|-----|-----|-----|\n" +
            "| 值1 | 值2 | 值3 |\n" +
            "| 值4 | 值5 | 值6 |\n\n" +
            "[企业微信官网](https://work.weixin.qq.com)\n\n" +
            "---\n" +
            "✅ Markdown 回复测试通过",
        },
      });
      console.log("  markdown reply sent");
      return;
    }

    // ---- Template card: text_notice reply ----
    if (userMsg === "card1") {
      console.log(">>> Testing TEMPLATE_CARD text_notice reply");
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "text_notice",
          source: { icon_url: ICON_URL, desc: "企业微信机器人", desc_color: 0 },
          main_title: { title: "模板卡片测试", desc: "text_notice 类型 — 文本通知模板卡片" },
          sub_title_text: "点击下方查看详情",
          emphasis_content: { title: "100%", desc: "测试通过率" },
          horizontal_content_list: [
            { keyname: "测试项", value: "模板卡片回复" },
            { keyname: "卡片类型", value: "text_notice" },
            { keyname: "状态", value: "✅ PASS" },
          ],
          jump_list: [
            { type: 1, title: "企业微信官网", url: CARD_URL },
          ],
          card_action: { type: 1, url: CARD_URL },
        },
      });
      console.log("  template_card text_notice reply sent");
      return;
    }

    // ---- Template card: news_notice reply ----
    if (userMsg === "card2") {
      console.log(">>> Testing TEMPLATE_CARD news_notice reply");
      await provider.replyMessage(frame, {
        msgtype: "template_card",
        template_card: {
          card_type: "news_notice",
          source: { icon_url: ICON_URL, desc: "企业微信机器人", desc_color: 0 },
          main_title: { title: "图文展示卡片测试", desc: "news_notice 类型 — 图文展示模板卡片" },
          card_image: {
            url: "https://wework.qpic.cn/wwpic/354393_4zpkKXd7SrGMvfg_1629280616/0",
            aspect_ratio: 2.25,
          },
          image_text_area: {
            type: 1,
            url: CARD_URL,
            title: "欢迎使用企业微信",
            desc: "您的智能机器人已就绪",
            image_url: "https://wework.qpic.cn/wwpic/354393_4zpkKXd7SrGMvfg_1629280616/0",
          },
          vertical_content_list: [
            { title: "功能一：消息回复", desc: "支持多种消息类型" },
            { title: "功能二：模板卡片", desc: "支持 text_notice / news_notice" },
          ],
          horizontal_content_list: [
            { keyname: "测试项", value: "图文卡片回复" },
            { keyname: "卡片类型", value: "news_notice" },
            { keyname: "状态", value: "✅ PASS" },
          ],
          jump_list: [
            { type: 1, title: "企业微信官网", url: CARD_URL },
          ],
          card_action: { type: 1, url: CARD_URL },
        },
      });
      console.log("  template_card news_notice reply sent");
      return;
    }

    // ---- File reply ----
    if (userMsg === "file") {
      console.log(">>> Testing FILE reply");
      var ts = new Date().toISOString().replace(/[:.]/g, "-");
      var fileContent = [
        "企业微信智能机器人 - 文件消息测试",
        "时间: " + ts,
        "",
        "测试内容:",
        "  1. 上传文件到企业微信",
        "  2. 获取 media_id",
        "  3. 通过 aibot_respond_msg 回复文件",
        "",
        "This is a test file for WeCom bot file message testing.",
      ].join("\n");

      try {
        var fileBuffer = Buffer.from(fileContent, "utf-8");
        console.log("  uploading file (" + fileBuffer.length + " bytes)...");
        var result = await provider.uploadMedia(fileBuffer, "wecom-test-" + Date.now() + ".txt", "file");
        console.log("  upload OK, media_id=" + result.media_id);

        await provider.replyMessage(frame, {
          msgtype: "file",
          file: { media_id: result.media_id },
        });
        console.log("  file reply sent (media_id=" + result.media_id + ")");
      } catch (e) {
        console.error("  FILE REPLY FAILED: " + (e as Error).message);
        // Fallback: tell user via stream
        await provider.replyMessage(frame, {
          msgtype: "stream",
          stream: { id: genStreamId(), finish: true, content: "❌ 文件消息测试失败: " + (e as Error).message },
        });
      }
      return;
    }

    // ---- Push: markdown ----
    if (userMsg === "push md") {
      console.log(">>> Testing PUSH markdown to chatId=" + chatId);
      try {
        await provider.sendMessage(chatId, numericChatType, {
          msgtype: "markdown",
          markdown: {
            content:
              "# 主动推送测试\n\n" +
              "这是一条机器人**主动推送**的 Markdown 消息。\n\n" +
              "- 无需用户消息触发\n" +
              "- 通过 aibot_send_msg 发送\n\n" +
              "✅ 主动推送 Markdown 测试通过",
          },
        });
        console.log("  push markdown sent OK");
      } catch (e) {
        console.error("  PUSH MARKDOWN FAILED: " + (e as Error).message);
      }
      return;
    }

    // ---- Push: template_card text_notice ----
    if (userMsg === "push c1") {
      console.log(">>> Testing PUSH template_card text_notice to chatId=" + chatId);
      try {
        await provider.sendMessage(chatId, numericChatType, {
          msgtype: "template_card",
          template_card: {
            card_type: "text_notice",
            source: { icon_url: ICON_URL, desc: "主动推送", desc_color: 0 },
            main_title: { title: "主动推送卡片测试", desc: "通过 aibot_send_msg 推送 text_notice" },
            sub_title_text: "无需用户消息即可推送",
            horizontal_content_list: [
              { keyname: "推送方式", value: "aibot_send_msg" },
              { keyname: "卡片类型", value: "text_notice" },
              { keyname: "状态", value: "✅ PASS" },
            ],
            jump_list: [{ type: 1, title: "企业微信官网", url: CARD_URL }],
            card_action: { type: 1, url: CARD_URL },
          },
        });
        console.log("  push template_card text_notice sent OK");
      } catch (e) {
        console.error("  PUSH template_card text_notice FAILED: " + (e as Error).message);
      }
      return;
    }

    // ---- Push: template_card news_notice ----
    if (userMsg === "push c2") {
      console.log(">>> Testing PUSH template_card news_notice to chatId=" + chatId);
      try {
        await provider.sendMessage(chatId, numericChatType, {
          msgtype: "template_card",
          template_card: {
            card_type: "news_notice",
            source: { icon_url: ICON_URL, desc: "主动推送", desc_color: 0 },
            main_title: { title: "图文推送测试", desc: "通过 aibot_send_msg 推送 news_notice" },
            card_image: {
              url: "https://wework.qpic.cn/wwpic/354393_4zpkKXd7SrGMvfg_1629280616/0",
              aspect_ratio: 2.25,
            },
            horizontal_content_list: [
              { keyname: "推送方式", value: "aibot_send_msg" },
              { keyname: "卡片类型", value: "news_notice" },
              { keyname: "状态", value: "✅ PASS" },
            ],
            jump_list: [{ type: 1, title: "企业微信官网", url: CARD_URL }],
            card_action: { type: 1, url: CARD_URL },
          },
        });
        console.log("  push template_card news_notice sent OK");
      } catch (e) {
        console.error("  PUSH news_notice FAILED: " + (e as Error).message);
      }
      return;
    }

    // ---- Push: file ----
    if (userMsg === "push file") {
      console.log(">>> Testing PUSH file to chatId=" + chatId);
      try {
        var fc = "主动推送文件测试\n时间: " + new Date().toISOString() + "\n通过 aibot_send_msg 发送";
        var fb = Buffer.from(fc, "utf-8");
        var fr = await provider.uploadMedia(fb, "push-test-" + Date.now() + ".txt", "file");
        console.log("  upload OK, media_id=" + fr.media_id);

        await provider.sendMessage(chatId, numericChatType, {
          msgtype: "file",
          file: { media_id: fr.media_id },
        });
        console.log("  push file sent OK");
      } catch (e) {
        console.error("  PUSH FILE FAILED: " + (e as Error).message);
      }
      return;
    }

    // ---- Status ----
    if (userMsg === "status") {
      var connected = true; // if we got here, WS is connected
      var uptime = Math.floor((Date.now() - lastMsgTime) / 1000);
      await provider.replyMessage(frame, {
        msgtype: "stream",
        stream: { id: genStreamId(), finish: true, content: "✅ 连接正常\n上次消息: " + uptime + "秒前\nBot ID: " + BOT_ID.substring(0, 10) + "..." },
      });
      return;
    }

    // ---- Help ----
    if (userMsg === "help") {
      await provider.replyMessage(frame, {
        msgtype: "stream",
        stream: { id: genStreamId(), finish: true, content: HELP },
      });
      return;
    }

    // ---- Unknown command ----
    await provider.replyMessage(frame, {
      msgtype: "stream",
      stream: { id: genStreamId(), finish: true, content: "未知命令: " + userMsg + "\n发送 \"help\" 查看可用命令" },
    });
  });

  // ---- Connect ----
  try {
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    console.log("=== 企业微信智能机器人 消息类型综合测试 ===");
    console.log("Bot ID: " + BOT_ID.substring(0, 10) + "...");
    console.log("已连接到企业微信长连接\n");
    console.log(HELP);
    console.log("发送 \"help\" 查看命令列表 | Ctrl+C 退出\n");

    process.on("SIGINT", function() {
      console.log("\nDisconnecting...");
      provider.disconnect();
      process.exit(0);
    });
  } catch (e) {
    console.error("连接失败: " + (e as Error).message);
    process.exit(1);
  }
}

main().catch(console.error);
