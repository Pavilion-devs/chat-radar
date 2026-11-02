import { randomUUID } from 'node:crypto';
import type { ChatMessage, SimulationStatus } from '../types.js';
import { messageCount, type Scenario } from './scenario.js';
// This module has no Twitch client or sending capability. Its only output is local data.
export class Replay {
  private timer?: ReturnType<typeof setTimeout>;
  private started=0;
  private index=0;
  private phaseSent=0;
  private phaseStart=0;
  private active=false;
  private runId=randomUUID();
  private sent=0;
  private lastProgress=0;
  private state: SimulationStatus;
  constructor(private scenario: Scenario, private speed: number,
    private ingest:(message:ChatMessage)=>void, private progress:(state:SimulationStatus)=>void, private now=Date.now) {
    this.state={speed:this.speed,runId:this.runId,scenario:scenario.name,state:'running',phase:scenario.phases[0]!.name,sent:0,total:messageCount(scenario),rate:scenario.phases[0]!.rate*speed};
  }
  get status() {return {...this.state};}
  start() {
    if (this.active || this.state.state!=='running' || this.sent) return;
    this.active=true;this.started=this.now();this.lastProgress=this.started;this.progress(this.status);this.tick();
  }
  stop() {
    if (!this.active) return;
    this.active=false;clearTimeout(this.timer);this.update('stopped');
  }
  private update(state: SimulationStatus['state']) {
    this.state={...this.state,state,sent:this.sent,rate:state==='running' ? this.scenario.phases[this.index]!.rate*this.speed:0};
    this.progress(this.status);
  }
  private tick=()=>{
    if (!this.active) return;
    const elapsed=(this.now()-this.started)*this.speed;
    let budget=250; // Yield between bounded batches after a delayed tick.
    while (this.index<this.scenario.phases.length && budget>0) {
      const phase=this.scenario.phases[this.index]!;
      const count=Math.floor(phase.durationSeconds*phase.rate);
      const target=Math.min(count,Math.floor(Math.max(0,elapsed-this.phaseStart)*phase.rate/1000)+1);
      while (this.phaseSent<target && budget-->0) {
        const user=this.phaseSent%phase.users;
        this.ingest({id:`sim:${this.runId}:${this.sent}`,user:{id:`sim:${this.runId}:${this.index}:${user}`,login:`sim_${this.index}_${user}`,name:`Sim viewer ${this.index+1}.${user+1}`},
          text:phase.messages[this.phaseSent%phase.messages.length]!,ts:this.now(),badges:[],sim:true});
        this.phaseSent++;this.sent++;
      }
      if (this.phaseSent<count || elapsed<this.phaseStart+phase.durationSeconds*1000) break;
      this.phaseStart+=phase.durationSeconds*1000;this.phaseSent=0;this.index++;
      if (this.index<this.scenario.phases.length) {
        this.state={...this.state,phase:this.scenario.phases[this.index]!.name};this.update('running');
      }
    }
    if (this.index===this.scenario.phases.length) {this.active=false;this.update('completed');return;}
    this.state={...this.state,sent:this.sent};
    if (this.now()-this.lastProgress>=1000) {this.lastProgress=this.now();this.update('running');}
    this.timer=setTimeout(this.tick,25);
  };
}
