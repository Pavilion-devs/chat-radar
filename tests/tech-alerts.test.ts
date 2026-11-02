import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { matchTechProblems } from '../src/analysis/tech-rules.js';
import { TechAlerts } from '../src/analysis/tech-alerts.js';
import { TechAlertService } from '../src/server/tech-alerts.js';
import { Pipeline } from '../src/server/pipeline.js';
import { SimulationController } from '../src/sim/controller.js';
import type { ChatMessage, ServerEvent, TechAlert } from '../src/types.js';
let sequence=0;
function message(user:string,text='no audio',sim=false):ChatMessage {return {id:`m${++sequence}`,user:{id:user,login:user,name:user},text,ts:Date.now(),badges:[],sim};}
afterEach(()=>vi.useRealTimers());
it.each([
 ['ur muuutedd','audio_muted'],["can't hear u",'audio_muted'],['sin audio','audio_muted'],['sem áudio','audio_muted'],['音が聞こえない','audio_muted'],['لا يوجد صوت','audio_muted'],
 ['game audio is too loud','game_audio_loud'],['jogo muito alto','game_audio_loud'],['ゲーム音が大きい','game_audio_loud'],
 ['stream is frozen','frozen_lag'],['lagggg','frozen_lag'],['tela travada','frozen_lag'],
 ['pantalla negra','black_screen'],['tela preta','black_screen'],['شاشة سوداء','black_screen'],
 ['wrong scene','wrong_scene'],['cena errada','wrong_scene'],['mic is peaking','mic_peaking'],['microfone estourando','mic_peaking'],
])('recognizes %s as %s',(text,category)=>expect(matchTechProblems(text)).toContain(category));
it.each(['audio is fine','not muted','no audio issues','no lag','screen is not black','game audio is not too loud','mic is not peaking','I muted him','that game has a blacksmith','what game next?','PogChamp'])('does not classify healthy or unrelated text: %s',text=>expect(matchTechProblems(text)).toEqual([]));
it('requires both unique users and share; repeated messages or duplicate IDs cannot manufacture users',()=>{
 const detector=new TechAlerts();
 for(let i=0;i<100;i++) expect(detector.ingest(message('spam'))).toEqual([]);
 for(let i=0;i<3;i++) expect(detector.ingest(message(`u${i}`))).toEqual([]);
 expect(detector.ingest(message('u4'))).toHaveLength(1);
 const diluted=new TechAlerts();for(let i=0;i<100;i++) diluted.ingest(message(`other${i}`,'W'));
 for(let i=0;i<5;i++) expect(diluted.ingest(message(`u${i}`))).toEqual([]);
 for(let i=5;i<12;i++) diluted.ingest(message(`u${i}`));expect(diluted.list()).toHaveLength(1);
 const duplicate=new TechAlerts();const m=message('single');for(let i=0;i<20;i++) duplicate.ingest(m);expect(duplicate.list()).toEqual([]);
});
it('expires old evidence, bounds memory, and keeps real/simulated crowds separate',()=>{
 let now=1000;const detector=new TechAlerts({capacity:5},()=>now);
 for(let i=0;i<4;i++) detector.ingest(message(`u${i}`));now+=30_000;
 expect(detector.ingest(message('new'))).toEqual([]);
 for(let i=0;i<4;i++) expect(detector.ingest(message(`sim${i}`,'no audio',true))).toEqual([]);
 expect(detector.list()).toEqual([]);
 for(let i=0;i<10;i++) detector.ingest(message('same'));expect(detector.list()).toEqual([]);
});
it('clears only the selected category, resets its evidence, and honors the full cooldown',()=>{
 let now=1000;const detector=new TechAlerts({},()=>now);
 for(let i=0;i<5;i++) detector.ingest(message(`u${i}`,'no audio and black screen'));
 const audio=detector.list().find(a=>a.category==='audio_muted')!;
 expect(detector.list()).toHaveLength(2);expect(detector.clear(audio.id)?.id).toBe(audio.id);expect(detector.clear(audio.id)).toBeUndefined();
 expect(detector.list().map(a=>a.category)).toEqual(['black_screen']);
 for(let i=0;i<10;i++) expect(detector.ingest(message(`new${i}`))).toEqual([]);
 now+=60_000;
 for(let i=0;i<4;i++) expect(detector.ingest(message(`fresh${i}`))).toEqual([]);
 expect(detector.ingest(message('fifth'))).toHaveLength(1);
});
it('allows independent category cooldowns and captures bounded evidence samples',()=>{
 const detector=new TechAlerts();for(let i=0;i<5;i++) detector.ingest(message(`u${i}`));
 for(let i=0;i<5;i++) detector.ingest(message(`u${i}`,'mic is clipping'));
 const alerts=detector.list();expect(alerts).toHaveLength(2);expect(alerts.every(a=>a.sample.length<=3 && a.uniqueUsers>=5)).toBe(true);
 alerts[0]!.sample.push('mutated');expect(detector.list()[0]!.sample).not.toContain('mutated');
});
it('detects the demo audio burst in under two seconds without a Twitch or OpenAI client',async()=>{
 const scenario=JSON.parse(await readFile('scenarios/demo.json','utf8'));
 vi.useFakeTimers();const start=Date.now();const pipeline=new Pipeline();const service=new TechAlertService(pipeline);const alerts:TechAlert[]=[];
 pipeline.onEvent(event=>{if(event.type==='alert') alerts.push(event.data);});
 const sim=new SimulationController(pipeline);sim.start(scenario);await vi.advanceTimersByTimeAsync(32_000);
 expect(alerts).toHaveLength(1);expect(alerts[0]!.category).toBe('audio_muted');expect(alerts[0]!.ts-start-30_000).toBeLessThan(2000);
 expect(alerts[0]!.sim).toBe(true);sim.stop();service.close();
});
it('thanks real chat once per human clear, skips simulated clears, and reports send failures',async()=>{
 const pipeline=new Pipeline();const send=vi.fn(async()=>true);const service=new TechAlertService(pipeline,send);const events:ServerEvent[]=[];pipeline.onEvent(e=>events.push(e));
 for(let i=0;i<5;i++) pipeline.ingest(message(`s${i}`,'no audio',true));
 const simulated=service.detector.list()[0]!;expect(service.clear(simulated.id)?.acknowledgement).toBe('local_only');await Promise.resolve();expect(send).not.toHaveBeenCalled();
 for(let i=0;i<5;i++) pipeline.ingest(message(`r${i}`));
 const real=service.detector.list()[0]!;service.clear(real.id);service.clear(real.id);await vi.waitFor(()=>expect(send).toHaveBeenCalledTimes(1));
 expect(events.some(e=>e.type==='alert_cleared' && e.data.acknowledgement==='sent')).toBe(true);
 send.mockRejectedValueOnce(new Error('offline'));for(let i=0;i<5;i++) pipeline.ingest(message(`p${i}`,'mic is peaking'));
 service.clear(service.detector.list()[0]!.id);await vi.waitFor(()=>expect(events.some(e=>e.type==='alert_cleared' && e.data.acknowledgement==='failed')).toBe(true));service.close();
});
