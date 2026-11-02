import type { RadarOutput, StableTopic } from './radar-schema.js';
import {topicKey as key,topicSimilarity as similarity} from './topic-label.js';
export class TopicRadar {
  private sequence=0;
  merge(output:RadarOutput,previous:StableTopic[]):StableTopic[] {
    const result:StableTopic[]=[];const used=new Set<string>();
    for (const topic of output.topics) {
      const duplicate=result.find(t=>t.kind===topic.kind && (key(t.label)===key(topic.label) || similarity(t.label,topic.label)>=0.6));
      if (duplicate) {duplicate.count_estimate=duplicate.count_estimate+topic.count_estimate;continue;}
      const candidates=previous.filter(old=>!used.has(old.id) && old.kind===topic.kind);
      const old=(topic.kind==='reaction'?candidates[0]:undefined) || candidates.find(old=>key(old.label)===key(topic.label)) || candidates.find(old=>similarity(old.label,topic.label)>=0.6) ||
        candidates.find(old=>topic.examples.some(example=>example.length>=8 && old.examples.includes(example)));
      if (old) used.add(old.id);
      result.push({...topic,id:old?.id ?? `topic:${++this.sequence}`,label:topic.label,
        count_estimate:old ? Math.round(0.6*topic.count_estimate+0.4*old.count_estimate):topic.count_estimate,examples:[...topic.examples]});
    }
    return result.sort((a,b)=>Number(a.kind==='reaction')-Number(b.kind==='reaction')||b.count_estimate-a.count_estimate);
  }
}
