import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { TwitchAuth } from '../src/twitch/auth.js';
import { TwitchApi } from '../src/twitch/api.js';
import { EventSub } from '../src/twitch/eventsub.js';
import { readConfig } from '../src/config.js';
const config=readConfig({TWITCH_CLIENT_ID:'test-client',TWITCH_CLIENT_SECRET:'test-secret',TWITCH_CHANNEL:'test'});
const dirs:string[]=[];
afterEach(async()=>{vi.useRealTimers();await Promise.all(dirs.splice(0).map(p=>rm(p,{recursive:true,force:true})));});
it('stores tokens privately, restores them, and shares concurrent refresh requests',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'radar-test-'));dirs.push(dir);const file=join(dir,'tokens.json');
  const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({access_token:'test-access',refresh_token:'test-refresh',expires_in:0}),{status:200}));
  const auth=new TwitchAuth(config,file,request);expect(await auth.load()).toBe(false);
  await auth.exchange('test-code');expect((await stat(file)).mode & 0o777).toBe(0o600);
  const restored=new TwitchAuth(config,file,request);expect(await restored.load()).toBe(true);
  request.mockImplementation(async()=>new Response(JSON.stringify({access_token:'test-new',refresh_token:'test-next',expires_in:3600})));
  expect(await Promise.all([restored.accessToken(),restored.accessToken()])).toEqual(['test-new','test-new']);
  expect(request).toHaveBeenCalledTimes(2);expect(JSON.parse(await readFile(file,'utf8')).refresh_token).toBe('test-next');
});
it('validates identity and required scopes without exposing upstream errors',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'radar-test-'));dirs.push(dir);
  const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'test',refresh_token:'test',expires_in:3600})))
    .mockResolvedValueOnce(new Response(JSON.stringify({client_id:'test-client',user_id:'1',scopes:[]})));
  const auth=new TwitchAuth(config,join(dir,'tokens.json'),request);await auth.exchange('code');
  await expect(auth.validate()).rejects.toThrow('missing chat scopes');
  request.mockResolvedValue(new Response('private-upstream-details',{status:400}));
  await expect(auth.accessToken(true)).rejects.toThrow('Twitch token request failed (400)');
});
it('retries Helix once after a 401 and surfaces a dropped chat message',async()=>{
  const auth={accessToken:vi.fn(async()=> 'test-token')} as unknown as TwitchAuth;
  const request=vi.fn().mockResolvedValueOnce(new Response('',{status:401})).mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:'broadcaster'}]})));
  const api=new TwitchApi('client',auth,request);expect(await api.userId('viewer')).toBe('broadcaster');
  expect(auth.accessToken).toHaveBeenCalledWith(true);
  request.mockResolvedValue(new Response(JSON.stringify({data:[{is_sent:false}]})));
  await expect(api.send('b','u','hello')).rejects.toThrow('did not send');
});
class FakeSocket extends EventEmitter {terminate=vi.fn();}
function fixture() {
  const sockets:FakeSocket[]=[];const urls:string[]=[];
  const subscribe=vi.fn(async()=>{});const receive=vi.fn();const status=vi.fn();
  const client=new EventSub(subscribe,receive,status,url=>{urls.push(url);const ws=new FakeSocket();sockets.push(ws);return ws as unknown as WebSocket;});
  const frame=(index:number,type:string,payload:object={},id='frame')=>sockets[index]!.emit('message',Buffer.from(JSON.stringify({metadata:{message_id:id,message_type:type,message_timestamp:new Date().toISOString(),subscription_type:'channel.chat.message'},payload})));
  const welcome=(index:number)=>frame(index,'session_welcome',{session:{id:`session${index}`,keepalive_timeout_seconds:10}});
  client.start();return {client,sockets,urls,subscribe,receive,status,frame,welcome};
}
it('subscribes on welcome, deduplicates notifications and transfers reconnect sessions without resubscribing',async()=>{
  const f=fixture();f.welcome(0);await Promise.resolve();expect(f.subscribe).toHaveBeenCalledWith('session0');
  f.frame(0,'notification',{event:{message_id:'chat'}},'event1');f.frame(0,'notification',{event:{message_id:'chat'}},'event1');
  expect(f.receive).toHaveBeenCalledTimes(1);
  f.frame(0,'session_reconnect',{session:{reconnect_url:'wss://eventsub.wss.twitch.tv/ws?reconnect=test'}});
  expect(f.sockets).toHaveLength(2);expect(f.sockets[0]!.terminate).not.toHaveBeenCalled();
  f.welcome(1);await Promise.resolve();expect(f.sockets[0]!.terminate).toHaveBeenCalled();expect(f.subscribe).toHaveBeenCalledTimes(1);f.client.stop();
});
it('detects missing keepalives and resubscribes after an ordinary disconnect',async()=>{
  vi.useFakeTimers();const f=fixture();f.welcome(0);await Promise.resolve();
  await vi.advanceTimersByTimeAsync(9000);f.frame(0,'session_keepalive');await vi.advanceTimersByTimeAsync(9000);expect(f.sockets).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(3000);expect(f.sockets).toHaveLength(2);f.welcome(1);await Promise.resolve();
  expect(f.subscribe).toHaveBeenCalledTimes(2);f.sockets[1]!.emit('close');await vi.advanceTimersByTimeAsync(1000);expect(f.sockets).toHaveLength(3);f.client.stop();
});
it('stops on revocation and rejects reconnect destinations outside Twitch',async()=>{
  vi.useFakeTimers();let f=fixture();f.welcome(0);await Promise.resolve();f.frame(0,'revocation');await vi.advanceTimersByTimeAsync(60_000);expect(f.sockets).toHaveLength(1);expect(f.status).toHaveBeenLastCalledWith(false,expect.stringContaining('revoked'));
  f=fixture();f.welcome(0);await Promise.resolve();f.frame(0,'session_reconnect',{session:{reconnect_url:'wss://attacker.invalid/ws'}});await vi.advanceTimersByTimeAsync(1000);expect(f.urls.every(u=>u.startsWith('wss://eventsub.wss.twitch.tv/'))).toBe(true);f.client.stop();
});
it('retries failed subscriptions with backoff and cancels recovery when stopped',async()=>{
  vi.useFakeTimers();const f=fixture();f.subscribe.mockRejectedValue(new Error('unavailable'));
  f.welcome(0);await vi.advanceTimersByTimeAsync(1000);expect(f.sockets).toHaveLength(2);
  f.welcome(1);await vi.advanceTimersByTimeAsync(1999);expect(f.sockets).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1);expect(f.sockets).toHaveLength(3);
  f.client.stop();await vi.advanceTimersByTimeAsync(60_000);expect(f.sockets).toHaveLength(3);
});
it('continues a Twitch session handoff when the old socket closes before the new welcome',async()=>{
  const f=fixture();f.welcome(0);await Promise.resolve();
  f.frame(0,'session_reconnect',{session:{reconnect_url:'wss://eventsub.wss.twitch.tv/ws?reconnect=test'}});
  f.sockets[0]!.emit('close');f.welcome(1);await Promise.resolve();
  expect(f.subscribe).toHaveBeenCalledTimes(1);expect(f.status).toHaveBeenLastCalledWith(true,'Receiving Twitch chat');f.client.stop();
});
it('creates clips with POST query parameters, reads stream state and clip URLs, and forwards cancellation',async()=>{
 const auth={accessToken:vi.fn(async()=> 'test-token')} as unknown as TwitchAuth;
 const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:'stream'}]})))
  .mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:'clip'}]}),{status:202}))
  .mockResolvedValueOnce(new Response(JSON.stringify({data:[{url:'https://clips.twitch.tv/ValidClip'}]})));
 const api=new TwitchApi('client',auth,request);const signal=new AbortController().signal;
 expect(await api.isLive('b',signal)).toBe(true);expect(await api.createClip('b',signal)).toBe('clip');expect(await api.clipUrl('clip',signal)).toBe('https://clips.twitch.tv/ValidClip');
 expect(request.mock.calls[1]![0]).toBe('https://api.twitch.tv/helix/clips?broadcaster_id=b');expect(request.mock.calls[1]![1]).toMatchObject({method:'POST'});expect(request.mock.calls[1]![1].body).toBeUndefined();
});
it('keeps chat-only tokens usable until the owner reauthorizes clipping',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'radar-chat-scopes-'));dirs.push(dir);
 const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:'test',refresh_token:'test',expires_in:3600})))
  .mockResolvedValueOnce(new Response(JSON.stringify({client_id:'test-client',user_id:'u',login:'viewer',scopes:['user:read:chat','user:write:chat']})));
 const auth=new TwitchAuth(config,join(dir,'tokens.json'),request);await auth.exchange('code');expect((await auth.validate()).user_id).toBe('u');
});
it('does not retry ambiguous failed clip creation requests',async()=>{
 const auth={accessToken:vi.fn(async()=> 'test-token')} as unknown as TwitchAuth;const request=vi.fn(async()=>new Response('',{status:500}));
 await expect(new TwitchApi('client',auth,request).createClip('b',new AbortController().signal)).rejects.toThrow('500');expect(request).toHaveBeenCalledTimes(1);
});
