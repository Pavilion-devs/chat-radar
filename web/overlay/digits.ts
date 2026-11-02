import {duration,type OverlayMotion} from './motion.js';
/** Unchanged digits retain their DOM; changed digits roll last digit first. */
export class DigitCount {
  private value='';private digits:HTMLElement[]=[];
  constructor(private host:HTMLElement,private motion:OverlayMotion){}
  set(value:number,animate=true){
    const next=new Intl.NumberFormat('en').format(Math.max(0,Math.round(value))),old=this.value;
    if(next===old)return;
    this.host.setAttribute('aria-label',next);this.value=next;
    const oldDigits=this.digits;this.digits=[];
    [...next].forEach((character,index)=>{
      const fromEnd=next.length-index,previous=old[old.length-fromEnd],slot=oldDigits[old.length-fromEnd]??document.createElement('span');
      slot.className='digit-slot';slot.setAttribute('aria-hidden','true');this.digits.push(slot);this.host.append(slot);
      if(character===previous&&slot.childElementCount)return;
      const current=document.createElement('span');current.textContent=character;current.className='digit-current';slot.replaceChildren(current);
      if(animate&&previous!==undefined&&!this.motion.reduced()){
        const before=document.createElement('span');before.className='digit-before';before.textContent=previous;slot.prepend(before);
        const delay=(fromEnd-1)*duration('--stagger-min');
        void this.motion.animate(current,[{transform:'translateY(100%)'},{transform:'translateY(0)'}],'--dur-sheet','--ease-out',delay);
        void this.motion.animate(before,[{transform:'translateY(0)'},{transform:'translateY(-100%)'}],'--dur-sheet','--ease-out',delay).then(()=>before.remove());
      }
    });
    for(const slot of oldDigits)if(!this.digits.includes(slot))slot.remove();
  }
}
