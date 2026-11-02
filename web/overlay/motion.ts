/** Token-driven, interruptible motion shared by the calm overlay's views. */
export function duration(token:string){const value=getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  // Resolve calc() through a computed duration instead of parsing its raw expression.
  const probe=document.createElement('i');probe.style.animationDuration=`var(${token})`;document.body.append(probe);const computed=getComputedStyle(probe).animationDuration;probe.remove();
  return value==='0'?0:parseFloat(computed)*(computed.endsWith('ms')?1:1000);
}
export function easing(token:string){return getComputedStyle(document.documentElement).getPropertyValue(token).trim();}
export class OverlayMotion {
  private active=new Set<Animation>();
  private media=matchMedia('(prefers-reduced-motion: reduce)');
  private observer=new MutationObserver(()=>{if(this.reduced())this.finish();});
  constructor(){this.media.addEventListener('change',this.onMotion);this.observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','style']});}
  private onMotion=()=>{if(this.reduced())this.finish();};
  reduced(){return this.media.matches||getComputedStyle(document.documentElement).getPropertyValue('--motion').trim()==='0';}
  animate(element:HTMLElement,frames:Keyframe[],token:string,ease='--ease-out',delay=0){
    if(this.reduced())return Promise.resolve();const ms=duration(token);if(!ms)return Promise.resolve();
    const animation=element.animate(frames,{duration:ms,easing:easing(ease),delay,fill:'backwards'});this.active.add(animation);
    return animation.finished.catch(()=>{}).then(()=>{this.active.delete(animation);animation.cancel();});
  }
  finish(){for(const animation of this.active)animation.finish();this.active.clear();}
  dispose(){this.finish();this.media.removeEventListener('change',this.onMotion);this.observer.disconnect();}
}
