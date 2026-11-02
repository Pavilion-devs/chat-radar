import {connect} from '../shared/connection.js';
import {Activity,clipUrl,momentLabel,number,time,type Alert,type Chat,type Moment,type Radar,type Reply,type Status} from '../shared/model.js';
import {TopicList} from '../shared/topics.js';
const el=(id:string)=>document.getElementById(id)!;
const make=<K extends keyof HTMLElementTagNameMap>(tag:K,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node;};
const topics=new TopicList(el('radar-topics'),83),activity=new Activity();
const alerts=new Map<string,Alert>(),moments=new Map<string,Moment>(),replyIds=new Set<string>(),chatIds=new Set<string>();
const messageList=el('messages'),replyList=el('command-replies'),alertList=el('alerts'),momentList=el('moments');
let status:Status|undefined,radar:Radar|undefined,connected=false,pendingChat:Chat[]=[],chatFlush:ReturnType<typeof setTimeout>|undefined;
function showConnection(){
  const active=connected&&(status?.connected||status?.sim);
  el('connection-label').textContent=!connected?'Reconnecting':status?.sim?(status.connected?'Twitch + simulation':'Local simulation'):status?.connected?'Chat connected':'Twitch disconnected';
  el('status').classList.toggle('offline',!active);
  el('channel-name').textContent=status?.channel||'Your channel';el('channel-state').textContent=!connected?'Viewer disconnected':status?.connected?'Twitch connected':status?.sim?'Local simulation':'Not connected';
  el('connect-twitch').textContent=status?.connected?'Reconnect Twitch ↗':'Connect Twitch ↗';
  el('sim-badge').hidden=!connected||!status?.sim;
  const simulation=status?.simulation;
  el('sim-detail').hidden=!connected||!status?.sim;
  if(simulation){el('sim-phase').textContent=simulation.phase;el('sim-progress').textContent=`${number.format(simulation.sent)} / ${number.format(simulation.total)} messages`;}
  const notice=el('connection-notice');notice.hidden=!!active;
  notice.textContent=!connected?'Connection lost. Keeping the last received data while we reconnect.':'Twitch is disconnected. Connect your account to start listening to real chat.';
}
function showRadar(value:Radar){
  radar=value;topics.render(value.topics);el('radar-empty').hidden=!!value.topics.length;
  el('radar-source').textContent=value.sim?'SIMULATION':value.ts?'TWITCH CHAT':'LISTENING';el('radar-source').classList.toggle('sim',value.sim);
  el('radar-sample').textContent=`${number.format(value.windowCount)} messages · ${number.format(value.sampledCount)} sampled`;
  el('mood-value').textContent=value.ts?value.mood.label:'Listening';el('mood-score').textContent=value.ts?`${value.mood.score>0?'+':''}${value.mood.score.toFixed(2)}`:'';
  el('mood-indicator').style.left=`${(Math.max(-1,Math.min(1,value.mood.score))+1)*100/2}%`;
  const title=el('radar-empty').querySelector('h3')!,body=el('radar-empty').querySelector('p')!;
  title.textContent=value.status==='disabled'?'Your model needs a quick setup.':value.status==='error'?'The radar needs a moment.':'Good conversations start here.';
  body.textContent=value.status==='disabled'?'Configure your model provider to turn chat into topics.':value.status==='error'?'Chat is still flowing. Topic updates will return when the model is available.':'As chat picks up, the biggest topics rise to the top.';
  freshness();
}
function freshness(){
  el('radar-status').textContent=!connected?'Viewer disconnected':!radar?.ts?(radar?.status==='disabled'?'Model setup needed':radar?.status==='error'?'Topic update unavailable':'Listening for chat'):radar.status==='stale'||Date.now()-radar.ts>30_000?`Last available topics · ${time(radar.ts)}`:`Updated ${Math.max(0,Math.round((Date.now()-radar.ts)/1000))}s ago`;
}
function showMoments(){
  const all=[...moments.values()].sort((a,b)=>b.ts-a.ts);momentList.replaceChildren();
  for(const moment of all.slice(0,30)){
    const row=make('li',`moment-row${moment.sim?' sim':''}`),icon=make('span','moment-icon','✦'),body=make('div','moment-body'),title=make('strong','',moment.title),meta=make('div','moment-meta');
    icon.setAttribute('aria-hidden','true');
    if(moment.sim)meta.append(make('span','tag sim','SIM'));
    meta.append(make('span','',time(moment.ts)),make('span','',`${number.format(moment.peakRate)} msg/s`),make('span','',`${number.format(moment.uniqueChatters)} voices`));
    if(!moment.saved)meta.append(make('span','','Saving…'));
    body.append(title,meta);row.append(icon,body);
    const url=moment.clipStatus==='ready'&&!moment.sim?clipUrl(moment.clipUrl):null;
    if(url){const link=make('a','moment-link','Watch clip ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';row.append(link);}
    else row.append(make('span','moment-state',momentLabel(moment)));
    momentList.append(row);
  }
  const count=all.filter(m=>m.saved).length,clips=all.filter(m=>!m.sim&&m.clipStatus==='ready'&&clipUrl(m.clipUrl)).length;
  el('moments-empty').hidden=all.length>0;el('moments-value').textContent=number.format(count);el('nav-moment-count').textContent=String(all.length);
  el('clip-total').textContent=clips?`${clips} verified Twitch clip${clips===1?'':'s'} · recent history`:'Recent saved history';
  el('moment-summary').textContent=all.length?`${all.length} recent moment${all.length===1?'':'s'}${all.some(m=>m.sim)?' · simulation labeled':''}`:'Listening for something good';
}
const sortedAlerts=()=>[...alerts.values()].sort((a,b)=>Number(a.sim)-Number(b.sim)||b.ts-a.ts);
async function fixAlert(alert:Alert,button?:HTMLButtonElement){
  if(button?.disabled)return;if(button)button.disabled=true;
  try{
    const response=await fetch(`/alerts/${encodeURIComponent(alert.id)}/clear`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    if(!response.ok){if(response.status===404){alerts.delete(alert.id);showAlerts();throw new Error('That report was already cleared.');}throw new Error('Could not mark this fixed. Please try again.');}
    const result=await response.json() as {acknowledgement:string};alerts.delete(alert.id);showAlerts();clearNotice(result.acknowledgement);
  }catch(error){el('alert-notice').textContent=error instanceof Error?error.message:'Could not mark the report fixed.';if(button)button.disabled=false;}
}
function showAlerts(){
  alertList.replaceChildren();const all=sortedAlerts();
  all.forEach((alert,index)=>{
    const row=make('li','alert-row'),head=make('div','alert-row-head'),title=make('strong','',alert.title),sample=make('p','',alert.sample.slice(0,2).map(s=>`“${s}”`).join(' · ')),foot=make('div','alert-row-foot'),button=make('button','fixed-button','Fixed ✓');
    head.append(title);if(alert.sim)head.append(make('span','tag sim','SIM'));
    foot.append(make('span','',`${alert.uniqueUsers} reporters · ${Math.round(alert.share*100)}% of chat`));
    if(index<6){const key=make('kbd','',String(index+1));button.append(key);button.setAttribute('aria-keyshortcuts',`Alt+${index+1}`);}
    button.setAttribute('aria-label',`Mark fixed: ${alert.title}${alert.sim?' (simulation)':''}`);button.addEventListener('click',()=>void fixAlert(alert,button));foot.append(button);row.append(head,sample,foot);alertList.append(row);
  });
  el('health-empty').hidden=!!all.length;el('alert-badge').textContent=all.length?`${all.length} TO CHECK`:'NO REPORTS';el('alert-badge').classList.toggle('warning',!!all.length);el('nav-alert-count').textContent=String(all.length);
}
function clearNotice(ack:string){
  const text:Record<string,string>={local_only:'Marked fixed locally. Simulation never sends to Twitch.',pending:'Marked fixed. Thanking chat…',sent:'Marked fixed. Chat has been thanked.',failed:'Marked fixed. The chat thank-you could not be sent.',unavailable:'Marked fixed. Twitch is disconnected.'};
  el('alert-notice').textContent=text[ack]??'Marked fixed.';
}
function receiveChat(chat:Chat){
  if(chatIds.has(chat.id))return;chatIds.add(chat.id);if(chatIds.size>5000)chatIds.delete(chatIds.values().next().value!);
  activity.add(chat);pendingChat.push(chat);if(pendingChat.length>40)pendingChat=pendingChat.slice(-40);
  if(!chatFlush)chatFlush=setTimeout(flushChat,200);
}
function flushChat(){
  chatFlush=undefined;const fragment=document.createDocumentFragment();
  for(const chat of pendingChat.reverse()){
    const row=make('li','chat-row'),clock=make('time','',time(chat.ts)),user=make('strong','',chat.user.name||chat.user.login),text=make('span','',chat.text),source=make('small','',chat.sim?'SIM':'TWITCH');
    clock.dateTime=new Date(chat.ts).toISOString();row.append(clock,user,text,source);fragment.append(row);
  }
  pendingChat=[];messageList.prepend(fragment);while(messageList.children.length>40)messageList.lastElementChild?.remove();el('chat-empty').hidden=!!messageList.children.length;
}
function showReply(reply:Reply){
  if(replyIds.has(reply.id))return;replyIds.add(reply.id);const row=make('li','reply-row'),head=make('div','reply-head');
  head.append(make('strong','',reply.command),make('span',`tag${reply.sim?' sim':''}`,reply.sim?'LOCAL PREVIEW':reply.status==='sent'?'SENT TO TWITCH':'SEND FAILED'));
  if(reply.cached)head.append(make('span','','cached'));const clock=make('time','',time(reply.ts));clock.dateTime=new Date(reply.ts).toISOString();head.append(clock);row.append(head,make('p','',reply.text));row.dataset.id=reply.id;replyList.prepend(row);
  while(replyList.children.length>20){const last=replyList.lastElementChild as HTMLElement;replyIds.delete(last.dataset.id!);last.remove();}
  el('commands-empty').hidden=true;el('reply-count').textContent=String(replyList.children.length);
}
for(const command of ['radar','missed']){
  const button=el(`preview-${command}`) as HTMLButtonElement;
  button.addEventListener('click',async()=>{
    button.disabled=true;el('command-notice').textContent='Preparing your local preview…';
    try{const response=await fetch('/commands/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:`!${command}`})});const body=await response.json();if(!response.ok)throw new Error(body.error||'The preview could not be created.');showReply(body);el('command-notice').textContent='Local preview ready. Nothing was sent to Twitch.';}
    catch(error){el('command-notice').textContent=error instanceof Error?error.message:'The preview could not be created.';}
    finally{button.disabled=false;}
  });
}
const tabs=[el('chat-tab'),el('commands-tab')];
function switchTab(index:number){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;el(i?'commands-feed':'chat-feed').hidden=i!==index;});}
for(const [index,tab]of tabs.entries()){
  tab.addEventListener('click',()=>switchTab(index));tab.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-index;switchTab(next);tabs[next]!.focus();}});
}
const overlayDialog=el('overlay-dialog') as HTMLDialogElement,shortcutsDialog=el('shortcuts-dialog') as HTMLDialogElement,frame=el('overlay-frame') as HTMLIFrameElement;
const layout=el('overlay-layout') as HTMLSelectElement,position=el('overlay-position') as HTMLSelectElement,scale=el('overlay-scale') as HTMLSelectElement,urlInput=el('overlay-url') as HTMLInputElement;
function overlayURL(){const url=new URL('/overlay/',location.origin);if(layout.value==='compact')url.searchParams.set('layout','compact');if(position.value==='left')url.searchParams.set('position','left');if(scale.value!=='1')url.searchParams.set('scale',scale.value);return url.href;}
function updateOverlay(){const url=overlayURL();urlInput.value=url;(el('open-overlay') as HTMLAnchorElement).href=url;if(frame.src!==url)frame.src=url;el('copy-notice').textContent='Uses the same live data as your dashboard. Background stays transparent.';}
const openSetup=()=>{updateOverlay();if(!overlayDialog.open)overlayDialog.showModal();};
for(const id of ['setup-overlay','customize-overlay','nav-overlay'])el(id).addEventListener('click',openSetup);
for(const select of [layout,position,scale])select.addEventListener('change',updateOverlay);
el('copy-overlay').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(urlInput.value);el('copy-notice').textContent='Copied. Paste this into your OBS Browser source.';}catch{urlInput.focus();urlInput.select();el('copy-notice').textContent='The URL is selected. Copy it and paste it into OBS.';}});
el('shortcuts-button').addEventListener('click',()=>shortcutsDialog.showModal());
for(const dialog of [overlayDialog,shortcutsDialog])dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width)frame.style.transform=`scale(${width/1920})`;}).observe(el('overlay-preview'));
function focusSection(id:string){const section=el(id);section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});section.focus({preventScroll:true});}
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement||(event.target as HTMLElement)?.isContentEditable||overlayDialog.open||shortcutsDialog.open)return;
  if(event.altKey&&/^[1-6]$/.test(event.key)){const index=Number(event.key)-1,alert=sortedAlerts()[index];if(alert){event.preventDefault();const button=alertList.children[index]?.querySelector('button');void fixAlert(alert,button??undefined);}return;}
  if(event.altKey)return;
  if(event.key==='?'){event.preventDefault();shortcutsDialog.showModal();}
  if(event.key.toLowerCase()==='a'){event.preventDefault();focusSection('alerts-section');}
  if(event.key.toLowerCase()==='m'){event.preventDefault();focusSection('moments-section');}
  if(event.key.toLowerCase()==='o'){event.preventDefault();openSetup();}
});
for(const link of document.querySelectorAll('.nav-item[href]'))link.addEventListener('click',()=>{document.querySelector('.nav-item.active')?.classList.remove('active');link.classList.add('active');});
const bars=Array.from({length:32},()=>{const bar=make('i');el('rate-bars').append(bar);return bar;});
function tick(){const snapshot=activity.snapshot();el('rate-value').textContent=number.format(snapshot.rate);el('chatters-value').textContent=number.format(snapshot.users);const max=Math.max(1,...snapshot.bars);snapshot.bars.forEach((value,i)=>{bars[i]!.style.height=`${Math.max(2,value/max*30)}px`;});freshness();}
connect(event=>{
  if(event.type==='status'){status=event.data;showConnection();}if(event.type==='radar')showRadar(event.data);if(event.type==='chat')receiveChat(event.data);
  if(event.type==='moment'){moments.set(event.data.id,event.data);if(moments.size>1000){const oldest=[...moments.values()].sort((a,b)=>a.ts-b.ts)[0];if(oldest)moments.delete(oldest.id);}showMoments();}
  if(event.type==='alert'){alerts.set(event.data.id,event.data);showAlerts();}
  if(event.type==='alert_cleared'){alerts.delete(event.data.id);showAlerts();clearNotice(event.data.acknowledgement);}
  if(event.type==='command_reply')showReply(event.data);
},value=>{connected=value;showConnection();freshness();},()=>{alerts.clear();showAlerts();replyIds.clear();replyList.replaceChildren();el('reply-count').textContent='0';el('commands-empty').hidden=false;});
updateOverlay();setInterval(tick,1000);tick();
