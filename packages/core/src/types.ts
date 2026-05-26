// 核心类型定义 — 所有模块共享

// ====== LLM 相关 ======

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | "content_filter";
}

export interface StreamDelta {
  type: "text" | "tool_call";
  content?: string;
  toolCall?: Partial<ToolCall>;
}

// ====== Skill 相关 ======

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, SkillParameter>;
    required: string[];
  };
}

export interface SkillParameter {
  type: string;
  description: string;
  enum?: string[];
}

export interface Skill {
  readonly definition: SkillDefinition;
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export interface CompositeSkill extends Skill {
  readonly steps: SkillStep[];
}

export interface SkillStep {
  skill: string;
  args: Record<string, unknown> | ((prevResult: unknown) => Record<string, unknown>);
}

// ====== 消息帧 ======

export interface WsFrame {
  cmd: string;
  headers: {
    req_id: string;
    errcode?: number;
    errmsg?: string;
  };
  body?: Record<string, unknown>;
}

export interface MessageCallback extends WsFrame {
  cmd: "aibot_msg_callback";
  body: {
    msgid: string;
    aibotid: string;
    chatid?: string;
    chattype: "single" | "group";
    from: { userid: string };
    msgtype: "text" | "image" | "mixed" | "voice" | "file" | "video";
    text?: { content: string };
    image?: { url: string; aeskey?: string };
    mixed?: { msg_item: MixedItem[] };
    voice?: { url: string; aeskey?: string };
    file?: { url: string; aeskey?: string };
    video?: { url: string; aeskey?: string };
  };
}

export interface MixedItem {
  msgtype: "text" | "image";
  text?: { content: string };
  image?: { url: string; aeskey?: string };
}

export interface EventCallback extends WsFrame {
  cmd: "aibot_event_callback";
  body: {
    msgid: string;
    create_time: number;
    aibotid: string;
    chatid?: string;
    chattype?: "single" | "group";
    from?: { userid: string };
    msgtype: "event";\n    response_url?: string;
    event: {
      eventtype: "enter_chat" | "template_card_event" | "feedback_event" | "disconnected_event";
      template_card_event?: TemplateCardEvent;
      feedback_event?: FeedbackEvent;
    };
  };
}

export interface TemplateCardEvent {\n  card_type: string;\n  event_key: string;\n  task_id: string;\n  selected_items?: SelectedItems;\n}\n\nexport interface SelectedItems {\n  selected_item: SelectedItem[];\n}\n\nexport interface SelectedItem {\n  question_key: string;\n  option_ids: { option_id: string[] };\n}

export interface FeedbackEvent {
  id: string;
  type: 1 | 2; // 1=好评, 2=差评
  content?: string;
}

// ====== Bot 配置 ======

export interface BotConfig {
  instanceId: string;
  botId: string;
  botSecret: string;
  systemPrompt: string;
  skills: string[];
  llm: LLMConfig;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  backupApiKeys?: string[];
}

// ====== Provider 接口 ======

export interface Provider {
  readonly name: string;
  
  connect(config: { botId: string; botSecret: string }): Promise<void>;
  disconnect(): void;
  onMessage(handler: (frame: MessageCallback) => void): void;
  onEvent(handler: (frame: EventCallback) => void): void;
  
  replyWelcome(frame: EventCallback, body: Record<string, unknown>): Promise<void>;
  replyMessage(frame: MessageCallback, body: Record<string, unknown>): Promise<void>;
  replyUpdateCard(frame: EventCallback, body: Record<string, unknown>): Promise<void>;
  sendMessage(chatId: string, chatType: number, body: Record<string, unknown>): Promise<void>;
  
  uploadMedia(fileBuffer: Buffer, filename: string, type: string): Promise<{ media_id: string }>;
  
  callTool(category: string, method: string, args: Record<string, unknown>): Promise<unknown>;
}
