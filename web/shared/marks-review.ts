import {icon} from './icons.js';
import {MarkAnimator,markGeometry,renderMark,renderHighlightedLabel,setMarkProgress,markKinds,type MarkKind,type MarkGeometry,type MarkOptions} from './marks.js';
const el=(id:string)=>document.getElementById(id)!;
const seedInput=el('mark-seed') as HTMLInputElement,reduced=el('marks-reduced') as HTMLInputElement,surface=el('marks-surface') as HTMLSelectElement;
const frame=el('swipe-frame') as HTMLSelectElement,marksOff=el('marks-off') as HTMLInputElement;
const media=matchMedia('(prefers-reduced-motion: reduce)');
const current=new Map<MarkKind,{geometry:MarkGeometry;svg:SVGSVGElement}>(),signatures=new Map<string,string>();
let count=850,variation=0,maximumDrawing=0,rightTape:SVGSVGElement|undefined,rightTapeGeometry:MarkGeometry|undefined;
const animator=new MarkAnimator(state=>{
  maximumDrawing=Math.max(maximumDrawing,state.drawing);document.body.dataset.maximumDrawing=String(maximumDrawing);
  el('drawing-budget').textContent=state.drawing||state.waiting?`Drawing ${state.drawing} · queued ${state.waiting}`:getComputedStyle(document.documentElement).getPropertyValue('--motion').trim()==='0'?'Ready · reduced motion':'Ready · 0 drawing';
});
for(const [id,name]of [['tokens-link-icon','arrow-right'],['draw-icon','play'],['concern-icon','warning-circle']] as const)el(id).append(icon(name,20));
const seed=()=>seedInput.value.trim()||'topic:next-game';
const pixels=(name:string)=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
function options(kind:MarkKind):MarkOptions{
  if(kind==='tally')return{count,unit:50};if(kind==='stamp')return{label:'MUTED'};
  if(kind==='tape')return{width:pixels('--marks-review-tape-width'),height:pixels('--marks-review-tape-height')};
  if(kind==='circle'){
    const slot=el('circle-host').getBoundingClientRect(),label=el('circle-label').getBoundingClientRect();
    return{ink:'alarm',width:slot.width,height:slot.height,contentWidth:Math.ceil(label.width),contentHeight:Math.ceil(label.height),clearance:pixels('--mark-circle-clearance')};
  }
  return{};
}
function recordProof(){
  const key=JSON.stringify([seed(),count,current.get('circle')?.geometry.protection,current.get('circle')?.geometry.width]),signature=JSON.stringify([...current.values()].map(item=>item.geometry).concat(rightTapeGeometry?[rightTapeGeometry]:[])),previous=signatures.get(key);
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
  for(const kind of markKinds){const geometry=markGeometry(kind,seed(),options(kind)),svg=kind==='highlighter'?renderHighlightedLabel(geometry,'Play Fortnite next',!marksOff.checked):renderMark(geometry);current.set(kind,{geometry,svg});el(`${kind}-host`).replaceChildren(svg);}
  rightTapeGeometry=markGeometry('tape',`${seed()}:right`,options('tape'));rightTape=renderMark(rightTapeGeometry);el('tape-right-host').replaceChildren(rightTape);
  el('marks-grid').dataset.marks=marksOff.checked?'off':'on';frame.value='100';el('frame-status').textContent=marksOff.checked?'Marks off · paper text':reduced.checked||media.matches?'Final frame · reduced motion':'Final frame';
  frame.disabled=marksOff.checked||reduced.checked||media.matches;(el('draw-marks') as HTMLButtonElement).disabled=marksOff.checked;
  const circle=current.get('circle')!.geometry,box=circle.protection!;
  const clearance=Math.min(...circle.parts[0]!.outline.map(point=>Math.hypot(Math.max(box.left-point.x,0,point.x-box.right),Math.max(box.top-point.y,0,point.y-box.bottom))));
  el('circle-clearance').textContent=`${clearance.toFixed(1)}px minimum clearance · ${circle.overshootDegrees!.toFixed(0)}° overshoot`;
  showTally();recordProof();
  if(animate&&!marksOff.checked){for(const {svg}of current.values())void animator.draw(svg);if(rightTape)void animator.draw(rightTape);el('frame-status').textContent='Playing · paper text stays visible';}
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
  if(reduced.checked||media.matches){animator.finish();frame.value='100';const svg=current.get('highlighter')?.svg;if(svg)setMarkProgress(svg,1);el('frame-status').textContent='Final frame · reduced motion';}
  frame.disabled=marksOff.checked||reduced.checked||media.matches;
}
reduced.checked=media.matches;reduced.addEventListener('change',updateMotion);media.addEventListener('change',()=>{reduced.checked=media.matches;updateMotion();});updateMotion();
surface.addEventListener('change',()=>{el('marks-grid').dataset.surface=surface.value;el('swipe-caption').textContent=surface.value==='paper'?'Drifting pigment · multiply':'Drift, texture, frayed ends';});el('marks-grid').dataset.surface='ink';
function showFrame(){animator.finish();setMarkProgress(current.get('highlighter')!.svg,Number(frame.value)/100);el('frame-status').textContent=frame.value==='100'?'Final frame':`${frame.value}% swipe · review frame`;}
frame.addEventListener('change',showFrame);
marksOff.checked=new URLSearchParams(location.search).get('marks')==='off';marksOff.addEventListener('change',()=>render());
window.addEventListener('pagehide',()=>animator.dispose(),{once:true});
let layoutWidth=innerWidth;
function refreshLayout(){const held=frame.value;render();if(!frame.disabled&&held!=='100'){frame.value=held;showFrame();}}
window.addEventListener('resize',()=>{if(innerWidth!==layoutWidth){layoutWidth=innerWidth;refreshLayout();}});render();void document.fonts.ready.then(refreshLayout);
