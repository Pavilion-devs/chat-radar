import type {Topic,Radar} from '../shared/model.js';
import {icon,type IconName} from '../shared/icons.js';
import {markGeometry,renderMark,setMarkProgress,MarkAnimator} from '../shared/marks.js';
import {OverlayMotion} from './motion.js';
import {DigitCount} from './digits.js';
import {highlightedLines,circledLines} from './label-mark.js';
import {rowMotion} from './row-motion.js';
import {labelLines,tallyUnit,radarZones,tallyEvidence} from './state.js';
const kinds:Record<Topic['kind'],{icon:IconName;label:string}>={question:{icon:'question',label:'Question'},request:{icon:'hand-pointing',label:'Request'},reaction:{icon:'lightning',label:'Reaction'},complaint:{icon:'warning-circle',label:'Complaint'}};
interface Row {row:HTMLLIElement;body:HTMLElement;label:HTMLElement;plain:HTMLElement;annotation:HTMLElement;count:DigitCount;kind:HTMLElement;tally:HTMLElement;signature:string;tallySignature:string;topic?:Topic}
export class RadarView {
  private rows=new Map<string,Row>();private version=0;private mood='';private score:number|undefined;
  readonly motion=new OverlayMotion();readonly marks=new MarkAnimator(state=>{document.body.dataset.drawing=String(state.drawing);document.body.dataset.maxDrawing=String(Math.max(Number(document.body.dataset.maxDrawing??0),state.drawing));});
  private canvas=document.createElement('canvas');
  private reactionCount=new DigitCount(document.getElementById('reaction-count')!,this.motion);
  private reactionId:string|undefined;private topId:string|undefined;
  constructor(private list:HTMLElement,private compact=false){document.getElementById('reaction-icon')!.append(icon('lightning',20));}
  private measure=(text:string,size:number)=>{const context=this.canvas.getContext('2d')!;context.font=`700 ${size}px "Space Grotesk"`;return context.measureText(text).width;};
  private create(topic:Topic){
    const row=document.createElement('li');row.className='radar-row';row.dataset.id=topic.id;
    const line=document.createElement('div');line.className='radar-line';
    const label=document.createElement('div');label.className='radar-label';
    const plain=document.createElement('span');plain.className='label-text';const annotation=document.createElement('span');annotation.className='row-annotation';label.append(plain,annotation);
    const counter=document.createElement('span');counter.className='radar-count';line.append(label,counter);
    const meta=document.createElement('div');meta.className='radar-meta';const kind=document.createElement('span');kind.className='radar-kind';const tally=document.createElement('span');tally.className='radar-tally';tally.setAttribute('aria-hidden','true');meta.append(kind,tally);const body=document.createElement('div');body.className='radar-row-body';body.append(line,meta);row.append(body);
    return{row,body,label,plain,annotation,count:new DigitCount(counter,this.motion),kind,tally,signature:'',tallySignature:''} satisfies Row;
  }
  async render(topics:Topic[],animate=true){
    this.finish();const version=++this.version,{asking:selected,reacting}=radarZones(topics,this.compact),ids=new Set(selected.map(topic=>topic.id));
    const reactionZone=document.getElementById('reacting-zone')!;reactionZone.hidden=!reacting;
    if(reacting){document.getElementById('reaction-label')!.textContent=reacting.label;document.getElementById('reaction')!.dataset.id=reacting.id;this.reactionCount.set(reacting.count_estimate,animate&&this.reactionId!==undefined);}
    this.reactionId=reacting?.id;
    // Hide the empty asking header after its last exiting row has collapsed.
    if(selected.length)document.getElementById('asking-zone')!.hidden=false;
    const previousTop=this.topId?this.rows.get(this.topId):undefined;this.topId=selected[0]?.id;
    if(animate&&previousTop&&previousTop.topic?.id!==this.topId&&previousTop.annotation.classList.contains('label-swipe')){document.body.dataset.radarPhase='fading';await Promise.all([...previousTop.annotation.querySelectorAll('.mark-reveal')].map(reveal=>this.motion.animate(reveal,[{strokeDashoffset:'0'},{strokeDashoffset:'1'}],'--dur-fade')));if(version!==this.version)return;}
    document.body.dataset.radarPhase='reordering';
    const exits=[...this.rows].filter(([id])=>!ids.has(id));
    // Keep exiting content in normal flow while its actual height collapses.
    // Survivors follow that collapse; an empty translated slot cannot remain.
    if(animate&&exits.length){await Promise.all(exits.map(([,view])=>{view.row.dataset.exiting='true';view.row.style.height='0px';return this.motion.animate(view.row,[{height:`${view.row.scrollHeight}px`,paddingTop:0,paddingBottom:0},{height:'0px',paddingTop:0,paddingBottom:0}],'--dur-reorder','--ease-travel');}));if(version!==this.version)return;}
    for(const [id,view]of exits){view.row.remove();this.rows.delete(id);}
    document.getElementById('asking-zone')!.hidden=!selected.length;
    const snapshots=[...this.list.children].map(row=>row.querySelector<HTMLElement>(':scope > .radar-row-body')!.cloneNode(true) as HTMLElement);
    const before=new Map([...this.rows].map(([id,view])=>[id,view.row.offsetTop])),movements:Promise<void>[]=[],draws:(()=>void)[]=[];
    const unit=tallyUnit(selected);document.getElementById('tally-unit')!.textContent=String(unit);
    for(const [index,topic]of selected.entries()){
      let view=this.rows.get(topic.id);const fresh=!view;if(!view){view=this.create(topic);this.rows.set(topic.id,view);}
      delete view.row.dataset.exiting;view.row.style.removeProperty('height');this.list.append(view.row);
      const old=view.topic;view.topic=topic;view.row.dataset.rank=String(index+1);view.row.dataset.kind=topic.kind;view.row.title=topic.examples.join('\n');view.row.setAttribute('aria-posinset',String(index+1));view.row.setAttribute('aria-setsize',String(selected.length));
      if(old?.kind!==topic.kind)view.kind.replaceChildren(icon(kinds[topic.kind].icon,20),document.createTextNode(kinds[topic.kind].label));
      view.count.set(topic.count_estimate,animate&&!fresh);
      const urgent=topic.kind==='complaint'&&topic.urgency>=.7,highlight=index===0&&!urgent;view.row.dataset.urgent=String(urgent);view.body.dataset.urgent=String(urgent);
      const size=parseFloat(getComputedStyle(view.plain).fontSize),lineHeight=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--overlay-label-line-height'));
      const lines=labelLines(topic.label,view.label.clientWidth-(urgent?36:0),text=>this.measure(text,size)),widths=lines.map(line=>Math.ceil(this.measure(line,size))),width=Math.max(...widths);
      view.row.style.setProperty('--row-extra',`${(lines.length-1)*lineHeight}px`);view.label.style.height=`${42+(lines.length-1)*lineHeight}px`;view.row.dataset.lines=String(lines.length);
      view.plain.setAttribute('aria-label',topic.label);view.plain.replaceChildren(...lines.map(line=>{const span=document.createElement('span');span.className='topic-label-line';span.textContent=line;return span;}));view.plain.hidden=highlight;
      const signature=JSON.stringify([lines,widths,urgent,highlight]);
      if(signature!==view.signature){
        view.annotation.replaceChildren();view.annotation.className=`row-annotation ${urgent?'label-circle':highlight?'label-swipe':''}`;
        if(urgent||highlight){
          const svg=urgent?circledLines(topic.id,width,lines.length,lineHeight):highlightedLines(topic.id,lines,widths,lineHeight);
          view.annotation.style.width=svg.getAttribute('width')+'px';view.annotation.style.height=svg.getAttribute('height')+'px';view.annotation.append(svg);
          if(animate){for(const part of svg.querySelectorAll<SVGGElement>('.mark-part'))part.dataset.phase='queued';draws.push(()=>{void this.marks.draw(svg);});}
        }view.signature=signature;
      }
      const evidence=tallyEvidence(topic.count_estimate,unit);view.row.dataset.count=String(topic.count_estimate);view.tally.dataset.unit=String(unit);view.tally.dataset.represented=String(evidence.represented);view.tally.dataset.remainder=String(evidence.remainder);
      let extra=view.tally.querySelector<HTMLElement>('.tally-more');if(!extra){extra=document.createElement('span');extra.className='tally-more';extra.textContent='+';view.tally.append(extra);}extra.hidden=evidence.remainder===0;
      view.tally.title=`${evidence.marks} marks × ${unit} = ${evidence.represented}${evidence.remainder?`, plus ${evidence.remainder} extra`:''}`;
      const tallySignature=JSON.stringify([unit,evidence.marks]);
      if(view.tallySignature!==tallySignature){
        // 44px viewport gives ~26px of actual pigment, not a 14px shrunken mark.
        const geometry=markGeometry('tally',topic.id,{count:topic.count_estimate,unit,width:144,height:44,minimumWidth:2.5}),svg=renderMark(geometry),previous=view.tally.querySelector('svg');
        if(previous){
          const known=new Set([...previous.querySelectorAll<SVGGElement>('.mark-part')].map(part=>part.dataset.part)),incoming=new Set(geometry.parts.map(part=>part.id));
          for(const part of previous.querySelectorAll<SVGGElement>('.mark-part'))if(!incoming.has(part.dataset.part!))part.remove();
          for(const part of svg.querySelectorAll<SVGGElement>('.mark-part'))if(!known.has(part.dataset.part)){if(animate)part.dataset.phase='queued';previous.append(part);if(animate)draws.push(()=>{void this.marks.draw(previous,[part.dataset.part!]);});}
        }else{if(animate)for(const part of svg.querySelectorAll<SVGGElement>('.mark-part'))part.dataset.phase='queued';view.tally.prepend(svg);if(animate)draws.push(()=>{void this.marks.draw(svg);});}
        view.tallySignature=tallySignature;
      }
    }
    // Invert against final DOM positions. Snapshot each destination slot so
    // neither a long FLIP nor an adjacent swap can leave it empty or overprint.
    for(const [index,topic]of selected.entries()){
      const view=this.rows.get(topic.id)!,snapshot=snapshots[index];
      const distance=before.has(topic.id)?before.get(topic.id)!-view.row.offsetTop:snapshot?view.row.offsetHeight:0;
      if(!animate||!distance||!snapshot)continue;
      snapshot.className='radar-ghost';snapshot.setAttribute('aria-hidden','true');
      snapshot.querySelector<HTMLElement>('.label-text')!.hidden=false;for(const mark of snapshot.querySelectorAll('.row-annotation'))mark.replaceChildren();
      // A destination slot must never retain an old, now differently ranked
      // number or tallies measured in the previous unit during its FLIP.
      snapshot.querySelector('.radar-count')!.replaceWith(view.body.querySelector('.radar-count')!.cloneNode(true));
      snapshot.querySelector('.radar-tally')!.replaceWith(view.tally.cloneNode(true));
      const renamed=new Map<string,string>();for(const node of snapshot.querySelectorAll('[id]')){const old=node.id;node.id=`${old}-ghost-${version}-${index}`;renamed.set(old,node.id);}
      for(const node of snapshot.querySelectorAll('*'))for(const attr of [...node.attributes]){let value=attr.value;for(const [old,id]of renamed)value=value===`#${old}`?`#${id}`:value.replaceAll(`url(#${old})`,`url(#${id})`);if(value!==attr.value)node.setAttribute(attr.name,value);}
      view.row.append(snapshot);const frames=rowMotion(distance,view.row.offsetHeight);
      movements.push(this.motion.animate(view.body,frames.incoming,'--dur-reorder','--ease-travel'));
      movements.push(this.motion.animate(snapshot,frames.outgoing,'--dur-reorder','--ease-travel').then(()=>snapshot.remove()));
    }
    await Promise.all(movements);if(version!==this.version)return;document.body.dataset.radarPhase='marking';for(const draw of draws)draw();
  }
  moodLine(radar:Radar,animate=true){
    const word=document.getElementById('mood-label')!,underline=document.getElementById('mood-underline')!,dot=document.getElementById('mood-position')!,mood=radar.mood.label;
    const changed=mood!==this.mood;word.textContent=mood;this.mood=mood;
    const score=Math.max(-1,Math.min(1,radar.mood.score)),left=(score+1)*50;dot.style.left=`${left}%`;
    if(animate&&this.score!==undefined&&this.score!==score)void this.motion.animate(dot,[{left:`${(this.score+1)*50}%`},{left:`${left}%`}],'--dur-sheet');this.score=score;
    if(changed){const svg=renderMark(markGeometry('underline',`mood:${mood}`,{width:Math.max(48,word.offsetWidth),height:12}));underline.replaceChildren(svg);if(animate)void this.marks.draw(svg);}
  }
  finish(){this.motion.finish();this.marks.finish(document.getElementById('radar-panel')!);for(const ghost of this.list.querySelectorAll('.radar-ghost'))ghost.remove();for(const svg of this.list.parentElement!.querySelectorAll<SVGSVGElement>('.mark-svg'))setMarkProgress(svg,1);}
  dispose(){this.motion.dispose();this.marks.dispose();}
}
