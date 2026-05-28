// MCP Skill Provider — 从 MCP tools/list 自动生成原子 Skill
import { SkillDefinition, Skill, Provider } from "@wecom-bot/core";
import { WeComMcpClient } from "./mcp-client";

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

function buildSkillName(cat: string, method: string): string {
  // 去掉 method 中重复的品类词（含复数），如 get_schedule_list → get_list
  var clean = method.replace(new RegExp("(^|_)" + cat + "s?(_|$)", "g"), "$1$2");
  // 特殊: msg 品类对应 message 语义相同，去掉重复
  if (cat === "msg") { clean = clean.replace(/_message\b/g, ""); }
  // 清理多余的 _
  clean = clean.replace(/^_+|_+$/g, "").replace(/__+/g, "_");
  if (!clean) clean = cat;
  // 转 CamelCase
  var parts = clean.split("_");
  return cat + "_" + parts.map(function(p, i) { return i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1); }).join("");
}

export class McpSkillProvider {
  private client: WeComMcpClient;
  private skills: Map<string, Skill> = new Map();
  private toolsByCategory: Map<string, ToolDef[]> = new Map();

  constructor(config: { botId: string; botSecret: string }) {
    this.client = new WeComMcpClient(config);
  }

  // Fetch all tools and register as skills
  async initialize(): Promise<void> {
    var categories = await this.client.fetchMcpConfig();
    this.skills.clear();
    this.toolsByCategory.clear();

    for (var cat of categories.keys()) {
      try {
        var tools = await this.client.listTools(cat);
        this.toolsByCategory.set(cat, tools);

        for (var t of tools) {
          var skillName = buildSkillName(cat, t.name);
          var def: SkillDefinition = {
            name: skillName,
            description: t.description || (cat + " " + t.name),
            parameters: this.schemaToParams(t.inputSchema),
          };

          var self = this;
          const category = cat;
          const method = t.name;
          var skill: Skill = {
            definition: def,
            execute: function(args: Record<string, unknown>) {
              return self.client.callTool(category, method, args);
            },
          };

          this.skills.set(def.name, skill);
        }
      } catch (e) {
        console.warn("[McpSkillProvider] Failed to load tools for " + cat + ": " + (e as Error).message);
      }
    }
    console.log("[McpSkillProvider] Initialized " + this.skills.size + " skills across " + categories.size + " categories");
  }

  // Get all registered skills
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  // Get skill by name
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  // Get tool list for a category
  getToolsForCategory(category: string): ToolDef[] {
    return this.toolsByCategory.get(category) || [];
  }

  // Get all category names
  getCategories(): string[] {
    return Array.from(this.toolsByCategory.keys());
  }

  // Convert JSON Schema to SkillDefinition parameters
  private schemaToParams(schema: Record<string, unknown>): {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  } {
    var props: Record<string, { type: string; description: string; enum?: string[] }> = {};
    var req: string[] = [];

    if (schema.type === "object" && schema.properties) {
      var sp = schema.properties as Record<string, Record<string, unknown>>;
      var sr = (schema.required as string[]) || [];

      for (var key of Object.keys(sp)) {
        var p = sp[key];
        var paramType = (p.type as string) || "string";

        // Handle enum
        var enumVals: string[] | undefined;
        if (p.enum && Array.isArray(p.enum)) {
          enumVals = p.enum.map(function(v: unknown) { return String(v); });
        }

        props[key] = {
          type: paramType,
          description: (p.description as string) || key,
          enum: enumVals,
        };

        if (sr.indexOf(key) >= 0) req.push(key);
      }
    }

    return { type: "object", properties: props, required: req };
  }

  // Get underlying MCP client (for direct access)
  getClient(): WeComMcpClient {
    return this.client;
  }
}
