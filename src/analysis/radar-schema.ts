import {topicSimilarity} from './topic-label.js';
import type {RadarSample} from './radar-sample.js';
export const TOPIC_KINDS=['question','request','reaction','complaint'] as const;
export interface RadarTopic {label:string;kind:typeof TOPIC_KINDS[number];count_estimate:number;examples:[string,string];urgency:number}
export interface RadarOutput {topics:RadarTopic[];mood:{label:string;score:number}}
export interface StableTopic extends RadarTopic {id:string}
export interface RadarState {
  topics:StableTopic[];mood:RadarOutput['mood'];ts:number|null;sim:boolean;
  status:'disabled'|'waiting'|'ready'|'stale'|'error';detail:string;windowCount:number;sampledCount:number;
}
export const MOODS=['hyped','curious','happy','confused','frustrated','salty','welcoming','neutral'] as const;
export const RADAR_SCHEMA={type:'object',additionalProperties:false,required:['topics','mood'],properties:{
  topics:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['label','kind','message_indices','urgency'],properties:{
    label:{type:'string',minLength:1,maxLength:22,pattern:'^\\S+(?:\\s+\\S+){0,4}$',description:"What chat is saying, in chat's voice. Never include question, request, reaction, complaint or their plurals."},kind:{type:'string',enum:TOPIC_KINDS},
    message_indices:{type:'array',minItems:1,maxItems:300,items:{type:'integer',minimum:0,maximum:299},description:'Distinct zero-based indices of ALL supporting supplied message entries. Each entry belongs to at most one topic. Never invent an index.'},urgency:{type:'number',minimum:0,maximum:1}
  }}},mood:{type:'object',additionalProperties:false,required:['label','score'],properties:{label:{type:'string',enum:MOODS},score:{type:'number',minimum:-1,maximum:1}}}
}};
function record(value:unknown,keys:string[]):Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid radar object');
  const obj=value as Record<string,unknown>;
  if (Object.keys(obj).length!==keys.length || !keys.every(key=>Object.hasOwn(obj,key))) throw new Error('Invalid radar fields');
  return obj;
}
function text(value:unknown,max:number):string {
  if (typeof value!=='string' || !value.trim() || value.length>max) throw new Error('Invalid radar text');return value.trim().replace(/\s+/g,' ');
}
function number(value:unknown,min:number,max:number):number {
  if (typeof value!=='number' || !Number.isFinite(value) || value<min || value>max) throw new Error('Invalid radar number');return value;
}
export function validateRadar(value:unknown,sample:RadarSample):RadarOutput {
  const root=record(value,['topics','mood']);
  if (!Array.isArray(root.topics) || root.topics.length>6) throw new Error('Invalid radar topics');
  const groups:{label:string;kind:RadarTopic['kind'];indices:Set<number>;urgency:number}[]=[];
  for(const item of root.topics){
    const topic=record(item,['label','kind','message_indices','urgency']),label=text(topic.label,22);
    if(label.split(/\s+/).length>5||/\b(?:question|request|reaction|complaint)s?\b/i.test(label)||!TOPIC_KINDS.includes(topic.kind as RadarTopic['kind']))throw new Error('Invalid radar topic');
    if(!Array.isArray(topic.message_indices)||!topic.message_indices.length||topic.message_indices.length>300)throw new Error('Missing radar evidence');
    const indices=new Set<number>();
    for(const index of topic.message_indices){if(typeof index!=='number'||!Number.isInteger(index)||index<0||index>=sample.messages.length||indices.has(index))throw new Error('Invalid radar evidence index');indices.add(index);}
    const kind=topic.kind as RadarTopic['kind'],urgency=number(topic.urgency,0,1);
    // A reaction family is one topic even if a provider separates W/Pog/LMAO.
    const duplicate=groups.find(group=>group.kind===kind&&(kind==='reaction'||topicSimilarity(group.label,label)>=.6));
    if(duplicate){for(const index of indices)duplicate.indices.add(index);duplicate.urgency=Math.max(duplicate.urgency,urgency);}
    else groups.push({label,kind,indices,urgency});
  }
  const claimed=new Set<number>(),represented=sample.messages.reduce((sum,entry)=>sum+entry.count,0);
  const topics=groups.map(group=>{
    for(const index of group.indices){if(claimed.has(index))throw new Error('Radar evidence assigned to different topics');claimed.add(index);}
    const evidence=[...group.indices].map(index=>sample.messages[index]!);
    const matches=evidence.reduce((sum,entry)=>sum+entry.count,0);
    const count_estimate=Math.min(sample.total,Math.round(matches*sample.total/Math.max(1,represented)));
    const examples:[string,string]=[evidence[0]!.text,evidence[1]?.text??evidence[0]!.text];
    return{label:group.label,kind:group.kind,urgency:group.urgency,count_estimate,examples};
  });
  const mood=record(root.mood,['label','score']);
  if(!MOODS.includes(mood.label as typeof MOODS[number]))throw new Error('Invalid one-word mood');
  return {topics,mood:{label:text(mood.label,20),score:number(mood.score,-1,1)}};
}
