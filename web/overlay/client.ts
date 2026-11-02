import {connect} from '../shared/connection.js';
import {MomentNotices,momentLabel,overlayOptions,type Alert,type Radar,type Moment,type Status} from '../shared/model.js';
import {TopicList} from '../shared/topics.js';
const el=(id:string)=>document.getElementById(id)!;
const options=overlayOptions(location.search),panel=el('radar-panel'),banner=el('alert-banner'),toast=el('moment-toast');
document.body.classList.toggle('compact',options.compact);document.body.dataset.position=options.position;
const topics=new TopicList(el('topics'),options.compact?83:101,options.compact?3:5),alerts=new Map<string,Alert>(),notices=new MomentNotices();
let radar:Radar|undefined,status:Status|undefined,connected=false,toastTimer:ReturnType<typeof setTimeout>|undefined;
function layout(){
  const availableHeight=innerHeight-(banner.hidden?145:210)-32;
  const scale=Math.min(options.scale,availableHeight/Math.max(1,panel.offsetHeight),(innerWidth-64)/(options.compact?390:450));
  document.body.style.setProperty('--overlay-scale',String(Math.max(.25,scale)));
}
function showAlerts(){
  const sorted=[...alerts.values()].sort((a,b)=>Number(a.sim)-Number(b.sim)||b.ts-a.ts),alert=sorted[0];
  banner.hidden=!alert;document.body.classList.toggle('has-alert',!!alert);
  if(alert){el('alert-title').textContent=alert.title;el('alert-source').textContent=alert.sim?'SIMULATED CHAT SIGNAL':'CHAT SIGNAL';el('alert-count').textContent=`${alert.uniqueUsers} people reported this${sorted.length>1?` · +${sorted.length-1} other alert${sorted.length>2?'s':''}`:''}`;}
  layout();
}
function connection(){
  const source=radar?.sim?'SIM':status?.connected?'TWITCH':status?.sim?'SIM':'OFFLINE';
  el('source-badge').textContent=connected?source:'RECONNECTING';el('source-badge').classList.toggle('sim',source==='SIM');
  document.body.classList.toggle('disconnected',!connected||(!status?.connected&&!status?.sim));
  el('connection-label').textContent=!connected?'Connection lost':status?.sim?'Local simulation':status?.connected?'Chat connected':'Twitch disconnected';
}
function showRadar(value:Radar){
  radar=value;topics.render(value.topics);el('empty-radar').hidden=!!value.topics.length;el('mood-section').hidden=value.ts===null;
  el('mood-label').textContent=value.mood.label;el('mood-position').style.left=`${(Math.max(-1,Math.min(1,value.mood.score))+1)*50}%`;
  el('empty-radar').querySelector('strong')!.textContent=value.status==='disabled'?'Radar is not configured':value.status==='error'?'Radar is unavailable':'Listening to chat';
  el('empty-radar').querySelector('p')!.textContent=value.status==='disabled'?'Finish model setup in the dashboard.':value.status==='error'?'Keeping chat connected. Waiting to retry.':'Topics will appear as the conversation builds.';
  connection();freshness();layout();
}
function freshness(){el('radar-freshness').textContent=!connected?'Last received topics':!radar?.ts?'Waiting for chat':radar.status==='stale'||Date.now()-radar.ts>30_000?'Last available topics':`Updated ${Math.max(0,Math.round((Date.now()-radar.ts)/1000))}s ago`;}
function showMoment(moment:Moment){
  if(!notices.accept(moment))return;
  toast.hidden=false;toast.classList.toggle('sim',moment.sim);
  el('moment-state').textContent=moment.sim?'SIMULATION · HYPE MOMENT':momentLabel(moment).toUpperCase();el('moment-title').textContent=moment.title;
  el('moment-detail').textContent=moment.sim?`${moment.peakRate} messages/s · Local marker`:`${moment.peakRate} messages/s · ${moment.clipStatus==='ready'?'Twitch clip ready':moment.clipStatus==='pending'?'Creating a Twitch clip…':'Moment kept in your dashboard'}`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},10_000);
}
connect(event=>{
  if(event.type==='status'){status=event.data;connection();}if(event.type==='radar')showRadar(event.data);
  if(event.type==='alert'){alerts.set(event.data.id,event.data);showAlerts();}if(event.type==='alert_cleared'){alerts.delete(event.data.id);showAlerts();}if(event.type==='moment')showMoment(event.data);
},value=>{connected=value;connection();freshness();},()=>{alerts.clear();showAlerts();});
window.addEventListener('resize',layout);document.fonts.ready.then(layout);setInterval(freshness,1000);layout();
