import { ChatMessage, LLMResponse, StreamDelta, ToolCall } from '@wecom-bot/core';

export interface LLMClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  backupApiKeys?: string[];
  timeoutMs?: number;
  maxRetries?: number;
}

export interface ChatParams {
  messages: ChatMessage[];
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  systemPrompt?: string;
  temperature?: number;
}

// SSE line parser
async function* parseSSE(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class LLMClient {
  private configs: LLMClientConfig[];
  private currentIndex = 0;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(configs: LLMClientConfig[]) {
    if (configs.length === 0) {
      throw new Error('at least one LLM config required');
    }
    this.configs = configs;
    this.timeoutMs = configs[0].timeoutMs ?? 30000;
    this.maxRetries = configs[0].maxRetries ?? 3;
  }

  private nextConfig(): LLMClientConfig {
    const config = this.configs[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.configs.length;
    return config;
  }

  async chat(params: ChatParams): Promise<LLMResponse> {
    return this.chatWithRetry(params, 0);
  }

  private async chatWithRetry(
    params: ChatParams,
    attempt: number
  ): Promise<LLMResponse> {
    const config = this.nextConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, this.timeoutMs);

    try {
      const messages: ChatMessage[] = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push(...params.messages);

      const body: Record<string, unknown> = {
        model: config.model,
        messages: messages,
        temperature: params.temperature ?? 0.7,
      };

      // DeepSeek: 关闭 thinking 模式确保 tool calling 正常
      if (config.baseUrl.indexOf("deepseek") >= 0) {
        body.thinking = { type: "disabled" };
      }

      if (params.tools && params.tools.length > 0) {
        body.tools = params.tools;
        body.tool_choice = 'auto';
      }

      const url = config.baseUrl + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(function() { return ''; });
        throw new Error(
          'LLM API HTTP ' + response.status + ': ' + errorText.slice(0, 200)
        );
      }

      const data = await response.json() as {
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: ToolCall[];
          };
          finish_reason: string;
        }>;
      };

      const choice = data.choices?.[0];
      if (!choice) {
        throw new Error('LLM response missing choices');
      }

      return {
        content: choice.message.content,
        toolCalls: choice.message.tool_calls ?? [],
        finishReason: choice.finish_reason as LLMResponse['finishReason'],
        reasoning_content: (choice.message as any).reasoning_content,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const isLastAttempt = attempt >= this.maxRetries - 1;

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (isLastAttempt) throw new Error(
          'LLM timeout (' + this.timeoutMs + 'ms), retried ' + this.maxRetries + ' times'
        );
      } else if (isLastAttempt) {
        throw error;
      }

      console.warn(
        '[LLMClient] attempt ' + (attempt + 1) + ' failed (key=' +
        config.apiKey.slice(0, 8) + '...), switching key...\n  error: ' +
        (error as Error).message
      );
      return this.chatWithRetry(params, attempt + 1);
    }
  }

  async *streamChat(params: ChatParams): AsyncGenerator<StreamDelta> {
    const config = this.nextConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(function() { controller.abort(); }, this.timeoutMs);

    try {
      const messages: ChatMessage[] = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push(...params.messages);

      const body: Record<string, unknown> = {
        model: config.model,
        messages: messages,
        temperature: params.temperature ?? 0.7,
        stream: true,
      };

      // DeepSeek: 关闭 thinking 模式确保 tool calling 正常
      if (config.baseUrl.indexOf("deepseek") >= 0) {
        body.thinking = { type: "disabled" };
      }

      if (params.tools && params.tools.length > 0) {
        body.tools = params.tools;
        body.tool_choice = 'auto';
      }

      const url = config.baseUrl + '/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(function() { return ''; });
        throw new Error(
          'LLM stream API HTTP ' + response.status + ': ' + errorText.slice(0, 200)
        );
      }

      if (!response.body) {
        throw new Error('LLM stream response has no body');
      }

      const toolCallAccumulator: Map<number, { id: string; name: string; arguments: string }> = new Map();

      for await (const data of parseSSE(response.body)) {
        const chunk = JSON.parse(data) as {
          choices: Array<{
            delta: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string;
          }>;
        };

        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          yield { type: 'text', content: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallAccumulator.get(tc.index) ?? {
              id: '',
              name: '',
              arguments: '',
            };
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            toolCallAccumulator.set(tc.index, existing);

            if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: existing.id,
                  type: 'function',
                  function: {
                    name: existing.name,
                    arguments: existing.arguments,
                  },
                },
              };
            }
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}
