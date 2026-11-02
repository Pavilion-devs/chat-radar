import type { Pipeline } from '../server/pipeline.js';
import type { SimulationStatus } from '../types.js';
import { prepareScenario } from './scenario.js';
import { Replay } from './replay.js';
export class SimulationController {
  private replay?: Replay;
  constructor(private pipeline: Pipeline) {}
  get status():SimulationStatus|undefined {return this.replay?.status;}
  start(value:unknown,speed=1,rate?:number) {
    if (this.status?.state==='running') throw new Error('A simulation is already running');
    const prepared=prepareScenario(value,speed,rate);
    this.replay=new Replay(prepared.scenario,prepared.speed,message=>this.pipeline.ingest(message),state=>{
      this.pipeline.setStatus({sim:state.state==='running',simulation:state});
    });
    this.replay.start();return this.replay.status;
  }
  stop() {this.replay?.stop();return this.status;}
}
