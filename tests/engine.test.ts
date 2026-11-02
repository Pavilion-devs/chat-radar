import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pipeline, normalize } from '../src/server/pipeline.js';
import { ChatBuffer } from '../src/analysis/buffer.js';
import { ChatSender } from '../src/twitch/send-chat.js';
import { createPing } from '../src/commands/ping.js';
import { readConfig } from '../src/config.js';
import type { ChatEvent, ChatMessage } from '../src/types.js';
const raw:ChatEvent={message_id:'1',chatter_user_id:'u1',chatter_user_login:'viewer',chatter_user_name:'Viewer',message:{text:'hi'},badges:[{set_id:'subscriber',id:'1',info:''}]};
const message=(id='1',ts=1000):ChatMessage=>({...normalize({...raw,message_id:id},new Date(ts).toISOString())});
afterEach(()=>vi.useRealTimers());
describe('ingestion',()=>{
  it('normalizes Twitch messages, retains badges and marks them real',()=>{
    expect(message()).toEqual({id:'1',user:{id:'u1',login:'viewer',name:'Viewer'},text:'hi',ts:1000,badges:raw.badges,sim:false});
    expect(()=>normalize(raw,'invalid')).toThrow();
  });
  it('expires old messages and enforces circular capacity',()=>{
    let now=1000;const buffer=new ChatBuffer(100,2,()=>now);
    buffer.add(message('1',950));buffer.add(message('2',960));buffer.add(message('3',970));
    expect(buffer.recent().map(m=>m.id)).toEqual(['2','3']);
    expect(buffer.add(message('3',970))).toBe(false);
    now=1070;expect(buffer.recent().map(m=>m.id)).toEqual(['3']);
    now=1071;expect(buffer.recent()).toEqual([]);
    expect(buffer.add(message('stale',900))).toBe(false);
  });
  it('publishes accepted messages immediately and suppresses duplicate delivery',()=>{
    const pipeline=new Pipeline(new ChatBuffer(100,10,()=>1000));const listener=vi.fn();
    const off=pipeline.onEvent(listener);
    pipeline.ingest(message());pipeline.ingest(message());expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({type:'chat',data:message()});
    off();pipeline.ingest(message('2'));expect(listener).toHaveBeenCalledTimes(1);
  });
});
describe('outbound safety',()=>{
  it('spaces sends and rejects invalid text',async()=>{
    vi.useFakeTimers();const send=vi.fn(async()=>{});const sender=new ChatSender(send);
    await sender.sendChat('first');const second=sender.sendChat('second');
    expect(send).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1600);await second;
    expect(send).toHaveBeenCalledTimes(2);
    await expect(sender.sendChat('x'.repeat(501))).rejects.toThrow('500');
    await expect(sender.sendChat('a\nb')).rejects.toThrow('one line');
    await expect(sender.sendChat(' ')).rejects.toThrow();sender.stop();
  });
  it('bounds pending sends and backs off without retrying an ambiguous POST',async()=>{
    vi.useFakeTimers();const send=vi.fn().mockRejectedValueOnce(new Error('rate limit')).mockResolvedValue(undefined);
    const sender=new ChatSender(send);await expect(sender.sendChat('first')).rejects.toThrow('failed');
    const queued=sender.sendChat('second');await vi.advanceTimersByTimeAsync(29_999);expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);await queued;expect(send).toHaveBeenCalledTimes(2);
    const pending=Array.from({length:20},()=>sender.sendChat('pending').catch(()=>{}));
    await expect(sender.sendChat('overflow')).rejects.toThrow('full');sender.stop();await Promise.all(pending);
  });
  it('handles !ping with global and per-user cooldowns; simulated chat never sends',async()=>{
    let now=1000;const send=vi.fn(async()=>{});const ping=createPing(send,vi.fn(),()=>now);
    const m={...message(),text:'!ping'};ping({...m,sim:true});expect(send).not.toHaveBeenCalled();
    ping(m);ping(m);expect(send).toHaveBeenCalledTimes(1);expect(send).toHaveBeenLastCalledWith('@viewer pong!');
    now+=3000;ping(m);expect(send).toHaveBeenCalledTimes(1);
    ping({...m,user:{...m.user,id:'other'}});expect(send).toHaveBeenCalledTimes(2);
    now+=7000;ping(m);expect(send).toHaveBeenCalledTimes(3);
  });
});
it('checks local redirect, channel and port configuration',()=>{
  expect(readConfig({}).port).toBe(3000);
  expect(()=>readConfig({PORT:'no'})).toThrow();
  expect(()=>readConfig({TWITCH_CHANNEL:'https://twitch.tv/a'})).toThrow();
  expect(()=>readConfig({TWITCH_REDIRECT_URI:'http://example.com/auth/callback'})).toThrow();
});
