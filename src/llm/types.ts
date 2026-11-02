export type LLMProvider = 'openai' | 'anthropic';
export interface LLMConfig {provider:LLMProvider;model:string;apiKey:string}
export interface StructuredRequest {name:string;instructions:string;input:unknown;schema:Record<string,unknown>;maxOutputTokens:number;effort?:'low'|'medium'|'high'}
export interface StructuredLLMClient {generate(request:StructuredRequest,signal:AbortSignal):Promise<unknown>}
export interface TokenUsage {input_tokens:number;output_tokens:number;total_tokens:number;cache_creation_input_tokens?:number;cache_read_input_tokens?:number}
export type UsageLogger=(usage:TokenUsage)=>void;
export const PROVIDERS={openai:{label:'OpenAI',keyEnv:'OPENAI_API_KEY',modelEnv:'OPENAI_MODEL',defaultModel:'gpt-4.1-mini'},anthropic:{label:'Anthropic',keyEnv:'ANTHROPIC_API_KEY',modelEnv:'ANTHROPIC_MODEL',defaultModel:'claude-haiku-5-5'}} as const;
export const usageLogger=(provider:LLMProvider):UsageLogger=>counts=>console.info('LLM token usage',{provider,...counts});
export const validTokens=(value:unknown):value is number=>typeof value==='number' && Number.isSafeInteger(value) && value>=0;
export function parseOutput(text:string):unknown {
  if (!text || text.length>30_000) throw new Error('Invalid LLM output');
  return JSON.parse(text) as unknown;
}
