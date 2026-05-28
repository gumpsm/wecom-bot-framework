import { LLMClient, LLMClientConfig } from "@wecom-bot/llm";
import { SkillRegistry } from "@wecom-bot/skills";
import { Agent, AgentConfig } from "@wecom-bot/agent";
import { WeComWsProvider } from "@wecom-bot/providers";
import { WeComMcpClient } from "../../providers/src/wecom/mcp-client";
import { McpSkillProvider } from "../../providers/src/wecom/mcp-skill-provider";
import { PermissionMiddleware } from "./permission-middleware";
import { EventRouter } from "./event-router";
import { BotConfig, Skill } from "./types";
import { createCompositeSkillDepsFactory, createCompositeSkill, CompositeSkillDeps } from "../../skills/src/composite-adapter";

// Composite skill definitions + functions
import { weeklyReportDefinition, createWeeklyReport, WeeklyReportInput } from "../../../composite-skills/create-weekly-report";
import { organizeMeetingDefinition, organizeMeeting, MeetingInput } from "../../../composite-skills/organize-meeting";
import { meetingMinutesDefinition, createMeetingMinutes, MeetingMinutesInput } from "../../../composite-skills/meeting-minutes";
import { partyVoteDefinition, sendPartyVote, PartyVoteInput } from "../../../composite-skills/party-vote";
import { infoGatheringDefinition, gatherAndAnalyze, AnalysisRequest } from "../../../composite-skills/info-gathering";

interface BotInstance {
  config: BotConfig;
  provider: WeComWsProvider;
  agent: Agent;
  skillRegistry: SkillRegistry;
}

export class BotManager {
  private bots = new Map<string, BotInstance>();
  private globalSkillRegistry = new SkillRegistry();
  private llmClient: LLMClient;
  private mcpClient: WeComMcpClient | null = null;
  private mcpSkillProvider: McpSkillProvider | null = null;
  private eventRouter: EventRouter = new EventRouter();
  private compositeSkillsRegistered = false;
  private permissionMiddleware: PermissionMiddleware | null = null;

  constructor(llmConfigs: LLMClientConfig[]) {
    this.llmClient = new LLMClient(llmConfigs);
  }

  async enableMcp(config: { botId: string; botSecret: string }): Promise<void> {
    this.mcpClient = new WeComMcpClient(config);
    this.mcpSkillProvider = new McpSkillProvider(config);
    await this.mcpSkillProvider.initialize();
    var allSkills = this.mcpSkillProvider.getAllSkills();
    for (var i = 0; i < allSkills.length; i++) {
      this.globalSkillRegistry.register(allSkills[i]);
    }
    console.log("[BotManager] MCP enabled: " + allSkills.length + " skills");
  }

  getEventRouter(): EventRouter { return this.eventRouter; }
  getMcpClient(): WeComMcpClient | null { return this.mcpClient; }
  getMcpSkillProvider(): McpSkillProvider | null { return this.mcpSkillProvider; }
  getPermissionMiddleware(): PermissionMiddleware | null { return this.permissionMiddleware; }

  registerGlobalSkill(skill: Parameters<SkillRegistry["register"]>[0]): void {
    this.globalSkillRegistry.register(skill);
  }

  getGlobalSkillRegistry(): SkillRegistry { return this.globalSkillRegistry; }

