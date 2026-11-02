import type { RadarState } from './radar-schema.js';
export class RadarHistory {
  private items:RadarState[]=[];
  constructor(private now=Date.now) {}
  add(state:RadarState){
    this.prune();if(state.status!=='ready'||state.ts===null||state.ts<this.now()-600_000||state.ts>this.now())return;
    if(this.items.some(item=>item.sim===state.sim&&item.ts===state.ts))return;
    this.items.push(structuredClone(state));if(this.items.length>160)this.items.shift();
  }
  private prune(){this.items=this.items.filter(item=>item.ts!==null&&item.ts>=this.now()-600_000);}
  recent(sim:boolean,since=this.now()-600_000){this.prune();return structuredClone(this.items.filter(item=>item.sim===sim&&item.ts!>=since).sort((a,b)=>a.ts!-b.ts!));}
  clear(sim:boolean){this.items=this.items.filter(item=>item.sim!==sim);}
}
