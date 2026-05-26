const { LLMClient } = require('../packages/llm/src/client');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

async function testLLMClient() {
  console.log('=== LLMClient Test ===\n');

  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const configs = [];

  for (let i = 1; i <= 3; i++) {
    const key = process.env['DEEPSEEK_API_KEY_' + i];
    if (key) configs.push({ apiKey: key, baseUrl, model });
  }

  console.log('Configured keys: ' + configs.length + '\n');
  const client = new LLMClient(configs);

  // Test 1: Basic chat
  console.log('Test 1: Basic chat...');
  try {
    const response = await client.chat({
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
      systemPrompt: 'You are a test assistant.',
    });
    console.log('  OK: ' + (response.content ? response.content.slice(0, 100) : 'null'));
  } catch (err) {
    console.log('  FAIL: ' + err.message);
  }

  // Test 2: With tools
  console.log('\nTest 2: With tools...');
  try {
    const response = await client.chat({
      messages: [{ role: 'user', content: 'Create a document titled "Test Doc".' }],
      systemPrompt: 'You have access to a create_doc tool. Use it when asked to create documents.',
      tools: [{
        type: 'function',
        function: {
          name: 'create_doc',
          description: 'Create a new document',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Document title' },
              content: { type: 'string', description: 'Document content' },
            },
            required: ['title'],
          },
        },
      }],
    });
    console.log('  OK: toolCalls=' + response.toolCalls.length);
    if (response.toolCalls.length > 0) {
      console.log('  Tool: ' + response.toolCalls[0].function.name);
      console.log('  Args: ' + response.toolCalls[0].function.arguments.slice(0, 100));
    }
  } catch (err) {
    console.log('  FAIL: ' + err.message);
  }

  // Test 3: Stream
  console.log('\nTest 3: Stream...');
  try {
    let text = '';
    for await (const delta of client.streamChat({
      messages: [{ role: 'user', content: 'Count to 3.' }],
      systemPrompt: 'You are a counter. Be brief.',
    })) {
      if (delta.type === 'text' && delta.content) {
        text += delta.content;
        process.stdout.write(delta.content);
      }
    }
    console.log('\n  OK: ' + text.length + ' chars');
  } catch (err) {
    console.log('\n  FAIL: ' + err.message);
  }

  console.log('\n=== Done ===');
}

testLLMClient().catch(console.error);
