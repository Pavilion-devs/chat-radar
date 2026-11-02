import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import type { Config } from '../config.js';
const CHAT_SCOPES = ['user:read:chat', 'user:write:chat'];
export const SCOPES = [...CHAT_SCOPES,'clips:edit'];
interface Tokens { access_token: string; refresh_token: string; expires_at: number }
export interface Identity { client_id: string; user_id: string; login: string; scopes: string[] }
export class TwitchAuth {
  private tokens?: Tokens;
  private refreshing?: Promise<string>;
  constructor(private config: Config, private file = '.tokens.json', private request: typeof fetch = fetch) {}
  async load() {
    try {
      this.tokens = JSON.parse(await readFile(this.file, 'utf8')) as Tokens;
      if (!this.tokens?.access_token || !this.tokens.refresh_token || !Number.isFinite(this.tokens.expires_at)) throw new Error('Invalid token file; reconnect Twitch');
      await chmod(this.file, 0o600);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw new Error('Cannot load .tokens.json; reconnect Twitch');
    }
  }
  private async grant(params: Record<string,string>) {
    const response = await this.request('https://id.twitch.tv/oauth2/token', {
      method:'POST', body:new URLSearchParams({client_id:this.config.clientId, client_secret:this.config.clientSecret, ...params}), signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Twitch token request failed (${response.status}); reconnect Twitch`);
    const result = await response.json() as {access_token:string;refresh_token:string;expires_in:number};
    if (!result.access_token || !result.refresh_token || !Number.isFinite(result.expires_in)) throw new Error('Invalid Twitch token response');
    const tokens = {access_token:result.access_token, refresh_token:result.refresh_token, expires_at:Date.now()+result.expires_in*1000};
    await writeFile(this.file+'.tmp', JSON.stringify(tokens), {mode:0o600});
    await chmod(this.file+'.tmp', 0o600);
    await rename(this.file+'.tmp', this.file);
    this.tokens = tokens;
    return tokens.access_token;
  }
  exchange(code:string) { return this.grant({grant_type:'authorization_code', code, redirect_uri:this.config.redirectUri}); }
  async accessToken(force = false): Promise<string> {
    if (!this.tokens) throw new Error('Connect Twitch at /auth/login');
    if (this.refreshing) return this.refreshing;
    if (!force && this.tokens.expires_at > Date.now()+60_000) return this.tokens.access_token;
    this.refreshing = this.grant({grant_type:'refresh_token', refresh_token:this.tokens.refresh_token});
    try { return await this.refreshing; } finally { this.refreshing = undefined; }
  }
  async validate(): Promise<Identity> {
    const token = await this.accessToken();
    const response = await this.request('https://id.twitch.tv/oauth2/validate', {headers:{Authorization:`OAuth ${token}`},signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error(`Twitch authorization invalid (${response.status}); reconnect Twitch`);
    const identity = await response.json() as Identity;
    if (identity.client_id !== this.config.clientId || !identity.user_id || !CHAT_SCOPES.every(scope => identity.scopes?.includes(scope))) throw new Error('Wrong Twitch app or missing chat scopes; reconnect Twitch');
    return identity;
  }
}
