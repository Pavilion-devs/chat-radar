export class ChatSender {
  private queue: {text:string;resolve:()=>void;reject:(error:Error)=>void}[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private stopped = false;
  private nextAt = 0;
  constructor(private send:(text:string)=>Promise<void>, private intervalMs=1600, private now=Date.now) {}
  sendChat(text:string):Promise<void> {
    if (this.stopped) return Promise.reject(new Error('Chat sender stopped'));
    if (!text.trim() || Array.from(text).length > 500 || /[\r\n]/.test(text)) return Promise.reject(new Error('Chat must be 1–500 characters on one line'));
    if (this.queue.length >= 20) return Promise.reject(new Error('Chat send queue full'));
    return new Promise((resolve,reject) => {this.queue.push({text,resolve,reject}); this.pump();});
  }
  private pump() {
    if (this.running || this.timer || this.stopped || !this.queue.length) return;
    const wait = this.nextAt-this.now();
    if (wait > 0) {this.timer=setTimeout(()=>{this.timer=undefined;this.pump();},wait); return;}
    const job = this.queue.shift()!;
    this.running=true;
    this.nextAt=this.now()+this.intervalMs;
    void this.send(job.text).then(job.resolve,()=>{
      // Back off after errors (including 429); do not retry ambiguous POSTs.
      this.nextAt=Math.max(this.nextAt,this.now()+30_000);
      job.reject(new Error('Chat send failed; check Twitch connection or channel restrictions'));
    }).finally(()=>{this.running=false;this.pump();});
  }
  stop() {
    this.stopped=true;
    clearTimeout(this.timer);
    for (const job of this.queue.splice(0)) job.reject(new Error('Chat sender stopped'));
  }
}
