import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { validClipUrl,validThumbnailUrl } from '../twitch/clips.js';
import type { Moment } from '../types.js';
const valid=(m:Moment)=>m && typeof m.id==='string' && typeof m.title==='string' && m.title.length<=80 && typeof m.sim==='boolean' && [m.ts,m.peakRate,m.uniqueChatters,m.baselineRate,m.zScore].every(Number.isFinite) && ['pending','fallback','llm'].includes(m.titleSource) && ['marker','pending','ready','failed'].includes(m.clipStatus) && (m.clipStatus==='ready' ? validClipUrl(m.clipUrl):m.clipUrl===null) && (m.thumbnailUrl===undefined||(!m.sim&&m.clipStatus==='ready'&&validThumbnailUrl(m.thumbnailUrl)));
export class MomentStore {
  private moments=new Map<string,Moment>();
  private tail:Promise<void>=Promise.resolve();
  readonly ready:Promise<void>;
  constructor(private file?:string,private limit=1000) {
    this.ready=this.load();
  }
  private async load() {
    if(!this.file)return;
    let contents:string;
    try{contents=await readFile(this.file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw new Error('Moment storage unavailable');}
    const list=JSON.parse(contents) as Moment[];
    if(!Array.isArray(list)||list.length>this.limit||!list.every(valid))throw new Error('Invalid moment storage');
    for(const m of list)this.moments.set(m.id,{...m,saved:true,titleSource:m.titleSource==='pending'?'fallback':m.titleSource,clipStatus:m.clipStatus==='pending'?'failed':m.clipStatus,clipReason:m.clipStatus==='pending'?'failed':m.clipReason});
  }
  list():Moment[]{return structuredClone([...this.moments.values()].sort((a,b)=>b.ts-a.ts));}
  upsert(moment:Moment):Promise<void> {
    const snapshot=structuredClone(moment);
    this.tail=this.tail.catch(()=>{}).then(async()=>{
      await this.ready;
      this.moments.set(snapshot.id,snapshot);
      const items=this.list().slice(0,this.limit);this.moments=new Map(items.map(m=>[m.id,m]));
      if(!this.file)return;
      await mkdir(dirname(this.file),{recursive:true});
      await writeFile(this.file+'.tmp',JSON.stringify(items,null,2),{mode:0o600});
      await rename(this.file+'.tmp',this.file);
    });
    return this.tail;
  }
  flush(){return this.tail;}
}
