import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { BotManager } from "@wecom-bot/core";
import { LLMClientConfig } from "@wecom-bot/llm";
import { BotConfig } from "@wecom-bot/core";

// ============================================
// 企业微信智能机器人框架 v0.2.0 — 服务入口
//
// 支持两种运行模式：
// 1. 单 Bot 模式（生产容器部署）：设置 BOT_NAME 环境变量，只启动指定 Bot
// 2. 多 Bot 模式（本地开发）：扫描 bots/ 目录下所有 Bot 并启动
// ============================================

// 优先加载 Bot 专属 .env（如 bots/project-bot/.env），再加载根 .env 作为 fallback
function loadEnv(): Record<string, string> {
  const botName = process.env.BOT_NAME;
  const rootEnvPath = path.resolve(__dirname, "../../..", ".env");
  const botEnvPath = botName
    ? path.resolve(__dirname, "../../..", "bots", botName, ".env")
    : null;

  // 加载优先级：Bot 专属 .env > 根 .env
  if (botEnvPath && fs.existsSync(botEnvPath)) {
    dotenv.config({ path: botEnvPath, override: true });
    console.log(`[env] 加载 Bot 专属配置: ${botEnvPath}`);
  }
  dotenv.config({ path: rootEnvPath });
  console.log(`[env] 加载根配置: ${rootEnvPath}`);

  return process.env as Record<string, string>;
}

function loadLLMConfigs(env: Record<string, string>): LLMClientConfig[] {
  const baseUrl = env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  const model = env.DEEPSEEK_MODEL || "deepseek-chat";
  const llmConfigs: LLMClientConfig[] = [];

  for (let i = 1; i <= 3; i++) {
    const key = env[`DEEPSEEK_API_KEY_${i}`];
    if (key) {
      llmConfigs.push({ apiKey: key, baseUrl, model });
      console.log(`[env] LLM Key ${i}: ${key.slice(0, 8)}... ✅`);
    }
  }

  if (llmConfigs.length === 0) {
    console.error("[error] 未配置 LLM API Key，请检查 .env 文件");
    process.exit(1);
  }

  return llmConfigs;
}

async function loadBotConfigs(botsDir: string): Promise<BotConfig[]> {
  const env = process.env as Record<string, string>;
  const botName = env.BOT_NAME;
  const baseUrl = env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  const model = env.DEEPSEEK_MODEL || "deepseek-chat";
  const configs: BotConfig[] = [];

  // 单 Bot 模式
  if (botName) {
    const configPath = path.join(botsDir, botName, "config.json");
    if (!fs.existsSync(configPath)) {
      console.error(`[error] Bot "${botName}" 配置不存在: ${configPath}`);
      process.exit(1);
    }
    const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    configs.push({
      instanceId: botName,
      botId: env.WECOM_BOT_ID || rawConfig.botId || "",
      botSecret: env.WECOM_BOT_SECRET || rawConfig.botSecret || "",
      systemPrompt: rawConfig.systemPrompt || "你是一个企业微信智能助手。",
      skills: rawConfig.skills || [],
      llm: rawConfig.llm || { apiKey: env.DEEPSEEK_API_KEY_1 || "", baseUrl, model },
    });
    return configs;
  }

  // 多 Bot 模式：扫描 bots/ 目录
  const botDirs = fs
    .readdirSync(botsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template");

  if (botDirs.length === 0) {
    console.warn("[warn] 未找到机器人配置，请先在 bots/ 下创建配置");
    console.log("框架已启动，等待配置...");
    return configs;
  }

  for (const dir of botDirs) {
    const configPath = path.join(botsDir, dir.name, "config.json");
    if (!fs.existsSync(configPath)) {
      console.warn(`[warn] 跳过 ${dir.name}: 缺少 config.json`);
      continue;
    }

    try {
      const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      configs.push({
        instanceId: dir.name,
        botId: env.WECOM_BOT_ID || rawConfig.botId || "",
        botSecret: env.WECOM_BOT_SECRET || rawConfig.botSecret || "",
        systemPrompt: rawConfig.systemPrompt || "你是一个企业微信智能助手。",
        skills: rawConfig.skills || [],
        llm: rawConfig.llm || { apiKey: env.DEEPSEEK_API_KEY_1 || "", baseUrl, model },
      });
    } catch (err) {
      console.error(`[error] 解析 ${dir.name} 失败: ${(err as Error).message}`);
    }
  }

  return configs;
}

async function main() {
  console.log("========================================");
  console.log("  企业微信智能机器人框架 v0.2.0");
  console.log("========================================");
  const mode = process.env.BOT_NAME ? `单Bot模式: ${process.env.BOT_NAME}` : "多Bot模式";
  console.log(`  运行模式: ${mode}\n`);

  const env = loadEnv();
  const llmConfigs = loadLLMConfigs(env);
  const botManager = new BotManager(llmConfigs);

  const botsDir = path.resolve(__dirname, "../../..", "bots");
  if (!fs.existsSync(botsDir)) {
    console.error(`[error] bots/ 目录不存在: ${botsDir}`);
    process.exit(1);
  }

  const botConfigs = await loadBotConfigs(botsDir);

  for (const config of botConfigs) {
    try {
      await botManager.startBot(config);
    } catch (err) {
      console.error(`[error] 启动 ${config.instanceId} 失败: ${(err as Error).message}`);
    }
  }

  console.log(`\n已启动 ${botManager.getStatus().length} 个 Bot`);
  console.log("按 Ctrl+C 退出\n");

  // 优雅退出
  process.on("SIGINT", async () => {
    console.log("\n正在关闭所有 Bot...");
    await botManager.stopAll();
    console.log("已退出");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n收到 SIGTERM，正在关闭...");
    await botManager.stopAll();
    process.exit(0);
  });

  // 保持运行
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[fatal] 框架启动失败:", err);
  process.exit(1);
});
