import crypto from "crypto";

var MCP_CONFIG_ENDPOINT = "https://qyapi.weixin.qq.com/cgi-bin/aibot/cli/get_mcp_config";

interface McpConfigItem {
  url: string;
  type: string;
  is_authed: boolean;
  biz_type: string;
}

function sign(secret: string, botId: string, time: number, nonce: string): string {
  return crypto
    .createHash("sha256")
    .update(secret + botId + time + nonce)
    .digest("hex");
}

function generateReqId(prefix: string): string {
  var timestamp = Date.now();
  var random = Math.random().toString(36).substring(2, 10);
  return prefix + "_" + timestamp + "_" + random;
}

function getUserAgent(): string {
  return "WeComCLI/0.1.8 distribution/npm " + process.platform + "/" + process.arch;
}

export class WeComMcpClient {
  private config: { botId: string; botSecret: string };
  private categoryUrls: Map<string, string> = new Map();

  constructor(config: { botId: string; botSecret: string }) {
    this.config = config;
  }

  async fetchMcpConfig(): Promise<Map<string, string>> {
    var time = Math.floor(Date.now() / 1000);
    var nonce = generateReqId("mcp");
    var signature = sign(this.config.botSecret, this.config.botId, time, nonce);

    var response = await fetch(MCP_CONFIG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": getUserAgent(),
      },
      body: JSON.stringify({
        bot_id: this.config.botId,
        time: time,
        nonce: nonce,
        signature: signature,
        bind_source: 1,
        cli_version: getUserAgent(),
      }),
    });

    if (!response.ok) {
      throw new Error("MCP config fetch failed: HTTP " + response.status);
    }

    var data = (await response.json()) as {
      errcode: number;
      errmsg: string;
      list: McpConfigItem[];
    };

    if (data.errcode !== 0) {
      throw new Error(
        "MCP config error: " + data.errmsg + " (errcode=" + data.errcode + ")"
      );
    }

    this.categoryUrls.clear();
    for (var item of data.list) {
      if (item.biz_type && item.url) {
        this.categoryUrls.set(item.biz_type, item.url);
      }
    }

    return this.categoryUrls;
  }

  async listTools(category: string): Promise<
    Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    var url = this.categoryUrls.get(category);
    if (!url) {
      await this.fetchMcpConfig();
      url = this.categoryUrls.get(category);
      if (!url) {
        throw new Error("Category " + category + " not found in MCP config");
      }
    }
    return this.listToolsWithUrl(url, category);
  }

  private async listToolsWithUrl(
    url: string,
    category: string
  ): Promise<
    Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>
  > {
    var response = await this.jsonRpcCall(url, "tools/list", {});

    var tools = response.result?.tools as Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;

    if (!tools) {
      throw new Error("Category " + category + " returned no tools");
    }

    return tools;
  }

  async callTool(
    category: string,
    method: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    var url = this.categoryUrls.get(category);
    if (!url) {
      await this.fetchMcpConfig();
      url = this.categoryUrls.get(category);
      if (!url) {
        throw new Error("Category " + category + " not found in MCP config");
      }
    }
    return this.callToolWithUrl(url, method, args);
  }

  private async callToolWithUrl(
    url: string,
    method: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    var response = await this.jsonRpcCall(url, "tools/call", {
      name: method,
      arguments: args,
    });

    var content = response.result?.content as Array<{
      type: string;
      text: string;
    }>;

    if (!content || content.length === 0) {
      throw new Error("Tool " + method + " returned empty content. Response: " + JSON.stringify(response).substring(0, 300));
    }

    var item = content[0];
    if (item.type !== "text") {
      throw new Error("Tool " + method + " returned non-text content type: " + item.type);
    }

    // Parse JSON from text — with better error handling
    var parsed: any;
    try {
      parsed = JSON.parse(item.text);
    } catch (parseErr) {
      throw new Error("Tool " + method + " returned non-JSON text: " + item.text.substring(0, 200));
    }

    if (parsed.errcode !== undefined && parsed.errcode !== 0) {
      throw new Error(
        "Tool " + method + " business error: errcode=" + parsed.errcode + " errmsg=" + (parsed.errmsg || "unknown")
      );
    }

    return parsed;
  }

  private async jsonRpcCall(
    url: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<{ result?: Record<string, unknown>; error?: { code: number } }> {
    var body = {
      jsonrpc: "2.0",
      id: generateReqId("rpc"),
      method: method,
      params: params,
    };

    var response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": getUserAgent(),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error("MCP request failed: HTTP " + response.status);
    }

    return response.json();
  }
}
