import type {Radar,Topic} from '../shared/model.js';
/** Ranking is local to a named zone, never across actionable chat and noise. */
export function radarZones(topics:readonly Topic[],compact=false){
  const descending=(a:Topic,b:Topic)=>b.count_estimate-a.count_estimate;
  return{asking:topics.filter(topic=>topic.kind!=='reaction').sort(descending).slice(0,compact?2:3),reacting:topics.filter(topic=>topic.kind==='reaction').sort(descending)[0]};
}
/** Every ribbon represents a complete unit; the visible + accounts for the rest. */
export function tallyEvidence(count:number,unit:number){
  const marks=Math.min(20,Math.floor(count/unit)),represented=marks*unit;
  return{marks,represented,remainder:count-represented};
}
/** Receipt-time traffic, not the sampled chat feed, determines quiet mode. */
export class CalmState {
  private lowSince:number|undefined;
  private quiet=false;
  updateRate(rate:number,now=Date.now()){
    if(rate>=2){this.lowSince=undefined;this.quiet=false;}
    else if(this.lowSince===undefined)this.lowSince=now;
    else if(now-this.lowSince>=60_000)this.quiet=true;
  }
  newTopics(now=Date.now()){this.quiet=false;this.lowSince=now;}
  state(radar:Radar|undefined){return this.quiet?'quiet':radar?.topics.length?'topics':'reading';}
}
/** Whole words only. Fit the complete label at ≥20px before shortening it. */
export function fitLabel(label:string,available:number,measure:(text:string,size:number)=>number){
  const words=label.trim().split(/\s+/).slice(0,5),whole=words.join(' ');
  for(let size=30;size>=20;size--)if(measure(whole,size)<=available)return{text:whole,size};
  while(words.length>1){words.pop();const text=words.join(' ')+'…';if(measure(text,20)<=available)return{text,size:20};}
  // An unusually long single word uses the full label line; the count moves below it.
  return{text:whole,size:20,wide:true};
}
export function tallyUnit(topics:readonly {count_estimate:number}[]){
  const count=topics[0]?.count_estimate??0,nice=[10,25,50,100,250,500,1000];
  const fits=nice.filter(unit=>Math.floor(count/unit)>=10&&Math.floor(count/unit)<=20);
  if(fits.length)return fits.sort((a,b)=>Math.abs(count/a-15)-Math.abs(count/b-15))[0]!;
  // A capped four-group tally is honest at gaps between nice units. Low volume
  // stays below two groups rather than inventing marks to fill the space.
  return nice.filter(unit=>count/unit>=10).at(-1)??10;
}
