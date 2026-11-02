import { OpenAIClient } from './openai.js';
import { AnthropicClient } from './anthropic.js';
import { LLMRadarClient } from './radar-client.js';
import type { LLMConfig, StructuredLLMClient } from './types.js';
export function createLLMClient(config:LLMConfig):StructuredLLMClient|undefined {
  if (!config.apiKey) return;
  switch(config.provider) {
    case 'openai':return new OpenAIClient(config.apiKey,config.model);
    case 'anthropic':return new AnthropicClient(config.apiKey,config.model);
    default:throw new Error('Unsupported LLM provider');
  }
}
export function createRadarClient(config:LLMConfig) {
  const llm=createLLMClient(config);return llm ? new LLMRadarClient(llm):undefined;
}
