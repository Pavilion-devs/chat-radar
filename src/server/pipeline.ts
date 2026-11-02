import { EventEmitter } from 'node:events';
import { ChatBuffer } from '../analysis/buffer.js';
import type { ChatEvent, ChatMessage, ServerEvent, Status } from '../types.js';
export function normalize(event: ChatEvent, timestamp: string): ChatMessage {
  const ts = Date.parse(timestamp);
  if (!event.message_id || !event.chatter_user_id || typeof event.message?.text !== 'string' || !Number.isFinite(ts)) throw new Error('Invalid chat event');
  return {id:event.message_id, user:{id:event.chatter_user_id, login:event.chatter_user_login, name:event.chatter_user_name}, text:event.message.text, ts, badges:event.badges || [], sim:false};
}
export class Pipeline {
  readonly bus = new EventEmitter();
  private currentStatus: Status = {connected:false, channel:'', detail:'Connect Twitch at /auth/login', sim:false};
  get status(): Status {return {...this.currentStatus};}
  setStatus(patch: Partial<Status>) {this.publish({type:'status',data:{...this.currentStatus,...patch}});}
  constructor(readonly buffer = new ChatBuffer()) {}
  ingest(message: ChatMessage) {
    if (!this.buffer.add(message)) return;
    this.publish({type:'chat', data:message});
  }
  publish(event: ServerEvent) {
    if (event.type==='status') this.currentStatus=event.data;
    this.bus.emit('event', event);
  }
  onEvent(listener: (event: ServerEvent) => void) {
    this.bus.on('event', listener);
    return () => this.bus.off('event', listener);
  }
}
