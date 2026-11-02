import express from 'express';
import { CommandService, type CommandServiceOptions } from './chat-commands.js';
import { HypeService, type HypeServiceOptions } from './hype.js';
import { TechAlertService } from './tech-alerts.js';
import { RadarService, type RadarOptions } from './topic-radar.js';
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import type { Config } from '../config.js';
import { SCOPES, type TwitchAuth } from '../twitch/auth.js';
import type { Pipeline } from './pipeline.js';
import { SimulationController } from '../sim/controller.js';
export function createApp(config:Config, auth:TwitchAuth, pipeline:Pipeline, connect:()=>Promise<void>, acknowledge?:(text:string)=>Promise<boolean>, radarOptions:RadarOptions={},hypeOptions:HypeServiceOptions={},commandOptions:CommandServiceOptions={}) {
  const app=express();
  app.disable('x-powered-by');
  app.use((_req,res,next)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws://localhost:*; style-src 'self'; frame-ancestors 'self'");
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');next();
  });
  const states=new Map<string,number>();
  pipeline.setStatus({channel:config.channel});
  let status=pipeline.status;
  const simulation=new SimulationController(pipeline);
  const techAlerts=new TechAlertService(pipeline,acknowledge);
  const radar=new RadarService(pipeline,radarOptions);
  const hype=new HypeService(pipeline,hypeOptions);
  const commands=new CommandService(pipeline,()=>radar.snapshot,()=>hype.list(),acknowledge,commandOptions);
  app.get('/health',(_req,res)=>res.json({ok:true, ...status}));
  // JSON-only CLI control on loopback. Browser origins are deliberately rejected.
  app.use('/sim',(req,res,next)=>{
    if (req.headers.origin || (req.socket.remoteAddress && !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))) {
      res.status(403).json({error:'Simulator control is local CLI only'});return;
    }
    next();
  },express.json({limit:'512kb'}));
  app.get('/sim/status',(_req,res)=>res.json(simulation.status || {state:'idle'}));
  app.post('/sim/run',(req,res)=>{
    if (!req.is('application/json')) {res.status(415).json({error:'JSON required'});return;}
    if (simulation.status?.state==='running') {res.status(409).json({error:'A simulation is already running'});return;}
    try {
      if (!req.body || typeof req.body!=='object') throw new Error('Expected simulation request');
      res.status(202).json(simulation.start(req.body.scenario,req.body.speed ?? 1,req.body.rate));
    } catch (error) {res.status(400).json({error:error instanceof Error ? error.message:'Invalid scenario'});}
  });
  app.post('/sim/stop',(req,res)=>{
    if (!req.is('application/json')) {res.status(415).json({error:'JSON required'});return;}
    if (!simulation.status || req.body?.runId!==simulation.status.runId) {res.status(409).json({error:'Run ID does not match'});return;}
    res.json(simulation.stop());
  });
  app.get('/commands/replies',(_req,res)=>res.json(commands.list()));
  app.post('/commands/preview',(req,res,next)=>{
    if(req.headers.origin&&req.headers.origin!==`http://localhost:${config.port}`){res.status(403).json({error:'Foreign origin rejected'});return;}
    if(!req.is('application/json')){res.status(415).json({error:'JSON required'});return;}next();
  },express.json({limit:'1kb'}),async(req,res)=>{
    const command=req.body?.command;
    if(command!=='!radar'&&command!=='!missed'){res.status(400).json({error:'Expected !radar or !missed'});return;}
    const reply=await commands.preview(command);
    if(!reply){res.status(429).json({error:'Command is on cooldown; wait before trying again'});return;}
    res.json(reply);
  });
  app.get('/moments',async(_req,res)=>{await hype.ready;res.json({moments:hype.list(),storageError:hype.storageError});});
  app.get('/radar',(_req,res)=>res.json(radar.snapshot));
  app.get('/alerts',(_req,res)=>res.json(techAlerts.detector.list()));
  app.post('/alerts/:id/clear',(req,res,next)=>{
    if (req.headers.origin && req.headers.origin!==`http://localhost:${config.port}`) {res.status(403).json({error:'Foreign origin rejected'});return;}
    if (!req.is('application/json')) {res.status(415).json({error:'JSON required'});return;}
    next();
  },express.json({limit:'1kb'}),(req,res)=>{
    const result=techAlerts.clear(req.params.id);
    if (!result) {res.status(404).json({error:'Alert is no longer active'});return;}
    res.json(result);
  });
  app.get('/auth/login',(_req,res)=>{
    if (!config.clientId || !config.clientSecret || !config.channel) {res.status(503).send('Set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET and TWITCH_CHANNEL in .env, then restart.');return;}
    for (const [state,expiry] of states) if (expiry<Date.now()) states.delete(state);
    if (states.size>=100) {res.status(429).send('Too many login attempts; wait a few minutes.');return;}
    const state=randomBytes(32).toString('hex');states.set(state,Date.now()+600_000);
    res.cookie('radar_oauth_state',state,{httpOnly:true,sameSite:'lax',maxAge:600_000,path:'/auth'});
    const params=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:SCOPES.join(' '),state,force_verify:'true'});
    res.redirect(`https://id.twitch.tv/oauth2/authorize?${params}`);
  });
  app.get('/auth/callback',async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const state=typeof req.query.state==='string'?req.query.state:'';
    const cookie=req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('radar_oauth_state='))?.slice('radar_oauth_state='.length) || '';
    const expires=states.get(state);states.delete(state);
    res.clearCookie('radar_oauth_state',{path:'/auth'});
    if (!expires || expires<Date.now() || !state || !/^[a-f0-9]{64}$/.test(cookie) || state.length!==cookie.length || !timingSafeEqual(Buffer.from(state),Buffer.from(cookie))) {res.status(400).send('Invalid or expired OAuth state. Start again at /auth/login.');return;}
    if (req.query.error || typeof req.query.code!=='string') {res.status(400).send('Twitch authorization declined. Start again at /auth/login.');return;}
    try { await auth.exchange(req.query.code);await connect();res.redirect('/dashboard/'); }
    catch {res.status(502).send('Could not connect Twitch. Check your app settings and retry /auth/login.');}
  });
  app.use('/dashboard',express.static(resolve('web/dashboard')));
  app.use('/overlay',express.static(resolve('web/overlay')));
  app.use('/shared',express.static(resolve('web/shared')));
  app.get('/',(_req,res)=>res.redirect('/dashboard/'));
  const server=createServer(app);
  const hub=new WebSocketServer({noServer:true,maxPayload:1024});
  server.on('upgrade',(req,socket,head)=>{
    const origin=req.headers.origin;
    if (req.url!=='/ws' || (origin && origin!==`http://localhost:${config.port}`)) {socket.destroy();return;}
    hub.handleUpgrade(req,socket,head,ws=>hub.emit('connection',ws));
  });
  hub.on('connection',ws=>{
    ws.on('error',()=>{});
    ws.send(JSON.stringify({type:'status',data:status}));
    ws.send(JSON.stringify({type:'radar',data:radar.snapshot}));
    for(const reply of commands.list())ws.send(JSON.stringify({type:'command_reply',data:reply}));
    for (const moment of hype.list().slice(0,100).reverse()) ws.send(JSON.stringify({type:'moment',data:moment}));
    for (const alert of techAlerts.detector.list()) ws.send(JSON.stringify({type:'alert',data:alert}));
    for (const message of pipeline.buffer.recent().slice(-100)) ws.send(JSON.stringify({type:'chat',data:message}));
  });
  const unsubscribe=pipeline.onEvent(event=>{
    if (event.type==='status') status=event.data;
    const data=JSON.stringify(event);
    for (const client of hub.clients) {
      if (client.bufferedAmount>1_000_000) {client.terminate();continue;}
      if (client.readyState===WebSocket.OPEN) client.send(data);
    }
  });
  return {app,server,simulation,techAlerts,radar,hype,commands,close:()=>{simulation.stop();commands.close();techAlerts.close();radar.close();void hype.close();unsubscribe();for(const client of hub.clients) client.terminate();hub.close();}};
}
