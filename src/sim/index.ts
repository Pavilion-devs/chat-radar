import { readConfig } from '../config.js';
import { loadScenario, localServer, options } from './cli.js';
import type { SimulationStatus } from '../types.js';
let origin:string|undefined;
let runId:string|undefined;
async function stop() {
  if (origin && runId) await fetch(`${origin}/sim/stop`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId}),signal:AbortSignal.timeout(3000)}).catch(()=>{});
  process.exitCode=130;
}
let interrupted=false;
for (const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>{interrupted=true;void stop();});
try {
  const opts=options(process.argv.slice(2));
  if (opts.help) console.log('Usage: npm run sim -- --scenario scenarios/demo.json [--speed 1] [--rate 40] [--server http://localhost:3000]');
  else {
    const prepared=await loadScenario(opts.scenario,opts.speed,opts.rate);
    origin=localServer(opts.server || `http://localhost:${readConfig().port}`);
    const response=await fetch(`${origin}/sim/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(prepared),signal:AbortSignal.timeout(5000)});
    if (!response.ok) throw new Error(`Simulator rejected (${response.status}): ${await response.text()}`);
    const initial=await response.json() as SimulationStatus;runId=initial.runId;
    console.log(`Replaying ${initial.scenario} into the local pipeline (${initial.total} messages).`);
    let lastPhase='';
    while (!interrupted) {
      const poll=await fetch(`${origin}/sim/status`,{signal:AbortSignal.timeout(5000)});
      if (!poll.ok) throw new Error('Cannot read simulator status');
      const state=await poll.json() as SimulationStatus;
      if (state.runId!==runId) throw new Error('Simulation was replaced');
      if (state.phase!==lastPhase) {console.log(`Phase: ${state.phase} · ${state.rate} messages/s`);lastPhase=state.phase;}
      if (state.state!=='running') {console.log(`${state.state}: ${state.sent}/${state.total} local messages`);break;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if (interrupted) await stop();
  }
} catch (error) {
  console.error(error instanceof Error && error.message.startsWith('fetch failed') ? 'Cannot reach the local server. Start npm run dev first, or use npm run demo.' : error instanceof Error ? error.message:'Simulator failed');
  await stop();process.exitCode=1;
}
