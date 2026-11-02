import type {Radar,Moment} from '../shared/model.js';
import {setMarkProgress} from '../shared/marks.js';
interface Review {show:(value:Radar,animate:boolean)=>Promise<void>;state:(mode:'reading'|'quiet')=>void;finish:()=>void;resume:()=>void;moment:(value:Moment)=>void;holdMoment:(progress:number)=>void}
/** Explicit local review only. Never sends messages, events, or network writes. */
export async function installReview(view:Review){
  const sheet=document.createElement('div');sheet.id='review-controls';sheet.setAttribute('aria-label','Local design review');
  const label=document.createElement('strong');label.textContent='SIM replay · actual demo radar outputs';sheet.append(label);
  const select=document.createElement('select');select.id='review-snapshot';select.setAttribute('aria-label','Recorded snapshot');sheet.append(select);
  const status=document.createElement('span');status.id='review-status';sheet.append(status);
  let records:Radar[]=[];
  const button=(text:string,action:()=>void)=>{const node=document.createElement('button');node.textContent=text;node.addEventListener('click',action);sheet.append(node);return node;};
  const selected=()=>records[Number(select.value)]!;
  const settle=()=>{view.finish();for(const animation of document.getAnimations())animation.finish();};
  let simMoment:Moment|undefined,liveMoment:Moment|undefined;
  const toss=(value:Moment|undefined,mid=false)=>{if(!value){status.textContent='No recorded moment available';return;}settle();view.moment({...value,id:`review:${value.id}:${Date.now()}`,ts:Date.now()});if(mid)requestAnimationFrame(()=>requestAnimationFrame(()=>{view.holdMoment(.5);status.textContent='Held · 50% toss';}));};
  button('Show SIM moment',()=>toss(simMoment));button('Mid toss',()=>toss(simMoment,true));button('Recorded live clip',()=>toss(liveMoment));
  void fetch('/moments').then(response=>response.json()).then((value:{moments:Moment[]})=>{simMoment=value.moments.find(moment=>moment.sim);}).catch(()=>{});
  void fetch('/dev/live-clip-review.json').then(response=>response.json()).then((value:Moment)=>{liveMoment=value;}).catch(()=>{});
  button('Show final',()=>{settle();view.show(selected(),false);status.textContent='Final';});
  button('Replay change',()=>{const index=Number(select.value);settle();view.show(records[Math.max(0,index-1)]!,false);requestAnimationFrame(()=>{view.show(selected(),true);status.textContent='Playing change';});});
  button('Mid reorder + digits',()=>{
    const index=Number(select.value);settle();view.show(records[Math.max(0,index-1)]!,false);
    requestAnimationFrame(()=>{view.show(selected(),true);let attempts=0;
      const hold=()=>{const swapping=document.body.dataset.radarPhase==='reordering'&&document.querySelector('.radar-ghost');
        if(!swapping&&attempts++<120){requestAnimationFrame(hold);return;}
        if(!swapping){status.textContent='This update has no row swap';return;}
        for(const animation of document.getAnimations()){animation.pause();const timing=animation.effect!.getTiming();animation.currentTime=Number(timing.delay)+Number(timing.duration)*.5;}status.textContent='Held · 50% reorder/digits';};requestAnimationFrame(hold);
    });
  });
  button('Mid marks + mood',()=>{settle();const index=Number(select.value);view.show(records[Math.max(0,index-1)]!,false);requestAnimationFrame(()=>{view.show(selected(),false);for(const svg of document.querySelectorAll<SVGSVGElement>('#radar-panel .label-swipe svg,#radar-panel .label-circle svg,#mood-underline svg'))setMarkProgress(svg,.5);status.textContent='Held · 50% marks';});});
  button('Mid tally pop',async()=>{settle();const index=Number(select.value);await view.show(records[Math.max(0,index-1)]!,false);await view.show(selected(),true);for(const animation of document.getAnimations()){animation.pause();const timing=animation.effect!.getTiming();animation.currentTime=Number(timing.delay)+Number(timing.duration)*.5;}status.textContent='Held · 50% tally arrival';});
  button('Reading',()=>{settle();view.state('reading');status.textContent='Reading chat…';});button('Quiet',()=>{settle();view.state('quiet');status.textContent='Quiet after 60s below threshold';});
  button('Reduce motion',()=>{document.documentElement.dataset.motion='reduced';settle();view.show(selected(),true);status.textContent='Reduced motion';});
  button('Normal motion',()=>{delete document.documentElement.dataset.motion;settle();view.show(selected(),false);status.textContent='Normal motion';});
  button('Resume live',()=>{settle();view.resume();status.textContent='Live WebSocket feed';});button('Hide controls',()=>{sheet.hidden=true;});
  document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='r'&&!(event.target instanceof HTMLInputElement)&&!(event.target instanceof HTMLSelectElement))sheet.hidden=!sheet.hidden;});
  document.body.append(sheet);
  try{const response=await fetch(new URLSearchParams(location.search).get('review')==='notice'?'/dev/notice-capture.json':'/dev/calm-capture.json');if(!response.ok)throw Error('Missing demo capture');records=await response.json() as Radar[];
    records.forEach((radar,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=`${index+1} · ${radar.topics[0]?.label??'Reading'}`;select.append(option);});
    select.value=String(Math.max(0,records.findIndex(record=>record.topics.length>=4&&record.topics.slice(1,4).some(topic=>topic.kind==='complaint'&&topic.urgency>=.7))));
    await document.fonts.ready;view.show(selected(),false);status.textContent='Final · recorded SIM';
  }catch{status.textContent='Run demo capture first';sheet.querySelectorAll('button').forEach(node=>{if(node.textContent!=='Hide controls'&&node.textContent!=='Resume live')node.disabled=true;});}
}
