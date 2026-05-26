// CompositeSkillAdapter — 将组合 Skill（DI 模式）适配为 Agent 可用的标准 Skill
import { Skill, SkillDefinition, Provider } from "@wecom-bot/core";
import { LLMClient } from "@wecom-bot/llm";

export interface CompositeSkillDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
  sendMessage?: (chatId: string, chatType: number, body: Record<string, unknown>) => Promise<void>;
  registerEventHandler?: (taskId: string, handler: (event: Record<string, unknown>) => Promise<void>) => void;
  chatId?: string;
  chatType?: number;
  systemPrompt?: string;
}

// 组合 Skill 函数签名
export type CompositeSkillFn<TInput, TOutput> = (
  input: TInput,
  deps: CompositeSkillDeps
) => Promise<TOutput>;

export function createCompositeSkill<TInput, TOutput>(
  definition: SkillDefinition,
  fn: CompositeSkillFn<TInput, TOutput>,
  depsFactory: () => CompositeSkillDeps
): Skill {
  return {
    definition: definition,
    execute: async function(args: Record<string, unknown>): Promise<unknown> {
      var deps = depsFactory();

      // 将 LLM 传来的 string 参数转换为组合 Skill 需要的类型
      var input = args as unknown as TInput;

      try {
        return await fn(input, deps);
      } catch (e) {
        console.error(
          "[CompositeSkillAdapter] " + definition.name + " failed: " + (e as Error).message
        );
        throw e;
      }
    },
  };
}

// 创建适配器工厂：传入 callTool + llm + sendMessage 的引用，返回 depsFactory
export function createCompositeSkillDepsFactory(
  callToolFn: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>,
  llmClient: LLMClient,
  sendMessageFn?: (chatId: string, chatType: number, body: Record<string, unknown>) => Promise<void>,
  registerEventFn?: (taskId: string, handler: (event: Record<string, unknown>) => Promise<void>) => void
): () => CompositeSkillDeps {
  // 使用闭包持有 chatId/chatType（运行时动态设置）
  var runtimeChatId = "";
  var runtimeChatType = 1;
  var runtimeSystemPrompt = "";

  return function(): CompositeSkillDeps {
    return {
      callTool: callToolFn,
      llm: llmClient,
      sendMessage: sendMessageFn,
      registerEventHandler: registerEventFn,
      chatId: runtimeChatId,
      chatType: runtimeChatType,
      systemPrompt: runtimeSystemPrompt,
    };
  };
}
