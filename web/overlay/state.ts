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
/** One type size for all rows. Prefer balanced whole-word lines; never shrink. */
export function labelLines(label:string,available:number,measure:(text:string)=>number){
  const words=label.trim().split(/\s+/),whole=words.join(' ');
  if(measure(whole)<=available)return[whole];
  const splits=words.slice(1).map((_,index)=>[words.slice(0,index+1).join(' '),words.slice(index+1).join(' ')]);
  const fit=splits.filter(lines=>lines.every(line=>measure(line)<=available));
  if(fit.length)return fit.sort((a,b)=>Math.abs(measure(a[0]!)-measure(a[1]!))-Math.abs(measure(b[0]!)-measure(b[1]!)))[0]!;
  // Unbroken chat tokens can wrap at a grapheme boundary without losing text.
  const lines:string[]=[];let line='';for(const character of whole){if(line&&measure(line+character)>available){lines.push(line.trimEnd());line='';}line+=character;}if(line)lines.push(line.trim());return lines;
}
export function tallyUnit(topics:readonly {count_estimate:number}[]){
  const count=topics[0]?.count_estimate??0,nice=[10,25,50,100,250,500,1000];
  const fits=nice.filter(unit=>Math.floor(count/unit)>=10&&Math.floor(count/unit)<=20);
  if(fits.length)return fits.sort((a,b)=>Math.abs(count/a-15)-Math.abs(count/b-15))[0]!;
  // A capped four-group tally is honest at gaps between nice units. Low volume
  // stays below two groups rather than inventing marks to fill the space.
  return nice.filter(unit=>count/unit>=10).at(-1)??10;
}
