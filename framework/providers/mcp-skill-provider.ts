// MCP Skill Provider — 从 MCP tools/list 自动生成原子 Skill
import { SkillDefinition, Skill, Provider } from "@wecom-bot/core";
import { WeComMcpClient } from "./mcp-client";

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
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
          var def: SkillDefinition = {
            name: cat + "." + t.name,
            description: t.description || (cat + " " + t.name),
            parameters: this.schemaToParams(t.inputSchema),
          };

          var self = this;
          var category = cat;
          var method = t.name;
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
