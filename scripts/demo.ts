import { spawn } from 'node:child_process';
console.log('Chat Radar demo: local simulated chat. Twitch authorization is not required.');
const child=spawn(process.execPath,['--import','tsx','src/index.ts','--demo',...process.argv.slice(2)],{stdio:'inherit'});
process.once('SIGINT',()=>child.kill('SIGINT'));
process.once('SIGTERM',()=>child.kill('SIGTERM'));
child.once('error',()=>{console.error('Could not start demo server');process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code ?? 0;});
