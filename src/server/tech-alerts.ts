import { TechAlerts } from '../analysis/tech-alerts.js';
import type { AlertCleared } from '../types.js';
import type { Pipeline } from './pipeline.js';
export class TechAlertService {
  readonly detector:TechAlerts;
  private unsubscribe:()=>void;
  constructor(private pipeline:Pipeline,private acknowledge?:(text:string)=>Promise<boolean>,detector=new TechAlerts()) {
    this.detector=detector;
    this.unsubscribe=pipeline.onEvent(event=>{
      if (event.type==='chat') for (const alert of this.detector.ingest(event.data)) pipeline.publish({type:'alert',data:alert});
    });
  }
  clear(id:string):AlertCleared|undefined {
    const alert=this.detector.clear(id);if (!alert) return;
    const cleared:AlertCleared={id:alert.id,category:alert.category,sim:alert.sim,ts:Date.now(),acknowledgement:alert.sim?'local_only':this.acknowledge?'pending':'unavailable'};
    this.pipeline.publish({type:'alert_cleared',data:cleared});
    if (!alert.sim && this.acknowledge) {
      void Promise.resolve().then(()=>this.acknowledge!('✅ Stream issue marked fixed. Thanks for the heads-up, chat!'))
        .then(sent=>this.pipeline.publish({type:'alert_cleared',data:{...cleared,acknowledgement:sent?'sent':'unavailable'}}))
        .catch(()=>this.pipeline.publish({type:'alert_cleared',data:{...cleared,acknowledgement:'failed'}}));
    }
    return cleared;
  }
  close() {this.unsubscribe();}
}
