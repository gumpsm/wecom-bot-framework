import dotenv from \"dotenv\";
import path from \"path\";
import fs from \"fs\";
import { BotManager } from \"@wecom-bot/core\";
import { LLMClientConfig } from \"@wecom-bot/llm\";
import { BotConfig } from \"@wecom-bot/core\";

// ============================================
// 企业微信智能机器人框架 v0.4.0 — 服务入口
//
// 支持两种运行模式：
// 1. 单 Bot 模式（生产容器部署）：设置 BOT_NAME 环境变量，只启动指定 Bot
// 2. 多 Bot 模式（本地开发）：扫描 bots/ 目录下所有 Bot 并启动
//
// 环境变量设计（v0.4.0 统一格式）：
//   Bot 凭据:   WECOM_{BOT_NAME}_BOT_ID / _BOT_SECRET
//   LLM 供应商: {PROVIDER}_KEY_N / _BASE_URL / _MODEL
//
// Bot 在 config.json 中通过 llmProvider 字段选用供应商
// ============================================

// ============================================
// 1. 环境变量加载
// ============================================

function loadEnv(): Record<string, string> {
  const rootEnvPath = path.resolve(__dirname, \"..\", \"..\", \"..\", \".env\");
  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
    console.log(\"[env] 已加载: \" + rootEnvPath);
  } else {
    console.warn(\"[warn] .env 文件不存在: \" + rootEnvPath);
    console.warn(\"[warn] 请复制 .env.example 为 .env 并填入真实凭据\");
  }
  return process.env as Record<string, string>;
}

// ============================================
// 2. LLM 供应商池解析
// ============================================

function loadLLMProviders(env: Record<string, string>): Record<string, LLMClientConfig[]> {
  var providers: Record<string, LLMClientConfig[]> = {};

  // 扫描所有已知供应商的环境变量
  var knownProviders = [\"DEEPSEEK\", \"MINIMAX\", \"GLM\", \"QWEN\"];

  for (var pi = 0; pi < knownProviders.length; pi++) {
    var provider = knownProviders[pi];
    var baseUrl = env[provider + \"_BASE_URL\"];
    if (!baseUrl) continue;

    var model = env[provider + \"_MODEL\"] || \"default\";
    var configs: LLMClientConfig[] = [];

    for (var i = 1; i <= 5; i++) {
      var key = env[provider + \"_KEY_\" + i];
      if (key) {
        configs.push({ apiKey: key, baseUrl: baseUrl, model: model });
        console.log(\"[env] \" + provider + \" Key \" + i + \": \" + key.slice(0, 8) + \"... ✅\");
      }
    }

    if (configs.length > 0) {
      providers[provider.toLowerCase()] = configs;
    }
  }

  if (Object.keys(providers).length === 0) {
    console.error(\"[error] 未配置任何 LLM 供应商，请检查 .env 文件\");
    console.error(\"[error] 格式: {PROVIDER}_KEY_1 + {PROVIDER}_BASE_URL + {PROVIDER}_MODEL\");
    process.exit(1);
  }

  return providers;
}

// ============================================
// 3. Bot 配置加载
// ============================================

function botNameToEnvPrefix(botName: string): string {
  // pa-bot → PA_BOT, party-bot → PARTY_BOT
  return botName.toUpperCase().replace(/-/g, \"_\");
}

function resolveLLMConfig(
  botConfig: Record<string, unknown>,
  llmProviders: Record<string, LLMClientConfig[]>
): LLMClientConfig[] {
  var providerName = (botConfig.llmProvider as string) || \"deepseek\";
  var providerNameLower = providerName.toLowerCase();

  var configs = llmProviders[providerNameLower];
  if (configs && configs.length > 0) {
    return configs;
  }

  // Fallback: 用第一个可用的供应商
  var firstProvider = Object.keys(llmProviders)[0];
  if (firstProvider) {
    console.warn(\"[warn] Bot 指定的 llmProvider '\" + providerName + \"' 不可用，fallback 到 '\" + firstProvider + \"'\");
    return llmProviders[firstProvider];
  }

  console.error(\"[error] 无可用 LLM 供应商\");
  process.exit(1);
}

async function loadBotConfigs(
  botsDir: string,
  llmProviders: Record<string, LLMClientConfig[]>
): Promise<BotConfig[]> {
  var env = process.env as Record<string, string>;
  var botName = env.BOT_NAME;
  var configs: BotConfig[] = [];

  // 单 Bot 模式
  if (botName) {
    var configPath = path.join(botsDir, botName, \"config.json\");
    if (!fs.existsSync(configPath)) {
      console.error(\"[error] Bot 配置不存在: \" + configPath);
      process.exit(1);
    }
    var rawConfig = JSON.parse(fs.readFileSync(configPath, \"utf-8\"));

    var prefix = botNameToEnvPrefix(botName);
    var botId = env[\"WECOM_\" + prefix + \"_BOT_ID\"] || rawConfig.botId || \"\";
    var botSecret = env[\"WECOM_\" + prefix + \"_BOT_SECRET\"] || rawConfig.botSecret || \"\";

    if (!botId || !botSecret) {
      console.error(\"[error] Bot '\" + botName + \"' 缺少凭据，请在 .env 中设置:\");
      console.error(\"  WECOM_\" + prefix + \"_BOT_ID=xxx\");
      console.error(\"  WECOM_\" + prefix + \"_BOT_SECRET=xxx\");
      process.exit(1);
    }

    var envLLM = env[prefix + "_LLM"];
    if (envLLM) { rawConfig.llmProvider = envLLM; }
    var llmCfgs = resolveLLMConfig(rawConfig, llmProviders);

    configs.push({
      instanceId: botName,
      botId: botId,
      botSecret: botSecret,
      systemPrompt: rawConfig.systemPrompt || \"你是一个企业微信智能助手。\",
      skills: rawConfig.skills || [],
      llm: rawConfig.llm || { apiKey: llmCfgs[0].apiKey, baseUrl: llmCfgs[0].baseUrl, model: llmCfgs[0].model },
    });
    return configs;
  }

  // 多 Bot 模式：扫描 bots/ 目录
  var botDirs = fs
    .readdirSync(botsDir, { withFileTypes: true })
    .filter(function(d: fs.Dirent) { return d.isDirectory() && d.name !== \"_template\"; });

  if (botDirs.length === 0) {
    console.warn(\"[warn] 未找到机器人配置，请先在 bots/ 下创建配置\");
    console.log(\"框架已启动，等待配置...\");
    return configs;
  }

  for (var di = 0; di < botDirs.length; di++) {
    var dir = botDirs[di];
    var configPath = path.join(botsDir, dir.name, \"config.json\");
    if (!fs.existsSync(configPath)) {
      console.warn(\"[warn] 跳过 \" + dir.name + \": 缺少 config.json\");
      continue;
    }

    try {
      var rawCfg = JSON.parse(fs.readFileSync(configPath, \"utf-8\"));

      var prefix2 = botNameToEnvPrefix(dir.name);
      var botId2 = env[\"WECOM_\" + prefix2 + \"_BOT_ID\"] || rawCfg.botId || \"\";
      var botSecret2 = env[\"WECOM_\" + prefix2 + \"_BOT_SECRET\"] || rawCfg.botSecret || \"\";

      if (!botId2 || !botSecret2) {
        console.warn(\"[warn] 跳过 \" + dir.name + \": .env 中缺少 WECOM_\" + prefix2 + \"_BOT_ID / _BOT_SECRET\");
        continue;
      }

      var envLLM2 = env[prefix2 + "_LLM"];
      if (envLLM2) { rawCfg.llmProvider = envLLM2; }
      var llmCfgs2 = resolveLLMConfig(rawCfg, llmProviders);

      configs.push({
        instanceId: dir.name,
        botId: botId2,
        botSecret: botSecret2,
        systemPrompt: rawCfg.systemPrompt || \"你是一个企业微信智能助手。\",
        skills: rawCfg.skills || [],
        llm: rawCfg.llm || { apiKey: llmCfgs2[0].apiKey, baseUrl: llmCfgs2[0].baseUrl, model: llmCfgs2[0].model },
      });

      console.log(\"[env] Bot \" + dir.name + \": 凭据=WECOM_\" + prefix2 + \"_*, LLM=\" + (rawCfg.llmProvider || \"deepseek\"));
    } catch (err) {
      console.error(\"[error] 解析 \" + dir.name + \" 失败: \" + (err as Error).message);
    }
  }

  return configs;
}

// ============================================
// 4. 主函数
// ============================================

async function main() {
  console.log(\"========================================\");
  console.log(\"  企业微信智能机器人框架 v0.4.0\");
  console.log(\"========================================\");
  var mode = process.env.BOT_NAME ? \"单Bot模式: \" + process.env.BOT_NAME : \"多Bot模式\";
  console.log(\"  运行模式: \" + mode);
  console.log(\"  环境变量: .env 按 Bot 分组（凭据+LLM+部署）\");
  console.log(\"\");

  var env = loadEnv();
  var llmProviders = loadLLMProviders(env);

  // BotManager 用第一个供应商的配置初始化（兼容旧接口）
  var firstProvider = Object.values(llmProviders)[0];
  var botManager = new BotManager(firstProvider);

  var botsDir = path.resolve(__dirname, \"..\", \"..\", \"..\", \"bots\");
  if (!fs.existsSync(botsDir)) {
    console.error(\"[error] bots/ 目录不存在: \" + botsDir);
    process.exit(1);
  }

  var botConfigs = await loadBotConfigs(botsDir, llmProviders);

  for (var ci = 0; ci < botConfigs.length; ci++) {
    var config = botConfigs[ci];
    try {
      await botManager.startBot(config);
      console.log(\"[bot] \" + config.instanceId + \" 已启动 ✅\");
    } catch (err) {
      console.error(\"[error] 启动 \" + config.instanceId + \" 失败: \" + (err as Error).message);
    }
  }

  console.log(\"\n已启动 \" + botManager.getStatus().length + \" 个 Bot\");
  console.log(\"按 Ctrl+C 退出\n\");

  // 优雅退出
  process.on(\"SIGINT\", async function() {
    console.log(\"\n正在关闭所有 Bot...\");
    await botManager.stopAll();
    console.log(\"已退出\");
    process.exit(0);
  });

  process.on(\"SIGTERM\", async function() {
    console.log(\"\n收到 SIGTERM，正在关闭...\");
    await botManager.stopAll();
    process.exit(0);
  });

  // 保持运行
  await new Promise(function() {});
}

main().catch(function(err: Error) {
  console.error(\"[fatal] 框架启动失败:\", err);
  process.exit(1);
});
