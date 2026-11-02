import type { ChatCommand } from './commands/chat.js';
import type { RadarState } from './analysis/radar-schema.js';
import type { TechCategory } from './analysis/tech-rules.js';
export interface ChatMessage {
  id: string;
  user: { id: string; login: string; name: string };
  text: string;
  ts: number;
  badges: { set_id: string; id: string; info: string }[];
  sim: boolean;
}
export interface ChatEvent {
  message_id: string; chatter_user_id: string; chatter_user_login: string;
  chatter_user_name: string; message: { text: string }; badges: ChatMessage['badges'];
}
export interface SimulationStatus {
  runId: string; scenario: string; state: 'running' | 'completed' | 'stopped';
  phase: string; sent: number; total: number; rate: number; speed?:number;
}
export interface Status {
  connected: boolean; channel: string; detail: string; sim: boolean; simulation?: SimulationStatus;
}
export interface TechAlert {
  id:string; category:TechCategory; title:string; count:number; uniqueUsers:number;
  share:number; sample:string[]; ts:number; sim:boolean;
}
export interface AlertCleared {
  id:string; category:TechCategory; ts:number; sim:boolean;
  acknowledgement:'local_only'|'pending'|'sent'|'failed'|'unavailable';
}
export interface Moment {
  id:string;ts:number;title:string;titleSource:'pending'|'fallback'|'llm';peakRate:number;uniqueChatters:number;baselineRate:number;zScore:number;
  sim:boolean;clipUrl:string|null;clipStatus:'marker'|'pending'|'ready'|'failed';clipReason:'simulated'|'offline'|'missing_scope'|'not_connected'|'failed'|null;saved:boolean;
}
export interface CommandReply {id:string;command:ChatCommand;user:string;text:string;ts:number;sim:boolean;status:'preview'|'sent'|'failed';source:'radar'|'llm'|'fallback';cached:boolean}
export type ServerEvent = {type:'command_reply';data:CommandReply} | {type:'moment';data:Moment} | {type:'radar';data:RadarState} | {type:'alert';data:TechAlert} | {type:'alert_cleared';data:AlertCleared} | { type: 'chat'; data: ChatMessage } | { type: 'status'; data: Status };
