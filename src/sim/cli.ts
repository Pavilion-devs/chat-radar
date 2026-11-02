import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { prepareScenario } from './scenario.js';
export function options(args:string[]) {
  const {values}=parseArgs({args,options:{scenario:{type:'string',default:'scenarios/demo.json'},speed:{type:'string',default:'1'},rate:{type:'string'},server:{type:'string'},help:{type:'boolean',short:'h'}}});
  return {scenario:values.scenario!,speed:Number(values.speed),rate:values.rate===undefined ? undefined:Number(values.rate),server:values.server,help:values.help};
}
export async function loadScenario(path:string,speed:number,rate?:number) {
  const file=await readFile(path,'utf8');
  if (Buffer.byteLength(file)>512_000) throw new Error('Scenario file is too large');
  return prepareScenario(JSON.parse(file) as unknown,speed,rate);
}
export function localServer(value:string) {
  const url=new URL(value);
  if (url.protocol!=='http:' || url.hostname!=='localhost' || url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw new Error('--server must be an http://localhost:PORT URL');
  return url.origin;
}
