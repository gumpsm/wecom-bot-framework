// 主动推送测试
import { WeComWsProvider } from '../packages/providers/src/wecom/ws-provider';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const BOT_ID = process.env.WECOM_BOT_ID;
const BOT_SECRET = process.env.WECOM_BOT_SECRET;

async function main() {
  const provider = new WeComWsProvider();

  provider.onMessage(function(frame) {
    console.log('[MSG] ' + frame.body?.msgtype + ' from ' + frame.body?.from?.userid);
    
    // Also test aibot_send_msg - push back to the user's chat
    var chatId = frame.body?.from?.userid || frame.body?.chatid || '';
    if (chatId) {
      setTimeout(async function() {
        console.log('[PUSH] Sending active push to ' + chatId + '...');
        try {
          await provider.sendMessage(chatId, 1, {
            msgtype: 'markdown',
            markdown: { content: '**主动推送测试**\n\n这是一条机器人主动推送的消息。\n- 项目A：进行中\n- 项目B：已完成' },
          });
          console.log('[PUSH] Sent OK');
        } catch (e) {
          console.log('[PUSH] Failed: ' + (e as Error).message);
        }
      }, 2000);
    }
  });

  try {
    await provider.connect({ botId: BOT_ID, botSecret: BOT_SECRET });
    console.log('Connected. Send a message to trigger active push test.');

    process.on('SIGINT', function() {
      provider.disconnect();
      process.exit(0);
    });
  } catch (e) {
    console.error('Failed: ' + (e as Error).message);
    process.exit(1);
  }
}

main().catch(console.error);
