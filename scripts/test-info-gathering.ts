// 信息汇集分析 Skill 集成测试
import dotenv from "dotenv";
import path from "path";
import { WeComMcpClient } from "../packages/providers/src/wecom/mcp-client";
import { LLMClient, LLMClientConfig } from "../packages/llm/src/client";
import { gatherAndAnalyze } from "../composite-skills/info-gathering";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

var BOT_ID = process.env.WECOM_BOT_ID as string;
var BOT_SECRET = process.env.WECOM_BOT_SECRET as string;

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

async function main() {
  console.log("=== 信息汇集分析 Skill 集成测试 ===\n");
  var client = new WeComMcpClient({ botId: BOT_ID, botSecret: BOT_SECRET });
  await client.fetchMcpConfig();
  var llm = new LLMClient(getLlmConfigs());

  var callTool = async function(cat: string, m: string, args: Record<string, unknown>) {
    return client.callTool(cat, m, args);
  };

  // Test 1: Report format
  console.log("--- Test 1: report format ---");
  try {
    var result = await gatherAndAnalyze({
      topic: "企业微信智能机器人框架 P1-P2 汇总分析",
      sources: [
        {
          type: "manual",
          label: "P1 长连接开发",
          data: "完成 WebSocket 长连接核心引擎，15 种消息类型全部测试通过。" +
            "实现 5 种模板卡片：text_notice, news_notice, button_interaction, vote_interaction, multiple_interaction。" +
            "事件回调完整捕获：enter_chat, template_card_event, feedback_event, disconnected_event。" +
            "踩坑 10 个：PowerShell heredoc、errcode 位置不一致、reply 不支持 msgtype=text、template_card_event 路径等。",
        },
        {
          type: "manual",
          label: "P2 CLI 集成",
          data: "MCP JSON-RPC 集成 6 品类 42 个原子 Skill：contact(1), todo(6), msg(4), schedule(8), meeting(5), doc(18)。" +
            "McpSkillProvider 从 tools/list 自动生成 Skill。EventRouter 实现 task_id 路由。" +
            "踩坑 3 个：MCP 参数类型严格、非 JSON 错误响应、schedule 时间格式。",
        },
        {
          type: "manual",
          label: "P3 组合 Skill",
          data: "创建 5 个组合 Skill：createWeeklyReport, organizeMeeting, createMeetingMinutes, sendPartyVote, gatherAndAnalyze。" +
            "全部通过 MCP 集成测试。" +
            "2 个示例 bot：project-bot, party-bot。",
        },
      ],
      outputFormat: "report",
      analysisPrompt: "请生成项目里程碑和关键成果总结，包括各阶段的完成度、踩坑数量分布、能力覆盖矩阵。",
    }, {
      callTool: callTool,
      llm: llm,
    });

    console.log("  [PASS] " + result.summary.substring(0, 80) + "...");
    console.log("  docUrl: " + result.docUrl);
  } catch (e) {
    console.log("  [FAIL] " + (e as Error).message);
    process.exit(1);
  }

  // Test 2: Table format
  console.log("\n--- Test 2: table format ---");
  try {
    var result2 = await gatherAndAnalyze({
      topic: "P1-P3 能力覆盖矩阵",
      sources: [
        {
          type: "manual",
          label: "能力清单",
          data: "消息类型: 15/15 通过\n模板卡片: 5/5 通过\n事件回调: 4/4 通过\nCLI品类: 6/6 通过\n原子Skill: 42/42 通过\n组合Skill: 5/5 通过\nBot示例: 2/2 通过",
        },
      ],
      outputFormat: "table",
    }, {
      callTool: callTool,
      llm: llm,
    });

    console.log("  [PASS] " + result2.summary.substring(0, 80) + "...");
    console.log("  docUrl: " + result2.docUrl);
    if (result2.tableUrl) console.log("  tableUrl: " + result2.tableUrl);
  } catch (e) {
    console.log("  [FAIL] " + (e as Error).message);
    process.exit(1);
  }

  console.log("\n所有测试通过！");
}

main().catch(function(e) {
  console.error("FATAL: " + (e as Error).message);
  process.exit(1);
});
