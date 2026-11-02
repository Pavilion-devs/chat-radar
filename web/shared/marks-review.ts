import {icon} from './icons.js';
import {MarkAnimator,markGeometry,renderMark,markKinds,type MarkKind,type MarkGeometry} from './marks.js';
const el=(id:string)=>document.getElementById(id)!;
const seedInput=el('mark-seed') as HTMLInputElement,reduced=el('marks-reduced') as HTMLInputElement,surface=el('marks-surface') as HTMLSelectElement;
const media=matchMedia('(prefers-reduced-motion: reduce)');
const current=new Map<MarkKind,{geometry:MarkGeometry;svg:SVGSVGElement}>(),signatures=new Map<string,string>();
let count=850,variation=0,maximumDrawing=0;
const animator=new MarkAnimator(state=>{
  maximumDrawing=Math.max(maximumDrawing,state.drawing);document.body.dataset.maximumDrawing=String(maximumDrawing);
  el('drawing-budget').textContent=state.drawing||state.waiting?`Drawing ${state.drawing} · queued ${state.waiting}`:getComputedStyle(document.documentElement).getPropertyValue('--motion').trim()==='0'?'Ready · reduced motion':'Ready · 0 drawing';
});
for(const [id,name]of [['tokens-link-icon','arrow-right'],['draw-icon','play'],['concern-icon','warning-circle']] as const)el(id).append(icon(name,20));
const seed=()=>seedInput.value.trim()||'topic:next-game';
function options(kind:MarkKind){return kind==='tally'?{count,unit:50}:kind==='circle'?{ink:'alarm' as const}:kind==='stamp'?{label:'MUTED'}:{};}
function recordProof(){
  const key=`${seed()}:${count}`,signature=JSON.stringify([...current.values()].map(item=>item.geometry)),previous=signatures.get(key);
  const same=previous===signature;
  el('seed-proof').textContent=previous?(same?'Same seed · identical paths':'Geometry mismatch'): 'New seed · stable paths saved';
  el('seed-proof').dataset.proof=previous?(same?'same':'mismatch'):'new';
  signatures.set(key,signature);if(signatures.size>32)signatures.delete(signatures.keys().next().value!);
}
function showTally(){
  const tally=current.get('tally')?.geometry.tally;el('tally-count').textContent=new Intl.NumberFormat('en').format(count);
  el('tally-limit').textContent=tally?.capped?'20 marks · number carries on':`${tally?.shown??0} marks · 4 groups maximum`;
}
function render(animate=false){
  animator.finish();maximumDrawing=0;document.body.dataset.maximumDrawing='0';
  seedInput.value=seed();
  for(const kind of markKinds){const geometry=markGeometry(kind,seed(),options(kind)),svg=renderMark(geometry);current.set(kind,{geometry,svg});el(`${kind}-host`).replaceChildren(svg);}
  showTally();recordProof();
  if(animate)for(const {svg}of current.values())void animator.draw(svg);
}
el('draw-marks').addEventListener('click',()=>render(true));el('repeat-seed').addEventListener('click',()=>render());
el('new-seed').addEventListener('click',()=>{const base=seed().split(':variation-')[0]!;seedInput.value=`${base}:variation-${++variation}`;render(true);});
seedInput.addEventListener('change',()=>render());seedInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();render(true);}});
el('add-tally').addEventListener('click',()=>{
  count+=50;const old=current.get('tally')!,geometry=markGeometry('tally',seed(),options('tally')),fresh=renderMark(geometry);
  const known=new Set([...old.svg.querySelectorAll<SVGGElement>('.mark-part')].map(part=>part.dataset.part));
  const added:string[]=[];
  for(const part of fresh.querySelectorAll<SVGGElement>('.mark-part'))if(!known.has(part.dataset.part)){old.svg.append(part);added.push(part.dataset.part!);}
  current.set('tally',{geometry,svg:old.svg});showTally();recordProof();if(added.length)void animator.draw(old.svg,added);
});
function updateMotion(){
  if(reduced.checked)document.documentElement.dataset.motion='reduced';else delete document.documentElement.dataset.motion;
  if(reduced.checked||media.matches)animator.finish();
}
reduced.checked=media.matches;reduced.addEventListener('change',updateMotion);media.addEventListener('change',()=>{reduced.checked=media.matches;updateMotion();});updateMotion();
surface.addEventListener('change',()=>{el('marks-grid').dataset.surface=surface.value;el('swipe-caption').textContent=surface.value==='paper'?'Ragged edges · multiply':'Ragged edges · 85% ink';});el('marks-grid').dataset.surface='ink';
window.addEventListener('pagehide',()=>animator.dispose(),{once:true});render();
