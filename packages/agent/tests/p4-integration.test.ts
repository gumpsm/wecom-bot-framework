/**
 * P4 集成测试：Agent 时间注入 + 权限拦截 + 闲聊处理
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent } from "../src/agent";
import { LLMClient } from "../../llm/src/client";
import { SkillRegistry } from "../../skills/src/registry";
import { Provider, Skill } from "../../core/src/types";
import { PermissionMiddleware } from "../../core/src/permission-middleware";

function createMockProvider(): Provider {
  return {
    name: "mock",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    onMessage: vi.fn(),
    onEvent: vi.fn(),
    replyWelcome: vi.fn().mockResolvedValue(undefined),
    replyMessage: vi.fn().mockResolvedValue(undefined),
    replyUpdateCard: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    uploadMedia: vi.fn().mockResolvedValue({ media_id: "test_media_id" }),
    callTool: vi.fn().mockResolvedValue({}),
  };
}

function createMockSkill(name: string): Skill {
  return {
    definition: { name, description: "Test: " + name, parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] } },
    execute: vi.fn().mockResolvedValue({ result: "ok" }),
  };
}

describe("P4 Integration", () => {
  let skillRegistry: SkillRegistry;
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    skillRegistry = new SkillRegistry();
    skillRegistry.register(createMockSkill("doc.create_doc"));
    skillRegistry.register(createMockSkill("doc.get_doc_content"));
    skillRegistry.register(createMockSkill("schedule.create_schedule"));
    skillRegistry.register(createMockSkill("todo.create_todo"));
    skillRegistry.register(createMockSkill("create-weekly-report"));
    mockLLMClient = new LLMClient([{ apiKey: "test", baseUrl: "http://localhost", model: "test" }]);
  });

  describe("P4-1: 时间上下文注入", () => {
    it("系统提示包含北京时间（年月日 + 星期）", async () => {
      const agent = new Agent(
        { systemPrompt: "你是测试助手。", skillNames: [], llmClient: mockLLMClient, skillRegistry },
        createMockProvider()
      );
      vi.spyOn(mockLLMClient, "chat").mockResolvedValue({ content: "ok", toolCalls: [], finishReason: "stop" });
      await agent.handleMessage("c1", "你好");
      const sysPrompt = vi.mocked(mockLLMClient.chat).mock.calls[0][0].systemPrompt || "";
      const now = new Date();
      expect(sysPrompt).toContain("北京时间");
      expect(sysPrompt).toContain(String(now.getFullYear()));
      expect(sysPrompt).toContain("星期");
    });

    it("系统提示包含 userId", async () => {
      const agent = new Agent(
        { systemPrompt: "测试", skillNames: [], llmClient: mockLLMClient, skillRegistry },
        createMockProvider()
      );
      vi.spyOn(mockLLMClient, "chat").mockResolvedValue({ content: "ok", toolCalls: [], finishReason: "stop" });
      await agent.handleMessage("c1", "你好", "ShiMeng");
      expect(vi.mocked(mockLLMClient.chat).mock.calls[0][0].systemPrompt).toContain("ShiMeng");
    });

    it("系统提示包含闲聊规则", async () => {
      const agent = new Agent(
        { systemPrompt: "测试", skillNames: [], llmClient: mockLLMClient, skillRegistry },
        createMockProvider()
      );
      vi.spyOn(mockLLMClient, "chat").mockResolvedValue({ content: "ok", toolCalls: [], finishReason: "stop" });
      await agent.handleMessage("c1", "你好");
      expect(vi.mocked(mockLLMClient.chat).mock.calls[0][0].systemPrompt).toContain("核心职能");
    });
  });

  describe("P4-2: 权限拦截执行", () => {
    it("用户有权限时正常执行 skill", async () => {
      const agent = new Agent(
        {
          systemPrompt: "测试", skillNames: ["doc.create_doc"], llmClient: mockLLMClient, skillRegistry,
          permissionCheck: async () => ({ allowed: true }),
        },
        createMockProvider()
      );
      vi.spyOn(mockLLMClient, "chat")
        .mockResolvedValueOnce({ content: null, toolCalls: [{ id: "c1", type: "function", function: { name: "doc.create_doc", arguments: '{"doc_name":"test"}' } }], finishReason: "tool_calls" })
        .mockResolvedValueOnce({ content: "已创建", toolCalls: [], finishReason: "stop" });
      const reply = await agent.handleMessage("c1", "创建文档", "ShiMeng");
      expect(reply).toBe("已创建");
    });

    it("用户无权限时返回拒绝信息", async () => {
      const agent = new Agent(
        {
          systemPrompt: "测试", skillNames: ["doc.create_doc"], llmClient: mockLLMClient, skillRegistry,
          permissionCheck: async () => ({ allowed: false, denyMessage: "您没有权限创建文档" }),
        },
        createMockProvider()
      );
      vi.spyOn(mockLLMClient, "chat")
        .mockResolvedValueOnce({ content: null, toolCalls: [{ id: "c1", type: "function", function: { name: "doc.create_doc", arguments: '{"doc_name":"test"}' } }], finishReason: "tool_calls" })
        .mockResolvedValueOnce({ content: "抱歉，您没有相关权限", toolCalls: [], finishReason: "stop" });
      const reply = await agent.handleMessage("c1", "创建文档", "Guest");
      expect(reply).toContain("权限");
    });

    it("无权限配置时所有 skill 开放", async () => {
      const agent = new Agent(
        { systemPrompt: "测试", skillNames: ["doc.create_doc"], llmClient: mockLLMClient, skillRegistry },
        createMockProvider()
      );
      vi.spyOn(mockLLMClient, "chat")
        .mockResolvedValueOnce({ content: null, toolCalls: [{ id: "c1", type: "function", function: { name: "doc.create_doc", arguments: '{"doc_name":"test"}' } }], finishReason: "tool_calls" })
        .mockResolvedValueOnce({ content: "已创建", toolCalls: [], finishReason: "stop" });
      const reply = await agent.handleMessage("c1", "创建文档");
      expect(reply).toBe("已创建");
    });

    it("被拒绝的 skill 不调用 registry.execute", async () => {
      const spy = vi.spyOn(skillRegistry, "execute");
      const agent = new Agent(
        {
          systemPrompt: "测试", skillNames: ["doc.create_doc"], llmClient: mockLLMClient, skillRegistry,
          permissionCheck: async () => ({ allowed: false, denyMessage: "禁止" }),
        },
        createMockProvider()
      );
      vi.spyOn(mockLLMClient, "chat")
        .mockResolvedValueOnce({ content: null, toolCalls: [{ id: "c1", type: "function", function: { name: "doc.create_doc", arguments: '{"doc_name":"test"}' } }], finishReason: "tool_calls" })
        .mockResolvedValueOnce({ content: "禁止", toolCalls: [], finishReason: "stop" });
      await agent.handleMessage("c1", "创建", "Guest");
      const docCreateCalls = spy.mock.calls.filter((c: any[]) => c[0] === "doc.create_doc");
      expect(docCreateCalls.length).toBe(0);
    });
  });

  describe("PermissionMiddleware 场景覆盖", () => {
    let middleware: PermissionMiddleware;

    beforeEach(() => {
      middleware = new PermissionMiddleware({
        roles: {
          "用户:ShiMeng": { skills: ["*"] },
          "岗位:项目经理": { skills: ["doc.*", "schedule.*", "create-weekly-report"] },
          "标签:党员": { skills: ["party-vote"] },
        },
        defaultRole: { skills: ["doc.get_doc_content", "todo.get_todo_list"] },
        denyMessage: "权限不足",
      });
    });

    it("通配符 * 匹配所有 skill", async () => {
      vi.spyOn(middleware as any, "getUserInfo").mockResolvedValue({ userId: "ShiMeng", departments: [], position: "", tags: [], fetchedAt: Date.now() });
      expect((await middleware.check("ShiMeng", "doc.create_doc")).allowed).toBe(true);
      expect((await middleware.check("ShiMeng", "some.random.skill")).allowed).toBe(true);
    });

    it("品类通配符 doc.* 匹配品类下所有", async () => {
      vi.spyOn(middleware as any, "getUserInfo").mockResolvedValue({ userId: "pm1", departments: [], position: "项目经理", tags: [], fetchedAt: Date.now() });
      expect((await middleware.check("pm1", "doc.create_doc")).allowed).toBe(true);
      expect((await middleware.check("pm1", "doc.get_doc_content")).allowed).toBe(true);
      expect((await middleware.check("pm1", "todo.create_todo")).allowed).toBe(false);
    });

    it("defaultRole 兜底：无匹配角色时使用", async () => {
      vi.spyOn(middleware as any, "getUserInfo").mockResolvedValue({ userId: "stranger", departments: [], position: "普通员工", tags: [], fetchedAt: Date.now() });
      expect((await middleware.check("stranger", "doc.get_doc_content")).allowed).toBe(true);
      expect((await middleware.check("stranger", "todo.get_todo_list")).allowed).toBe(true);
      expect((await middleware.check("stranger", "doc.create_doc")).allowed).toBe(false);
    });

    it("多角色并集：同时匹配项目经理 + 党员", async () => {
      vi.spyOn(middleware as any, "getUserInfo").mockResolvedValue({ userId: "pm_party", departments: [], position: "项目经理", tags: ["党员"], fetchedAt: Date.now() });
      expect((await middleware.check("pm_party", "doc.create_doc")).allowed).toBe(true);
      expect((await middleware.check("pm_party", "party-vote")).allowed).toBe(true);
      expect((await middleware.check("pm_party", "todo.create_todo")).allowed).toBe(false);
    });

    it("无权限配置时全部开放", async () => {
      const mw = new PermissionMiddleware();
      expect((await mw.check("anyone", "any.skill")).allowed).toBe(true);
    });
  });
});