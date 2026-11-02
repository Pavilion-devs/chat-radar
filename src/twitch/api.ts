import type { TwitchAuth } from './auth.js';
export class TwitchApi {
  constructor(private clientId:string, private auth: TwitchAuth, private request:typeof fetch = fetch) {}
  async call<T>(path:string, body?:unknown, retry = true, options:{method?:'GET'|'POST';signal?:AbortSignal}={}):Promise<T> {
    const token = await this.auth.accessToken();
    const response = await this.request(`https://api.twitch.tv/helix/${path}`, {
      method:options.method ?? (body === undefined ? 'GET':'POST'),
      headers:{'Client-Id':this.clientId, Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)
    });
    if (response.status === 401 && retry) { await this.auth.accessToken(true); return this.call<T>(path,body,false,options); }
    if (!response.ok) throw new Error(`Twitch API request failed (${response.status})`);
    return await response.json() as T;
  }
  async userId(login:string) {
    const result = await this.call<{data:{id:string}[]}>(`users?login=${encodeURIComponent(login)}`);
    if (!result.data[0]) throw new Error('TWITCH_CHANNEL was not found');
    return result.data[0].id;
  }
  subscribe(sessionId:string, broadcasterId:string, userId:string) {
    return this.call('eventsub/subscriptions', {type:'channel.chat.message',version:'1',condition:{broadcaster_user_id:broadcasterId,user_id:userId},transport:{method:'websocket',session_id:sessionId}});
  }
  async isLive(broadcasterId:string,signal:AbortSignal){
    const result=await this.call<{data:{id:string}[]}>(`streams?user_id=${encodeURIComponent(broadcasterId)}`,undefined,true,{signal});return result.data.length>0;
  }
  async createClip(broadcasterId:string,signal:AbortSignal){
    const result=await this.call<{data:{id:string}[]}>(`clips?broadcaster_id=${encodeURIComponent(broadcasterId)}`,undefined,true,{method:'POST',signal});
    if(!result.data[0]?.id)throw new Error('Twitch did not return a clip ID');return result.data[0].id;
  }
  async clipUrl(id:string,signal:AbortSignal){
    const result=await this.call<{data:{url:string}[]}>(`clips?id=${encodeURIComponent(id)}`,undefined,true,{signal});return result.data[0]?.url;
  }
  async send(broadcasterId:string, senderId:string, message:string) {
    const result = await this.call<{data:{is_sent:boolean}[]}>('chat/messages',{broadcaster_id:broadcasterId,sender_id:senderId,message});
    if (!result.data[0]?.is_sent) throw new Error('Twitch did not send the chat message (check channel restrictions)');
  }
}
