import { LLMClient } from '@wecom-bot/llm';
import { SkillRegistry } from '@wecom-bot/skills';
import { Provider, ChatMessage, StreamDelta } from '@wecom-bot/core';

export interface AgentConfig {
  systemPrompt: string;
  skillNames: string[];
  llmClient: LLMClient;
  skillRegistry: SkillRegistry;
}

export class Agent {
  private config: AgentConfig;
  private provider: Provider;
  private conversations: Map<string, ChatMessage[]> = new Map();

  constructor(config: AgentConfig, provider: Provider) {
    this.config = config;
    this.provider = provider;
  }

  // 处理用户消息
  async handleMessage(
    chatId: string,
    userMessage: string,
    userId?: string
  ): Promise<string> {
    const history = this.getHistory(chatId);
    history.push({ role: 'user', content: userMessage });

    const tools = this.config.skillRegistry.getDefinitions(
      this.config.skillNames
    );

    try {
      // 第一次 LLM 调用：判断意图 + 是否需要工具
      const response = await this.config.llmClient.chat({
        messages: history,
        tools,
        systemPrompt: this.config.systemPrompt,
      });

      // 如果 LLM 决定调用工具
      if (response.toolCalls.length > 0) {
        // 记录 assistant 的工具调用
        history.push({
          role: 'assistant',
          content: null,
          tool_calls: response.toolCalls,
        });

        // 执行每个工具调用
        for (const toolCall of response.toolCalls) {
          const args = JSON.parse(toolCall.function.arguments);
          try {
            const result = await this.config.skillRegistry.execute(
              toolCall.function.name,
              args
            );
            history.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
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
        const finalResponse = await this.config.llmClient.chat({
          messages: history,
          systemPrompt: this.config.systemPrompt,
        });

        const reply = finalResponse.content ?? '抱歉，我无法处理这个请求。';
        history.push({ role: 'assistant', content: reply });
        return reply;
      }

      // LLM 直接回复（不需要工具）
      const reply = response.content ?? '抱歉，我暂时无法回复。';
      history.push({ role: 'assistant', content: reply });
      return reply;

    } catch (err) {
      console.error('[Agent] 处理消息出错:', err);
      const errorMsg = '抱歉，服务暂时不可用，请稍后再试。';
      history.push({ role: 'assistant', content: errorMsg });
      return errorMsg;
    }
  }

  // 流式处理消息
  async *handleMessageStream(
    chatId: string,
    userMessage: string
  ): AsyncGenerator<StreamDelta> {
    const history = this.getHistory(chatId);
    history.push({ role: 'user', content: userMessage });

    const tools = this.config.skillRegistry.getDefinitions(
      this.config.skillNames
    );

    try {
      // 第一次流式调用
      let accumulatedContent = '';
      let toolCalls: Array<{
        id: string;
        function: { name: string; arguments: string };
      }> = [];

      for await (const delta of this.config.llmClient.streamChat({
        messages: history,
        tools,
        systemPrompt: this.config.systemPrompt,
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
          tool_calls: toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: tc.function,
          })),
        });

        for (const tc of toolCalls) {
          const args = JSON.parse(tc.function.arguments);
          try {
            const result = await this.config.skillRegistry.execute(
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
        for await (const delta of this.config.llmClient.streamChat({
          messages: history,
          systemPrompt: this.config.systemPrompt,
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
    const history = this.conversations.get(chatId)!;

    // 限制历史长度（保留最近 20 轮）
    if (history.length > 40) {
      const systemMsg = history.find(m => m.role === 'system');
      const recentHistory = history.slice(-40);
      if (systemMsg) recentHistory.unshift(systemMsg);
      this.conversations.set(chatId, recentHistory);
    }

    return this.conversations.get(chatId)!;
  }

  clearHistory(chatId: string): void {
    this.conversations.delete(chatId);
  }
}
