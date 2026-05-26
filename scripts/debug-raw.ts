// Debug test: log ALL raw frames to see exact server response format
import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const BOT_ID = process.env.WECOM_BOT_ID;
const BOT_SECRET = process.env.WECOM_BOT_SECRET;

console.log('=== Raw Frame Debug ===');
console.log('Connecting...');

const ws = new WebSocket('wss://openws.work.weixin.qq.com');

ws.on('open', function() {
  console.log('[OPEN] Connected');
  
  // Send subscribe
  const subFrame = JSON.stringify({
    cmd: 'aibot_subscribe',
    headers: { req_id: 'sub_001' },
    body: { bot_id: BOT_ID, secret: BOT_SECRET },
  });
  console.log('[SEND] ' + subFrame);
  ws.send(subFrame);
});

ws.on('message', function(data) {
  const raw = data.toString();
  console.log('[RECV] ' + raw);
  
  try {
    const frame = JSON.parse(raw);
    console.log('  cmd=' + frame.cmd + ' headers=' + JSON.stringify(frame.headers));
    
    // If we get a message callback, try to reply
    if (frame.cmd === 'aibot_msg_callback') {
      console.log('[ACTION] Got message, sending reply...');
      const replyFrame = JSON.stringify({
        cmd: 'aibot_respond_msg',
        headers: { req_id: frame.headers.req_id },
        body: { msgtype: 'text', text: { content: '收到！' } },
      });
      console.log('[SEND] ' + replyFrame);
      ws.send(replyFrame);
    }
    
    // If we get enter_chat, reply welcome
    if (frame.cmd === 'aibot_event_callback' && frame.body?.event?.eventtype === 'enter_chat') {
      console.log('[ACTION] Got enter_chat, sending welcome...');
      const welcomeFrame = JSON.stringify({
        cmd: 'aibot_respond_welcome_msg',
        headers: { req_id: frame.headers.req_id },
        body: { msgtype: 'text', text: { content: '欢迎！' } },
      });
      console.log('[SEND] ' + welcomeFrame);
      ws.send(welcomeFrame);
    }
  } catch (e) {
    console.log('  Parse error: ' + (e as Error).message);
  }
});

ws.on('close', function(code, reason) {
  console.log('[CLOSE] code=' + code + ' reason=' + reason.toString());
});

ws.on('error', function(err) {
  console.log('[ERROR] ' + err.message);
});

process.on('SIGINT', function() {
  console.log('\nClosing...');
  ws.close();
  process.exit(0);
});
