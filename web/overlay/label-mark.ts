import {markGeometry,renderMark,renderHighlightedLabel} from '../shared/marks.js';
/** One annotation with one seeded ribbon per text line, sharing the surface queue. */
export function highlightedLines(seed:string,lines:readonly string[],widths:readonly number[],lineHeight:number){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),width=Math.max(...widths)+24,height=42+(lines.length-1)*lineHeight;
  svg.classList.add('mark-svg');svg.dataset.kind='highlighter';svg.dataset.ink='marker';svg.dataset.lines=String(lines.length);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('role','img');svg.setAttribute('aria-label',lines.join(' '));
  lines.forEach((line,index)=>{const mark=renderHighlightedLabel(markGeometry('highlighter',`${seed}:line:${index}`,{width:widths[index]!+24,height:42}),line),group=document.createElementNS(svg.namespaceURI,'g');group.setAttribute('transform',`translate(0 ${index*lineHeight})`);group.append(...mark.childNodes);svg.append(group);});
  return svg;
}
export function circledLines(seed:string,width:number,lines:number,lineHeight:number){
  const geometry=markGeometry('circle',seed,{width:Math.max(80,width+48),height:96+(lines-1)*lineHeight,contentWidth:width,contentHeight:30+(lines-1)*lineHeight,clearance:10,ink:'alarm'}),svg=renderMark(geometry);
  svg.setAttribute('width',String(geometry.width));svg.setAttribute('height',String(geometry.height));return svg;
}
