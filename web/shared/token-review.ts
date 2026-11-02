import {icon,iconNames,type IconName} from './icons.js';
import {contrastRatio,overlayContrastThreshold} from './contrast.js';
const element=(id:string)=>document.getElementById(id)!;
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text='')=>{const result=document.createElement(tag);result.className=className;result.textContent=text;return result;};
const root=document.documentElement;
const palette=[['ink-0','Panel'],['ink-1','Raised'],['ink-2','Rules'],['paper','Text'],['graphite','Meta'],['marker','Accent'],['alarm','Broken'],['ok','All good'],['ink-blue','Interactive']] as const;
for(const [token,label]of palette){
  const sample=node('div','swatch'),color=node('span','swatch-color');
  color.style.backgroundColor=`var(--${token})`;
  const value=getComputedStyle(root).getPropertyValue(`--${token}`).trim();
  sample.append(color,node('strong','',label),node('code','',value));element('palette').append(sample);
}
for(const item of document.querySelectorAll<HTMLElement>('[data-icon]')){
  const name=item.dataset.icon as IconName;
  if(iconNames.includes(name))item.replaceChildren(icon(name,Number(item.dataset.size)||20));
}
for(const [target,samples]of [
  ['small-icons',[['question','Question',20],['hand-pointing','Request',20],['lightning','Reaction',20],['warning-circle','Concern',20]]],
  ['large-icons',[['microphone-slash','Muted · 32px',32],['speaker-simple-slash','Audio · 32px',32],['monitor-play','Screen · 48px',48],['wifi-slash','Offline · 32px',32]]]
] as const){
  for(const [name,label,size]of samples){const sample=node('div','icon-sample');sample.append(icon(name,size),node('span','',label));element(target).append(sample);}
}
for(const space of [4,8,12,16,24,32,48]){
  const sample=node('div','space-sample'),bar=node('i');bar.style.width=`var(--space-${space})`;sample.append(bar,node('span','',String(space)));element('spacing-scale').append(sample);
}
for(const [name,duration]of [['Press',90],['Hover',120],['Fade',150],['Pop',180],['Sheet',300],['Toss',440],['Draw',600],['Reorder',500]] as const){
  const sample=node('div','motion-token');sample.append(node('strong','',`${duration}ms`),node('span','',name));element('motion-tokens').append(sample);
}
const reduce=element('reduce-motion') as HTMLInputElement;
const media=matchMedia('(prefers-reduced-motion: reduce)');reduce.checked=media.matches;
function updateMotion(){
  if(reduce.checked)root.dataset.motion='reduced';else delete root.dataset.motion;
  const motion=getComputedStyle(root).getPropertyValue('--motion').trim();
  element('motion-status').textContent=motion==='0'?'Reduced motion · 0':'Motion enabled · 1';
}
reduce.addEventListener('change',updateMotion);media.addEventListener('change',()=>{reduce.checked=media.matches;updateMotion();});
element('preview-motion').addEventListener('click',()=>element('motion-block').classList.toggle('moved'));updateMotion();
const token=(name:string)=>getComputedStyle(root).getPropertyValue(name).trim();
for(const [foreground,background,label,sizeToken,weight]of [
  ['--paper','--ink-0','Paper / panel','--type-overlay-ui',500],
  ['--graphite','--ink-0','Graphite / panel','--type-overlay-ui',500],
  ['--ink-0','--marker','Ink / marker','--type-overlay-topic',700],
  ['--ink-0','--alarm','Ink / alarm','--type-alarm',700],
  ['--paper','--ink-0','Alarm count band','--type-overlay-ui',500],
] as const){
  const size=parseFloat(token(sizeToken)),threshold=overlayContrastThreshold(size,weight),ratio=contrastRatio(token(foreground),token(background)),pass=ratio>=threshold;
  const item=node('div','contrast-pair'),status=node('small','',pass?'Pass':'Pairing needs care');
  item.dataset.contrastPass=String(pass);
  status.prepend(icon(pass?'check-circle':'warning-circle',20));item.append(node('strong','',`${ratio.toFixed(2)}:1`),node('span','',label),node('span','',`${size}px${weight>=700?' bold':''} · needs ${threshold}:1`),status);element('contrast-pairs').append(item);
}
void document.fonts.ready.then(()=>{
  const loaded=document.fonts.check('700 26px "Space Grotesk"')&&document.fonts.check('500 15px Inter')&&document.fonts.check('600 22px Caveat');
  element('font-status').textContent=loaded?'3 local fonts loaded':'Check local font loading';
});
