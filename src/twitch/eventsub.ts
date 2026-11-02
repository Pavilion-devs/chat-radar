import WebSocket from 'ws';
import type { ChatEvent } from '../types.js';
const ENDPOINT = 'wss://eventsub.wss.twitch.tv/ws';
interface Frame {
  metadata:{message_id:string;message_type:string;message_timestamp:string;subscription_type?:string};
  payload:{session?:{id:string;keepalive_timeout_seconds:number|null;reconnect_url?:string};event?:ChatEvent;subscription?:{status:string}};
}
interface Connection {ws:WebSocket; timer?:ReturnType<typeof setTimeout>; welcomed:boolean}
export class EventSub {
  private active?:Connection;
  private pending?:Connection;
  private retry?:ReturnType<typeof setTimeout>;
  private stopped=true;
  private attempts=0;
  private seen=new Map<string,number>();
  private nextPrune=0;
  constructor(private subscribe:(id:string)=>Promise<unknown>, private receive:(event:ChatEvent,ts:string)=>void,
    private status:(connected:boolean,detail:string)=>void, private socket:(url:string)=>WebSocket = url=>new WebSocket(url)) {}
  start() { if (!this.stopped) return; this.stopped=false;this.connect(ENDPOINT,false); }
  stop() {
    this.stopped=true; clearTimeout(this.retry);this.retry=undefined;
    this.dispose(this.active);this.dispose(this.pending);this.active=undefined;this.pending=undefined;
  }
  private dispose(connection?:Connection) {
    if (!connection) return;
    clearTimeout(connection.timer);
    connection.ws.removeAllListeners();
    connection.ws.on('error',()=>{});
    connection.ws.terminate();
  }
  private reconnect(detail:string) {
    if (this.stopped) return;
    this.dispose(this.active);this.dispose(this.pending);this.active=undefined;this.pending=undefined;
    this.status(false,detail);
    if (this.retry) return;
    const delay=Math.min(30_000,1000*2**Math.min(this.attempts++,5));
    this.retry=setTimeout(()=>{this.retry=undefined;this.connect(ENDPOINT,false);},delay);
  }
  private connect(url:string,transfer:boolean) {
    if (this.stopped) return;
    const connection:Connection={ws:this.socket(url),welcomed:false};
    if (transfer) this.pending=connection; else this.active=connection;
    let timeout=10_000;
    const arm=()=>{
      clearTimeout(connection.timer);
      connection.timer=setTimeout(()=>this.reconnect('EventSub timed out; reconnecting'),timeout+1000);
    };
    arm();
    connection.ws.on('error',()=>this.reconnect('EventSub connection error; reconnecting'));
    connection.ws.on('close',()=>{
      // During Twitch's migration window the replacement is already opening.
      if (connection===this.active && this.pending) {
        clearTimeout(connection.timer);this.active=undefined;return;
      }
      this.reconnect('EventSub disconnected; reconnecting');
    });
    connection.ws.on('message',data=>{
      void (async()=>{
        let frame:Frame;
        try { frame=JSON.parse(data.toString()) as Frame; }
        catch { this.reconnect('Invalid EventSub frame; reconnecting');return; }
        if (!frame.metadata || !frame.payload) {this.reconnect('Invalid EventSub frame; reconnecting');return;}
        arm();
        const {message_type:type,message_id:id,message_timestamp:ts}=frame.metadata;
        const session=frame.payload.session;
        if (type==='session_welcome' && session) {
          if (connection.welcomed) return;
          connection.welcomed=true;
          timeout=(session.keepalive_timeout_seconds ?? 10)*1000;arm();
          if (transfer) {
            this.dispose(this.active);this.active=connection;this.pending=undefined;
          } else {
            await this.subscribe(session.id);
            if (this.stopped || this.active!==connection) return;
          }
          this.attempts=0;this.status(true,'Receiving Twitch chat');
        } else if (type==='session_reconnect') {
          const next=new URL(session?.reconnect_url || '');
          if (next.protocol!=='wss:' || next.hostname!=='eventsub.wss.twitch.tv') throw new Error('Invalid reconnect URL');
          if (!this.pending) this.connect(next.toString(),true);
        } else if (type==='notification' && frame.metadata.subscription_type==='channel.chat.message' && frame.payload.event) {
          const now=Date.now();
          if (now>=this.nextPrune) {
            for (const [key,at] of this.seen) if (now-at>15*60_000) this.seen.delete(key);
            this.nextPrune=now+60_000;
          }
          if (this.seen.has(id)) return;
          if (this.seen.size>=100_000) this.seen.delete(this.seen.keys().next().value!);
          this.seen.set(id,now);
          this.receive(frame.payload.event,ts);
        } else if (type==='revocation') {
          this.stop();this.status(false,'Twitch subscription revoked; reconnect at /auth/login');
        }
      })().catch(()=>this.reconnect('EventSub subscription or message failed; reconnecting'));
    });
  }
}
