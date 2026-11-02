import { afterEach, expect, it, vi } from 'vitest';
import { sampleChat, type RadarSample } from '../src/analysis/radar-sample.js';
import { RADAR_SCHEMA, validateRadar, type RadarOutput } from '../src/analysis/radar-schema.js';
import { TopicRadar } from '../src/analysis/topic-radar.js';
import { RadarService } from '../src/server/topic-radar.js';
import { Pipeline } from '../src/server/pipeline.js';
import { OpenAIClient } from '../src/llm/openai.js';
import { LLMRadarClient, type RadarClient } from '../src/llm/radar-client.js';
import type { UsageLogger } from '../src/llm/types.js';
function createOpenAIRadarClient(key:string,model:string,request:typeof fetch,usage:UsageLogger) {return new LLMRadarClient(new OpenAIClient(key,model,request,usage));}
import type { ChatMessage, ServerEvent } from '../src/types.js';
let sequence=0;
const message=(text='next game?',sim=false,ts=Date.now()):ChatMessage=>({id:`r${++sequence}`,user:{id:`u${sequence}`,login:'viewer',name:'Viewer'},text,ts,badges:[],sim});
function grounded(example='next game?',count=1,label='Next game'):RadarOutput {return {topics:[{label,kind:'question',count_estimate:count,examples:[example,example],urgency:0.3}],mood:{label:'curious',score:0.2}};}
function output(_example='next game?',_count=1,label='Next game'){return {topics:[{label,kind:'question',message_indices:[0],urgency:.3}],mood:{label:'curious',score:.2}};}
afterEach(()=>vi.useRealTimers());
it('deduplicates text, preserves crowd counts, and excludes stale/future/other-source messages',()=>{
 const now=Date.now();const messages=[message('next game?'),message('NEXT   GAME?'),message('old',false,now-60_001),message('future',false,now+1),message('sim',true)];
 const sample=sampleChat(messages,now,false);expect(sample.total).toBe(2);expect(sample.messages).toEqual([{text:'next game?',count:2,uniqueUsers:2}]);
});
it('bounds samples to 300 entries and 24,000 characters with coverage across the window',()=>{
 const messages=Array.from({length:1000},(_,i)=>message(`message ${i}`));const sample=sampleChat(messages,Date.now(),false);
 expect(sample.messages).toHaveLength(300);expect(sample.messages[0]!.text).toBe('message 0');expect(sample.messages.at(-1)!.text).toBe('message 999');
 const long=sampleChat(Array.from({length:1000},(_,i)=>message(`${i} ${'x'.repeat(500)}`)),Date.now(),false);
 expect(long.messages.reduce((n,m)=>n+m.text.length,0)).toBeLessThanOrEqual(24_000);expect(long.messages.every(m=>m.text.length<=300)).toBe(true);
});
it('validates word limits, kinds, grounded examples, numeric bounds, and exact output fields',()=>{
 const sample=sampleChat([message()],Date.now(),false);
 expect(validateRadar(output(),sample)).toEqual(grounded());
 for(const value of [output('',1,'No audio complaint'),output('',1,'A label over twenty two'),output('',1,'one two three four five six'),{...output(),extra:1},{...output(),mood:{label:'very curious',score:.2}},{...output(),topics:[{...output().topics[0],kind:'unknown'}]},{...output(),topics:[{...output().topics[0],message_indices:[0,0]}]},{...output(),topics:[{...output().topics[0],message_indices:[1]}]}]) expect(()=>validateRadar(value,sample)).toThrow();
});
it('merges label variations, preserves IDs, smooths counts, and drops absent topics',()=>{
 const engine=new TopicRadar();const first=engine.merge(grounded('next game?',10),[]);
 const next=engine.merge(grounded('different quote',20,'Next game choice'),first);
 expect(next[0]).toMatchObject({id:first[0]!.id,label:'Next game choice',count_estimate:16});
 expect(engine.merge({...grounded(),topics:[]},next)).toEqual([]);
 const renamed=engine.merge(grounded('next game?',30,'Choose our next title'),first);expect(renamed[0]!.id).toBe(first[0]!.id);
});
it('submits strict Responses API schema and untrusted chat as user data, logging only token counts',async()=>{
 const sample=sampleChat([message()],Date.now(),false);const usage=vi.fn();let sent:Record<string,unknown>={};
 const request=vi.fn(async(_url:unknown,init?:RequestInit)=>{sent=JSON.parse(init!.body as string);return new Response(JSON.stringify({status:'completed',usage:{input_tokens:12,output_tokens:10,total_tokens:22},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output())}]}]}));});
 const client=createOpenAIRadarClient('test-secret','test-model',request,usage);
 expect(await client.analyze(sample,[],new AbortController().signal)).toEqual(output());
 expect(sent).toMatchObject({model:'test-model',store:false,text:{format:{name:'chat_radar',type:'json_schema',strict:true,schema:RADAR_SCHEMA}}});
 expect(usage).toHaveBeenCalledWith({input_tokens:12,output_tokens:10,total_tokens:22});
 expect(sent.instructions).toContain('untrusted');expect(JSON.stringify(sent)).not.toContain('test-secret');
});
it('rejects HTTP failures, refusals and incomplete responses without echoing upstream content',async()=>{
 const sample=sampleChat([message()],Date.now(),false);
 for(const body of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'sensitive content'}]}]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'not JSON'}]}]}]) {
  const client=createOpenAIRadarClient('test','test',vi.fn(async()=>new Response(JSON.stringify(body))),()=>{});await expect(client.analyze(sample,[],new AbortController().signal)).rejects.toThrow();
 }
 const client=createOpenAIRadarClient('test','test',vi.fn(async()=>new Response('private error data',{status:429})),()=>{});
 await expect(client.analyze(sample,[],new AbortController().signal)).rejects.toThrow('OpenAI request failed (429)');
});
it('updates on the 8-second clock, does not repeat unchanged inputs, and clears expired topics',async()=>{
 vi.useFakeTimers();const pipeline=new Pipeline();const analyze=vi.fn(async()=>output());const service=new RadarService(pipeline,{client:{analyze}});
 pipeline.ingest(message());await vi.advanceTimersByTimeAsync(7999);expect(analyze).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1);expect(analyze).toHaveBeenCalledTimes(1);expect(service.snapshot.status).toBe('ready');
 await vi.advanceTimersByTimeAsync(8000);expect(analyze).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(48_000);expect(service.snapshot.status).toBe('waiting');expect(service.snapshot.topics).toEqual([]);service.close();
});
it('keeps the last good state on invalid output and errors, then retries and recovers',async()=>{
 const pipeline=new Pipeline();pipeline.ingest(message());const analyze=vi.fn().mockResolvedValueOnce(output()).mockRejectedValueOnce(new Error('private upstream detail')).mockResolvedValueOnce(output('next game?',2));
 const service=new RadarService(pipeline,{client:{analyze}});await service.refresh();const first=service.snapshot;
 pipeline.ingest(message());await service.refresh();expect(service.snapshot.status).toBe('stale');expect(service.snapshot.ts).toBe(first.ts);expect(service.snapshot.topics).toEqual(first.topics);expect(service.snapshot.detail).not.toContain('private');
 await service.refresh();expect(service.snapshot.status).toBe('ready');expect(analyze).toHaveBeenCalledTimes(3);service.close();
});
it('times out without blocking ingest, skips overlapping requests and ignores late results',async()=>{
 vi.useFakeTimers();const pipeline=new Pipeline();pipeline.ingest(message());let finish:(value:unknown)=>void=()=>{};
 let signal:AbortSignal|undefined;
 const analyze=vi.fn((_sample:RadarSample,_previous:unknown,s:AbortSignal)=>{signal=s;return new Promise(resolve=>{finish=resolve;});});
 const service=new RadarService(pipeline,{client:{analyze},timeoutMs:100});
 const running=service.refresh();await service.refresh();expect(analyze).toHaveBeenCalledTimes(1);
 pipeline.ingest(message('no audio'));expect(pipeline.buffer.recent()).toHaveLength(2);
 await vi.advanceTimersByTimeAsync(100);await running;expect(signal?.aborted).toBe(true);expect(service.snapshot.status).toBe('error');
 finish(output());await Promise.resolve();expect(service.snapshot.status).toBe('error');service.close();expect(vi.getTimerCount()).toBe(0);
});
it('separates sources, publishes snapshots, disables cleanly without keys, and cancels on close',async()=>{
 const pipeline=new Pipeline();pipeline.ingest(message('real'));pipeline.ingest(message('sim',true));const events:ServerEvent[]=[];pipeline.onEvent(e=>events.push(e));
 const client:RadarClient={analyze:async sample=>output(sample.messages[0]!.text)};const service=new RadarService(pipeline,{client});
 await service.refresh();expect(service.snapshot.sim).toBe(false);pipeline.setStatus({sim:true});await service.refresh();expect(service.snapshot.sim).toBe(true);
 expect(events.some(e=>e.type==='radar')).toBe(true);const copy=service.snapshot;copy.topics.length=0;expect(service.snapshot.topics).toHaveLength(1);service.close();
 const disabled=new RadarService(pipeline);await disabled.refresh();expect(disabled.snapshot.status).toBe('disabled');disabled.close();
 const pending=new RadarService(pipeline,{client:{analyze:()=>new Promise(()=>{})}});const run=pending.refresh();pending.close();await run;
});
it('covers the end of long-message windows and retains the most repeated theme',()=>{
 const messages=Array.from({length:1000},(_,i)=>message(`${i} ${'x'.repeat(400)}`));
 const common=message('popular recurring topic');messages.splice(500,0,...Array.from({length:100},()=>({...common,id:`common${++sequence}`})));
 const sample=sampleChat(messages,Date.now(),false);
 expect(sample.messages.at(-1)!.text.startsWith('999 ')).toBe(true);expect(sample.messages.find(m=>m.text==='popular recurring topic')?.count).toBe(100);
});
it('does not perform API calls for empty chat and exposes no credentials in its state',async()=>{
 const client={analyze:vi.fn()};const pipeline=new Pipeline();const service=new RadarService(pipeline,{client});
 await service.refresh();expect(client.analyze).not.toHaveBeenCalled();expect(service.snapshot).toMatchObject({status:'waiting',topics:[]});service.close();
});
it('runs the simulator through the real API adapter with an injected HTTP response and publishes radar events',async()=>{
 const {readFile}=await import('node:fs/promises');const {SimulationController}=await import('../src/sim/controller.js');
 const scenario=JSON.parse(await readFile('scenarios/demo.json','utf8'));
 vi.useFakeTimers();const usage=vi.fn();
 const request=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  const body=JSON.parse(init!.body as string);expect(body.text.format.strict).toBe(true);
  const data=JSON.parse(body.input[0].content) as {total:number;messages:{text:string;count:number}[]};
  const mostFrequent=[...data.messages].sort((a,b)=>b.count-a.count)[0]!;
  return new Response(JSON.stringify({status:'completed',usage:{input_tokens:20,output_tokens:10,total_tokens:30},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output(mostFrequent.text,mostFrequent.count,'Chat theme'))}]}]}));
 });
 const pipeline=new Pipeline();const service=new RadarService(pipeline,{client:createOpenAIRadarClient('test-key','test-model',request,usage)});
 const snapshots:ServerEvent[]=[];pipeline.onEvent(e=>{if(e.type==='radar') snapshots.push(e);});const sim=new SimulationController(pipeline);sim.start(scenario);
 await vi.advanceTimersByTimeAsync(95_000);
 expect(request.mock.calls.length).toBeGreaterThan(5);expect(usage).toHaveBeenCalledTimes(request.mock.calls.length);
 expect(snapshots.every(e=>e.type==='radar' && e.data.status==='ready' && e.data.sim && e.data.sampledCount<=300)).toBe(true);
 expect(service.snapshot.topics[0]!.id).toBe('topic:1');sim.stop();service.close();
});
it('classifies quota errors safely and stops automatic retries until restart',async()=>{
 const {LLMRequestError}=await import('../src/llm/errors.js');
 vi.useFakeTimers();const pipeline=new Pipeline();pipeline.ingest(message());
 const request=vi.fn(async()=>new Response(JSON.stringify({error:{code:'project_spend_limit_exceeded',type:'insufficient_quota',message:'private details'}}),{status:429}));
 const client=createOpenAIRadarClient('test','test',request,()=>{});
 await expect(client.analyze(sampleChat(pipeline.buffer.recent(),Date.now(),false),[],new AbortController().signal)).rejects.toMatchObject({kind:'quota',status:429});
 request.mockClear();const service=new RadarService(pipeline,{client});await service.refresh();
 expect(service.snapshot.status).toBe('error');expect(service.snapshot.detail).toContain('quota');expect(service.snapshot.detail).not.toContain('private');
 await vi.advanceTimersByTimeAsync(60_000);expect(request).toHaveBeenCalledTimes(1);service.close();
 expect(new LLMRequestError('openai',429,'quota').message).not.toContain('test');
});
it('honors Retry-After for temporary limits and then recovers',async()=>{
 vi.useFakeTimers();const pipeline=new Pipeline();pipeline.ingest(message());
 const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{type:'rate_limit_error',code:'slow_down'}}),{status:429,headers:{'retry-after':'30'}}))
 .mockImplementation(async()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output())}]}]})));
 const client=createOpenAIRadarClient('test','test',request,()=>{});const service=new RadarService(pipeline,{client});await service.refresh();
 expect(service.snapshot.detail).toContain('rate limit');await vi.advanceTimersByTimeAsync(29_999);expect(request).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(2001);expect(service.snapshot.status).toBe('ready');service.close();
});
it('grounds unequal topic counts in real-looking repeated chat and merges reaction variants',()=>{
 const now=Date.now(),chat=[...Array.from({length:60},(_,i)=>message(['W streamer','PogChamp','LMAOOO'][i%3],false,now)),...Array.from({length:25},()=>message('minecraft next pls',false,now)),...Array.from({length:10},()=>message('what game next?',false,now)),...Array.from({length:5},()=>message('bro ur muted',false,now))];
 const sample=sampleChat(chat,now,false),index=(text:string)=>sample.messages.findIndex(entry=>entry.text===text);
 const topic=(label:string,kind:string,indices:number[])=>({label,kind,message_indices:indices,urgency:kind==='complaint'?.9:.2});
 const raw={topics:[topic('W stream','reaction',[index('W streamer')]),topic('LMAOOO','reaction',[index('PogChamp'),index('LMAOOO')]),topic('Play Minecraft next','request',[index('minecraft next pls')]),topic("What's the next game?",'question',[index('what game next?')]),topic("Can't hear you",'complaint',[index('bro ur muted')])],mood:{label:'hyped',score:.8}};
 const validated=validateRadar(raw,sample),model=new TopicRadar(),topics=model.merge(validated,[]);
 expect(topics.map(topic=>topic.count_estimate)).toEqual([25,10,5,60]);expect(topics.filter(topic=>topic.kind==='reaction')).toHaveLength(1);
 expect(topics.map(topic=>topic.label)).toEqual(['Play Minecraft next',"What's the next game?","Can't hear you",'W stream']);
 // Equal counts are allowed when the observed message frequencies really tie.
 const equal={...sample,total:60,messages:sample.messages.map(entry=>({...entry,count:10}))};
 const two={...raw,topics:[raw.topics[2],raw.topics[3]]};expect(validateRadar(two,equal).topics.map(topic=>topic.count_estimate)).toEqual([10,10]);
});
it('scales evidence by represented-message coverage, then smooths each topic independently',()=>{
 const sample:RadarSample={total:1000,lastId:'last',sim:false,messages:[{text:'minecraft next pls',count:30,uniqueUsers:20},{text:'bro ur muted',count:10,uniqueUsers:8},{text:'unrelated',count:60,uniqueUsers:30}]};
 const raw={topics:[{label:'Play Minecraft next',kind:'request',message_indices:[0],urgency:.4},{label:"Can't hear you",kind:'complaint',message_indices:[1],urgency:.9}],mood:{label:'curious',score:.1}};
 const output=validateRadar(raw,sample),engine=new TopicRadar();expect(output.topics.map(t=>t.count_estimate)).toEqual([300,100]);
 const first=engine.merge(output,[]);const next=engine.merge(validateRadar(raw,{...sample,total:2000}),first);expect(next.map(t=>t.count_estimate)).toEqual([480,160]);
 expect(()=>validateRadar({...raw,topics:[raw.topics[0],{...raw.topics[1],message_indices:[0]}]},sample)).toThrow('different topics');
});
