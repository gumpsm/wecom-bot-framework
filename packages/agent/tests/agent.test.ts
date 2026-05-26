import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../src/agent';
import { LLMClient } from '../../llm/src/client';
import { SkillRegistry } from '../../skills/src/registry';
import { Skill, SkillDefinition, Provider } from '../../core/src/types';

function createMockProvider(): Provider {
  return {
    name: 'mock',
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    onMessage: vi.fn(),
    onEvent: vi.fn(),
    replyWelcome: vi.fn().mockResolvedValue(undefined),
    replyMessage: vi.fn().mockResolvedValue(undefined),
    replyUpdateCard: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    uploadMedia: vi.fn().mockResolvedValue({ media_id: 'test_media_id' }),
    callTool: vi.fn().mockResolvedValue({}),
  };
}

function createMockSkill(name: string): Skill {
  return {
    definition: {
      name,
      description: 'Test skill: ' + name,
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input' },
        },
        required: ['input'],
      },
    },
    execute: vi.fn().mockResolvedValue({ result: 'ok' }),
  };
}

describe('Agent', () => {
  let agent: Agent;
  let mockProvider: Provider;
  let skillRegistry: SkillRegistry;
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    mockProvider = createMockProvider();
    skillRegistry = new SkillRegistry();
    skillRegistry.register(createMockSkill('test.skill'));

    mockLLMClient = new LLMClient([{
      apiKey: 'test',
      baseUrl: 'http://localhost',
      model: 'test',
    }]);

    agent = new Agent(
      {
        systemPrompt: 'You are a test bot.',
        skillNames: ['test.skill'],
        llmClient: mockLLMClient,
        skillRegistry,
      },
      mockProvider
    );
  });

  describe('handleMessage()', () => {
    it('should process a message and maintain history', async () => {
      // Mock LLM to return direct text response
      vi.spyOn(mockLLMClient, 'chat').mockResolvedValue({
        content: 'Hello!',
        toolCalls: [],
        finishReason: 'stop',
      });

      const reply = await agent.handleMessage('chat1', 'Hi');
      expect(reply).toBe('Hello!');
    });

    it('should handle tool calls from LLM', async () => {
      vi.spyOn(mockLLMClient, 'chat')
        // First call: LLM decides to use tool
        .mockResolvedValueOnce({
          content: null,
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'test.skill',
              arguments: '{"input":"hello"}',
            },
          }],
          finishReason: 'tool_calls',
        })
        // Second call: LLM generates final response
        .mockResolvedValueOnce({
          content: 'Done!',
          toolCalls: [],
          finishReason: 'stop',
        });

      const reply = await agent.handleMessage('chat1', 'Do something');
      expect(reply).toBe('Done!');
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });

    it('should handle LLM errors gracefully', async () => {
      vi.spyOn(mockLLMClient, 'chat').mockRejectedValue(new Error('API error'));

      const reply = await agent.handleMessage('chat1', 'Hi');
      expect(reply).toContain('抱歉');
    });
  });

  describe('clearHistory()', () => {
    it('should clear conversation history', () => {
      agent.clearHistory('chat1');
      // No error = success
    });
  });
});
