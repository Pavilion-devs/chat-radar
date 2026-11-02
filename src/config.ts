import 'dotenv/config';
import { PROVIDERS, type LLMProvider } from './llm/types.js';
export function readConfig(env = process.env) {
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  const redirectUri = env.TWITCH_REDIRECT_URI || `http://localhost:${port}/auth/callback`;
  const url = new URL(redirectUri);
  if (url.protocol !== 'http:' || url.hostname !== 'localhost' || url.port !== String(port) || url.pathname !== '/auth/callback' || url.search || url.hash) {
    throw new Error('TWITCH_REDIRECT_URI must be http://localhost:PORT/auth/callback');
  }
  const channel = (env.TWITCH_CHANNEL || '').trim().toLowerCase();
  if (channel && !/^[a-z0-9_]{1,25}$/.test(channel)) throw new Error('TWITCH_CHANNEL must be a Twitch login');
  const llmTimeoutMs=Number(env.LLM_TIMEOUT_MS || 30_000);
  if(!Number.isInteger(llmTimeoutMs) || llmTimeoutMs<1000 || llmTimeoutMs>120_000) throw new Error('LLM_TIMEOUT_MS must be 1000–120000');
  const provider=env.LLM_PROVIDER?.trim().toLowerCase() || 'anthropic';
  if (provider!=='openai' && provider!=='anthropic') throw new Error('LLM_PROVIDER must be openai or anthropic');
  const selected=PROVIDERS[provider];
  const apiKey=env[selected.keyEnv]?.trim() || '';
  const model=env.LLM_MODEL?.trim() || env[selected.modelEnv]?.trim() || selected.defaultModel;
  return {port,redirectUri,channel,llmTimeoutMs,clientId:env.TWITCH_CLIENT_ID || '',clientSecret:env.TWITCH_CLIENT_SECRET || '',llm:{provider:provider as LLMProvider,apiKey,model}};
}
export type Config = ReturnType<typeof readConfig>;
