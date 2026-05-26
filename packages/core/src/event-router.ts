// 事件路由器 — 将 template_card_event 按 task_id 路由到对应 Skill
import { EventCallback, TemplateCardEvent } from "@wecom-bot/core";

export interface CardEventHandler {
  (event: EventCallback, cardEvent: TemplateCardEvent): Promise<void>;
}

export class EventRouter {
  // task_id → handler map
  private handlers: Map<string, { handler: CardEventHandler; ttl: number }> = new Map();
  // Cleanup interval (every 5 minutes)
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    var self = this;
    this.cleanupTimer = setInterval(function() { self.cleanup(); }, 300000);
  }

  // Register a handler for a specific task_id
  register(taskId: string, handler: CardEventHandler, ttlMs: number = 600000): void {
    this.handlers.set(taskId, { handler: handler, ttl: Date.now() + ttlMs });
  }

  // Handle an incoming event — route to registered handler
  async handleEvent(event: EventCallback): Promise<boolean> {
    var etype = event.body?.event?.eventtype;
    if (etype !== "template_card_event") return false;

    var cardEvent = event.body?.event?.template_card_event;
    if (!cardEvent || !cardEvent.task_id) return false;

    var entry = this.handlers.get(cardEvent.task_id);
    if (!entry) {
      console.log("[EventRouter] No handler registered for task_id=" + cardEvent.task_id);
      return false;
    }

    // Remove one-shot handler after use
    this.handlers.delete(cardEvent.task_id);

    try {
      await entry.handler(event, cardEvent);
      return true;
    } catch (e) {
      console.error("[EventRouter] Handler error for task_id=" + cardEvent.task_id + ": " + (e as Error).message);
      return false;
    }
  }

  // Clean up expired handlers
  private cleanup(): void {
    var now = Date.now();
    for (var entry of this.handlers.entries()) {
      if (entry[1].ttl < now) this.handlers.delete(entry[0]);
    }
  }

  // Shutdown
  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.handlers.clear();
  }
}
