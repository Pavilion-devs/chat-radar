import type { ChatMessage } from '../types.js';
export interface HypeSignal {ts:number;peakRate:number;uniqueChatters:number;baselineRate:number;zScore:number;sim:boolean}
export interface HypeOptions {warmupSeconds:number;cooldownMs:number;alpha:number;zThreshold:number;ratio:number;minRate:number;minUsers:number}
const DEFAULTS:HypeOptions={warmupSeconds:20,cooldownMs:60_000,alpha:0.1,zThreshold:4,ratio:3,minRate:25,minUsers:10};
// One-second receipt-time buckets. All state is bounded; no network or disk work.
export class HypeDetector {
  private start?:number;
  private users=new Set<string>();
  private ids=new Set<string>();
  private count=0;private samples=0;
  private mean=0;private variance=0;private userMean=0;private userVariance=0;
  private lastSpike=-Infinity;
  private options:HypeOptions;
  constructor(options:Partial<HypeOptions>={},private now=Date.now) {
    this.options={...DEFAULTS,...options};const o=this.options;
    if(!Object.values(o).every(Number.isFinite)||o.warmupSeconds<1||o.cooldownMs<0||o.alpha<=0||o.alpha>1||o.zThreshold<=0||o.ratio<=1||o.minRate<1||o.minUsers<1) throw new Error('Invalid hype thresholds');
  }
  ingest(message:ChatMessage,at=this.now()):HypeSignal[] {
    const signals=this.advance(at,message.sim);
    if(this.start===undefined)this.start=Math.floor(at/1000)*1000;
    if(this.ids.has(message.id)||this.count>=100_000)return signals;
    this.ids.add(message.id);this.users.add(message.user.id);this.count++;
    return signals;
  }
  advance(at=this.now(),sim=false):HypeSignal[] {
    if(this.start===undefined)return [];
    const target=Math.floor(at/1000)*1000;
    if(target-this.start>120_000){this.start=target;this.count=0;this.ids.clear();this.users.clear();this.samples=0;this.mean=0;this.variance=0;this.userMean=0;this.userVariance=0;return [];}
    const result:HypeSignal[]=[];
    while(this.start!<target){
      const rate=this.count,users=this.users.size;
      const z=(rate-this.mean)/Math.sqrt(Math.max(25,this.variance));
      const userZ=(users-this.userMean)/Math.sqrt(Math.max(9,this.userVariance));
      const unusual=this.samples>=this.options.warmupSeconds && rate>=this.options.minRate && users>=this.options.minUsers && z>=this.options.zThreshold && userZ>=3 && rate>=Math.max(1,this.mean)*this.options.ratio && users>=Math.max(1,this.userMean)*2;
      const ts:number=this.start!+1000;
      if(unusual && ts-this.lastSpike>=this.options.cooldownMs){this.lastSpike=ts;result.push({ts,peakRate:rate,uniqueChatters:users,baselineRate:this.mean,zScore:z,sim});}
      if(this.samples===0){this.mean=rate;this.userMean=users;}
      else if(!unusual){
        const a=this.options.alpha,delta=rate-this.mean,userDelta=users-this.userMean;
        this.mean+=a*delta;this.variance=(1-a)*(this.variance+a*delta*delta);
        this.userMean+=a*userDelta;this.userVariance=(1-a)*(this.userVariance+a*userDelta*userDelta);
      }
      this.samples++;this.start=ts;this.count=0;this.ids.clear();this.users.clear();
    }
    return result;
  }
}
