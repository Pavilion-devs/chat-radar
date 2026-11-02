import { PROVIDERS, type LLMProvider } from './types.js';
export class LLMRequestError extends Error {
  constructor(readonly provider:LLMProvider,readonly status:number,readonly kind:'quota'|'rate_limit'|'authentication'|'configuration'|'upstream',readonly retryAfterMs=30_000) {
    super(`${PROVIDERS[provider].label} request failed (${status})`);
  }
  get userMessage() {
    const {label,keyEnv}=PROVIDERS[this.provider];
    switch(this.kind) {
      case 'quota':return `${label} API quota unavailable. Check credits and project limits, then restart the server.`;
      case 'authentication':return `${label} authentication failed. Check ${keyEnv}, then restart the server.`;
      case 'configuration':return `${label} request configuration rejected. Check the selected model and account access, then restart the server.`;
      case 'rate_limit':return `${label} rate limit reached; waiting before retrying.`;
      default:return `${label} request failed; retrying on the next interval.`;
    }
  }
}
export function retryDelay(response:Response):number {
  const header=response.headers.get('retry-after');
  const seconds=header===null ? NaN:Number(header);
  const wait=Number.isFinite(seconds) ? seconds*1000 : header ? Date.parse(header)-Date.now():NaN;
  return Number.isFinite(wait) ? Math.max(8000,wait):30_000;
}
