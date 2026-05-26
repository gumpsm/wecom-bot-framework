import WebSocket from "ws";
import { EventEmitter } from "events";
import { WeComMcpClient } from "./mcp-client";
import { MessageCallback, EventCallback, WsFrame, Provider } from "@wecom-bot/core";

var WS_URL = "wss://openws.work.weixin.qq.com";
var HEARTBEAT_INTERVAL = 30000;
var RECONNECT_BASE_DELAY = 1000;
var RECONNECT_MAX_DELAY = 30000;
var MAX_RECONNECT_ATTEMPTS = 10;

type MessageHandler = (frame: MessageCallback) => void;
type EventHandler = (frame: EventCallback) => void;

function generateReqId(prefix: string): string {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).substring(2, 10);
}

// Simple HTTP POST without external deps (uses Node built-in http/https)
function httpPostJson(url: string, body: object): Promise<void> {
  return new Promise(function(resolve, reject) {
    var parsed = new URL(url);
    var mod = parsed.protocol === "https:" ? require("https") : require("http");
    var data = JSON.stringify(body);
    var req = mod.request({
      method: "POST",
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      timeout: 5000,
    }, function(res: any) {
      var chunks: Buffer[] = [];
      res.on("data", function(c: Buffer) { chunks.push(c); });
      res.on("end", function() {
        var respText = Buffer.concat(chunks).toString("utf-8");
        try {
          var resp = JSON.parse(respText);
          if (resp.errcode === 0) resolve();
          else reject(new Error("WeCom HTTP error: errcode=" + resp.errcode + " errmsg=" + (resp.errmsg || "")));
        } catch (e) {
          reject(new Error("Invalid response: " + respText));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", function() { req.destroy(); reject(new Error("HTTP timeout")); });
    req.write(data);
    req.end();
  });
}

export class WeComWsProvider extends EventEmitter implements Provider {
  readonly name = "wecom-ws";
  private ws: WebSocket | null = null;
  private config!: { botId: string; botSecret: string };
  private reconnectAttempts = 0;
  private messageHandlers: MessageHandler[] = [];
  private eventHandlers: EventHandler[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastPongTime = 0;
  private isManualDisconnect = false;
  private mcpClient: WeComMcpClient | null = null;
  private pendingRequests = new Map<string, {
    resolve: (frame: WsFrame) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }>();

  // ====== Provider ======

  async connect(config: { botId: string; botSecret: string }): Promise<void> {
    this.config = config;
    this.isManualDisconnect = false;
    await this.doConnect();
  }

  disconnect(): void {
    this.isManualDisconnect = true;
    this.clearTimers();
    if (this.ws) { this.ws.close(1000, "Manual disconnect"); this.ws = null; }
    for (var p of this.pendingRequests.values()) { p.reject(new Error("Disconnected")); }
    this.pendingRequests.clear();
  }

  onMessage(h: MessageHandler): void { this.messageHandlers.push(h); }
  onEvent(h: EventHandler): void { this.eventHandlers.push(h); }

  setMcpClient(client: WeComMcpClient): void { this.mcpClient = client; }

  // ====== Reply (fire-and-forget via WS) ======

  async replyWelcome(frame: EventCallback, body: Record<string, unknown>): Promise<void> {
    this.send({ cmd: "aibot_respond_welcome_msg", headers: { req_id: frame.headers.req_id }, body });
  }
  async replyMessage(frame: MessageCallback, body: Record<string, unknown>): Promise<void> {
    this.send({ cmd: "aibot_respond_msg", headers: { req_id: frame.headers.req_id }, body });
  }
  // Update card via WS (must be within 5s of event callback, uses event req_id)
  async replyUpdateCard(frame: EventCallback, body: Record<string, unknown>): Promise<void> {
    this.send({ cmd: "aibot_respond_update_msg", headers: { req_id: frame.headers.req_id }, body });
  }
  // Update card via HTTP POST to response_url (no 5s time limit)
  async updateCardViaUrl(responseUrl: string, templateCard: Record<string, unknown>): Promise<void> {
    await httpPostJson(responseUrl, {
      response_type: "update_template_card",
      template_card: templateCard,
    });
  }
  async sendMessage(chatId: string, chatType: number, body: Record<string, unknown>): Promise<void> {
    this.send({ cmd: "aibot_send_msg", headers: { req_id: generateReqId("sendmsg") }, body: Object.assign({}, body, { chatid: chatId, chat_type: chatType }) });
  }

  // ====== Upload ======

  async uploadMedia(fileBuffer: Buffer, filename: string, type: string): Promise<{ media_id: string }> {
    var totalSize = fileBuffer.length;
    var chunkSize = 512 * 1024;
    var totalChunks = Math.ceil(totalSize / chunkSize);

    var initResult = await this.request("aibot_upload_media_init", {
      req_id: generateReqId("ul_init"),
      body: { type, filename, total_size: totalSize, total_chunks: totalChunks, md5: "" },
    });
    var uploadId = initResult.body?.upload_id as string;
    if (!uploadId) throw new Error("Upload init failed: no upload_id");

    for (var i = 0; i < totalChunks; i++) {
      var chunk = fileBuffer.slice(i * chunkSize, (i + 1) * chunkSize);
      await this.request("aibot_upload_media_chunk", {
        req_id: generateReqId("ul_chunk"),
        body: { upload_id: uploadId, chunk_index: i, base64_data: chunk.toString("base64") },
      });
    }

    var finishResult = await this.request("aibot_upload_media_finish", {
      req_id: generateReqId("ul_finish"),
      body: { upload_id: uploadId },
    });
    var mediaId = finishResult.body?.media_id as string;
    if (!mediaId) throw new Error("Upload finish failed: no media_id");

    return { media_id: mediaId };
  }

  // ====== CLI (P2) ======

  async callTool(category: string, method: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.mcpClient) throw new Error("MCP client not configured. Call setMcpClient() first.");
    return this.mcpClient.callTool(category, method, args);
  }

  // ====== Internal ======

  private send(frame: WsFrame): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private request(cmd: string, params: { req_id: string; body?: Record<string, unknown> }): Promise<WsFrame> {
    var self = this;
    return new Promise(function(resolve, reject) {
      if (!self.ws || self.ws.readyState !== WebSocket.OPEN) { reject(new Error("WS not connected")); return; }
      var reqId = params.req_id;
      var timer = setTimeout(function() { self.pendingRequests.delete(reqId); reject(new Error("Timeout cmd=" + cmd)); }, 15000);
      self.pendingRequests.set(reqId, { resolve, reject, timer });
      self.ws!.send(JSON.stringify({ cmd, headers: { req_id: reqId }, body: params.body }));
    });
  }

  private doConnect(): Promise<void> {
    var self = this;
    return new Promise(function(resolve, reject) {
      self.ws = new WebSocket(WS_URL);
      var subscribed = false;

      self.ws.on("open", function() {
        var subFrame = JSON.stringify({ cmd: "aibot_subscribe", headers: { req_id: generateReqId("subscribe") }, body: { bot_id: self.config.botId, secret: self.config.botSecret } });
        self.ws!.send(subFrame);
        subscribed = true;
        self.reconnectAttempts = 0;
        self.startHeartbeat();
        console.log("[WS] Connected & subscribed");
        resolve();
      });

      self.ws.on("message", function(data) {
        try {
          var raw = data.toString();
          var frame = JSON.parse(raw) as WsFrame;

          // errcode check for request-response
          var reqId = frame.headers?.req_id;
          var hasErrcode = frame.errcode !== undefined || frame.headers?.errcode !== undefined;

          if (hasErrcode && reqId) {
            var pending = self.pendingRequests.get(reqId);
            if (pending) {
              self.pendingRequests.delete(reqId);
              clearTimeout(pending.timer);
              var errcode = (frame.errcode ?? frame.headers?.errcode) as number;
              if (errcode === 0) {
                pending.resolve(frame);
              } else {
                pending.reject(new Error("WeCom error: errcode=" + errcode + " errmsg=" + (frame.errmsg || frame.headers?.errmsg || "unknown")));
              }
              return;
            }
          }

          // Push frame (message or event callback)
          if (frame.cmd === "aibot_msg_callback") {
            for (var i = 0; i < self.messageHandlers.length; i++) self.messageHandlers[i](frame as MessageCallback);
          } else if (frame.cmd === "aibot_event_callback") {
            for (var j = 0; j < self.eventHandlers.length; j++) self.eventHandlers[j](frame as EventCallback);
          }

          self.lastPongTime = Date.now();
        } catch (err) {
          console.error("[WS] Parse error: " + (err as Error).message);
        }
      });

      self.ws.on("close", function(code, reason) {
        self.clearTimers();
        if (!self.isManualDisconnect) self.scheduleReconnect();
      });

      self.ws.on("error", function(err) { console.error("[WS] " + err.message); });

      setTimeout(function() { if (!subscribed) reject(new Error("Connection timeout")); }, 15000);
    });
  }

  private startHeartbeat(): void {
    var self = this;
    this.lastPongTime = Date.now();
    this.heartbeatTimer = setInterval(function() {
      if (Date.now() - self.lastPongTime > HEARTBEAT_INTERVAL * 3) {
        console.warn("[WS] Heartbeat timeout, reconnecting...");
        self.ws?.close();
        return;
      }
      self.send({ cmd: "ping", headers: { req_id: generateReqId("ping") } });
    }, HEARTBEAT_INTERVAL);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) { console.error("[WS] Max reconnect reached"); this.emit("reconnect_failed"); return; }
    var delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts), RECONNECT_MAX_DELAY);
    var self = this;
    this.reconnectTimer = setTimeout(function() { self.reconnectAttempts++; self.doConnect().catch(function(e) { console.error("[WS] Reconnect failed: " + (e as Error).message); }); }, delay);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }
}
