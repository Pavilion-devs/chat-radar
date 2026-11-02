import type { ChatMessage } from '../types.js';
export interface RadarSample {messages:{text:string;count:number;uniqueUsers:number}[];total:number;lastId:string;sim:boolean}
// Deduplicate text, preserving frequency and distinct-user evidence. Spread selection across the window.
export function sampleChat(messages:ChatMessage[],now:number,sim:boolean,options:{windowMs?:number;maxEntries?:number;maxCharacters?:number}={}):RadarSample {
  const groups=new Map<string,{text:string;count:number;users:Set<string>}>();
  let total=0,lastId='';
  for (const message of messages) {
    if (message.sim!==sim || message.ts<now-(options.windowMs??60_000) || message.ts>now || !message.text.trim()) continue;
    total++;lastId=message.id;
    const text=message.text.normalize('NFKC').replace(/\s+/g,' ').trim().slice(0,300);
    const key=text.toLowerCase();const group=groups.get(key);
    if (group) {group.count++;group.users.add(message.user.id);}
    else groups.set(key,{text,count:1,users:new Set([message.user.id])});
  }
  const all=[...groups.values()];
  const cap=Math.min(options.maxEntries??300,Math.floor((options.maxCharacters??24_000)/all.reduce((longest,item)=>Math.max(longest,item.text.length),1)));
  const selected=all.length<=cap ? all : Array.from({length:cap},(_,i)=>all[Math.floor(i*(all.length-1)/(cap-1))]!);
  const mostFrequent=all.reduce<(typeof all)[number]|undefined>((best,item)=>!best || item.count>best.count ? item:best,undefined);
  if (mostFrequent && !selected.includes(mostFrequent)) selected[Math.floor(selected.length/2)]=mostFrequent;
  const result=selected.map(item=>({text:item.text,count:item.count,uniqueUsers:item.users.size}));
  return {messages:result,total,lastId,sim};
}
