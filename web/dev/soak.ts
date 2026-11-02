export {};
/** Observe actual iframe DOM every animation frame; never writes to the engine. */
const frames=[...document.querySelectorAll<HTMLIFrameElement>('iframe')];
const report={moments:[] as {view:string;id:string;phase:string;at:number;holdAt?:number;exitAt?:number}[],frames:0,issues:[] as {at:number;view:string;issue:string}[],samples:{} as Record<string,unknown>,minGap:Infinity,maxDraw:0,minTallyInk:Infinity};
const began=Date.now();const seen=new Set<string>();
function check(){
 for(const frame of frames){
  const doc=frame.contentDocument;if(!doc?.querySelector('.radar-panel'))continue;const win=frame.contentWindow!,scale=win.innerWidth/1920;
  const issue=(text:string)=>{const signature=frame.id+text;if(!seen.has(signature)){seen.add(signature);report.issues.push({at:Date.now()-began,view:frame.id,issue:text});}};
  const rows=[...doc.querySelectorAll<HTMLElement>('.radar-row:not([data-exiting])')],labels:string[]=[];
  const shown=doc.querySelector<HTMLElement>('#radar-panel')!.dataset.state==='topics';
  const moment=doc.querySelector<HTMLElement>('#moment-toast')!;
  if(!moment.hidden){
   const record={view:frame.id,id:moment.dataset.id!,phase:moment.dataset.phase!,at:Date.now()-began,holdAt:Number(moment.dataset.holdAt)||undefined,exitAt:Number(moment.dataset.exitAt)||undefined};
   if(!report.moments.some(previous=>previous.view===record.view&&previous.id===record.id&&previous.phase===record.phase))report.moments.push(record);
   if(moment.dataset.sim==='true'&&(moment.querySelector('img')||!moment.querySelector('.polaroid-sim')))issue('Invalid SIM polaroid');
   const title=moment.querySelector('.polaroid-title');if(title){const style=win.getComputedStyle(title);if(parseFloat(style.fontSize)!==22||style.fontWeight!=='600'||!style.fontFamily.includes('Inter'))issue('Polaroid title type');}
   if(moment.dataset.phase==='exit'&&Number(moment.dataset.exitAt)-Number(moment.dataset.holdAt)<5990)issue('Moment held less than 6 seconds');
  }
  if(!shown)continue;
  for(const node of doc.querySelectorAll('.radar-ghost [mask]')){const id=node.getAttribute('mask')?.match(/url\(#([^)]*)\)/)?.[1];if(id&&!doc.getElementById(id))issue('Broken snapshot mask');}
  const maximum=doc.querySelector<HTMLElement>('#radar-panel')!.dataset.layout==='compact'?2:3;
  if(rows.length>maximum)issue('Too many asking rows');if(rows.some(row=>row.dataset.kind==='reaction'))issue('Reaction in asking zone');
  const counts=rows.map(row=>Number(row.querySelector('.radar-count')!.getAttribute('aria-label')?.replaceAll(',','')));
  if(counts.some((count,i)=>i>0&&count>counts[i-1]!))issue('Asking rank inversion');
  if(doc.querySelector<HTMLElement>('#asking-zone')!.hidden!==(doc.querySelectorAll('#topics > .radar-row').length===0))issue('Empty asking header visible');
  const reaction=doc.querySelector<HTMLElement>('#reaction')!,reactionZone=doc.querySelector<HTMLElement>('#reacting-zone')!;
  if(!reactionZone.hidden){
   if(reaction.querySelector('.mark-svg,.row-annotation,.radar-tally'))issue('Annotated reaction');
   for(const node of reaction.querySelectorAll('#reaction-label,#reaction-count')){const style=win.getComputedStyle(node);if(parseFloat(style.fontSize)!==20||style.fontWeight!=='600'||!style.fontFamily.includes('Inter'))issue('Reaction type incorrect');}
   if(!reaction.querySelector('use')?.getAttribute('href')?.includes('lightning-fill'))issue('Reaction icon incorrect');
  }
  const list=doc.querySelector<HTMLElement>('#topics')!,all=[...list.children] as HTMLElement[];
  const natural=all.reduce((sum,row)=>sum+row.getBoundingClientRect().height/scale,0);if(Math.abs(list.getBoundingClientRect().height/scale-natural)>1)issue('Uncollapsed row space');
  for(const row of rows){
   const body=row.querySelector<HTMLElement>(':scope > .radar-row-body')!;const plain=body.querySelector<HTMLElement>('.label-text')!,svgText=body.querySelector<SVGTextElement>('.mark-label-base'),text=plain.hidden?svgText!:plain;
   const label=plain.getAttribute('aria-label')??'';labels.push(label);
   if(!label||label.length>22||label.split(/\s+/).length>5||/\b(question|request|reaction|complaint)s?\b/i.test(label))issue('Invalid label: '+label);
   if(!text){issue('Missing visible label');continue;}
   const ghost=row.querySelector<HTMLElement>(':scope > .radar-ghost');if(ghost){
    const slot=row.getBoundingClientRect(),a=body.getBoundingClientRect(),b=ghost.getBoundingClientRect();
    const segment=(r:DOMRect)=>[Math.max(slot.top,r.top),Math.min(slot.bottom,r.bottom)];const x=segment(a),y=segment(b);
    const length=(s:number[])=>Math.max(0,s[1]!-s[0]!),overlap=Math.max(0,Math.min(x[1]!,y[1]!)-Math.max(x[0]!,y[0]!));
    if(overlap/scale>1)issue('Overprinted row transition');if(Math.abs(length(x)+length(y)-overlap-slot.height)/scale>1)issue('Empty row transition');
   }
   const textRight=plain.hidden?Math.max(...[...body.querySelectorAll('.mark-label-base')].map(node=>node.getBoundingClientRect().right)):text.getBoundingClientRect().right;
   const gap=(body.querySelector('.radar-count')!.getBoundingClientRect().left-textRight)/scale;
   report.minGap=Math.min(report.minGap,gap);if(gap<15.5)issue('Label/count collision: '+label+' '+gap.toFixed(1));
   if(Number(win.getComputedStyle(row).opacity)<.99||win.getComputedStyle(text).visibility==='hidden')issue('Vanished active row: '+label);
   if(parseFloat(win.getComputedStyle(text).fontSize)!==26||win.getComputedStyle(text).fontWeight!=='700')issue('Asking label must be 26px/700');
   if(Number(row.dataset.lines)>2)issue('More than two label lines');
   if(doc.body.dataset.radarPhase==='reordering'&&body.querySelector('.label-swipe .mark-part[data-phase=drawing]'))issue('Highlight before reorder completed');
   const annotations=body.querySelectorAll('.row-annotation svg');if(annotations.length>1)issue('Multiple row annotations');
   if(row.dataset.urgent==='true'&&body.querySelector('.label-swipe svg'))issue('Urgent row highlighted');
   if(svgText){const box=svgText.getBBox(),svg=svgText.ownerSVGElement!;if(box.x<0||box.x+box.width>svg.viewBox.baseVal.width)issue('Clipped highlighter text: '+label);}
   for(const path of body.querySelectorAll<SVGGraphicsElement>('.radar-tally .mark-ink')){const box=path.getBBox();report.minTallyInk=Math.min(report.minTallyInk,box.height);if(box.height<23)issue('Tiny tally ink');}
   const tally=body.querySelector<HTMLElement>('.radar-tally')!,unit=Number(tally.dataset.unit),represented=Number(tally.dataset.represented),remainder=Number(tally.dataset.remainder),count=Number(row.dataset.count),strokes=tally.querySelectorAll('.mark-part').length;
   if(strokes>20||strokes*unit!==represented||represented>count||represented+remainder!==count)issue('Misrepresented tally');
   if(tally.querySelector<HTMLElement>('.tally-more')!.hidden!==(remainder===0))issue('Unmarked tally remainder');
   if(String(unit)!==doc.querySelector('#tally-unit')!.textContent)issue('Tally legend mismatch');
  }
  if(/\s/.test(doc.querySelector('#mood-label')?.textContent?.trim()??''))issue('Multiword mood');
  report.maxDraw=Math.max(report.maxDraw,Number(doc.body.dataset.drawing??0));if(Number(doc.body.dataset.drawing??0)>2)issue('Drawing budget exceeded');
  report.samples[frame.id]={labels,counts,reacting:reactionZone.hidden?null:{label:doc.querySelector('#reaction-label')?.textContent,count:doc.querySelector('#reaction-count')?.getAttribute('aria-label')},tallies:rows.map(row=>{const tally=row.querySelector<HTMLElement>(':scope > .radar-row-body .radar-tally')!;return{unit:tally.dataset.unit,represented:tally.dataset.represented,remainder:tally.dataset.remainder};}),unit:doc.querySelector('#tally-unit')?.textContent,mood:doc.querySelector('#mood-label')?.textContent,labelSizes:rows.map(row=>win.getComputedStyle(row.querySelector('.label-text')!).fontSize),note:doc.querySelector<HTMLElement>('#radar-note')!.hidden?null:doc.querySelector('#radar-note')?.textContent,noteTop:doc.querySelector<HTMLElement>('#radar-note')!.style.top,moment:moment.hidden?null:{id:moment.dataset.id,phase:moment.dataset.phase,shownAt:moment.dataset.shownAt,holdAt:moment.dataset.holdAt,exitAt:moment.dataset.exitAt}};
 }
 report.frames++;document.getElementById('audit')!.textContent=JSON.stringify(report);requestAnimationFrame(check);
}
requestAnimationFrame(check);
