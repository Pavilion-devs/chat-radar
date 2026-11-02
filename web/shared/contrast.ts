function luminance(hex:string):number {
  if(!/^#[\da-f]{6}$/i.test(hex))throw new Error('Expected a six-digit hex color');
  const channels=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722;
}
export function contrastRatio(foreground:string,background:string):number {
  const a=luminance(foreground),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
export function overlayContrastThreshold(size:number,weight:number):number {
  return size>=24&&weight>=700?4.5:7;
}
