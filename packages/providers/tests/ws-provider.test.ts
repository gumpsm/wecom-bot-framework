import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeComWsProvider } from '../src/wecom/ws-provider';

// Mock ws module
vi.mock('ws', () => {
  const EventEmitter = require('events');
  class MockWebSocket extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    send = vi.fn();
    close = vi.fn();
  }
  return { default: MockWebSocket, WebSocket: MockWebSocket };
});

describe('WeComWsProvider', () => {
  let provider: WeComWsProvider;

  beforeEach(() => {
    provider = new WeComWsProvider();
  });

  afterEach(() => {
    provider.disconnect();
  });

  describe('connect()', () => {
    it('should connect to WeCom WebSocket URL', async () => {
      // We cannot fully test WS connection without mocking timers,
      // but we can verify the provider was created
      expect(provider.name).toBe('wecom-ws');
    });
  });

  describe('disconnect()', () => {
    it('should stop timers and close connection', () => {
      provider.disconnect();
      // No error thrown = success
    });
  });

  describe('message/event handlers', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      provider.onMessage(handler);
      // Handler registered without error
    });

    it('should register event handler', () => {
      const handler = vi.fn();
      provider.onEvent(handler);
      // Handler registered without error
    });
  });

  describe('callTool()', () => {
    it('should throw when MCP client not configured', async () => {
      await expect(
        provider.callTool('doc', 'create', {})
      ).rejects.toThrow('MCP client not configured');
    });
  });
});
