import { commandNoise } from '../analysis/chat-text.js';
import { sampleChat } from '../analysis/radar-sample.js';
import { validateRadar, type RadarState } from '../analysis/radar-schema.js';
import { TopicRadar } from '../analysis/topic-radar.js';
import { LLMRequestError } from '../llm/errors.js';
import type { RadarClient } from '../llm/radar-client.js';
import type { Pipeline } from './pipeline.js';
export interface RadarOptions {client?:RadarClient;disabledDetail?:string;intervalMs?:number;timeoutMs?:number;now?:()=>number}
export class RadarService {
  private timer?:ReturnType<typeof setInterval>;
  private timeout?:ReturnType<typeof setTimeout>;
  private abort?:AbortController;
  private closed=false;
  private busy=false;
  private suspended=false;
  private nextAttempt=0;
  private states=new Map<boolean,RadarState>();
  private signatures=new Map<boolean,string>();
  private model=new TopicRadar();
  private current:RadarState;
  private now:()=>number;
  constructor(private pipeline:Pipeline,private options:RadarOptions={}) {
    this.now=options.now || Date.now;
    this.current=this.empty(false,options.client?'waiting':'disabled');
    if (options.client) this.timer=setInterval(()=>{void this.refresh();},options.intervalMs ?? 8000);
  }
  private empty(sim:boolean,status:RadarState['status']):RadarState {
    return {topics:[],mood:{label:'Neutral',score:0},ts:null,sim,status,detail:status==='disabled'?(this.options.disabledDetail || 'Configure the selected LLM provider API key to enable topic radar'):'Waiting for chat',windowCount:0,sampledCount:0};
  }
  get snapshot():RadarState {return structuredClone(this.current);}
  private publish(state:RadarState) {if (!this.closed) {this.current=state;this.pipeline.publish({type:'radar',data:this.snapshot});}}
  async refresh():Promise<void> {
    if (this.closed || this.busy || this.suspended || this.now()<this.nextAttempt || !this.options.client) return;
    const recent=this.pipeline.buffer.recent(this.now()-60_000).filter(message=>!commandNoise(message.text));
    const sim=this.pipeline.status.sim || (!recent.some(m=>!m.sim) && recent.some(m=>m.sim));
    const sample=sampleChat(recent,this.now(),sim);
    const previous=this.states.get(sim);
    if (!sample.messages.length) {
      this.signatures.delete(sim);this.states.delete(sim);this.publish(this.empty(sim,'waiting'));return;
    }
    const signature=`${sample.lastId}:${sample.total}`;
    if (this.signatures.get(sim)===signature && previous && previous.status==='ready') {this.publish(previous);return;}
    this.busy=true;
    this.abort=new AbortController();
    const signal=this.abort.signal;
    try {
      const timeout=new Promise<never>((_,reject)=>{signal.addEventListener('abort',()=>reject(new Error('Radar cancelled')),{once:true});this.timeout=setTimeout(()=>{this.abort?.abort();reject(new Error('Radar timeout'));},this.options.timeoutMs ?? 30_000);});
      const raw=await Promise.race([this.options.client.analyze(sample,previous?.topics || [],signal),timeout]);
      if (this.closed || signal.aborted) return;
      const output=validateRadar(raw,sample);
      const state:RadarState={...output,topics:this.model.merge(output,previous?.topics || []).map(topic=>({...topic,count_estimate:Math.min(sample.total,topic.count_estimate)})),ts:this.now(),sim,status:'ready',detail:'Updated from the last 60 seconds of chat',windowCount:sample.total,sampledCount:sample.messages.length};
      this.states.set(sim,state);this.signatures.set(sim,signature);this.publish(state);
    } catch (error) {
      if (!this.closed) {
        let detail=previous?'Radar update failed; showing the last good result':'Radar update failed; retrying on the next interval';
        if(signal.aborted) detail=previous?'Radar request timed out; showing the last good result':'Radar request timed out; retrying on the next interval';
        if (error instanceof LLMRequestError) {
          if (['quota','authentication','configuration'].includes(error.kind)) {
            this.suspended=true;
            detail=error.userMessage;
          } else if (error.kind==='rate_limit') {
            this.nextAttempt=this.now()+error.retryAfterMs;
            detail=error.userMessage;
          }
          if (previous) detail+=' Showing the last good result.';
        }
        const state:RadarState={...(previous || this.empty(sim,'error')),status:previous?'stale':'error',detail};
        this.publish(state);
      }
    } finally {clearTimeout(this.timeout);this.timeout=undefined;this.abort=undefined;this.busy=false;}
  }
  close() {this.closed=true;clearInterval(this.timer);this.abort?.abort();clearTimeout(this.timeout);}
}
