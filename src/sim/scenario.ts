export interface Phase { name: string; durationSeconds: number; rate: number; users: number; messages: string[] }
export interface Scenario { name: string; phases: Phase[] }
function object(value: unknown): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a scenario object');
  return value as Record<string,unknown>;
}
function number(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
  return value;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) throw new Error('Invalid scenario text');
  return value;
}
export function parseScenario(value: unknown): Scenario {
  const input=object(value);
  if (!Array.isArray(input.phases) || !input.phases.length || input.phases.length>50) throw new Error('Expected 1–50 phases');
  const phases=input.phases.map(value=>{
    const p=object(value);
    if (!Array.isArray(p.messages) || !p.messages.length || p.messages.length>100) throw new Error('Expected 1–100 messages per phase');
    const users=number(p.users,1,10_000,'users');
    if (!Number.isInteger(users)) throw new Error('users must be an integer');
    const phase={name:text(p.name,80),durationSeconds:number(p.durationSeconds,0.1,600,'durationSeconds'),rate:number(p.rate,1,1000,'rate'),users,messages:p.messages.map(m=>text(m,500))};
    if (Math.floor(phase.durationSeconds*phase.rate)<1) throw new Error('Each phase must emit at least one message');
    return phase;
  });
  if (phases.reduce((sum,p)=>sum+p.durationSeconds,0)>900 || phases.reduce((sum,p)=>sum+Math.floor(p.durationSeconds*p.rate),0)>100_000) throw new Error('Scenario exceeds 15 minutes or 100,000 messages');
  return {name:text(input.name,80),phases};
}
export function prepareScenario(value: unknown, speed=1, rate?: number): {scenario: Scenario; speed: number} {
  number(speed,0.1,20,'speed');
  const original=parseScenario(value);
  const scenario=rate===undefined ? original : parseScenario({...original,phases:original.phases.map(p=>({...p,rate:number(rate,1,1000,'rate')}))});
  if (scenario.phases.some(p=>p.rate*speed>5000)) throw new Error('Effective rate cannot exceed 5000 messages/s; lower speed or rate');
  return {scenario,speed};
}
export function messageCount(scenario: Scenario) {return scenario.phases.reduce((sum,p)=>sum+Math.floor(p.durationSeconds*p.rate),0);}
