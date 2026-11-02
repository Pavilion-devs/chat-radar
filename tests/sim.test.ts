import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseScenario, prepareScenario, messageCount } from '../src/sim/scenario.js';
import { Replay } from '../src/sim/replay.js';
import { SimulationController } from '../src/sim/controller.js';
import { Pipeline } from '../src/server/pipeline.js';
import { createPing } from '../src/commands/ping.js';
import { localServer, options } from '../src/sim/cli.js';
import type { ChatMessage, SimulationStatus } from '../src/types.js';
const scenario={name:'test',phases:[{name:'first',durationSeconds:1,rate:40,users:10,messages:['!ping','no audio']},{name:'spike',durationSeconds:1,rate:200,users:100,messages:['CLIP IT']}]};
afterEach(()=>vi.useRealTimers());
it('replays exact counts at phase rates, using current timestamps and local identities',async()=>{
  vi.useFakeTimers();const messages:ChatMessage[]=[];const states:SimulationStatus[]=[];
  const replay=new Replay(parseScenario(scenario),1,m=>messages.push(m),s=>states.push(s));replay.start();
  await vi.advanceTimersByTimeAsync(1000);expect(messages.filter(m=>m.text!=='CLIP IT')).toHaveLength(40);
  await vi.advanceTimersByTimeAsync(1000);expect(messages).toHaveLength(240);expect(replay.status.state).toBe('completed');
  expect(new Set(messages.map(m=>m.id)).size).toBe(240);
  expect(messages.every(m=>m.sim && m.id.startsWith('sim:') && m.user.id.startsWith('sim:') && m.badges.length===0)).toBe(true);
  expect(messages.every(m=>m.ts<=Date.now() && m.ts>=Date.now()-2000)).toBe(true);
  expect(new Set(states.map(s=>s.phase))).toEqual(new Set(['first','spike']));expect(states.at(-1)?.rate).toBe(0);
});
it('accelerates time without changing counts and cancels without leaking timers',async()=>{
  vi.useFakeTimers();const ingest=vi.fn();const replay=new Replay(parseScenario(scenario),2,ingest,()=>{});replay.start();
  await vi.advanceTimersByTimeAsync(1000);expect(ingest).toHaveBeenCalledTimes(240);
  expect(replay.status.state).toBe('completed');expect(vi.getTimerCount()).toBe(0);
  const second=new Replay(parseScenario(scenario),1,ingest,()=>{});second.start();second.stop();
  const count=ingest.mock.calls.length;await vi.advanceTimersByTimeAsync(5000);expect(ingest).toHaveBeenCalledTimes(count);expect(second.status.state).toBe('stopped');
});
it('runs the actual five-phase demo through the pipeline without sending chat',async()=>{
  const demo=parseScenario(JSON.parse(await readFile('scenarios/demo.json','utf8')));
  vi.useFakeTimers();const pipeline=new Pipeline();const send=vi.fn(async()=>{});const ping=createPing(send,vi.fn());
  const phases=new Set<string>();pipeline.onEvent(e=>{if(e.type==='chat') ping(e.data);else if(e.type==='status' && e.data.simulation) phases.add(e.data.simulation.phase);});
  const controller=new SimulationController(pipeline);pipeline.setStatus({connected:true,detail:'Receiving Twitch chat'});controller.start(demo);
  expect(pipeline.status.sim).toBe(true);expect(()=>controller.start(demo)).toThrow('already running');
  // A Twitch status update must not hide active simulation status.
  pipeline.setStatus({connected:false,detail:'Reconnecting'});expect(pipeline.status.sim).toBe(true);
  await vi.advanceTimersByTimeAsync(95_000);
  expect(controller.status?.state).toBe('completed');expect(pipeline.status.sim).toBe(false);
  expect(phases.size).toBe(5);expect(pipeline.buffer.recent()).toHaveLength(messageCount(demo));
  expect(send).not.toHaveBeenCalled();expect(pipeline.status.connected).toBe(false);
  const oldId=pipeline.buffer.recent()[0]!.id;controller.start(demo);expect(pipeline.buffer.recent().at(-1)!.id).not.toBe(oldId);controller.stop();
});
it('rejects invalid or excessive workloads and permits bounded rate overrides',()=>{
  for(const value of [null,{}, {...scenario,phases:[]}, {...scenario,phases:[{...scenario.phases[0],rate:-1}]}, {...scenario,phases:[{...scenario.phases[0],durationSeconds:600,rate:1000}]}, {...scenario,phases:[{...scenario.phases[0],messages:[]}] }]) expect(()=>parseScenario(value)).toThrow();
  for(const speed of [NaN,0,Infinity,21]) expect(()=>prepareScenario(scenario,speed)).toThrow();
  expect(()=>prepareScenario(scenario,20,1000)).toThrow('Effective rate');
  expect(prepareScenario(scenario,2,10).scenario.phases.every(p=>p.rate===10)).toBe(true);
  expect(()=>parseScenario({...scenario,phases:[{...scenario.phases[0],users:1.5}]})).toThrow();
});
it('restricts CLI destinations to localhost and parses explicit replay flags',()=>{
  expect(localServer('http://localhost:3000')).toBe('http://localhost:3000');
  for(const url of ['https://localhost:3000','http://example.com','http://localhost:3000/path','http://name:secret@localhost:3000']) expect(()=>localServer(url)).toThrow();
  expect(options(['--scenario','sample.json','--speed','2','--rate','40'])).toMatchObject({scenario:'sample.json',speed:2,rate:40});
  expect(()=>options(['--unknown'])).toThrow();
});