  // Register all 5 composite skills with proper parameter adapters
  private registerCompositeSkills(): void {
    if (this.compositeSkillsRegistered) return;
    var self = this;

    // Create deps factory
    var depsFactory = createCompositeSkillDepsFactory(
      function(cat: string, m: string, args: Record<string, unknown>) {
        if (!self.mcpClient) throw new Error("MCP not enabled");
        return self.mcpClient.callTool(cat, m, args);
      },
      this.llmClient
    );

    // 1. Weekly Report: progress/nextPlan arrive as strings, need to split
    var weeklySkill = createCompositeSkill<Record<string, unknown>, any>(
      weeklyReportDefinition,
      async function(args: Record<string, unknown>, deps: CompositeSkillDeps) {
        var input: WeeklyReportInput = {
          projectName: (args.projectName as string) || "",
          weekRange: (args.weekRange as string) || "",
          progress: ((args.progress as string) || "").split("\n").filter(function(s: string) { return s.trim(); }),
          nextPlan: ((args.nextPlan as string) || "").split("\n").filter(function(s: string) { return s.trim(); }),
        };
        if ((args as any).risks) {
          try { input.risks = JSON.parse((args as any).risks as string); } catch(e) { /* ignore */ }
        }
        if ((args as any).members) {
          input.members = ((args as any).members as string).split(/[,，]/).filter(function(s: string) { return s.trim(); });
        }
        deps.systemPrompt = "你是一个专业的项目周报撰写助手。请保持原有结构和内容，只优化表达。";
        return createWeeklyReport(input, deps);
      },
      depsFactory
    );
    this.globalSkillRegistry.register(weeklySkill);
    console.log("[BotManager] Registered composite: create-weekly-report");

    // 2. Organize Meeting: invitees arrive as comma-separated userid string
    var meetingSkill = createCompositeSkill<Record<string, unknown>, any>(
      organizeMeetingDefinition,
      async function(args: Record<string, unknown>, deps: CompositeSkillDeps) {
        var inviteeStr = (args.invitees as string) || "";
        var invitees = inviteeStr.split(/[,，]/).filter(function(s: string) { return s.trim(); })
          .map(function(uid: string) { return { userid: uid.trim() }; });
        var input: MeetingInput = {
          title: (args.title as string) || "",
          startTime: (args.startTime as string) || "",
          durationMinutes: parseInt((args.durationMinutes as string) || "30", 10),
          invitees: invitees,
          description: (args.description as string) || "",
          location: (args.location as string) || "",
        };
        return organizeMeeting(input, deps);
      },
      depsFactory
    );
    this.globalSkillRegistry.register(meetingSkill);
    console.log("[BotManager] Registered composite: organize-meeting");

    // 3. Meeting Minutes
    var minutesSkill = createCompositeSkill<Record<string, unknown>, any>(
      meetingMinutesDefinition,
      async function(args: Record<string, unknown>, deps: CompositeSkillDeps) {
        var attendeesStr = (args.attendees as string) || "";
        var input: MeetingMinutesInput = {
          meetingTitle: (args.meetingTitle as string) || "",
          meetingDate: (args.meetingDate as string) || "",
          rawContent: (args.rawContent as string) || "",
          attendees: attendeesStr ? attendeesStr.split(/[,，]/).filter(function(s: string) { return s.trim(); }) : [],
          template: ((args.template as string) || "standard") as any,
        };
        return createMeetingMinutes(input, deps);
      },
      depsFactory
    );
    this.globalSkillRegistry.register(minutesSkill);
    console.log("[BotManager] Registered composite: meeting-minutes");

    // 4. Party Vote: candidates arrive as comma-separated names
    var voteSkill = createCompositeSkill<Record<string, unknown>, any>(
      partyVoteDefinition,
      async function(args: Record<string, unknown>, deps: CompositeSkillDeps) {
        var candidateStr = (args.candidates as string) || "";
        var names = candidateStr.split(/[,，]/).filter(function(s: string) { return s.trim(); });
        var options = names.map(function(name: string, idx: number) {
          return { id: "candidate_" + idx, text: name.trim() };
        });
        var questions = [{ key: "candidate", title: "推荐人选", options: options }];
        if ((args as any).questions) {
          try {
            var extra = JSON.parse((args as any).questions as string);
            for (var q of extra) {
              questions.push({
                key: q.key,
                title: q.title,
                options: (q.options || []).map(function(opt: string, oi: number) {
                  return { id: q.key + "_" + oi, text: opt };
                }),
              });
            }
          } catch(e) { /* ignore */ }
        }
        var input: PartyVoteInput = {
          title: (args.title as string) || "",
          description: (args.description as string) || "请选择您的推荐",
          questions: questions,
        };
        return sendPartyVote(input, deps);
      },
      depsFactory
    );
    this.globalSkillRegistry.register(voteSkill);
    console.log("[BotManager] Registered composite: party-vote");

    // 5. Info Gathering
    var infoSkill = createCompositeSkill<Record<string, unknown>, any>(
      infoGatheringDefinition,
      async function(args: Record<string, unknown>, deps: CompositeSkillDeps) {
        var input: AnalysisRequest = {
          topic: (args.topic as string) || "",
          sources: [{ type: "manual", label: "用户提供的数据", data: (args.dataSummary as string) || "" }],
          outputFormat: ((args.outputFormat as string) || "report") as any,
        };
        return gatherAndAnalyze(input, deps);
      },
      depsFactory
    );
    this.globalSkillRegistry.register(infoSkill);
    console.log("[BotManager] Registered composite: info-gathering");

    this.compositeSkillsRegistered = true;
  }

