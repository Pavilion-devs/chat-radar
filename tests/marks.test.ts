import {expect,it} from 'vitest';
import {markGeometry,markKinds} from '../web/shared/marks.js';
import {contrastRatio,overlayContrastThreshold} from '../web/shared/contrast.js';
it('regenerates every mark identically for the same seed and changes it for another topic',()=>{
  for(const kind of markKinds){
    const options=kind==='tally'?{count:850,unit:50}:{};
    const first=markGeometry(kind,'topic-a',options);
    expect(markGeometry(kind,'topic-a',options)).toEqual(first);
    expect(markGeometry(kind,'topic-b',options).parts.map(part=>part.d)).not.toEqual(first.parts.map(part=>part.d));
    for(const part of first.parts){
      expect(part.d.endsWith('Z')).toBe(true);expect(part.d).not.toMatch(/NaN|Infinity/);
      expect(Math.max(...part.widths)-Math.min(...part.widths)).toBeGreaterThan(.1);
      expect(part.outline.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.x<=first.width&&point.y>=0&&point.y<=first.height)).toBe(true);
    }
  }
});
it('keeps existing tally paths fixed when adding a line or a fifth-mark slash',()=>{
  const four=markGeometry('tally','same-topic',{count:200,unit:50}),five=markGeometry('tally','same-topic',{count:250,unit:50}),six=markGeometry('tally','same-topic',{count:300,unit:50});
  expect(five.parts.slice(0,4)).toEqual(four.parts);expect(six.parts.slice(0,5)).toEqual(five.parts);
  const slash=five.parts[4]!;const points=slash.outline;
  expect(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))).toBeGreaterThan(30);
  expect(markGeometry('tally','same-topic',{count:49,unit:50}).parts).toHaveLength(0);
});
it('caps tallies at four groups while preserving the exact count and unit',()=>{
  const geometry=markGeometry('tally','busy-chat',{count:1284,unit:50});
  expect(geometry.parts).toHaveLength(20);expect(geometry.tally).toEqual({count:1284,unit:50,shown:20,capped:true});
  expect(markGeometry('tally','busy-chat',{count:1000,unit:50}).tally?.capped).toBe(false);
});
it('rejects invalid geometry, invalid tally units, and unreadably squeezed stamp text',()=>{
  expect(()=>markGeometry('circle','topic',{height:12})).toThrow(RangeError);
  expect(()=>markGeometry('highlighter','topic',{width:NaN})).toThrow(RangeError);
  expect(()=>markGeometry('tally','topic',{count:Infinity})).toThrow(RangeError);
  expect(()=>markGeometry('tally','topic',{count:10,unit:0})).toThrow(RangeError);
  expect(()=>markGeometry('stamp','topic',{label:'THIS STAMP LABEL IS MUCH TOO LONG'})).toThrow(RangeError);
});
it('keeps stamp distress and tape rotation seeded; stamp text remains separate readable type',()=>{
  const first=markGeometry('stamp','alarm-id',{label:'muted'}),fixed=markGeometry('stamp','alarm-id',{label:'fixed'});
  expect(first.text?.value).toBe('MUTED');expect(first.text!.size).toBeGreaterThanOrEqual(24);
  expect(first.parts).toEqual(fixed.parts);expect(first.texture).toEqual(fixed.texture);
  expect(first.texture!.split('Z').length).toBeGreaterThan(20);
  const tape=markGeometry('tape','clip-id');expect(Math.abs(tape.rotation)).toBeGreaterThanOrEqual(1);expect(Math.abs(tape.rotation)).toBeLessThanOrEqual(2);
});
it('gives the marker a drifting centerline, tapered ends and two separate pigment streaks',()=>{
  for(let seed=0;seed<50;seed++){
    const mark=markGeometry('highlighter',`marker-${seed}`),body=mark.parts[0]!;
    const ys=body.centerline!.map(point=>point.y),widths=body.widths;
    expect(Math.max(...ys)-Math.min(...ys)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...ys)-Math.min(...ys)).toBeLessThanOrEqual(3);
    expect(widths[0]).toBeLessThan(widths[20]!*.7);
    expect(widths.at(-1)).toBeLessThan(widths[20]!*.7);
    expect(mark.pigment!.streaks).toHaveLength(2);
    expect(mark.pigment!.cutout).toContain(mark.pigment!.streaks[0]);
  }
});
it('protects the entire circle text box across seeds, with a heavy downstroke and lifted overshoot',()=>{
  for(let seed=0;seed<200;seed++){
    const circle=markGeometry('circle',`circle-${seed}`,{width:440,height:132,contentWidth:310,contentHeight:35,clearance:10}),box=circle.protection!,loop=circle.parts[0]!;
    expect(circle.overshootDegrees).toBeGreaterThanOrEqual(15);
    expect(circle.overshootDegrees).toBeLessThanOrEqual(25);
    for(const point of loop.outline){
      const distance=Math.hypot(Math.max(box.left-point.x,0,point.x-box.right),Math.max(box.top-point.y,0,point.y-box.bottom));
      expect(distance).toBeGreaterThanOrEqual(10);
    }
    expect(Math.max(...loop.widths)).toBeGreaterThan(Math.min(...loop.widths)*5);
    expect(loop.widths.at(-1)).toBeLessThan(loop.widths[0]!*.5);
  }
  expect(()=>markGeometry('circle','tight',{width:320,height:60,contentWidth:310,contentHeight:35})).toThrow(RangeError);
});
it('tears both tape ends instead of leaving rectangular caps',()=>{
  const tape=markGeometry('tape','photo',{width:96,height:28}),outline=tape.parts[0]!.outline;
  const left=outline.filter(point=>point.x<10),right=outline.filter(point=>point.x>86);
  expect(new Set(left.map(point=>point.x)).size).toBeGreaterThan(5);
  expect(new Set(right.map(point=>point.x)).size).toBeGreaterThan(5);
});
it('uses the approved contrast thresholds without disguising forbidden paper-on-alarm text',()=>{
  expect(overlayContrastThreshold(20,700)).toBe(7);expect(overlayContrastThreshold(24,500)).toBe(7);expect(overlayContrastThreshold(24,700)).toBe(4.5);
  expect(contrastRatio('#A6A299','#0B0C0E')).toBeGreaterThanOrEqual(7);
  expect(contrastRatio('#0B0C0E','#FF4A3D')).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio('#F3EEE4','#FF4A3D')).toBeLessThan(4.5);
  // 72% marker pigment over ink: streaks also pass for labels fitted below 24px.
  expect(contrastRatio('#0B0C0E','#BB9F30')).toBeGreaterThanOrEqual(7);
});
