import type {Moment} from '../shared/model.js';
import {markGeometry,renderMark,type MarkAnimator} from '../shared/marks.js';
import {icon} from '../shared/icons.js';
import {OverlayMotion,duration} from './motion.js';
import {momentPresentation} from './notice-state.js';
/** One toss per moment. Title/save updates never replay it or reset the hold. */
export class MomentView {
  private motion=new OverlayMotion();private current:Moment|undefined;private queue:Moment[]=[];private shown=new Set<string>();private timer:ReturnType<typeof setTimeout>|undefined;private disposed=false;
  constructor(private host:HTMLElement,private marks:MarkAnimator){}
  receive(moment:Moment){
    if(this.current?.id===moment.id){this.current=moment;const title=this.host.querySelector<HTMLElement>('.polaroid-title');if(title)title.textContent=moment.title;return;}
    const queued=this.queue.findIndex(item=>item.id===moment.id);if(queued>=0){this.queue[queued]=moment;return;}
    if(!momentPresentation(moment)||this.shown.has(moment.id))return;
    this.queue.push(moment);if(this.queue.length>3)this.queue.shift();if(!this.current)void this.next();
  }
  private async next(){
    if(this.disposed)return;const moment=this.queue.shift();if(!moment)return;this.current=moment;this.shown.add(moment.id);if(this.shown.size>1000)this.shown.delete(this.shown.values().next().value!);
    const presentation=momentPresentation(moment)!;this.host.replaceChildren();this.host.dataset.sim=String(moment.sim);this.host.dataset.id=moment.id;
    const paper=document.createElement('div');paper.className='polaroid-paper';paper.setAttribute('aria-hidden','true');
    const content=document.createElement('div');content.className='polaroid-content';
    const media=document.createElement('div');media.className='polaroid-media';
    const state=document.createElement('div');state.className='polaroid-state';state.append(icon(presentation.clipped?'play':'clipboard-text',24),document.createTextNode(presentation.state));media.append(state);
    if(presentation.sim){const badge=document.createElement('span');badge.className='polaroid-sim';badge.textContent='SIM';state.append(badge);}
    if(presentation.thumbnail){
      const photo=document.createElement('img');photo.className='polaroid-photo';photo.alt='Twitch clip thumbnail';photo.referrerPolicy='no-referrer';
      const loaded=await new Promise<boolean>(resolve=>{const timeout=setTimeout(()=>resolve(false),8000);photo.onload=()=>{clearTimeout(timeout);resolve(true);};photo.onerror=()=>{clearTimeout(timeout);resolve(false);};photo.src=presentation.thumbnail!;});
      if(this.disposed)return;if(loaded){media.replaceChildren(photo);media.dataset.photo='true';}
    }
    const title=document.createElement('strong');title.className='polaroid-title';title.textContent=this.current.title;
    const tapes=document.createElement('div');tapes.className='polaroid-tapes';tapes.setAttribute('aria-hidden','true');
    for(let index=0;index<2;index++){const tape=renderMark(markGeometry('tape',`${moment.id}:tape:${index}`,{width:112,height:32}));tapes.append(tape);}
    content.append(media,title,tapes);
    if(presentation.clipped){const stamp=renderMark(markGeometry('stamp',moment.id,{width:160,height:64,label:'CLIPPED',ink:'ink'}));stamp.classList.add('polaroid-stamp');content.append(stamp);}
    this.host.append(paper,content);this.host.hidden=false;this.host.dataset.phase='toss';this.host.dataset.shownAt=String(Date.now());
    const x=getComputedStyle(document.documentElement).getPropertyValue('--overlay-toss-x').trim(),y=getComputedStyle(document.documentElement).getPropertyValue('--overlay-toss-y').trim();
    await this.motion.animate(this.host,[{transform:`translate(-${x},${y})`,opacity:0},{transform:'translate(0,0)',opacity:1}],'--dur-toss','--ease-settle');
    if(this.disposed)return;this.host.dataset.phase='hold';this.host.dataset.holdAt=String(Date.now());
    // Tape and the clip stamp are already attached to the tossed paper.
    this.timer=setTimeout(()=>{void this.exit();},duration('--hold-moment'));
  }
  private async exit(){
    this.host.dataset.phase='exit';this.host.dataset.exitAt=String(Date.now());this.marks.finish(this.host);
    const distance=getComputedStyle(document.documentElement).getPropertyValue('--overlay-toss-exit').trim();
    await this.motion.animate(this.host,[{transform:'translateY(0)',opacity:1},{transform:`translateY(${distance})`,opacity:0}],'--dur-sheet');
    this.host.hidden=true;this.host.dataset.phase='hidden';this.current=undefined;if(!this.disposed)void this.next();
  }
  finish(){this.motion.finish();this.marks.finish(this.host);}
  holdFrame(progress:number){for(const animation of this.host.getAnimations({subtree:true})){animation.pause();const timing=animation.effect!.getTiming();animation.currentTime=Number(timing.delay)+Number(timing.duration)*progress;}}
  dispose(){this.disposed=true;clearTimeout(this.timer);this.motion.dispose();this.marks.finish(this.host);}
}
