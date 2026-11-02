export {};
interface Capture {index:number;elapsed:number;audit:{samples:Record<string,{moment?:unknown;note?:string;noteTop?:string}>}}
const records=await fetch('/dev/review-captures/soak/manifest.json').then(response=>response.json()) as Capture[];
const extra=await fetch('/dev/review-captures/soak/extra.json').then(response=>response.ok?response.json():[]).catch(()=>[]) as Capture[];
const select=document.getElementById('sheet') as HTMLSelectElement,region=document.getElementById('region') as HTMLSelectElement,host=document.getElementById('frames')!;
let items:{record:Capture;view:string;extra?:boolean;extraIndex?:number}[]=[];
function choose(){
 const source=region.value==='toss'?extra:records;
 items=source.flatMap((record,index)=>['bright','dark','small'].filter(view=>region.value==='radar'||region.value==='toss'||(region.value==='moments'?record.audit.samples[view]?.moment:record.audit.samples[view]?.note)).map(view=>({record,view,extra:region.value==='toss',extraIndex:index})));
 select.replaceChildren();for(let page=0;page<Math.ceil(items.length/12);page++){const option=document.createElement('option');option.value=String(page);option.textContent=String(page+1);select.append(option);}render();
}
function render(){
 const start=Number(select.value)*12;host.replaceChildren();
 for(const item of items.slice(start,start+12)){
  const {record,view}=item,figure=document.createElement('figure'),caption=document.createElement('figcaption'),crop=document.createElement('div'),img=document.createElement('img');
  caption.textContent=`${(record.elapsed/1000).toFixed(1)}s · ${view}`;crop.className='crop';img.alt=caption.textContent;img.src=`/dev/review-captures/soak/${item.extra?`mid-toss-${view}-${item.extraIndex}`:`${view}-${String(record.index).padStart(3,'0')}`}.jpg`;
  if(region.value!=='radar'){
   const note=region.value==='notes',scale=298/(note?304:region.value==='toss'?500:420),x=note?1136:region.value==='toss'?0:32,y=note?48+parseFloat(record.audit.samples[view]?.noteTop??'136')-12:700;
   crop.style.height=note?'150px':'270px';img.style.width=`${1920*scale}px`;img.style.left=`${-x*scale}px`;img.style.top=`${-y*scale}px`;
  }
  const link=document.createElement('a');link.href=img.src;link.target='_blank';link.rel='noopener';link.textContent=caption.textContent;caption.replaceChildren(link);crop.append(img);figure.append(caption,crop);host.append(figure);
 }
 document.getElementById('summary')!.textContent=items.length?`${start+1}–${Math.min(items.length,start+12)} of ${items.length} frames`:'No matching captures';
}
select.addEventListener('change',render);region.addEventListener('change',choose);choose();
