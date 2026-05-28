// 鏍稿績绫诲瀷瀹氫箟 鈥?鎵€鏈夋ā鍧楀叡浜?
// ====== LLM 鐩稿叧 ======

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string;
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
  reasoning_content?: string;
}

export interface StreamDelta {
  type: "text" | "tool_call";
  content?: string;
  toolCall?: Partial<ToolCall>;
}

// ====== Skill 鐩稿叧 ======

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

// ====== 娑堟伅甯?======

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
    msgtype: "event";
    response_url?: string;
    event: {
      eventtype: "enter_chat" | "template_card_event" | "feedback_event" | "disconnected_event";
      template_card_event?: TemplateCardEvent;
      feedback_event?: FeedbackEvent;
    };
  };
}

export interface TemplateCardEvent {
  card_type: string;
  event_key: string;
  task_id: string;
  selected_items?: SelectedItems;
}

export interface SelectedItems {
  selected_item: SelectedItem[];
}

export interface SelectedItem {
  question_key: string;
  option_ids: { option_id: string[] };
}

export interface FeedbackEvent {
  id: string;
  type: 1 | 2; // 1=濂借瘎, 2=宸瘎
  content?: string;
}

// ====== Bot 閰嶇疆 ======

export interface BotConfig {
  instanceId: string;
  botId: string;
  botSecret: string;
  systemPrompt: string;
  skills: string[];
  llm: LLMConfig;
  permissions?: PermissionConfig;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  backupApiKeys?: string[];
}

// ====== Provider 鎺ュ彛 ======

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


// ====== 权限控制 ======

export interface RoleEntry {
  skills: string[];
}

export interface SheetRoleSource {
  docid: string;
  sheetName: string;
  nameColumn: string;
  deptColumn: string;
  roleColumn: string;
}

export interface PermissionConfig {
  roleSource?: {
    sheets?: SheetRoleSource[];
  };
  roles: Record<string, RoleEntry>;
  defaultRole?: RoleEntry;
  denyMessage?: string;
}
