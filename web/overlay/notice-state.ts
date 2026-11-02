import {clipUrl,type Radar,type Moment} from '../shared/model.js';
export function bigJump(previous:Radar|undefined,next:Radar){
  if(!previous?.ts||!next.ts||next.ts<=previous.ts||previous.sim!==next.sim)return;
  return next.topics.filter(topic=>topic.kind!=='reaction').flatMap(topic=>{
    const old=previous.topics.find(candidate=>candidate.id===topic.id);if(!old)return[];
    const delta=topic.count_estimate-old.count_estimate;
    return delta>=Math.max(100,old.count_estimate*.35)?[{id:topic.id,delta,seconds:Math.max(1,Math.round((next.ts!-previous.ts!)/1000))}]:[];
  }).sort((a,b)=>b.delta-a.delta)[0];
}
export function thumbnailUrl(value:string|undefined){
  if(!value)return null;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&['twitch.tv','twitchcdn.net','jtvnw.net'].some(host=>url.hostname.endsWith('.'+host))?url.href:null;}catch{return null;}
}
export function momentPresentation(moment:Moment){
  if(moment.sim)return{state:'Moment marked',thumbnail:null,sim:true,clipped:false};
  if(moment.clipStatus==='pending')return null;
  const clipped=moment.clipStatus==='ready'&&!!clipUrl(moment.clipUrl);
  return{state:clipped?'Clip saved':'Moment marked',thumbnail:clipped?thumbnailUrl(moment.thumbnailUrl):null,sim:false,clipped};
}
