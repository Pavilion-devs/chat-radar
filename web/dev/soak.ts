export {};
/** Observe actual iframe DOM every animation frame; never writes to the engine. */
const frames=[...document.querySelectorAll<HTMLIFrameElement>('iframe')];
const report={frames:0,issues:[] as {at:number;view:string;issue:string}[],samples:{} as Record<string,unknown>,minGap:Infinity,maxDraw:0,minTallyInk:Infinity};
const began=Date.now();const seen=new Set<string>();
function check(){
 for(const frame of frames){
  const doc=frame.contentDocument;if(!doc?.querySelector('.radar-panel'))continue;const win=frame.contentWindow!,scale=win.innerWidth/1920;
  const issue=(text:string)=>{const signature=frame.id+text;if(!seen.has(signature)){seen.add(signature);report.issues.push({at:Date.now()-began,view:frame.id,issue:text});}};
  const rows=[...doc.querySelectorAll<HTMLElement>('.radar-row:not([data-exiting])')],labels:string[]=[];
  const shown=doc.querySelector<HTMLElement>('#radar-panel')!.dataset.state==='topics';
  if(!shown)continue;
  for(const node of doc.querySelectorAll('.radar-ghost [mask]')){const id=node.getAttribute('mask')?.match(/url\(#([^)]*)\)/)?.[1];if(id&&!doc.getElementById(id))issue('Broken snapshot mask');}
  if(rows.length>4)issue('More than four rows');if(rows.filter(row=>row.dataset.kind==='reaction').length>1)issue('More than one reaction');
  const list=doc.querySelector<HTMLElement>('#topics')!,all=[...list.children] as HTMLElement[];
  const natural=all.reduce((sum,row)=>sum+row.offsetHeight,0);if(Math.abs(list.offsetHeight-natural)>1)issue('Uncollapsed row space');
  for(const row of rows){
   const body=row.querySelector<HTMLElement>(':scope > .radar-row-body')!;const plain=body.querySelector<HTMLElement>('.label-text')!,svgText=body.querySelector<SVGTextElement>('.mark-label-base'),text=plain.hidden?svgText!:plain;
   const label=text?.textContent??'';labels.push(label);
   if(!label||label.length>22||label.split(/\s+/).length>5||/\b(question|request|reaction|complaint)s?\b/i.test(label))issue('Invalid label: '+label);
   if(!text){issue('Missing visible label');continue;}
   const ghost=row.querySelector<HTMLElement>(':scope > .radar-ghost');if(ghost){
    const slot=row.getBoundingClientRect(),a=body.getBoundingClientRect(),b=ghost.getBoundingClientRect();
    const segment=(r:DOMRect)=>[Math.max(slot.top,r.top),Math.min(slot.bottom,r.bottom)];const x=segment(a),y=segment(b);
    const length=(s:number[])=>Math.max(0,s[1]!-s[0]!),overlap=Math.max(0,Math.min(x[1]!,y[1]!)-Math.max(x[0]!,y[0]!));
    if(overlap/scale>1)issue('Overprinted row transition');if(Math.abs(length(x)+length(y)-overlap-slot.height)/scale>1)issue('Empty row transition');
   }
   const gap=(body.querySelector('.radar-count')!.getBoundingClientRect().left-text.getBoundingClientRect().right)/scale;
   report.minGap=Math.min(report.minGap,gap);if(gap<15.5)issue('Label/count collision: '+label+' '+gap.toFixed(1));
   if(Number(win.getComputedStyle(row).opacity)<.99||win.getComputedStyle(text).visibility==='hidden')issue('Vanished active row: '+label);
   if(parseFloat(win.getComputedStyle(text).fontSize)<20)issue('Small label');
   const annotations=body.querySelectorAll('.row-annotation svg');if(annotations.length>1)issue('Multiple row annotations');
   if(row.dataset.urgent==='true'&&body.querySelector('.label-swipe svg'))issue('Urgent row highlighted');
   if(svgText){const box=svgText.getBBox(),svg=svgText.ownerSVGElement!;if(box.x<0||box.x+box.width>svg.viewBox.baseVal.width)issue('Clipped highlighter text: '+label);}
   for(const path of body.querySelectorAll<SVGGraphicsElement>('.radar-tally .mark-ink')){const box=path.getBBox();report.minTallyInk=Math.min(report.minTallyInk,box.height);if(box.height<23)issue('Tiny tally ink');}
  }
  if(/\s/.test(doc.querySelector('#mood-label')?.textContent?.trim()??''))issue('Multiword mood');
  report.maxDraw=Math.max(report.maxDraw,Number(doc.body.dataset.drawing??0));if(Number(doc.body.dataset.drawing??0)>2)issue('Drawing budget exceeded');
  report.samples[frame.id]={labels,counts:rows.map(row=>row.querySelector('.radar-count')!.getAttribute('aria-label')),unit:doc.querySelector('#tally-unit')?.textContent,mood:doc.querySelector('#mood-label')?.textContent};
 }
 report.frames++;document.getElementById('audit')!.textContent=JSON.stringify(report);requestAnimationFrame(check);
}
requestAnimationFrame(check);
