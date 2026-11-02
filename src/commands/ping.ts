import type { ChatMessage } from '../types.js';
export function createPing(sendChat:(text:string)=>Promise<void>, onError:()=>void, now=Date.now) {
  const users = new Map<string,number>();
  let lastGlobal = -Infinity;
  return (message:ChatMessage) => {
    if (message.sim || message.text.trim().toLowerCase() !== '!ping') return;
    const ts=now();
    if (ts-lastGlobal < 3000 || ts-(users.get(message.user.id) ?? -Infinity) < 10_000) return;
    for (const [id,at] of users) if (ts-at >= 10_000) users.delete(id);
    users.set(message.user.id,ts); lastGlobal=ts;
    void sendChat(`@${message.user.login} pong!`).catch(onError);
  };
}
