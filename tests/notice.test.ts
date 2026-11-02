import {expect,it} from 'vitest';
import {bigJump,momentPresentation,thumbnailUrl} from '../web/overlay/notice-state.js';
import type {Moment,Radar} from '../web/shared/model.js';
import {arrowGeometry} from '../web/shared/marks.js';
const radar={topics:[{id:'one',label:'Next game?',kind:'question',count_estimate:200,examples:[],urgency:0}],ts:1000,sim:true,mood:{label:'curious',score:0},status:'ready',detail:'',sampledCount:40,windowCount:1000} satisfies Radar;
const moment={id:'m',ts:1000,title:'Chat demands a clip',titleSource:'llm',peakRate:400,uniqueChatters:200,sim:true,clipStatus:'marker',clipUrl:null,clipReason:'simulated',saved:true} satisfies Moment;
it('ties a big-jump note to the same topic and actual update interval, never to reactions or replacement topics',()=>{
 const next={...radar,ts:9000,topics:[{...radar.topics[0]!,count_estimate:450}]};expect(bigJump(radar,next)).toEqual({id:'one',delta:250,seconds:8});
 expect(bigJump(radar,{...next,topics:[{...next.topics[0]!,count_estimate:250}]})).toBeUndefined();
 expect(bigJump(radar,{...next,topics:[{...next.topics[0]!,id:'new'}]})).toBeUndefined();expect(bigJump(radar,{...next,topics:[{...next.topics[0]!,kind:'reaction'}]})).toBeUndefined();expect(bigJump(radar,{...next,sim:false})).toBeUndefined();
});
it('never gives SIM a thumbnail or a CLIPPED label, even with misleading fields in a payload',()=>{
 expect(momentPresentation({...moment,clipStatus:'ready',clipUrl:'https://clips.twitch.tv/Valid',thumbnailUrl:'https://clips-media-assets.twitch.tv/real.jpg'})).toEqual({state:'Moment marked',thumbnail:null,sim:true,clipped:false});
 expect(momentPresentation({...moment,sim:false,clipStatus:'pending'})).toBeNull();
 expect(momentPresentation({...moment,sim:false,clipStatus:'ready',clipUrl:'https://clips.twitch.tv/Valid',thumbnailUrl:'https://clips-media-assets.twitch.tv/real.jpg'})).toEqual({state:'Clip saved',thumbnail:'https://clips-media-assets.twitch.tv/real.jpg',sim:false,clipped:true});
 expect(momentPresentation({...moment,sim:false,clipStatus:'failed'})?.clipped).toBe(false);
 for(const value of ['javascript:alert(1)','https://twitch.tv.evil.invalid/photo','http://clips-media-assets.twitch.tv/photo','https://user:pass@static-cdn.jtvnw.net/photo'])expect(thumbnailUrl(value)).toBeNull();
});
it('seeds the curved margin annotation and keeps its pressure variation',()=>{const arrow=arrowGeometry('one');expect(arrowGeometry('one')).toEqual(arrow);expect(arrowGeometry('two')).not.toEqual(arrow);expect(new Set(arrow.parts[0]!.widths).size).toBeGreaterThan(1);});
