import { randomUUID } from 'node:crypto';
import { HypeDetector, type HypeSignal, type HypeOptions } from '../analysis/hype.js';
import { momentTitle } from '../llm/moment-title.js';
import type { StructuredLLMClient } from '../llm/types.js';
import type { ClipResult } from '../twitch/clips.js';
import type { Moment } from '../types.js';
import type { Pipeline } from './pipeline.js';
import { MomentStore } from './moments.js';
export interface HypeServiceOptions {llm?:StructuredLLMClient;clip?:(signal:AbortSignal)=>Promise<ClipResult>;store?:MomentStore;detector?:Partial<HypeOptions>;timeoutMs?:number;clipTimeoutMs?:number;now?:()=>number}
export class HypeService {
  private real:HypeDetector;private sim:HypeDetector;
  private simRun='';private simStart=0;private simSpeed=1;private simActive=false;
  private moments=new Map<string,Moment>();private versions=new Map<string,number>();
  private timer:ReturnType<typeof setInterval>;private unsubscribe:()=>void;
  private jobs=new Set<Promise<void>>();private aborts=new Set<AbortController>();private closed=false;
  private store:MomentStore;private now:()=>number;
  readonly ready:Promise<void>;
  storageError=false;
  constructor(private pipeline:Pipeline,private options:HypeServiceOptions={}) {
    this.now=options.now || Date.now;this.real=new HypeDetector(options.detector,this.now);this.sim=new HypeDetector(options.detector,this.now);this.store=options.store || new MomentStore();
    this.ready=this.store.ready.then(()=>{for(const m of this.store.list())if(!this.moments.has(m.id))this.moments.set(m.id,m);for(const m of this.store.list().slice(0,100).reverse())this.emit(m);}).catch(()=>{this.storageError=true;});
    this.unsubscribe=pipeline.onEvent(event=>{
      if(event.type==='chat'){
        const at=event.data.sim?this.simTime():this.now();
        for(const spike of (event.data.sim?this.sim:this.real).ingest(event.data,at))this.record(spike);
      } else if(event.type==='status' && event.data.simulation){
        const s=event.data.simulation;
        if(s.runId!==this.simRun){this.simRun=s.runId;this.simStart=this.now();this.simSpeed=s.speed || 1;this.sim=new HypeDetector(options.detector,this.now);}
        this.simActive=s.state==='running';
        if(!this.simActive)for(const spike of this.sim.advance(this.simTime(),true))this.record(spike);
      }
    });
    this.timer=setInterval(()=>{
      for(const spike of this.real.advance(this.now(),false))this.record(spike);
      if(this.simActive)for(const spike of this.sim.advance(this.simTime(),true))this.record(spike);
    },250);
  }
  private simTime(){return this.simStart+(this.now()-this.simStart)*this.simSpeed;}
  list(){return structuredClone([...this.moments.values()].sort((a,b)=>b.ts-a.ts));}
  private emit(moment:Moment){if(!this.closed)this.pipeline.publish({type:'moment',data:structuredClone(moment)});}
  private persist(moment:Moment){
    if(this.closed)return;
    const version=(this.versions.get(moment.id)||0)+1;this.versions.set(moment.id,version);moment.saved=false;this.emit(moment);
    const job=this.store.upsert({...moment,saved:true}).then(()=>{if(this.versions.get(moment.id)===version){moment.saved=true;this.emit(moment);}}).catch(()=>{this.storageError=true;this.emit(moment);});
    this.track(job);
  }
  private track(job:Promise<void>){this.jobs.add(job);void job.finally(()=>this.jobs.delete(job));}
  private async bounded<T>(work:(signal:AbortSignal)=>Promise<T>,timeoutMs=this.options.timeoutMs ?? 30_000):Promise<T>{
    const abort=new AbortController();this.aborts.add(abort);let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([work(abort.signal),new Promise<never>((_,reject)=>{abort.signal.addEventListener('abort',()=>reject(new Error('Moment work cancelled')),{once:true});timer=setTimeout(()=>abort.abort(),timeoutMs);})]);}
    finally{clearTimeout(timer);this.aborts.delete(abort);}
  }
  private record(spike:HypeSignal){
    if(this.closed)return;
    const moment:Moment={id:randomUUID(),ts:this.now(),title:'Hype spike in chat',titleSource:this.options.llm?'pending':'fallback',peakRate:spike.peakRate,uniqueChatters:spike.uniqueChatters,baselineRate:spike.baselineRate,zScore:spike.zScore,sim:spike.sim,clipUrl:null,clipStatus:spike.sim || !this.options.clip?'marker':'pending',clipReason:spike.sim?'simulated':!this.options.clip?'not_connected':null,saved:false};
    this.moments.set(moment.id,moment);
    if(this.moments.size>1000){const oldest=[...this.moments.values()].sort((a,b)=>a.ts-b.ts)[0]!;this.moments.delete(oldest.id);this.versions.delete(oldest.id);}
    this.persist(moment);
    if(this.options.llm){
      const counts=new Map<string,number>();
      for(const m of this.pipeline.buffer.recent(this.now()-3000/(spike.sim?this.simSpeed:1)))if(m.sim===spike.sim){const text=m.text.slice(0,160);counts.set(text,(counts.get(text)||0)+1);}
      const messages=[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([text])=>text);
      this.track(this.bounded(signal=>momentTitle(this.options.llm!,messages,signal)).then(title=>{moment.title=title;moment.titleSource='llm';this.persist(moment);}).catch(()=>{moment.titleSource='fallback';this.persist(moment);}));
    }
    // Simulated evidence never invokes any Twitch method, including clip creation.
    if(!spike.sim && this.options.clip){
      this.track(this.bounded(signal=>this.options.clip!(signal),this.options.clipTimeoutMs ?? 35_000).then(result=>{
        moment.clipStatus=result.status;moment.clipUrl=result.status==='ready'?result.url:null;if(result.status==='ready'&&result.thumbnailUrl)moment.thumbnailUrl=result.thumbnailUrl;moment.clipReason=result.status==='marker'?result.reason:null;this.persist(moment);
      }).catch(()=>{moment.clipStatus='failed';moment.clipReason='failed';this.persist(moment);}));
    }
  }
  async close(){this.closed=true;clearInterval(this.timer);this.unsubscribe();for(const abort of this.aborts)abort.abort();await Promise.allSettled([...this.jobs]);await this.store.flush().catch(()=>{});}
}
