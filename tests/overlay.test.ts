import {expect,it} from 'vitest';
import {CalmState,labelLines,tallyUnit,radarZones,tallyEvidence} from '../web/overlay/state.js';
import type {Radar} from '../web/shared/model.js';
import {markGeometry} from '../web/shared/marks.js';
const radar={topics:[{id:'one',label:'Next game',kind:'question',count_estimate:120,examples:[],urgency:.3}],mood:{label:'excited',score:.7},ts:100,sim:true,status:'ready',detail:'',sampledCount:20,windowCount:200} satisfies Radar;
it('stays in Reading chat until topics arrive; collapses only after 60 continuous quiet seconds',()=>{
  const state=new CalmState();expect(state.state(undefined)).toBe('reading');expect(state.state(radar)).toBe('topics');
  state.updateRate(1,0);state.updateRate(1,59_999);expect(state.state(radar)).toBe('topics');
  state.updateRate(1,60_000);expect(state.state(radar)).toBe('quiet');
  state.updateRate(2,60_001);expect(state.state(radar)).toBe('topics');
  state.updateRate(0,60_002);state.updateRate(0,120_001);expect(state.state(radar)).toBe('topics');
  state.updateRate(0,120_002);expect(state.state(radar)).toBe('quiet');
});

it('ranks asking chat separately from the biggest reaction, regardless of input ordering',()=>{
 const topic=radar.topics[0]!;
 const input=[{...topic,id:'noise',kind:'reaction' as const,count_estimate:2692},{...topic,id:'small',count_estimate:155},{...topic,id:'large',kind:'complaint' as const,count_estimate:480},{...topic,id:'medium',kind:'request' as const,count_estimate:200},{...topic,id:'fourth',count_estimate:80},{...topic,id:'other-noise',kind:'reaction' as const,count_estimate:700}];
 const zones=radarZones(input);expect(zones.asking.map(t=>t.count_estimate)).toEqual([480,200,155]);expect(zones.reacting?.id).toBe('noise');expect(tallyUnit(zones.asking)).toBe(25);
 expect(radarZones(input,true).asking.map(t=>t.id)).toEqual(['large','medium']);expect(input[0]!.id).toBe('noise');
 expect(radarZones(input.filter(t=>t.kind==='reaction')).asking).toEqual([]);expect(radarZones(input.filter(t=>t.kind!=='reaction')).reacting).toBeUndefined();expect(radarZones([])).toEqual({asking:[],reacting:undefined});
});

it('never invents tally volume and accounts for every remainder, including the four-group cap',()=>{
 for(const count of [0,3,155,249,480,2692,20001,99999]){
   const unit=tallyUnit([{count_estimate:count}]),evidence=tallyEvidence(count,unit);
   expect(evidence.marks).toBeLessThanOrEqual(20);expect(evidence.represented).toBeLessThanOrEqual(count);expect(evidence.represented+evidence.remainder).toBe(count);
   expect(markGeometry('tally','honest',{count,unit,width:144,height:44}).parts.length).toBe(evidence.marks);
 }
 expect(tallyEvidence(2692,10)).toEqual({marks:20,represented:200,remainder:2492});
});
it('wakes on a newly formed topic without immediately collapsing on the next low-rate tick',()=>{
  const state=new CalmState();state.updateRate(0,0);state.updateRate(0,60_000);expect(state.state(radar)).toBe('quiet');
  state.newTopics(61_000);state.updateRate(0,62_000);expect(state.state(radar)).toBe('topics');
  state.updateRate(0,121_000);expect(state.state(radar)).toBe('quiet');
});
it('keeps the complete label at one font size, wrapping into balanced lines instead of shrinking',()=>{
 const measure=(text:string)=>text.length*13;
 for(const label of ["What's the next game?","No audio, you're muted",'Play Minecraft next']){
  const lines=labelLines(label,228,measure);expect(lines.length).toBeLessThanOrEqual(2);expect(lines.join(' ')).toBe(label);expect(lines.every(line=>measure(line)<=228)).toBe(true);
 }
 expect(labelLines('Next game?',264,measure)).toEqual(['Next game?']);
});
it('scales tally units with busy chat and keeps small overlay ribbons legible without changing their prefix',()=>{
  expect(tallyUnit([{count_estimate:984}])).toBe(50);expect(tallyUnit([{count_estimate:2656}])).toBe(250);
  const options={width:144,height:44,minimumWidth:2.5,count:850,unit:50};
  const first=markGeometry('tally','topic',options),next=markGeometry('tally','topic',{...options,count:900});
  expect(next.parts.slice(0,17)).toEqual(first.parts);expect(first.parts.every(part=>Math.min(...part.widths)>=2.5)).toBe(true);
});
it('keeps FLIP slots occupied with no overlapping incoming/outgoing bodies, including long moves',async()=>{
  const {slotOffsets,rowMotion}=await import('../web/overlay/row-motion.js');
  for(const height of [136,172,208])for(const distance of [-408,-272,-172,-136,136,172,272,408])for(let i=0;i<=100;i++){
    const {incoming,outgoing}=slotOffsets(distance,height,i/100);if(i===0)expect(rowMotion(distance,height).outgoing[0]!.transform).toBe(`translateY(${outgoing}px)`);
    const a=[Math.max(0,incoming),Math.min(height,incoming+height)],b=[Math.max(0,outgoing),Math.min(height,outgoing+height)];
    const length=(r:number[])=>Math.max(0,r[1]!-r[0]!);
    const overlap=Math.max(0,Math.min(a[1]!,b[1]!)-Math.max(a[0]!,b[0]!));
    expect(length(a)+length(b)-overlap).toBeCloseTo(height);expect(overlap).toBeCloseTo(0);
  }
});

it('chooses a nice unit for the first topic, with 10–20 capped strokes once volume permits',()=>{
 const nice=[10,25,50,100,250,500,1000];
 for(let count=100;count<30000;count+=13){const unit=tallyUnit([{count_estimate:count},{count_estimate:99999}]);expect(nice).toContain(unit);expect(Math.min(20,Math.floor(count/unit))).toBeGreaterThanOrEqual(10);}
 expect(tallyUnit([{count_estimate:3}])).toBe(10);
});
