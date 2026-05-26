// LLM 类型引用 — composite-skills 共享依赖声明
// 实际运行时的 LLMClient 由调用方注入（Dependency Injection）
export { LLMClient, LLMClientConfig } from "../packages/llm/src/client";
