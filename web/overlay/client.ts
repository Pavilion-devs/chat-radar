import {connect} from '../shared/connection.js';
import {Activity,MomentNotices,momentLabel,type Alert,type Radar,type Moment,type Status} from '../shared/model.js';
import {RadarView} from './radar-view.js';
import {CalmState} from './state.js';
const el=(id:string)=>document.getElementById(id)!;
const params=new URLSearchParams(location.search),panel=el('radar-panel'),banner=el('alert-banner'),toast=el('moment-toast');
const topics=new RadarView(el('topics')),alerts=new Map<string,Alert>(),notices=new MomentNotices(),calm=new CalmState();
const activity=new Activity();
let radar:Radar|undefined,status:Status|undefined,connected=false,toastTimer:ReturnType<typeof setTimeout>|undefined,reviewHeld=false;
const bg=params.get('bg');if(bg==='bright'||bg==='dark')document.body.dataset.bg=bg;
function layout(){document.body.style.setProperty('--canvas-scale',String(Math.min(innerWidth/1920,innerHeight/1080)));}
function showAlerts(){
  const sorted=[...alerts.values()].sort((a,b)=>Number(a.sim)-Number(b.sim)||b.ts-a.ts),alert=sorted[0];banner.hidden=!alert;
  if(alert){el('alert-title').textContent=alert.title;el('alert-source').textContent=alert.sim?'SIMULATED CHAT SIGNAL':'CHAT SIGNAL';el('alert-count').textContent=`${alert.uniqueUsers} people reported this${sorted.length>1?` · +${sorted.length-1} more`:''}`;}
}
function connection(){
  const sim=!!(radar?.sim||status?.sim),active=connected&&(sim||!!status?.connected);
  el('source-badge').textContent=sim?'Local':active?'LIVE':connected?'Offline':'Reconnecting';el('sim-badge').hidden=!sim;
  el('source-badge').parentElement!.dataset.live=String(active&&!sim);panel.dataset.connected=String(connected);
  state();
}
function state(){const next=calm.state(radar);if(next!=='topics'&&panel.dataset.state!==next)topics.finish();panel.dataset.state=next;el('radar-content').hidden=next!=='topics';
  el('pill-label').textContent=!connected&&!reviewHeld?'Reconnecting…':radar?.status==='disabled'?'Set up radar':radar?.status==='error'&&!radar.topics.length?'Radar unavailable':next==='quiet'?'· quiet':'Reading chat…';
}
function showRadar(value:Radar,animate=true){
  const was=radar;radar=value;
  if(value.topics.some(topic=>!was?.topics.some(previous=>previous.id===topic.id)))calm.newTopics();state();
  const moving=animate&&calm.state(value)==='topics';
  const rendering=topics.render(value.topics,moving);topics.moodLine(value,moving);connection();return rendering;
}
function showMoment(moment:Moment){
  if(!notices.accept(moment))return;toast.hidden=false;toast.classList.toggle('sim',moment.sim);
  el('moment-state').textContent=moment.sim?'SIMULATION · HYPE MOMENT':momentLabel(moment).toUpperCase();el('moment-title').textContent=moment.title;
  el('moment-detail').textContent=moment.sim?`${moment.peakRate} messages/s · Local marker`:`${moment.peakRate} messages/s · ${moment.clipStatus==='ready'?'Twitch clip ready':moment.clipStatus==='pending'?'Creating a Twitch clip…':'Moment kept in your dashboard'}`;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},10_000);
}
connect(event=>{
  if(event.type==='status'){status=event.data;if(!reviewHeld){calm.updateRate(status.simulation?.state==='running'?status.simulation.rate:activity.snapshot().rate);connection();}}
  if(event.type==='radar'&&!reviewHeld)showRadar(event.data);
  if(event.type==='chat'&&!reviewHeld)activity.add(event.data);
  if(event.type==='alert'){alerts.set(event.data.id,event.data);showAlerts();}if(event.type==='alert_cleared'){alerts.delete(event.data.id);showAlerts();}if(event.type==='moment')showMoment(event.data);
},value=>{connected=value;if(!reviewHeld)connection();},()=>{alerts.clear();showAlerts();});
// Receipt-time buckets ignore reconnect history; simulator status provides its
// authoritative rate. No new server event fields are needed.
const idleTimer=setInterval(()=>{if(reviewHeld)return;calm.updateRate(status?.simulation?.state==='running'?status.simulation.rate:activity.snapshot().rate);state();},1000);
window.addEventListener('resize',layout);void document.fonts.ready.then(()=>{layout();if(radar)showRadar(radar,false);});layout();
window.addEventListener('pagehide',()=>{clearInterval(idleTimer);clearTimeout(toastTimer);topics.dispose();},{once:true});
if(params.has('review'))void import('../dev/overlay-review.js').then(({installReview})=>installReview({
  show:(value,animate)=>{reviewHeld=true;connected=true;return showRadar(value,animate);},
  state:(mode)=>{reviewHeld=true;connected=true;calm.updateRate(2,0);calm.updateRate(0,0);if(mode==='quiet')calm.updateRate(0,60_001);radar=mode==='reading'?undefined:radar;state();el('sim-badge').hidden=false;},
  finish:()=>topics.finish(),resume:()=>{reviewHeld=false;connection();},
}));
