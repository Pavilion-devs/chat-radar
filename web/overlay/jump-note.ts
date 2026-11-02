import {arrowGeometry,renderMark,type MarkAnimator} from '../shared/marks.js';
import {OverlayMotion,duration} from './motion.js';
import {bigJump} from './notice-state.js';
import type {Radar} from '../shared/model.js';
/** A short producer note points to one changed asking row, then clears. */
export class JumpNote {
  private timer:ReturnType<typeof setTimeout>|undefined;private motion=new OverlayMotion();
  constructor(private host:HTMLElement,private marks:MarkAnimator){}
  show(previous:Radar|undefined,next:Radar){
    const jump=bigJump(previous,next);if(!jump)return;
    const row=[...document.querySelectorAll<HTMLElement>('#topics > .radar-row')].find(row=>row.dataset.id===jump.id);if(!row)return;
    clearTimeout(this.timer);this.motion.finish();this.marks.finish(this.host);this.host.replaceChildren();
    const label=document.createElement('span');label.textContent=`+${new Intl.NumberFormat('en').format(jump.delta)} in ${jump.seconds}s`;
    const arrow=renderMark(arrowGeometry(`jump:${jump.id}:${next.ts}`));arrow.classList.add('note-arrow');
    this.host.append(label,arrow);this.host.style.top=`${row.offsetTop+document.getElementById('asking-heading')!.offsetHeight+document.querySelector<HTMLElement>('.overlay-header')!.offsetHeight+24}px`;this.host.hidden=false;
    void this.motion.animate(this.host,[{opacity:0},{opacity:1}],'--dur-fade');void this.marks.draw(arrow,undefined,true);
    this.timer=setTimeout(()=>{void this.motion.animate(this.host,[{opacity:1},{opacity:0}],'--dur-fade').then(()=>{this.host.hidden=true;});},duration('--hold-note'));
  }
  dispose(){clearTimeout(this.timer);this.marks.finish(this.host);this.motion.dispose();}
}
