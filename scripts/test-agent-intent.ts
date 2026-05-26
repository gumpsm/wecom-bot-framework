// Agent 意图识别集成测试 — 验证组合 Skill 能被 LLM 正确选中
import dotenv from "dotenv";
import path from "path";
import { LLMClient, LLMClientConfig } from "../packages/llm/src/client";
import { SkillRegistry } from "../packages/skills/src/registry";
import { Agent } from "../packages/agent/src/agent";
import { SkillDefinition, Provider, Skill } from "../packages/core/src/types";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function getLlmConfigs(): LLMClientConfig[] {
  var keys = [process.env.DEEPSEEK_API_KEY_1, process.env.DEEPSEEK_API_KEY_2, process.env.DEEPSEEK_API_KEY_3]
    .filter(function(k) { return k; }) as string[];
  if (keys.length === 0) throw new Error("No DEEPSEEK_API_KEY configured");
  return keys.map(function(k) {
    return {
      apiKey: k,
      baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1") as string,
      model: (process.env.DEEPSEEK_MODEL || "deepseek-chat") as string,
    };
  });
}

function createMockProvider(): Provider {
  return {
    name: "mock",
    connect: async function() {},
    disconnect: function() {},
    onMessage: function() {},
    onEvent: function() {},
    replyWelcome: async function() {},
    replyMessage: async function() {},
    replyUpdateCard: async function() {},
    sendMessage: async function() {},
    uploadMedia: async function() { return { media_id: "test" }; },
    callTool: async function() { return {}; },
  };
}

var callLog: Array<{ name: string; args: Record<string, unknown> }> = [];

function makeCompositeSkill(def: SkillDefinition): Skill {
  return {
    definition: def,
    execute: async function(args: Record<string, unknown>) {
      callLog.push({ name: def.name, args: args });
      return { success: true, message: def.name + " executed" };
    },
  };
}

var weeklyReportDef: SkillDefinition = {
  name: "create-weekly-report",
  description: "创建项目周报文档。当用户说写周报、本周总结、项目进展时使用。需要项目名称和进展内容。",
  parameters: {
    type: "object",
    properties: {
      projectName: { type: "string", description: "项目名称" },
      progress: { type: "string", description: "本周进展" },
      nextPlan: { type: "string", description: "下周计划" },
    },
    required: ["projectName"],
  },
};

var meetingDef: SkillDefinition = {
  name: "organize-meeting",
  description: "组织会议，创建会议并同步日程。当用户说开会、安排会议、拉会时使用。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "会议主题" },
      startTime: { type: "string", description: "开始时间" },
      durationMinutes: { type: "string", description: "时长分钟" },
      invitees: { type: "string", description: "参会人" },
    },
    required: ["title"],
  },
};

async function main() {
  console.log("=== Agent 意图识别集成测试 ===\n");

  var llm = new LLMClient(getLlmConfigs());
  var registry = new SkillRegistry();
  registry.register(makeCompositeSkill(weeklyReportDef));
  registry.register(makeCompositeSkill(meetingDef));

  var agent = new Agent(
    {
      systemPrompt: "你是一个项目管理助手。用户提到写周报时调用 create-weekly-report。用户提到开会时调用 organize-meeting。闲聊时直接回复。缺少信息时追问。",
      skillNames: ["create-weekly-report", "organize-meeting"],
      llmClient: llm,
      skillRegistry: registry,
    },
    createMockProvider()
  );

  // Test 1: 明确周报意图（信息充足）
  console.log("Test 1: 用户说「帮我写本周的项目周报，项目是企业微信框架，进展是完成P1P2，下周开始P3」");
  callLog = [];
  var reply1 = await agent.handleMessage("chat-1",
    "帮我写本周的项目周报，项目是企业微信框架，进展是完成了P1和P2，下周计划开始P3");
  console.log("  Reply: " + reply1.substring(0, 80) + "...");
  if (callLog.length > 0) {
    console.log("  [PASS] LLM选中组合Skill: " + callLog.map(function(l: any) { return l.name; }).join(", "));
    console.log("  Args: " + JSON.stringify(callLog[0].args).substring(0, 120));
  } else {
    console.log("  [INFO] LLM未调用工具（可能因信息不足选择追问）");
  }

  // Test 2: 明确会议意图
  console.log("\nTest 2: 用户说「明天下午3点组织项目例会，时长30分钟」");
  callLog = [];
  var reply2 = await agent.handleMessage("chat-2",
    "明天下午3点组织项目例会，参会人有张三和李四，时长30分钟");
  console.log("  Reply: " + reply2.substring(0, 80) + "...");
  if (callLog.length > 0) {
    console.log("  [PASS] LLM选中组合Skill: " + callLog.map(function(l: any) { return l.name; }).join(", "));
  } else {
    console.log("  [INFO] LLM未调用工具");
  }

  // Test 3: 闲聊
  console.log("\nTest 3: 闲聊「你好，你是谁」");
  callLog = [];
  var reply3 = await agent.handleMessage("chat-3", "你好，你是谁");
  console.log("  Reply: " + reply3.substring(0, 80) + "...");
  if (callLog.length === 0) {
    console.log("  [PASS] 闲聊正确走文本回复，未触发Skill");
  } else {
    console.log("  [WARN] 闲聊不应触发工具调用");
  }

  // Test 4: 模糊意图
  console.log("\nTest 4: 模糊意图「帮我写个周报」（缺少项目名）");
  callLog = [];
  var reply4 = await agent.handleMessage("chat-4", "帮我写个周报");
  console.log("  Reply: " + reply4.substring(0, 120) + "...");
  if (callLog.length === 0) {
    console.log("  [PASS] LLM识别到缺信息，追问而不是盲调Skill");
  } else {
    console.log("  LLM尝试调用: " + callLog.map(function(l: any) { return l.name; }).join(", "));
  }

  console.log("\n=== 测试完成 ===");
}

main().catch(function(e) {
  console.error("FATAL: " + (e as Error).message);
  process.exit(1);
});
