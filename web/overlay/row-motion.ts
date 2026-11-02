/** FLIP travel clipped to an occupied rank slot. The outgoing snapshot stays
 * until the incoming body reaches the slot, then their edges travel together. */
export function rowMotion(distance:number,height:number){
  const direction=Math.sign(distance),hold=Math.max(0,1-height/Math.abs(distance));
  const outgoing:Keyframe[]=[{transform:'translateY(0)',offset:0}];
  if(hold>0)outgoing.push({transform:'translateY(0)',offset:hold});
  outgoing.push({transform:`translateY(${-direction*height}px)`,offset:1});
  return{incoming:[{transform:`translateY(${distance}px)`},{transform:'translateY(0)'}],outgoing};
}
export function slotOffsets(distance:number,height:number,progress:number){const incoming=distance*(1-progress);return{incoming,outgoing:Math.sign(distance)*Math.min(0,Math.abs(incoming)-height)};}
