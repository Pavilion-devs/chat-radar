import type { ChatMessage, Moment } from '../types.js';
import type { RadarState } from './radar-schema.js';
import { commandNoise } from './chat-text.js';
import { sampleChat } from './radar-sample.js';
export interface RecapContext {
  sim:boolean;since:number;until:number;totalMessages:number;
  radar:{ts:number;topics:{label:string;kind:string}[];mood:string}[];
  moments:{ts:number;title:string}[];
  messages:{text:string;count:number;uniqueUsers:number}[];
}
export function recapContext(messages:ChatMessage[],history:RadarState[],moments:Moment[],now:number,sim:boolean,since=now-600_000):RecapContext {
  since=Math.max(since,now-600_000);
  const eligible=messages.filter(m=>m.ts>=since && !commandNoise(m.text));
  const sample=sampleChat(eligible,now,sim,{windowMs:600_000,maxEntries:80,maxCharacters:16_000});
  const frames=history.filter(s=>s.sim===sim&&s.status==='ready'&&s.ts!==null&&s.ts>=since&&s.ts<=now);
  const selected=frames.length<=20?frames:Array.from({length:20},(_,i)=>frames[Math.floor(i*(frames.length-1)/19)]!);
  return {sim,since,until:now,totalMessages:sample.total,messages:sample.messages,
    radar:selected.map(s=>({ts:s.ts!,topics:s.topics.map(t=>({label:t.label,kind:t.kind})),mood:s.mood.label})),
    moments:moments.filter(m=>m.sim===sim&&m.ts>=since&&m.ts<=now).sort((a,b)=>a.ts-b.ts).slice(-10).map(m=>({ts:m.ts,title:m.title}))};
}
export function cleanBody(text:string,max=400):string {
  const clean=text.replace(/https?:\/\/\S+|www\.\S+/gi,'').replace(/@(?=[a-z0-9_])/gi,'').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim();
  const chars=Array.from(clean);return chars.length<=max?clean:chars.slice(0,max-1).join('')+'…';
}
export function fallbackRecap(context:RecapContext):string {
  const labels=[...new Set(context.radar.flatMap(frame=>frame.topics.map(t=>t.label)))].slice(-4);
  const moments=context.moments.slice(-2).map(m=>m.title);
  if(!labels.length&&!moments.length)return context.totalMessages?'Recent chat is still being analyzed; no recap is ready yet.':'Not enough recent chat to recap yet.';
  return cleanBody([labels.length?`Chat topics included ${labels.join(', ')}.`:'',moments.length?`Moment markers: ${moments.join('; ')}.`:''].filter(Boolean).join(' '));
}
