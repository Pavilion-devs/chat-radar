import { LLMRadarClient } from './llm/radar-client.js';
import { MomentStore } from './server/moments.js';
import { TwitchClipper } from './twitch/clips.js';
import { createLLMClient } from './llm/index.js';
import { PROVIDERS } from './llm/types.js';
import { readConfig } from './config.js';
import { TwitchAuth } from './twitch/auth.js';
import { TwitchApi } from './twitch/api.js';
import { EventSub } from './twitch/eventsub.js';
import { ChatSender } from './twitch/send-chat.js';
import { Pipeline, normalize } from './server/pipeline.js';
import { createApp } from './server/app.js';
import { createPing } from './commands/ping.js';
import { loadScenario, options } from './sim/cli.js';
const demo=process.argv.includes('--demo');
const demoOptions=demo ? options(process.argv.slice(2).filter(arg=>arg!=='--demo')):undefined;
const demoScenario=demoOptions ? await loadScenario(demoOptions.scenario,demoOptions.speed,demoOptions.rate):undefined;
const config=readConfig();
const auth=new TwitchAuth(config);
const api=new TwitchApi(config.clientId,auth);
const pipeline=new Pipeline();
const llm=createLLMClient(config.llm);
let clipper:TwitchClipper|undefined;
let eventsub:EventSub|undefined;
let sender:ChatSender|undefined;
let removePing:(()=>void)|undefined;
let validating=false;
let lastValidation=Date.now();
let connecting:Promise<void>|undefined;
let shuttingDown=false;
function status(connected:boolean,detail:string) {pipeline.setStatus({connected,detail,channel:config.channel});}
function disconnect() {clipper=undefined;eventsub?.stop();sender?.stop();removePing?.();}
function connect():Promise<void> {
  if (shuttingDown) return Promise.resolve();
  if (connecting) return connecting;
  connecting=(async()=>{
    disconnect();status(false,'Connecting Twitch');
    try {
      const identity=await auth.validate();
      lastValidation=Date.now();
      const broadcasterId=await api.userId(config.channel);
      if (shuttingDown) return;
      clipper=new TwitchClipper(api,broadcasterId,identity.scopes);
      sender=new ChatSender(text=>api.send(broadcasterId,identity.user_id,text));
      const ping=createPing(text=>sender!.sendChat(text),()=>console.warn('Could not send !ping reply'));
      removePing=pipeline.onEvent(event=>{if(event.type==='chat') ping(event.data);});
      eventsub=new EventSub(id=>api.subscribe(id,broadcasterId,identity.user_id),(event,ts)=>pipeline.ingest(normalize(event,ts)),status);
      eventsub.start();
    } catch {disconnect();status(false,'Twitch connection failed; check .env and reconnect at /auth/login');throw new Error('Twitch connection failed');}
  })().finally(()=>{connecting=undefined;});
  return connecting;
}
const {server,close,simulation}=createApp(config,auth,pipeline,connect,async text=>{
  if (!pipeline.status.connected || !sender) return false;
  await sender.sendChat(text);return true;
},{client:llm?new LLMRadarClient(llm):undefined,timeoutMs:config.llmTimeoutMs,disabledDetail:`Set ${PROVIDERS[config.llm.provider].keyEnv} to enable topic radar`},{llm,store:new MomentStore('data/moments.json'),timeoutMs:config.llmTimeoutMs,clip:signal=>pipeline.status.connected && clipper?clipper.create(signal):Promise.resolve({status:'marker',reason:'not_connected'})},{llm,timeoutMs:config.llmTimeoutMs});
server.listen(config.port,'localhost',()=>{
  console.log(`Chat Radar: http://localhost:${config.port}/dashboard/`);
  if (demoScenario) {
    status(false,'Local demo; Twitch is not connected');
    let phase='';
    pipeline.onEvent(event=>{
      if (event.type==='status' && event.data.simulation && event.data.simulation.phase!==phase) {
        phase=event.data.simulation.phase;console.log(`SIM: ${phase}`);
      }
    });
    simulation.start(demoScenario.scenario,demoScenario.speed);
    return;
  }
  void auth.load().then(loaded=>{if(loaded) return connect();}).catch(()=>status(false,'Saved Twitch authorization failed; reconnect at /auth/login'));
});
server.on('error',()=>{console.error('Server could not start; check PORT');process.exitCode=1;shutdown();});
// Twitch requires validation on startup and hourly while a session is in use.
const validationTimer=setInterval(()=>{
  if (!eventsub || validating || connecting) return;
  validating=true;
  void (async()=>{
    await auth.accessToken();
    if(Date.now()-lastValidation >= 60*60_000) {await auth.validate();lastValidation=Date.now();}
  })().catch(()=>{disconnect();eventsub=undefined;status(false,'Twitch authorization expired or revoked; reconnect at /auth/login');}).finally(()=>{validating=false;});
},60_000);
function shutdown() {shuttingDown=true;clearInterval(validationTimer);disconnect();close();server.close();}
process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
