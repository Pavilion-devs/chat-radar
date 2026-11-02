/** Original seeded ribbon geometry. Visible marks are filled shapes, never strokes.
 * Centerline strokes exist only inside alpha masks to reveal those shapes.
 */
export const markKinds=['highlighter','tally','circle','underline','stamp','tape'] as const;
export type MarkKind=typeof markKinds[number];
export type MarkInk='marker'|'alarm'|'ink'|'paper';
export interface Point {x:number;y:number}
export interface Ribbon {
  id:string;d:string;reveal:string;revealWidth:number;widths:number[];
  outline:Point[];mode:'draw'|'pop'|'stamp';
}
export interface MarkOptions {width?:number;height?:number;count?:number;unit?:number;label?:string;ink?:MarkInk}
export interface MarkGeometry {
  kind:MarkKind;width:number;height:number;seedHash:string;ink:MarkInk;parts:Ribbon[];
  text?:{value:string;x:number;y:number;size:number};texture?:string;rotation:number;
  tally?:{count:number;unit:number;shown:number;capped:boolean};
}
const defaults:Record<MarkKind,[number,number]>={highlighter:[320,42],tally:[256,54],circle:[360,82],underline:[160,20],stamp:[240,96],tape:[220,42]};
function hash(seed:string){let value=2166136261;for(let i=0;i<seed.length;i++){value^=seed.charCodeAt(i);value=Math.imul(value,16777619);}return value>>>0;}
function random(seed:string){let value=hash(seed);return()=>{value+=0x6D2B79F5;let n=Math.imul(value^(value>>>15),value|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296;};}
const n=(value:number)=>String(Math.round(value*100)/100);
const p=(point:Point)=>`${n(point.x)} ${n(point.y)}`;
function curve(points:Point[],move=true){
  let d=move?`M${p(points[0]!)}`:'';
  for(let i=0;i<points.length-1;i++){
    const before=points[Math.max(0,i-1)]!,start=points[i]!,end=points[i+1]!,after=points[Math.min(points.length-1,i+2)]!;
    d+=`C${n(start.x+(end.x-before.x)/6)} ${n(start.y+(end.y-before.y)/6)} ${n(end.x-(after.x-start.x)/6)} ${n(end.y-(after.y-start.y)/6)} ${p(end)}`;
  }
  return d;
}
function ribbon(id:string,points:Point[],widths:number[],rand:()=>number,ragged=false,mode:Ribbon['mode']='draw'):Ribbon{
  const outer:Point[]=[],inner:Point[]=[];
  points.forEach((point,index)=>{
    const before=points[Math.max(0,index-1)]!,after=points[Math.min(points.length-1,index+1)]!;
    const dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy)||1,half=widths[index]!/2;
    outer.push({x:point.x-dy/length*half,y:point.y+dx/length*half});
    inner.push({x:point.x+dy/length*half,y:point.y-dx/length*half});
  });
  const cap=(from:Point,to:Point)=>{
    if(!ragged)return `L${p(to)}`;
    return [1,2,3,4].map(step=>{const t=step/4;return `L${n(from.x+(to.x-from.x)*t+(step<4?(rand()-.5)*3:0))} ${n(from.y+(to.y-from.y)*t)}`;}).join('');
  };
  const back=[...inner].reverse();
  const d=curve(outer)+cap(outer.at(-1)!,back[0]!)+curve(back,false)+cap(back.at(-1)!,outer[0]!)+'Z';
  return {id,d,reveal:curve(points),revealWidth:Math.max(...widths)*1.7,widths,outline:[...outer,...back],mode};
}
function roundedRoute(w:number,h:number){
  const inset=7,r=Math.min(9,h*.12),points:Point[]=[];
  const line=(from:Point,to:Point,steps:number)=>{for(let i=0;i<steps;i++){const t=i/steps;points.push({x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t});}};
  const arc=(x:number,y:number,start:number)=>{for(let i=0;i<6;i++){const angle=start+i/6*Math.PI/2;points.push({x:x+Math.cos(angle)*r,y:y+Math.sin(angle)*r});}};
  line({x:inset+r,y:inset},{x:w-inset-r,y:inset},10);arc(w-inset-r,inset+r,-Math.PI/2);
  line({x:w-inset,y:inset+r},{x:w-inset,y:h-inset-r},6);arc(w-inset-r,h-inset-r,0);
  line({x:w-inset-r,y:h-inset},{x:inset+r,y:h-inset},10);arc(inset+r,h-inset-r,Math.PI/2);
  line({x:inset,y:h-inset-r},{x:inset,y:inset+r},6);arc(inset+r,inset+r,Math.PI);
  points.push({x:inset+r+4,y:inset});return points;
}
export function markGeometry(kind:MarkKind,seed:string,options:MarkOptions={}):MarkGeometry{
  if(!markKinds.includes(kind))throw new Error('Unknown mark kind');
  const [baseWidth,baseHeight]=defaults[kind],w=options.width??baseWidth,h=options.height??baseHeight;
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<48||h<12||w>4096||h>4096)throw new RangeError('Mark dimensions are outside the supported range');
  if(kind==='stamp'&&(w<80||h<40))throw new RangeError('Stamp dimensions are too small');
  if(kind==='circle'&&h<32)throw new RangeError('Circle height is too small');
  const rand=random(`${kind}:${seed}`),phase=rand()*Math.PI*2;
  const result:MarkGeometry={kind,width:w,height:h,seedHash:hash(seed).toString(16),ink:options.ink??(kind==='stamp'?'ink':kind==='tape'?'paper':'marker'),parts:[],rotation:0};
  if(kind==='highlighter'||kind==='tape'||kind==='underline'){
    const points:Point[]=[],widths:number[]=[],steps=kind==='underline'?25:19;
    for(let i=0;i<steps;i++){
      const t=i/(steps-1),wave=Math.sin(t*Math.PI*2+phase);
      points.push({x:4+t*(w-8),y:h/2+wave*h*(kind==='underline'?.13:.035)+(rand()-.5)*h*.025});
      const base=h*(kind==='underline'?.17:kind==='tape'?.76:.84);
      widths.push(base*(kind==='highlighter'?.96+.06*Math.sin(t*Math.PI*2.4+phase)+(rand()-.5)*.04:.9+.13*Math.sin(t*Math.PI*2.4+phase)+(rand()-.5)*.1));
    }
    result.parts.push(ribbon('ribbon',points,widths,rand,kind!=='underline'));
    if(kind==='tape')result.rotation=(rand()>.5?1:-1)*(1+rand());
  }else if(kind==='tally'){
    const count=options.count??0,unit=options.unit??50;
    if(!Number.isFinite(count)||count<0||!Number.isFinite(unit)||unit<=0)throw new RangeError('Tallies need a nonnegative count and a positive unit');
    const total=Math.floor(count/unit),shown=Math.min(20,total);result.tally={count,unit,shown,capped:total>20};
    for(let i=0;i<shown;i++){
      // Every tally owns a seed: adding a tally cannot reshape existing ones.
      const r=random(`tally:${seed}:${i}`),group=Math.floor(i/5),index=i%5,x=(group*64+12)*w/256,sx=w/256,sy=h/54;
      const start=index===4?{x:x-5*sx,y:42*sy}:{x:x+index*10*sx+(r()-.5)*2*sx,y:(10+r()*3)*sy};
      const end=index===4?{x:x+36*sx,y:10*sy}:{x:start.x+(r()-.5)*5*sx,y:(42+r()*2)*sy};
      const points=Array.from({length:7},(_,j)=>{const t=j/6;return {x:start.x+(end.x-start.x)*t+(j&&j<6?(r()-.5)*1.1*sx:0),y:start.y+(end.y-start.y)*t};});
      const widths=points.map((_,j)=>(2.8+.8*Math.sin(j/6*Math.PI)+(r()-.5)*.5)*Math.min(sx,sy));
      result.parts.push(ribbon(`tally-${i}`,points,widths,r,false,'pop'));
    }
  }else if(kind==='circle'){
    const points:Point[]=[],widths:number[]=[],start=-.55+(rand()-.5)*.2,base=Math.min(4.8,h*.055);
    for(let i=0;i<76;i++){
      const t=i/75,angle=start+t*(Math.PI*2+.42),radiusNoise=Math.sin(angle*3+phase)*.5+(rand()-.5)*.45;
      points.push({x:w/2+Math.cos(angle)*(w/2-8+radiusNoise),y:h/2+Math.sin(angle)*(h/2-8+radiusNoise)});
      widths.push(base*(.86+.25*Math.sin(angle*2+phase)+(rand()-.5)*.16));
    }
    result.parts.push(ribbon('loop',points,widths,rand));
  }else{
    const points=roundedRoute(w,h).map(point=>({x:point.x+(rand()-.5)*.8,y:point.y+(rand()-.5)*.8}));
    const widths=points.map((_,i)=>3.6+Math.sin(i/points.length*Math.PI*5+phase)*.8+(rand()-.5)*.7);
    result.parts.push(ribbon('frame',points,widths,rand,false,'stamp'));
    const value=(options.label??'MUTED').trim().toUpperCase().slice(0,40);
    result.text={value,x:w/2,y:h/2+1,size:Math.min(40,h*.43,(w-36)/Math.max(1,value.length)*1.55)};
    if(result.text.size<24)throw new RangeError('Stamp text needs a larger frame to stay at least 24px');
    // Seeded negative-space flecks replace unstable noise filters.
    let texture=`M0 0H${n(w)}V${n(h)}H0Z`;
    const r=random(`stamp-texture:${seed}`);
    for(let i=0;i<Math.min(180,Math.ceil(w*h/220));i++){
      const x=3+r()*(w-6),y=3+r()*(h-6),dx=.5+r()*1.7,dy=.5+r()*2.2;
      texture+=`M${n(x)} ${n(y)}l${n(dx)} ${n(-.25)}l${n(.3)} ${n(dy)}l${n(-dx-.3)} ${n(.25)}Z`;
    }
    result.texture=texture;
  }
  return result;
}

