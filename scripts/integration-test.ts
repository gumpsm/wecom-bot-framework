// 集成测试：连接企业微信长连接，验证消息回调 + 自动回复
import { WeComWsProvider } from '../packages/providers/src/wecom/ws-provider';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const BOT_ID = process.env.WECOM_BOT_ID;
const BOT_SECRET = process.env.WECOM_BOT_SECRET;

if (!BOT_ID || !BOT_SECRET) {
  console.error('ERROR: WECOM_BOT_ID or WECOM_BOT_SECRET not set');
  process.exit(1);
}

function genStreamId() {
  return 'stream_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

var testResults = { connected: false, msgReceived: false, replied: false, eventReceived: false };

console.log('=== WeCom Integration Test ===');
console.log('Bot ID: ' + BOT_ID.slice(0, 10) + '...');

async function main() {
  const provider = new WeComWsProvider();

  provider.onMessage(function(frame) {
    console.log('\n=== MESSAGE CALLBACK ===');
    console.log('msgtype: ' + frame.body?.msgtype);
    console.log('chattype: ' + frame.body?.chattype);
    console.log('from: ' + (frame.body?.from?.userid || 'unknown'));

    if (frame.body?.msgtype === 'text' && frame.body?.text) {
      console.log('content: ' + frame.body.text.content);
    }

    testResults.msgReceived = true;

    // Reply using stream format (aibot_respond_msg does NOT support msgtype:text)
    var streamId = genStreamId();
    console.log('Replying with stream id: ' + streamId);

    provider.replyMessage(frame, {
      msgtype: 'stream',
      stream: {
        id: streamId,
        finish: true,
        content: 'Integration test PASSED. Your message was received.',
      },
    }).then(function() {
      console.log('>> Reply sent OK'); testResults.replied = true; printResults();
      testResults.replied = true;
    }).catch(function(e) {
      console.log('>> Reply failed: ' + e.message);
    });

    printResults();
  });

  provider.onEvent(function(frame) {
    var et = frame.body?.event?.eventtype;
    console.log('\n=== EVENT: ' + (et || 'unknown') + ' ===');
    testResults.eventReceived = true;

    if (et === 'enter_chat') {
      provider.replyWelcome(frame, {
        msgtype: 'text',
        text: { content: 'Hello! I am the test bot. Send me a message.' },
      }).then(function() {
        console.log('>> Welcome sent');
      }).catch(function(e) {
        console.log('>> Welcome failed: ' + e.message);
      });
    }
    printResults();
  });

  console.log('Connecting...');
  try {
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    testResults.connected = true;
    console.log('Connected! Send a message to the bot now. Ctrl+C to exit.\n');
  } catch (e) {
    console.error('Failed: ' + (e as Error).message);
    process.exit(1);
  }

  process.on('SIGINT', function() {
    console.log('\nShutting down...');
    provider.disconnect();
    printResults();
    process.exit(0);
  });
}

function printResults() {
  console.log('\n--- STATUS ---');
  console.log('WS: ' + (testResults.connected ? 'PASS' : 'FAIL'));
  console.log('Msg: ' + (testResults.msgReceived ? 'PASS' : 'WAIT'));
  console.log('Reply: ' + (testResults.replied ? 'PASS' : 'WAIT'));
}

main().catch(console.error);
