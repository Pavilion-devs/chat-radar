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
it('uses the approved contrast thresholds without disguising forbidden paper-on-alarm text',()=>{
  expect(overlayContrastThreshold(20,700)).toBe(7);expect(overlayContrastThreshold(24,500)).toBe(7);expect(overlayContrastThreshold(24,700)).toBe(4.5);
  expect(contrastRatio('#A6A299','#0B0C0E')).toBeGreaterThanOrEqual(7);
  expect(contrastRatio('#0B0C0E','#FF4A3D')).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio('#F3EEE4','#FF4A3D')).toBeLessThan(4.5);
});
