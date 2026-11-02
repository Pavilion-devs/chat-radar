import type { ChatMessage } from '../types.js';
import type { RadarState } from '../analysis/radar-schema.js';
import { cleanBody, fallbackRecap, type RecapContext } from '../analysis/recap.js';
import { generateRecap } from '../llm/recap.js';
import type { StructuredLLMClient } from '../llm/types.js';
export type ChatCommand='!radar'|'!missed';
export interface CommandResponse {command:ChatCommand;text:string;source:'radar'|'llm'|'fallback';cached:boolean}
interface Cached {body:string;source:'llm'|'fallback';at:number}
export interface ChatCommandOptions {context:(sim:boolean)=>RecapContext;radar:(sim:boolean)=>RadarState|undefined;llm?:StructuredLLMClient;timeoutMs?:number;now?:()=>number}
export class ChatCommands {
  private users=new Map<string,number>();private global=new Map<string,number>();
  private cache=new Map<boolean,Cached>();private generations=new Map<boolean,number>();
  private pending=new Map<boolean,{promise:Promise<Cached>;abort:AbortController}>();private closed=false;
  private now:()=>number;
  constructor(private options:ChatCommandOptions){this.now=options.now||Date.now;}
  async execute(message:ChatMessage):Promise<CommandResponse|undefined>{
    if(this.closed||typeof message.user.login!=='string'||!/^[a-z0-9_]{1,25}$/i.test(message.user.login))return;
    const command=message.text.trim().toLowerCase();if(command!=='!radar'&&command!=='!missed')return;
    const source=message.sim?'sim':'real',global=`${source}:${command}`,user=`${global}:${message.user.id}`,at=this.now();
    if(at-(this.global.get(global)??-Infinity)<10_000||at-(this.users.get(user)??-Infinity)<60_000)return;
    for(const [key,ts]of this.users)if(at-ts>=60_000)this.users.delete(key);
    this.users.set(user,at);this.global.set(global,at);
    if(command==='!radar'){
      const radar=this.options.radar(message.sim);
      const available=radar?.ts!==null&&radar?.ts!==undefined&&at-radar.ts<=600_000&&radar.sim===message.sim;
      const body=available&&radar.topics.length ? `${at-radar.ts!>30_000||radar.status==='stale'?'Last available topics:':'Top topics:'} ${radar.topics.slice(0,3).map(t=>`${t.label} (~${t.count_estimate})`).join('; ')}. Mood: ${radar.mood.label}.`:'Topic radar is still warming up; no recent topics are ready.';
      return {command,text:`@${message.user.login} Radar: ${cleanBody(body)}`,source:'radar',cached:false};
    }
    const generation=this.generations.get(message.sim)||0;
    const prior=this.cache.get(message.sim);const cached=!!prior&&at-prior.at<20_000;
    const result=cached?prior!:await this.missed(message.sim);
    if(this.closed||generation!==(this.generations.get(message.sim)||0))return;
    return {command,text:`@${message.user.login} Recap: ${result.body}`,source:result.source,cached};
  }
  private missed(sim:boolean):Promise<Cached>{
    const pending=this.pending.get(sim);if(pending)return pending.promise;
    const context=this.options.context(sim),abort=new AbortController(),generation=this.generations.get(sim)||0;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const run=async():Promise<Cached>=>{
      let body=fallbackRecap(context),source:'llm'|'fallback'='fallback';
      try{
        if(this.options.llm&&(context.totalMessages||context.radar.length||context.moments.length)){
          const timeout=new Promise<never>((_,reject)=>{abort.signal.addEventListener('abort',()=>reject(new Error('Recap cancelled')),{once:true});timer=setTimeout(()=>abort.abort(),this.options.timeoutMs??30_000);});
          body=await Promise.race([generateRecap(this.options.llm,context,abort.signal),timeout]);source='llm';
        }
      }catch{ /* Keep a factual fallback rather than echoing provider errors. */ }
      finally{clearTimeout(timer);}
      const result:Cached={body:cleanBody(body),source,at:this.now()};
      if(!this.closed&&generation===(this.generations.get(sim)||0))this.cache.set(sim,result);
      return result;
    };
    const promise=run().finally(()=>{if(this.pending.get(sim)?.promise===promise)this.pending.delete(sim);});
    this.pending.set(sim,{promise,abort});return promise;
  }
  reset(sim:boolean){
    this.generations.set(sim,(this.generations.get(sim)||0)+1);this.cache.delete(sim);this.pending.get(sim)?.abort.abort();this.pending.delete(sim);
    const prefix=sim?'sim:':'real:';for(const key of this.users.keys())if(key.startsWith(prefix))this.users.delete(key);for(const key of this.global.keys())if(key.startsWith(prefix))this.global.delete(key);
  }
  close(){this.closed=true;for(const entry of this.pending.values())entry.abort.abort();this.cache.clear();}
}