  async startBot(config: BotConfig): Promise<void> {
    console.log("[BotManager] Starting bot: " + config.instanceId);

    if (!this.compositeSkillsRegistered) {
      this.registerCompositeSkills();
    }

    var provider = new WeComWsProvider();
    if (this.mcpClient) {
      provider.setMcpClient(this.mcpClient);
    }

    var botSkillRegistry = new SkillRegistry();
    var globalSkillNames = this.globalSkillRegistry.list();
    for (var i = 0; i < globalSkillNames.length; i++) {
      var skill = this.globalSkillRegistry.get(globalSkillNames[i]);
      if (skill) botSkillRegistry.register(skill);
    }

    var configuredSkills = config.skills.length > 0 ? config.skills : globalSkillNames;

    // 初始化权限中间件
    var self = this;
    var permMiddleware: PermissionMiddleware | null = null;
    if (config.permissions && Object.keys(config.permissions.roles).length > 0) {
      permMiddleware = new PermissionMiddleware(config.permissions, this.mcpClient || undefined);
      this.permissionMiddleware = permMiddleware;
      console.log('[BotManager] 权限控制已启用: ' + Object.keys(config.permissions.roles).length + ' 个角色');
    }

    var agent = new Agent(
      {
        systemPrompt: config.systemPrompt,
        skillNames: configuredSkills,
        llmClient: this.llmClient,
        skillRegistry: botSkillRegistry,
        permissionCheck: permMiddleware
          ? async function(skillName: string, userId: string) { return permMiddleware!.check(userId, skillName); }
          : undefined,
      },
      provider
    );

    var instance: BotInstance = { config, provider, agent, skillRegistry: botSkillRegistry };

    provider.onMessage(async function(frame) {
      var chatId = frame.body?.chatid ?? frame.body?.from?.userid ?? "unknown";
      var userId = frame.body?.from?.userid;
      var userMessage = "";
      if (frame.body?.msgtype === "text" && frame.body?.text) {
        userMessage = frame.body.text.content || "";
        if (frame.body.chattype === "group") {
          userMessage = userMessage.replace(/@\S+\s*/, "").trim();
        }
      } else if (frame.body?.msgtype === "mixed" && frame.body?.mixed) {
        var textItem = frame.body.mixed.msg_item?.find(function(i: any) { return i.msgtype === "text"; });
        userMessage = textItem?.text?.content ?? "";
      } else {
        userMessage = "[非文本消息]";
      }
      console.log("[Bot:" + config.instanceId + "] " + frame.body?.msgtype + ": " + userMessage.slice(0, 50));
      try {
        var reply = await agent.handleMessage(chatId, userMessage, userId);
        await provider.replyMessage(frame, {
          msgtype: "stream", stream: { id: "reply_" + Date.now(), finish: true, content: reply },
        });
      } catch (err) {
        console.error("[Bot:" + config.instanceId + "] Error: " + (err as Error).message);
        try {
          await provider.replyMessage(frame, {
            msgtype: "stream", stream: { id: "err_" + Date.now(), finish: true, content: "抱歉，处理您的消息时出了点问题，请稍后再试。" },
          });
        } catch (replyErr) { /* ignore */ }
      }
    });

    provider.onEvent(async function(frame) {
      var eventType = frame.body?.event?.eventtype;
      console.log("[Bot:" + config.instanceId + "] Event: " + eventType);
      if (eventType === "template_card_event") {
        var handled = await self.eventRouter.handleEvent(frame);
        if (!handled) {
          console.log("[Bot:" + config.instanceId + "] Unhandled template_card_event");
        }
      }
      if (eventType === "enter_chat") {
        try {
          await provider.replyWelcome(frame, {
            msgtype: "text",
            text: { content: "您好！我是智能助手，有什么可以帮您的吗？" },
          });
        } catch (err) { /* ignore */ }
      }
    });

    await provider.connect({ botId: config.botId, botSecret: config.botSecret });
    this.bots.set(config.instanceId, instance);
    console.log("[BotManager] Bot " + config.instanceId + " started");
  }

  async stopBot(instanceId: string): Promise<void> {
    var instance = this.bots.get(instanceId);
    if (instance) {
      instance.provider.disconnect();
      instance.agent.clearHistory(instanceId);
      this.bots.delete(instanceId);
    }
  }

  async stopAll(): Promise<void> {
    var ids = Array.from(this.bots.keys());
    for (var i = 0; i < ids.length; i++) { await this.stopBot(ids[i]); }
  }

  getStatus(): Array<{ instanceId: string; running: boolean }> {
    return Array.from(this.bots.entries()).map(function(entry: [string, BotInstance]) {
      return { instanceId: entry[0], running: true };
    });
  }
}
