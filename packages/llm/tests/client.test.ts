import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortSignal.timeout
const mockTimeout = vi.fn();
AbortSignal.timeout = mockTimeout;

import { LLMClient } from '../src/client';

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function createReadableStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe('LLMClient', () => {
  let client: LLMClient;

  beforeEach(() => {
    mockFetch.mockReset();
    mockTimeout.mockReturnValue(undefined);
    client = new LLMClient([{
      apiKey: 'test-key-1',
      baseUrl: 'https://api.test.com/v1',
      model: 'test-model',
      timeoutMs: 5000,
      maxRetries: 2,
    }]);
  });

  describe('chat()', () => {
    it('should make a POST request to the correct URL', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, {
        choices: [{
          message: { content: 'Hello!' },
          finish_reason: 'stop',
        }],
      }));

      await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('https://api.test.com/v1/chat/completions');
    });

    it('should return content from successful response', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, {
        choices: [{
          message: { content: 'Hello, World!' },
          finish_reason: 'stop',
        }],
      }));

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.content).toBe('Hello, World!');
      expect(result.toolCalls).toEqual([]);
      expect(result.finishReason).toBe('stop');
    });

    it('should include system prompt when provided', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, {
        choices: [{
          message: { content: 'OK' },
          finish_reason: 'stop',
        }],
      }));

      await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
        systemPrompt: 'You are a test bot.',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toBe('You are a test bot.');
    });

    it('should include tools when provided', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, {
        choices: [{
          message: { content: null, tool_calls: [] },
          finish_reason: 'stop',
        }],
      }));

      await client.chat({
        messages: [{ role: 'user', content: 'Create doc' }],
        tools: [{
          type: 'function',
          function: {
            name: 'create_doc',
            description: 'Create document',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        }],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tools).toBeDefined();
      expect(body.tools.length).toBe(1);
      expect(body.tool_choice).toBe('auto');
    });

    it('should extract tool calls from response', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: {
                name: 'create_doc',
                arguments: '{"title":"Test"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      }));

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Create doc' }],
        tools: [{
          type: 'function',
          function: {
            name: 'create_doc',
            description: 'Create document',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        }],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].function.name).toBe('create_doc');
      expect(result.toolCalls[0].function.arguments).toBe('{"title":"Test"}');
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse(200, {
          choices: [{
            message: { content: 'Success after retry' },
            finish_reason: 'stop',
          }],
        }));

      const result = await client.chat({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.content).toBe('Success after retry');
    });

    it('should throw after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      await expect(
        client.chat({
          messages: [{ role: 'user', content: 'Hi' }],
        })
      ).rejects.toThrow('Persistent error');

      expect(mockFetch).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
    });
  });

  describe('streamChat()', () => {
    it('should yield text deltas from streaming response', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":" World"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: createReadableStream(chunks),
        text: async () => '',
      });

      const results: string[] = [];
      for await (const delta of client.streamChat({
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        if (delta.type === 'text' && delta.content) {
          results.push(delta.content);
        }
      }

      expect(results).toEqual(['Hello', ' World']);
    });
  });
});
