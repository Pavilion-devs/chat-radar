import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { ChatCommands } from '../src/commands/chat.js';
import { CommandService } from '../src/server/chat-commands.js';
import { RadarHistory } from '../src/analysis/radar-history.js';
import { recapContext, type RecapContext } from '../src/analysis/recap.js';
import { generateRecap } from '../src/llm/recap.js';
import { Pipeline } from '../src/server/pipeline.js';
import { SimulationController } from '../src/sim/controller.js';
import type { RadarState } from '../src/analysis/radar-schema.js';
import type { ChatMessage, CommandReply, Moment } from '../src/types.js';
let sequence=0;
const message=(text:string,user='viewer',sim=false,ts=Date.now()):ChatMessage=>({id:`c${++sequence}`,user:{id:user,login:user,name:user},text,ts,badges:[],sim});
function radar(sim=false,ts=Date.now()):RadarState{return {topics:['Next game','Muted microphone','Clip requests','Fourth topic'].map((label,i)=>({id:`t${i}`,label,kind:'request',count_estimate:100-i,examples:['hello','hello'],urgency:0.2})),mood:{label:'Excited',score:0.4},ts,sim,status:'ready',detail:'ok',windowCount:400,sampledCount:4};}
function context(sim=false):RecapContext{return {sim,since:Date.now()-600000,until:Date.now(),totalMessages:100,messages:[{text:'What is next game?',count:50,uniqueUsers:30}],radar:[{ts:Date.now(),topics:[{label:'Next game',kind:'question'}],mood:'Curious'}],moments:[]};}
afterEach(()=>vi.useRealTimers());
it('answers !radar from the latest result with top three topics, a mention and no model call',async()=>{
 const generate=vi.fn();const engine=new ChatCommands({context,radar:sim=>radar(sim),llm:{generate}});
 const result=await engine.execute(message('  !RaDaR '));expect(result?.text).toContain('@viewer Radar:');expect(result?.text).toContain('Clip requests');expect(result?.text).not.toContain('Fourth topic');expect(result?.text).toContain('Excited');expect(generate).not.toHaveBeenCalled();engine.close();
});
it('applies 60-second user and 10-second global cooldowns per command, with source isolation',async()=>{
 let now=0;const engine=new ChatCommands({context,radar:sim=>radar(sim,now),now:()=>now});
 expect(await engine.execute(message('!missed','one'))).toBeDefined();expect(await engine.execute(message('!missed','two'))).toBeUndefined();
 expect(await engine.execute(message('!radar','two'))).toBeDefined();expect(await engine.execute(message('!missed','one',true))).toBeDefined();
 now=10000;expect(await engine.execute(message('!missed','one'))).toBeUndefined();expect(await engine.execute(message('!missed','two'))).toBeDefined();
 now=60000;expect(await engine.execute(message('!missed','one'))).toBeDefined();engine.close();
});
it('caches only the recap body for 20 seconds, retaining a fresh mention for each viewer',async()=>{
 let now=0;const generate=vi.fn(async()=>({recap:'Chat discussed the next game.'}));const engine=new ChatCommands({context,radar:()=>radar(),llm:{generate},now:()=>now});
 expect(await engine.execute(message('!missed','alice'))).toMatchObject({cached:false,source:'llm',text:'@alice Recap: Chat discussed the next game.'});
 now=10000;expect(await engine.execute(message('!missed','bob'))).toMatchObject({cached:true,text:'@bob Recap: Chat discussed the next game.'});expect(generate).toHaveBeenCalledTimes(1);
 now=20000;expect((await engine.execute(message('!missed','carol')))?.cached).toBe(false);expect(generate).toHaveBeenCalledTimes(2);engine.close();
});
it('coalesces concurrent eligible recaps without blocking ingestion or mixing usernames',async()=>{
 vi.useFakeTimers();let finish:(value:unknown)=>void=()=>{};const generate=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
 const engine=new ChatCommands({context,radar:()=>radar(),llm:{generate}});const first=engine.execute(message('!missed','one'));
 await vi.advanceTimersByTimeAsync(10000);const second=engine.execute(message('!missed','two'));expect(generate).toHaveBeenCalledTimes(1);
 finish({recap:'Chat asked about the next game.'});expect((await first)?.text).toMatch(/^@one /);expect((await second)?.text).toMatch(/^@two /);engine.close();expect(vi.getTimerCount()).toBe(0);
});
it('uses evidence-based fallback on timeout/refusal or no key and bounds complete replies to 450 characters',async()=>{
 vi.useFakeTimers();const engine=new ChatCommands({context,radar:()=>radar(),llm:{generate:()=>new Promise(()=>{})},timeoutMs:100});
 const pending=engine.execute(message('!missed'));await vi.advanceTimersByTimeAsync(100);expect(await pending).toMatchObject({source:'fallback'});engine.close();
 const long=new ChatCommands({context,radar:()=>radar(),llm:{generate:async()=>({recap:'😀'.repeat(400)})}});
 const reply=await long.execute(message('!missed','a'.repeat(25)));expect(Array.from(reply!.text).length).toBeLessThanOrEqual(450);expect(reply!.text).not.toMatch(/[\r\n]/);long.close();
 const empty=new ChatCommands({context:()=>({...context(),messages:[],totalMessages:0,radar:[],moments:[]}),radar:()=>undefined,llm:{generate:vi.fn()}});
 expect((await empty.execute(message('!missed')))?.text).toContain('Not enough');expect((await empty.execute(message('!radar')))?.text).toContain('warming up');empty.close();
});
it('drops cancelled recap replies after a new replay or shutdown',async()=>{
 vi.useFakeTimers();const engine=new ChatCommands({context,radar:()=>radar(),llm:{generate:()=>new Promise(()=>{})}});
 const first=engine.execute(message('!missed','viewer',true));engine.reset(true);expect(await first).toBeUndefined();
 const second=engine.execute(message('!missed','viewer',true));engine.close();expect(await second).toBeUndefined();expect(vi.getTimerCount()).toBe(0);
});
it('builds a bounded ten-minute, source-specific context without commands or bot reply loops',()=>{
 const now=1000000;const messages=[message('early evidence','u',false,now-590000),message('new evidence','v',false,now),message('too old','x',false,now-600001),message('fake simulation','s',true,now),message('!missed','x',false,now),message('@u Recap: old bot answer','bot',false,now)];
 const frames=[radar(false,now-500000),radar(true,now),radar(false,now-700000)];
 const moments=[{sim:false,ts:now-1000,title:'Chat Demands A Clip'},{sim:true,ts:now,title:'Fake Moment'}] as Moment[];
 const result=recapContext(messages,frames,moments,now,false);expect(result.totalMessages).toBe(2);expect(result.messages.map(m=>m.text)).toEqual(['early evidence','new evidence']);expect(result.radar).toHaveLength(1);expect(result.moments.map(m=>m.title)).toEqual(['Chat Demands A Clip']);
 expect(JSON.stringify(result)).not.toContain('"login"');expect(JSON.stringify(result)).not.toContain('"user"');
});
it('retains only distinct recent successful radar snapshots and returns immutable history',()=>{
 let now=1000000;const history=new RadarHistory(()=>now);history.add(radar(false,now));history.add(radar(false,now));history.add({...radar(false,now),status:'stale'});history.add(radar(true,now));
 expect(history.recent(false)).toHaveLength(1);const copy=history.recent(false);copy[0]!.topics=[];expect(history.recent(false)[0]!.topics.length).toBeGreaterThan(0);history.clear(true);expect(history.recent(true)).toEqual([]);
 now+=600001;expect(history.recent(false)).toEqual([]);
});
it('validates structured recaps and keeps instructions in the system-side request',async()=>{
 const generate=vi.fn(async()=>({recap:'Chat requested the next game.'}));expect(await generateRecap({generate},context(),new AbortController().signal)).toBe('Chat requested the next game.');
 const request=generate.mock.calls[0] as unknown as [Record<string,unknown>];expect(request[0]).toMatchObject({name:'chat_recap',effort:'low'});expect(request[0].instructions).toContain('untrusted');
 for(const value of [{recap:'x'.repeat(401)},{recap:'line one\nline two'},{recap:'go to https://example.com'},{recap:'@other hello'},{recap:'',extra:1}])await expect(generateRecap({generate:async()=>value},context(),new AbortController().signal)).rejects.toThrow();
});
it('never invokes the Twitch sender for simulated commands, even while connected',async()=>{
 const pipeline=new Pipeline();pipeline.setStatus({connected:true});const send=vi.fn(async()=>true);const service=new CommandService(pipeline,()=>radar(true),()=>[],send,{llm:{generate:async()=>({recap:'Chat discussed the next game.'})}});
 pipeline.ingest(message('hello','s',true));pipeline.ingest(message('!radar','one',true));pipeline.ingest(message('!missed','two',true));
 await vi.waitFor(()=>expect(service.list()).toHaveLength(2));expect(service.list().every(reply=>reply.status==='preview'&&reply.sim)).toBe(true);expect(send).not.toHaveBeenCalled();service.close();
});
it('sends real command replies asynchronously and reports send failures without retrying',async()=>{
 const pipeline=new Pipeline();pipeline.setStatus({connected:true});const send=vi.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('private send error'));
 const service=new CommandService(pipeline,()=>radar(false),()=>[],send);
 pipeline.ingest(message('!radar','one'));await vi.waitFor(()=>expect(service.list()[0]?.status).toBe('sent'));
 pipeline.ingest(message('!missed','two'));await vi.waitFor(()=>expect(service.list()[1]?.status).toBe('failed'));expect(send).toHaveBeenCalledTimes(2);expect(service.list()[1]!.text).not.toContain('private');service.close();
});
it('exercises both command previews in the full simulator and never posts fake chat',async()=>{
 const scenario=JSON.parse(await readFile('scenarios/demo.json','utf8'));vi.useFakeTimers();const pipeline=new Pipeline();const send=vi.fn(async()=>true);const replies:CommandReply[]=[];
 const service=new CommandService(pipeline,()=>radar(true),()=>[],send,{llm:{generate:async()=>({recap:'Chat asked about games, reported audio issues, and requested clips.'})}});
 pipeline.onEvent(e=>{if(e.type==='command_reply')replies.push(e.data);});const sim=new SimulationController(pipeline);sim.start(scenario);
 await vi.advanceTimersByTimeAsync(95000);expect(replies.some(r=>r.command==='!radar')).toBe(true);expect(replies.some(r=>r.command==='!missed'&&r.source==='llm')).toBe(true);expect(replies.every(r=>r.status==='preview')).toBe(true);expect(send).not.toHaveBeenCalled();sim.stop();service.close();
});
it('does not reuse a previous replay radar snapshot or cache when a new run starts',async()=>{
 let now=1000;const pipeline=new Pipeline();const service=new CommandService(pipeline,()=>radar(true,1000),()=>[],undefined,{now:()=>now});
 now=2000;pipeline.setStatus({sim:true,simulation:{runId:'new-run',scenario:'new',state:'running',phase:'start',sent:0,total:100,rate:40,speed:1}});
 const reply=await service.preview('!radar');expect(reply?.text).toContain('warming up');service.close();
});
it('falls back without echoing malformed or failed model responses into chat',async()=>{
 for(const generate of [async()=>({recap:'bad',extra:'private'}),async()=>{throw new Error('private provider body');}]){
  const engine=new ChatCommands({context,radar:()=>radar(),llm:{generate}});const result=await engine.execute(message('!missed'));expect(result?.source).toBe('fallback');expect(result?.text).not.toContain('private');engine.close();
 }
});
