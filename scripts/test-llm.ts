// @ts-nocheck
import { LLMClient } from '../packages/llm/src/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function testLLMClient() {
  console.log('=== LLMClient Test ===\n');

  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const configs = [];

  const key1 = process.env.DEEPSEEK_API_KEY_1;
  const key2 = process.env.DEEPSEEK_API_KEY_2;
  const key3 = process.env.DEEPSEEK_API_KEY_3;
  
  if (key1) configs.push({ apiKey: key1, baseUrl, model });
  if (key2) configs.push({ apiKey: key2, baseUrl, model });
  if (key3) configs.push({ apiKey: key3, baseUrl, model });

  console.log('Keys: ' + configs.length);
  const client = new LLMClient(configs);

  // Test 1: Basic
  console.log('\nTest 1: Basic chat');
  try {
    const r = await client.chat({
      messages: [{ role: 'user', content: 'Say hello in Chinese, one sentence.' }],
      systemPrompt: 'You are a test bot.',
    });
    console.log('  OK: ' + (r.content || 'null').slice(0, 100));
  } catch (e) {
    console.log('  FAIL: ' + e.message);
  }

  // Test 2: Tools
  console.log('\nTest 2: With tools');
  try {
    const r = await client.chat({
      messages: [{ role: 'user', content: 'Create a document called TestDoc.' }],
      systemPrompt: 'Use create_doc tool when asked to create documents.',
      tools: [{
        type: 'function',
        function: {
          name: 'create_doc',
          description: 'Create a new doc',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Doc title' },
            },
            required: ['title'],
          },
        },
      }],
    });
    console.log('  OK: toolCalls=' + r.toolCalls.length + ', content=' + (r.content || 'null').slice(0, 50));
    if (r.toolCalls.length > 0) {
      console.log('  Tool: ' + r.toolCalls[0].function.name);
    }
  } catch (e) {
    console.log('  FAIL: ' + e.message);
  }

  // Test 3: Stream
  console.log('\nTest 3: Stream');
  try {
    let text = '';
    for await (const d of client.streamChat({
      messages: [{ role: 'user', content: 'Count: 1, 2, 3.' }],
      systemPrompt: 'Be brief.',
    })) {
      if (d.type === 'text' && d.content) {
        text += d.content;
        process.stdout.write(d.content);
      }
    }
    console.log('\n  OK: ' + text.length + ' chars');
  } catch (e) {
    console.log('\n  FAIL: ' + e.message);
  }

  console.log('\n=== Done ===');
}

testLLMClient();
