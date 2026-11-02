// Official Phosphor Core 2.1.1 SVGs, self-hosted under their MIT license.
export const iconNames = ['question','hand-pointing','lightning','warning-circle','microphone-slash','speaker-simple-slash','monitor-play','wifi-slash','check-circle','x','arrow-right','copy','play','arrow-square-out','faders','info','list','gear','sun','moon','broadcast','chat-circle-text','keyboard','clipboard-text'] as const;
export type IconName = typeof iconNames[number];
export function icon(name:IconName, size=20):SVGSVGElement {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const use=document.createElementNS('http://www.w3.org/2000/svg','use');
  const safeSize=Number.isFinite(size)&&size>0?size:20;
  const weight=safeSize<=20?'fill':'bold';
  svg.setAttribute('viewBox','0 0 256 256');
  svg.setAttribute('width',String(safeSize));svg.setAttribute('height',String(safeSize));
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  svg.classList.add('phosphor-icon');svg.dataset.weight=weight;
  use.setAttribute('href',`/shared/icons/phosphor.svg#${name}-${weight}`);
  svg.append(use);return svg;
}
