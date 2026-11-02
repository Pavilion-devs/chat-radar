export const TOPIC_KINDS=['question','request','reaction','complaint'] as const;
export interface RadarTopic {label:string;kind:typeof TOPIC_KINDS[number];count_estimate:number;examples:[string,string];urgency:number}
export interface RadarOutput {topics:RadarTopic[];mood:{label:string;score:number}}
export interface StableTopic extends RadarTopic {id:string}
export interface RadarState {
  topics:StableTopic[];mood:RadarOutput['mood'];ts:number|null;sim:boolean;
  status:'disabled'|'waiting'|'ready'|'stale'|'error';detail:string;windowCount:number;sampledCount:number;
}
export const RADAR_SCHEMA={type:'object',additionalProperties:false,required:['topics','mood'],properties:{
  topics:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['label','kind','count_estimate','examples','urgency'],properties:{
    label:{type:'string',minLength:1,maxLength:60,pattern:'^\\S+(?:\\s+\\S+){0,4}$'},kind:{type:'string',enum:TOPIC_KINDS},
    count_estimate:{type:'integer',minimum:0},examples:{type:'array',minItems:2,maxItems:2,items:{type:'string',minLength:1,maxLength:300}},urgency:{type:'number',minimum:0,maximum:1}
  }}},mood:{type:'object',additionalProperties:false,required:['label','score'],properties:{label:{type:'string',minLength:1,maxLength:40},score:{type:'number',minimum:-1,maximum:1}}}
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
export function validateRadar(value:unknown,total:number,evidence:Set<string>):RadarOutput {
  const root=record(value,['topics','mood']);
  if (!Array.isArray(root.topics) || root.topics.length>6) throw new Error('Invalid radar topics');
  const topics=root.topics.map(item=>{
    const topic=record(item,['label','kind','count_estimate','examples','urgency']);
    const label=text(topic.label,60);
    if (label.split(/\s+/).length>5 || !TOPIC_KINDS.includes(topic.kind as RadarTopic['kind'])) throw new Error('Invalid radar topic');
    const count_estimate=number(topic.count_estimate,0,total);if (!Number.isInteger(count_estimate)) throw new Error('Invalid radar count');
    if (!Array.isArray(topic.examples) || topic.examples.length!==2) throw new Error('Invalid radar examples');
    const examples=topic.examples.map(example=>text(example,300));
    if (!examples.every(example=>evidence.has(example))) throw new Error('Ungrounded radar examples');
    return {label,kind:topic.kind as RadarTopic['kind'],count_estimate,examples:examples as [string,string],urgency:number(topic.urgency,0,1)};
  });
  const mood=record(root.mood,['label','score']);
  return {topics,mood:{label:text(mood.label,40),score:number(mood.score,-1,1)}};
}
