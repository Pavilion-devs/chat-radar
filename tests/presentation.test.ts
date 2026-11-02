import {expect,it} from 'vitest';
import {Activity,MomentNotices,clipUrl,momentLabel,overlayOptions,type Chat,type Moment} from '../web/shared/model.js';
const moment=(patch:Partial<Moment>={}):Moment=>({id:'moment',ts:100_000,title:'A great moment',titleSource:'llm',peakRate:400,uniqueChatters:200,sim:false,clipStatus:'pending',clipUrl:null,clipReason:null,saved:true,...patch});
it('bounds overlay parameters and falls back safely for malformed inputs',()=>{
  expect(overlayOptions('?layout=compact&position=left&scale=1.2')).toEqual({compact:true,position:'left',scale:1.2});
  expect(overlayOptions('?scale=Infinity&position=other')).toEqual({compact:false,position:'right',scale:1});
  expect(overlayOptions('?scale=99').scale).toBe(1.5);expect(overlayOptions('?scale=0.1').scale).toBe(.65);expect(overlayOptions('?scale=-1').scale).toBe(1);
});
it('never labels simulated or invalid clip URLs as real clips',()=>{
  const url='https://www.twitch.tv/viewer/clip/Actual-Clip';
  expect(momentLabel(moment({sim:true,clipStatus:'ready',clipUrl:url}))).toBe('Simulated moment');
  expect(momentLabel(moment({clipStatus:'ready',clipUrl:'https://evil.invalid/clip'}))).toBe('Moment saved');
  expect(momentLabel(moment({clipStatus:'ready',clipUrl:url}))).toBe('Clipped');
  for(const invalid of ['javascript:alert(1)','https://twitch.tv.evil.invalid/clip/a','https://user:secret@clips.twitch.tv/a','https://www.twitch.tv/settings'])expect(clipUrl(invalid)).toBeNull();
});
it('restores moment snapshots without replaying old toasts, including on reconnect',()=>{
  const notices=new MomentNotices();
  expect(notices.accept(moment(),200_000)).toBe(false);
  expect(notices.accept(moment({clipStatus:'ready',clipUrl:'https://clips.twitch.tv/a'}),201_000)).toBe(false);
  expect(notices.accept(moment({id:'new',ts:200_000}),201_000)).toBe(true);
  expect(notices.accept(moment({id:'new',ts:200_000}),202_000)).toBe(false);
});
it('updates a fresh pending toast when its clip completes once, without replaying save-only changes',()=>{
  const notices=new MomentNotices(),pending=moment();
  expect(notices.accept(pending,100_000)).toBe(true);
  expect(notices.accept({...pending,saved:false},100_100)).toBe(false);
  const ready={...pending,clipStatus:'ready',clipUrl:'https://clips.twitch.tv/Published'};
  expect(notices.accept(ready,130_000)).toBe(true);expect(notices.accept(ready,130_100)).toBe(false);
  expect(notices.accept({...ready,title:'Late update'},250_000)).toBe(false);
});
it('keeps chat rate stable across snapshot replay and drops buffered history',()=>{
  const activity=new Activity(),chat:Chat={id:'one',user:{id:'u',login:'viewer',name:'Viewer'},text:'hello',ts:100_000,sim:false};
  activity.add(chat,100_000);activity.add(chat,100_010);
  activity.add({...chat,id:'old',ts:90_000},100_000);
  activity.add({...chat,id:'two',sim:true},100_000);
  expect(activity.snapshot(101_000)).toMatchObject({rate:2,users:2});
  expect(activity.snapshot(112_000)).toMatchObject({rate:0,users:0});
  expect(activity.snapshot(200_000).bars.every(value=>value===0)).toBe(true);
});