const namespace='http://www.w3.org/2000/svg';let serial=0;
function svgNode<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>={}):SVGElementTagNameMap[K]{
  const element=document.createElementNS(namespace,tag);for(const [key,value]of Object.entries(attrs))element.setAttribute(key,String(value));return element;
}
export function renderMark(geometry:MarkGeometry):SVGSVGElement{
  const prefix=`cr-mark-${++serial}-${geometry.seedHash}`,svg=svgNode('svg',{viewBox:`0 0 ${geometry.width} ${geometry.height}`,width:'100%',height:'100%','aria-hidden':'true',focusable:'false'});
  svg.classList.add('mark-svg');svg.dataset.kind=geometry.kind;svg.dataset.ink=geometry.ink;svg.dataset.seed=geometry.seedHash;
  if(geometry.kind==='tape')svg.style.setProperty('--mark-tilt',`${n(geometry.rotation)}deg`);
  let textureId='';
  if(geometry.texture){const defs=svgNode('defs'),clip=svgNode('clipPath',{id:`${prefix}-texture`});textureId=`${prefix}-texture`;clip.append(svgNode('path',{d:geometry.texture,'clip-rule':'evenodd','fill-rule':'evenodd'}));defs.append(clip);svg.append(defs);}
  for(const part of geometry.parts){
    const group=svgNode('g',{'data-part':part.id,'data-mode':part.mode,'data-phase':'complete'});group.classList.add('mark-part');
    const defs=svgNode('defs'),mask=svgNode('mask',{id:`${prefix}-${part.id}`,maskUnits:'userSpaceOnUse',x:0,y:0,width:geometry.width,height:geometry.height,'mask-type':'alpha'});
    const reveal=svgNode('path',{d:part.reveal,pathLength:1,fill:'none',stroke:'var(--paper)','stroke-width':part.revealWidth,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':1,'stroke-dashoffset':0});reveal.classList.add('mark-reveal');mask.append(reveal);defs.append(mask);
    const ink=svgNode('path',{d:part.d,fill:'currentColor',stroke:'none','fill-rule':'nonzero',mask:`url(#${prefix}-${part.id})`});ink.classList.add('mark-ink');
    const content=svgNode('g');if(textureId)content.setAttribute('clip-path',`url(#${textureId})`);content.append(ink);
    if(geometry.text){const text=svgNode('text',{x:geometry.text.x,y:geometry.text.y,'font-size':geometry.text.size,'text-anchor':'middle','dominant-baseline':'central'});text.classList.add('mark-stamp-word');text.textContent=geometry.text.value;content.append(text);}
    group.append(defs,content);svg.append(group);
  }
  return svg;
}
export function createMark(kind:MarkKind,seed:string,options:MarkOptions={}):SVGSVGElement{return renderMark(markGeometry(kind,seed,options));}
export interface DrawingState {drawing:number;waiting:number}
interface DrawJob {part:SVGGElement;resolve:()=>void;promise:Promise<void>;animations:Animation[]}
/** A single shared queue for the surface. The budget counts individual strokes. */
export class MarkAnimator {
  private pending:DrawJob[]=[];private active=new Set<DrawJob>();private jobs=new Map<SVGGElement,DrawJob>();
  private media:MediaQueryList;private observer:MutationObserver;private disposed=false;
  constructor(private onChange:(state:DrawingState)=>void=()=>{}){
    this.media=matchMedia('(prefers-reduced-motion: reduce)');this.media.addEventListener('change',this.motionChanged);
    this.observer=new MutationObserver(this.motionChanged);this.observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','style']});
  }
  private reduced(){return this.media.matches||getComputedStyle(document.documentElement).getPropertyValue('--motion').trim()==='0';}
  private motionChanged=()=>{if(this.reduced())this.finish();};
  private notify(){this.onChange({drawing:this.active.size,waiting:this.pending.length});}
  draw(svg:SVGSVGElement,only?:readonly string[]):Promise<void>{
    const parts=[...svg.querySelectorAll<SVGGElement>('.mark-part')].filter(part=>!only||only.includes(part.dataset.part!));
    if(this.disposed||this.reduced()){for(const part of parts)this.finalState(part);return Promise.resolve();}
    const promises=parts.map(part=>{
      const previous=this.jobs.get(part);if(previous)return previous.promise;
      let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});
      const job:DrawJob={part,resolve,promise,animations:[]};this.jobs.set(part,job);part.dataset.phase='queued';
      const reveal=part.querySelector<SVGPathElement>('.mark-reveal');if(reveal)reveal.style.strokeDashoffset='1';
      this.pending.push(job);return promise;
    });
    this.pump();return Promise.all(promises).then(()=>{});
  }
  private finalState(part:SVGGElement){part.dataset.phase='complete';part.style.removeProperty('opacity');part.style.removeProperty('transform');const reveal=part.querySelector<SVGPathElement>('.mark-reveal');if(reveal)reveal.style.strokeDashoffset='0';}
  private pump(){
    while(this.active.size<2&&this.pending.length){
      const job=this.pending.shift()!;this.active.add(job);this.notify();
      if(this.reduced()||!job.part.isConnected){this.complete(job);continue;}
      const style=getComputedStyle(job.part),value=style.animationDuration.split(',')[0]??'0s',duration=parseFloat(value)*(value.trim().endsWith('ms')?1:1000);
      job.part.dataset.phase='drawing';const reveal=job.part.querySelector<SVGPathElement>('.mark-reveal');
      if(!duration||!reveal||typeof job.part.animate!=='function'){this.complete(job);continue;}
      const mode=job.part.dataset.mode;
      if(mode==='pop'||mode==='stamp'){
        reveal.style.strokeDashoffset='0';
        job.animations.push(job.part.animate([{opacity:0,transform:'scale(.82)'},{opacity:1,transform:'scale(1)'}],{duration,easing:style.animationTimingFunction}));
      }else job.animations.push(reveal.animate([{strokeDashoffset:'1'},{strokeDashoffset:'0'}],{duration,easing:style.animationTimingFunction}));
      void Promise.all(job.animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>this.complete(job));
    }
    this.notify();
  }
  private complete(job:DrawJob){
    if(!this.active.delete(job))return;this.jobs.delete(job.part);this.finalState(job.part);for(const animation of job.animations)animation.cancel();job.resolve();this.pump();
  }
  finish(){
    const jobs=[...this.active,...this.pending];this.active.clear();this.pending=[];this.jobs.clear();
    for(const job of jobs){this.finalState(job.part);for(const animation of job.animations)animation.cancel();job.resolve();}this.notify();
  }
  dispose(){this.disposed=true;this.finish();this.observer.disconnect();this.media.removeEventListener('change',this.motionChanged);}
}
