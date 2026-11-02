export const topicKey=(label:string)=>label.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
export function topicSimilarity(a:string,b:string){const first=new Set(topicKey(a).split(' ')),second=new Set(topicKey(b).split(' '));const shared=[...first].filter(word=>second.has(word)).length;return shared/(first.size+second.size-shared);}
