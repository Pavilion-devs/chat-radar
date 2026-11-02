import { randomUUID } from 'node:crypto';
import { ChatCommands, type ChatCommand } from '../commands/chat.js';
import { RadarHistory } from '../analysis/radar-history.js';
import { recapContext } from '../analysis/recap.js';
import type { RadarState } from '../analysis/radar-schema.js';
import type { StructuredLLMClient } from '../llm/types.js';
import type { CommandReply, ChatMessage, Moment } from '../types.js';
import type { Pipeline } from './pipeline.js';
export interface CommandServiceOptions {llm?:StructuredLLMClient;timeoutMs?:number;now?:()=>number}
export class CommandService {
  private history:RadarHistory;private engine:ChatCommands;private replies:CommandReply[]=[];
  private unsubscribe:()=>void;private closed=false;private simRun='';private simSince=-Infinity;
  private now:()=>number;
  constructor(private pipeline:Pipeline,radar:()=>RadarState,moments:()=>Moment[],private send?: (text:string)=>Promise<boolean>,options:CommandServiceOptions={}){
    this.now=options.now||Date.now;this.history=new RadarHistory(this.now);this.history.add(radar());
    this.engine=new ChatCommands({...options,context:sim=>recapContext(pipeline.buffer.recent(this.now()-600_000),this.history.recent(sim),moments(),this.now(),sim,sim?this.simSince:this.now()-600_000),radar:sim=>{
      const current=radar();return current.sim===sim&&current.ts!==null&&(!sim||current.ts>=this.simSince)?current:this.history.recent(sim).at(-1);
    }});
    this.unsubscribe=pipeline.onEvent(event=>{
      if(event.type==='radar')this.history.add(event.data);
      if(event.type==='status'&&event.data.simulation?.runId!==undefined&&event.data.simulation.runId!==this.simRun){this.simRun=event.data.simulation.runId;this.simSince=this.now();this.engine.reset(true);this.history.clear(true);}
      if(event.type==='chat'&&(event.data.sim||pipeline.status.connected))void this.handle(event.data);
    });
  }
  private async handle(message:ChatMessage):Promise<CommandReply|undefined>{
    const response=await this.engine.execute(message);if(!response||this.closed)return;
    let status:CommandReply['status']='preview';
    if(!message.sim){try{status=this.pipeline.status.connected&&await this.send?.(response.text)?'sent':'failed';}catch{status='failed';}}
    if(this.closed)return;
    const reply:CommandReply={...response,id:randomUUID(),user:message.user.login,ts:this.now(),sim:message.sim,status};
    this.replies.push(reply);if(this.replies.length>20)this.replies.shift();this.pipeline.publish({type:'command_reply',data:reply});return reply;
  }
  preview(command:ChatCommand){return this.handle({id:randomUUID(),text:command,user:{id:'local-preview',login:'demo_viewer',name:'Demo viewer'},ts:this.now(),badges:[],sim:true});}
  list(){return structuredClone(this.replies);}
  close(){this.closed=true;this.unsubscribe();this.engine.close();}
}
