import { setTimeout as delay } from 'node:timers/promises';
import type { TwitchApi } from './api.js';
export type ClipResult={status:'ready';url:string;thumbnailUrl?:string}|{status:'marker';reason:'offline'|'missing_scope'|'not_connected'};
export function validThumbnailUrl(value:unknown):value is string{
  if(typeof value!=='string')return false;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&['twitch.tv','twitchcdn.net','jtvnw.net'].some(host=>url.hostname.endsWith('.'+host));}catch{return false;}
}
export function validClipUrl(value:unknown):value is string {
  if(typeof value!=='string')return false;
  try{const url=new URL(value);return url.protocol==='https:' && !url.username && !url.password && ((url.hostname==='clips.twitch.tv' && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) || (url.hostname==='www.twitch.tv' && /^\/[A-Za-z0-9_]+\/clip\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)));}catch{return false;}
}
export class TwitchClipper {
  constructor(private api:TwitchApi,private broadcasterId:string,private scopes:string[],private now=Date.now,private wait=(ms:number,signal:AbortSignal)=>delay(ms,undefined,{signal})) {}
  async create(signal:AbortSignal):Promise<ClipResult> {
    signal.throwIfAborted();
    if(!this.scopes.includes('clips:edit'))return {status:'marker',reason:'missing_scope'};
    if(!await this.api.isLive(this.broadcasterId,signal))return {status:'marker',reason:'offline'};
    signal.throwIfAborted();
    const id=await this.api.createClip(this.broadcasterId,signal);
    const end=this.now()+15_000;
    while(this.now()<end){
      signal.throwIfAborted();
      const remaining=AbortSignal.timeout(Math.max(1,end-this.now()));
      const clip=await this.api.clip(id,AbortSignal.any([signal,remaining]));
      if(clip){if(!validClipUrl(clip.url))throw new Error('Invalid Twitch clip URL');return {status:'ready',url:clip.url,...(validThumbnailUrl(clip.thumbnailUrl)?{thumbnailUrl:clip.thumbnailUrl}:{})};}
      await this.wait(Math.min(1000,Math.max(1,end-this.now())),signal);
    }
    throw new Error('Twitch clip did not become available');
  }
}
