import type {Event} from './model.js';
export function connect(onEvent:(event:Event)=>void,onConnection:(connected:boolean)=>void,onReset:()=>void=()=>{}){
  let socket:WebSocket|undefined,stopped=false,retry=1000,timer:ReturnType<typeof setTimeout>|undefined;
  function open(){
    if(stopped)return;
    socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
    socket.onopen=()=>{retry=1000;onReset();onConnection(true);};
    socket.onmessage=message=>{try{const event=JSON.parse(message.data) as Event;onEvent(event);}catch{ /* Ignore malformed data; the next snapshot recovers state. */ }};
    socket.onclose=()=>{onConnection(false);if(!stopped){timer=setTimeout(open,retry);retry=Math.min(10_000,retry*2);}};
    socket.onerror=()=>socket?.close();
  }
  open();
  window.addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);socket?.close();},{once:true});
}
