import type { ChatMessage, TechAlert } from '../types.js';
import { matchTechProblems, TECH_LABELS, type TechCategory } from './tech-rules.js';
interface Entry {id:string;at:number;user:string;text:string;matches:{category:TechCategory;generation:number}[]}
interface Stats {count:number;users:Map<string,number>;generation:number}
interface Window {entries:Entry[];head:number;seen:Set<string>;stats:Map<TechCategory,Stats>}
export interface TechOptions {windowMs:number;minUsers:number;minShare:number;cooldownMs:number;capacity:number}
const DEFAULTS:TechOptions={windowMs:30_000,minUsers:5,minShare:0.10,cooldownMs:60_000,capacity:100_000};
export class TechAlerts {
  private windows=new Map<boolean,Window>();
  private active=new Map<string,TechAlert>();
  private cooldown=new Map<string,number>();
  private sequence=0;
  private options:TechOptions;
  constructor(options:Partial<TechOptions>={},private now=Date.now) {
    this.options={...DEFAULTS,...options};
    const o=this.options;
    if (![o.windowMs,o.minUsers,o.minShare,o.cooldownMs,o.capacity].every(Number.isFinite) || o.windowMs<=0 || o.minUsers<1 || !Number.isInteger(o.minUsers) || o.minShare<=0 || o.minShare>1 || o.cooldownMs<0 || o.capacity<o.minUsers || !Number.isInteger(o.capacity)) throw new Error('Invalid tech alert thresholds');
  }
  private key(sim:boolean,category:TechCategory) {return `${sim?'sim':'real'}:${category}`;}
  private window(sim:boolean) {
    let window=this.windows.get(sim);
    if (!window) {window={entries:[],head:0,seen:new Set(),stats:new Map()};this.windows.set(sim,window);}
    return window;
  }
  private stats(window:Window,category:TechCategory) {
    let stats=window.stats.get(category);
    if (!stats) {stats={count:0,users:new Map(),generation:0};window.stats.set(category,stats);}
    return stats;
  }
  private remove(window:Window) {
    const entry=window.entries[window.head++]!;window.seen.delete(entry.id);
    for (const match of entry.matches) {
      const stats=this.stats(window,match.category);
      if (stats.generation!==match.generation) continue;
      stats.count--;const count=stats.users.get(entry.user)!-1;
      if (count) stats.users.set(entry.user,count);else stats.users.delete(entry.user);
    }
  }
  private prune(window:Window) {
    while (window.head<window.entries.length && window.entries[window.head]!.at<=this.now()-this.options.windowMs) this.remove(window);
    if (window.head>=4096 && window.head>=window.entries.length/2) {window.entries=window.entries.slice(window.head);window.head=0;}
  }
  ingest(message:ChatMessage):TechAlert[] {
    const window=this.window(message.sim);this.prune(window);
    if (window.seen.has(message.id)) return [];
    if (window.entries.length-window.head>=this.options.capacity) this.remove(window);
    const matches=matchTechProblems(message.text).map(category=>{
      const stats=this.stats(window,category);stats.count++;stats.users.set(message.user.id,(stats.users.get(message.user.id)||0)+1);
      return {category,generation:stats.generation};
    });
    window.entries.push({id:message.id,at:this.now(),user:message.user.id,text:message.text,matches});window.seen.add(message.id);
    const total=window.entries.length-window.head;
    const fired:TechAlert[]=[];
    for (const {category} of matches) {
      const key=this.key(message.sim,category);const stats=this.stats(window,category);
      if (this.active.has(key) || this.now()<(this.cooldown.get(key) ?? 0) || stats.users.size<this.options.minUsers || stats.count/total<this.options.minShare) continue;
      const sample:string[]=[];
      for (let i=window.entries.length-1;i>=window.head && sample.length<3;i--) {
        const entry=window.entries[i]!;
        if (entry.matches.some(m=>m.category===category && m.generation===stats.generation) && !sample.includes(entry.text)) sample.push(entry.text);
      }
      const alert:TechAlert={id:`tech:${++this.sequence}`,category,title:TECH_LABELS[category],count:stats.count,uniqueUsers:stats.users.size,share:stats.count/total,sample,ts:this.now(),sim:message.sim};
      this.active.set(key,alert);this.cooldown.set(key,this.now()+this.options.cooldownMs);fired.push(alert);
    }
    return fired;
  }
  list():TechAlert[] {return [...this.active.values()].map(alert=>({...alert,sample:[...alert.sample]}));}
  clear(id:string):TechAlert|undefined {
    const alert=[...this.active.values()].find(a=>a.id===id);
    if (!alert) return;
    const key=this.key(alert.sim,alert.category);this.active.delete(key);this.cooldown.set(key,this.now()+this.options.cooldownMs);
    const window=this.window(alert.sim);this.prune(window);
    const stats=this.stats(window,alert.category);stats.count=0;stats.users.clear();stats.generation++;
    return {...alert,sample:[...alert.sample]};
  }
}
