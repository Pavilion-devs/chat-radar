import type { RadarOutput, StableTopic } from './radar-schema.js';
const key=(label:string)=>label.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
function similarity(a:string,b:string) {
  const first=new Set(key(a).split(' '));const second=new Set(key(b).split(' '));
  const shared=[...first].filter(word=>second.has(word)).length;
  return shared/(first.size+second.size-shared);
}
export class TopicRadar {
  private sequence=0;
  merge(output:RadarOutput,previous:StableTopic[]):StableTopic[] {
    const result:StableTopic[]=[];const used=new Set<string>();
    for (const topic of output.topics) {
      const duplicate=result.find(t=>t.kind===topic.kind && (key(t.label)===key(topic.label) || similarity(t.label,topic.label)>=0.6));
      if (duplicate) {duplicate.count_estimate=Math.max(duplicate.count_estimate,topic.count_estimate);continue;}
      const candidates=previous.filter(old=>!used.has(old.id) && old.kind===topic.kind);
      const old=candidates.find(old=>key(old.label)===key(topic.label)) || candidates.find(old=>similarity(old.label,topic.label)>=0.6) ||
        candidates.find(old=>topic.examples.some(example=>example.length>=8 && old.examples.includes(example)));
      if (old) used.add(old.id);
      result.push({...topic,id:old?.id ?? `topic:${++this.sequence}`,label:old?.label ?? topic.label,
        count_estimate:old ? Math.round(0.6*topic.count_estimate+0.4*old.count_estimate):topic.count_estimate,examples:[...topic.examples]});
    }
    return result.sort((a,b)=>b.count_estimate-a.count_estimate);
  }
}
