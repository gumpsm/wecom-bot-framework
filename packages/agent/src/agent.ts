import { LLMClient } from '@wecom-bot/llm';
import { SkillRegistry } from '@wecom-bot/skills';
import { Provider, ChatMessage, StreamDelta } from '@wecom-bot/core';

export interface AgentConfig {
  systemPrompt: string;
  skillNames: string[];
  llmClient: LLMClient;
  skillRegistry: SkillRegistry;
  permissionCheck?: (skillName: string, userId: string) => Promise<{ allowed: boolean; denyMessage?: string }>;
}

export class Agent {
  private config: AgentConfig;
  private provider: Provider;
  private conversations: Map<string, ChatMessage[]> = new Map();

  constructor(config: AgentConfig, provider: Provider) {
    this.config = config;
    this.provider = provider;
  }

  // 构建动态 system prompt（注入时间、用户、闲聊规则）
  private buildSystemPrompt(userId?: string): string {
    var now = new Date();
    var weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    var timeStr = '现在是北京时间 ' + now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + weekDays[now.getDay()] + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0') + '。';
    var userStr = userId ? '\n当前对话用户 userid: ' + userId + '。' : '';
    var casualRule = '\n你可以简单回应问候和日常寒暄（如"你好""辛苦了""谢谢"），但应自然地将对话引导回你的核心职能。';
    var noIdRule = '\n重要：永远不要向用户展示原始系统ID（如todo_id、schedule_id、docid、meetingid等长字符串）。用序号或简短标题替代。例如：不要说"日程ID: 4aa82b6c..."，直接说"下午3点 集成测试"。';
    var detailRule = '\n查询日程时schedule_get_list只返回ID列表，需进一步调用schedule_get_detail（参数schedule_id_list数组）获取标题和时间。查询待办时todo_get_list返回索引不含content，需调用todo_get_detail（参数todo_id_list数组）获取内容。批量传多个ID可减少调用次数。';
    return timeStr + userStr + '\n' + this.config.systemPrompt + casualRule + noIdRule + detailRule;
  }

  // 处理用户消息
  async handleMessage(
    chatId: string,
    userMessage: string,
    userId?: string
  ): Promise<string> {
    var history = this.getHistory(chatId);
    history.push({ role: 'user', content: userMessage });

    var systemPrompt = this.buildSystemPrompt(userId);
    var tools = this.config.skillRegistry.getDefinitions(
      this.config.skillNames
    );

    try {
      // 第一次 LLM 调用：判断意图 + 是否需要工具
      var response = await this.config.llmClient.chat({
        messages: history,
        tools,
        systemPrompt: systemPrompt,
      });

      // 如果 LLM 决定调用工具
      if (response.toolCalls.length > 0) {
        // 记录 assistant 的工具调用
        history.push({
          role: 'assistant',
          content: null,
          tool_calls: response.toolCalls,
          reasoning_content: response.reasoning_content,
        });

        // 执行每个工具调用
        for (var toolCall of response.toolCalls) {
          var args = JSON.parse(toolCall.function.arguments);
          if (this.config.permissionCheck) {
            const perm = await this.config.permissionCheck(toolCall.function.name, userId || "unknown");
            if (!perm.allowed) {
              history.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: perm.denyMessage || "权限不足" }) });
              continue;
            }
          }
          try {
            var result = await this.config.skillRegistry.execute(
              toolCall.function.name,
              args
            );
            history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            console.error("[Agent] Skill "+toolCall.function.name+" failed:",(err as Error).message);
            history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: (err as Error).message,
              }),
            });
          }
        }

        // 第二次 LLM 调用：基于工具结果生成最终回复
        var finalResponse = await this.config.llmClient.chat({
          messages: history,
          systemPrompt: systemPrompt,
        });

        var reply = finalResponse.content ?? '抱歉，我无法处理这个请求。';
        history.push({ role: 'assistant', content: reply });
        return reply;
      }

      // LLM 直接回复（不需要工具）
      var reply = response.content ?? '抱歉，我暂时无法回复。';
      history.push({ role: 'assistant', content: reply });
      return reply;

    } catch (err) {
      console.error('[Agent] 处理消息出错:', err);
      var errorMsg = '抱歉，服务暂时不可用，请稍后再试。';
      history.push({ role: 'assistant', content: errorMsg });
      return errorMsg;
    }
  }

  // 流式处理消息
  async *handleMessageStream(
    chatId: string,
    userMessage: string,
    userId?: string
  ): AsyncGenerator<StreamDelta> {
    var history = this.getHistory(chatId);
    history.push({ role: 'user', content: userMessage });

    var systemPrompt = this.buildSystemPrompt(userId);
    var tools = this.config.skillRegistry.getDefinitions(
      this.config.skillNames
    );

    try {
      // 第一次流式调用
      var accumulatedContent = '';
      var toolCalls: Array<{
        id: string;
        function: { name: string; arguments: string };
      }> = [];

      for await (var delta of this.config.llmClient.streamChat({
        messages: history,
        tools,
        systemPrompt: systemPrompt,
      })) {
        if (delta.type === 'text' && delta.content) {
          accumulatedContent += delta.content;
          yield delta;
        }
        if (delta.type === 'tool_call' && delta.toolCall) {
          toolCalls.push(delta.toolCall as {
            id: string;
            function: { name: string; arguments: string };
          });
        }
      }

      // 处理工具调用
      if (toolCalls.length > 0) {
        history.push({
          role: 'assistant',
          content: accumulatedContent || null,
          tool_calls: toolCalls.map(function(tc) { return {
            id: tc.id,
            type: 'function' as const,
            function: tc.function,
          }; }),
        });

        for (var tc of toolCalls) {
          var args = JSON.parse(tc.function.arguments);
          if (this.config.permissionCheck) {
            const perm = await this.config.permissionCheck(tc.function.name, userId || "unknown");
            if (!perm.allowed) {
              history.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: perm.denyMessage || "权限不足" }) });
              continue;
            }
          }
          try {
            var result = await this.config.skillRegistry.execute(
              tc.function.name,
              args
            );
            history.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            history.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: JSON.stringify({ error: (err as Error).message }),
            });
          }
        }

        // 第二次流式调用
        for await (var delta of this.config.llmClient.streamChat({
          messages: history,
          systemPrompt: systemPrompt,
        })) {
          if (delta.type === 'text' && delta.content) {
            yield delta;
          }
        }
      }
    } catch (err) {
      console.error('[Agent Stream] 处理出错:', err);
      yield { type: 'text', content: '抱歉，服务暂时不可用，请稍后再试。' };
    }
  }

  private getHistory(chatId: string): ChatMessage[] {
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, []);
    }
    var history = this.conversations.get(chatId)!;

    // 限制历史长度（保留最近 20 轮）
    if (history.length > 40) {
      var systemMsg = history.find(function(m) { return m.role === 'system'; });
      var recentHistory = history.slice(-40);
      if (systemMsg) recentHistory.unshift(systemMsg);
      this.conversations.set(chatId, recentHistory);
    }

    return this.conversations.get(chatId)!;
  }

  clearHistory(chatId: string): void {
    this.conversations.delete(chatId);
  }
}
