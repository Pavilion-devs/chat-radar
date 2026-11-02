export interface Chat {id:string;user:{id:string;login:string;name:string};text:string;ts:number;sim:boolean}
export interface Status {connected:boolean;channel:string;detail:string;sim:boolean;simulation?:{runId:string;scenario:string;state:string;phase:string;rate:number;sent:number;total:number}}
export interface Topic {id:string;label:string;kind:'question'|'request'|'reaction'|'complaint';count_estimate:number;examples:string[];urgency:number}
export interface Radar {topics:Topic[];mood:{label:string;score:number};ts:number|null;sim:boolean;status:string;detail:string;sampledCount:number;windowCount:number}
export interface Alert {id:string;category:string;title:string;uniqueUsers:number;share:number;sample:string[];ts:number;sim:boolean}
export interface Moment {id:string;ts:number;title:string;titleSource:string;peakRate:number;uniqueChatters:number;sim:boolean;clipStatus:string;clipUrl:string|null;clipReason:string|null;saved:boolean}
export interface Reply {id:string;ts:number;command:string;text:string;sim:boolean;status:string;cached:boolean;source:string}
export type Event = {type:'status';data:Status}|{type:'radar';data:Radar}|{type:'chat';data:Chat}|{type:'moment';data:Moment}|{type:'alert';data:Alert}|{type:'alert_cleared';data:{id:string;acknowledgement:string}}|{type:'command_reply';data:Reply};
export const kinds={question:{icon:'?',label:'Question'},request:{icon:'↗',label:'Request'},reaction:{icon:'✦',label:'Reaction'},complaint:{icon:'!',label:'Concern'}};
export const number=new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1});
export const time=(ts:number)=>new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
export function overlayOptions(search:string){
  const params=new URLSearchParams(search),value=Number(params.get('scale')??1);
  return {compact:params.get('layout')==='compact',position:params.get('position')==='left'?'left':'right',scale:Number.isFinite(value)&&value>0?Math.min(1.5,Math.max(.65,value)):1};
}
export function clipUrl(value:string|null):string|null{
  if(!value)return null;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&((u.hostname==='clips.twitch.tv'&&/^\/[\w-]+\/?$/.test(u.pathname))||(u.hostname==='www.twitch.tv'&&/^\/\w+\/clip\/[\w-]+\/?$/.test(u.pathname)))?u.href:null;}catch{return null;}
}
export function momentLabel(moment:Moment){
  if(moment.sim)return 'Simulated moment';
  if(moment.clipStatus==='ready'&&clipUrl(moment.clipUrl))return 'Clipped';
  if(moment.clipStatus==='pending')return 'Creating clip';
  if(moment.clipStatus==='failed')return 'Clip unavailable';
  return 'Moment saved';
}
// Reconnect snapshots must restore history without replaying old on-stream toasts.
export class MomentNotices {
  private seen=new Map<string,{eligible:boolean;signature:string}>();
  accept(moment:Moment,now=Date.now()):boolean{
    const previous=this.seen.get(moment.id),signature=[moment.title,moment.clipStatus,moment.clipUrl].join('|');
    const eligible=previous?.eligible??(now-moment.ts<10_000&&now-moment.ts>=-2000);
    this.seen.set(moment.id,{eligible,signature});
    if(this.seen.size>1000)this.seen.delete(this.seen.keys().next().value!);
    return eligible&&now-moment.ts<120_000&&previous?.signature!==signature;
  }
}
// Bounded receipt-time buckets; buffered history cannot become a new traffic spike.
export class Activity {
  private buckets=new Map<number,{count:number;users:Set<string>}>();
  private seen=new Set<string>();
  add(chat:Chat,now=Date.now()){
    if(this.seen.has(chat.id))return;
    this.seen.add(chat.id);if(this.seen.size>5000)this.seen.delete(this.seen.values().next().value!);
    if(now-chat.ts>2000||chat.ts-now>2000)return;
    const second=Math.floor(now/1000),bucket=this.buckets.get(second)??{count:0,users:new Set<string>()};
    bucket.count++;bucket.users.add(`${chat.sim?'sim':'real'}:${chat.user.id}`);this.buckets.set(second,bucket);this.prune(second);
  }
  private prune(second:number){for(const key of this.buckets.keys())if(key<second-60)this.buckets.delete(key);}
  snapshot(now=Date.now()){
    const second=Math.floor(now/1000);this.prune(second);const users=new Set<string>();
    for(const [key,bucket]of this.buckets)if(key>=second-10)for(const user of bucket.users)users.add(user);
    return {rate:this.buckets.get(second-1)?.count??0,users:users.size,bars:Array.from({length:32},(_,i)=>this.buckets.get(second-32+i)?.count??0)};
  }
}
