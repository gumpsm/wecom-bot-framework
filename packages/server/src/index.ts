import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { BotManager } from '@wecom-bot/core';
import { LLMClientConfig } from '@wecom-bot/llm';
import { BotConfig } from '@wecom-bot/core';

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

async function main() {
  console.log('========================================');
  console.log('  企业微信智能机器人框架 v0.1.0');
  console.log('========================================\n');

  // LLM 配置
  const llmConfigs: LLMClientConfig[] = [];
  const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  for (let i = 1; i <= 3; i++) {
    const key = process.env[DEEPSEEK_API_KEY_];
    if (key) {
      llmConfigs.push({ apiKey: key, baseUrl, model });
      console.log(LLM Key : ... ✅);
    }
  }

  if (llmConfigs.length === 0) {
    console.error('错误: 未配置 LLM API Key，请检查 .env 文件');
    process.exit(1);
  }

  // 创建 BotManager
  const botManager = new BotManager(llmConfigs);

  // 加载机器人配置
  const botsDir = path.resolve(__dirname, '../../..', 'bots');
  if (!fs.existsSync(botsDir)) {
    console.error('Error: bots directory not found: ' + botsDir);
    process.exit(1);
  }

  const botDirs = fs.readdirSync(botsDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  if (botDirs.length === 0) {
    console.warn('警告: 未找到机器人配置，请先在 bots/ 下创建配置');
    console.log('框架已启动，等待配置...');
  }

  for (const dir of botDirs) {
    const configPath = path.join(botsDir, dir.name, 'config.json');
    
    if (!fs.existsSync(configPath)) {
      console.warn('Skipping ' + dir.name + ': missing config.json');
      continue;
    }

    try {
      const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      
      // 替换环境变量占位符
      const config: BotConfig = {
        instanceId: dir.name,
        botId: process.env.WECOM_BOT_ID || rawConfig.botId,
        botSecret: process.env.WECOM_BOT_SECRET || rawConfig.botSecret,
        systemPrompt: rawConfig.systemPrompt || '你是一个企业微信智能助手。',
        skills: rawConfig.skills || [],
        llm: { apiKey: '', baseUrl, model },
      };

      await botManager.startBot(config);
    } catch (err) {
      console.error('Start ' + dir.name + ' failed: ' + (err as Error).message);
    }
  }

  console.log('\\nStarted ' + botManager.getStatus().length + ' bots');
  console.log('按 Ctrl+C 退出\n');

  // 优雅退出
  process.on('SIGINT', async () => {
    console.log('\n正在关闭所有机器人...');
    await botManager.stopAll();
    console.log('已退出');
    process.exit(0);
  });

  // 保持运行
  await new Promise(() => {});
}

main().catch(err => {
  console.error('框架启动失败:', err);
  process.exit(1);
});
