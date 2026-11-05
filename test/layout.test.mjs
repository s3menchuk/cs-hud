import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultLayout, validateLayout, resolveLayout, constrainPart, layoutParts, layoutForSettings, hudViewport, viewportPosition } from '../public/layout.js';

test('Default layout matches the 1920x1080 broadcast canvas',()=>{
  const layout=defaultLayout();assert.deepEqual(validateLayout(layout),layout);
  for(const [id,p] of Object.entries(layout.elements)){
    assert.ok(p.x>=0&&p.y>=0);assert.ok(p.x+layoutParts[id].width<=1920);assert.ok(p.y+layoutParts[id].height<=1080);
  }
  assert.deepEqual(resolveLayout(null),layout);
});
test('Dragging and scaling keep elements within the canvas',()=>{
  const part=constrainPart('scoreboard',{x:1900,y:1070,scale:1.5,opacity:1,visible:true});
  assert.equal(part.x,870);assert.equal(part.y,945);
  assert.equal(constrainPart('focus',{...part,x:-20,y:-50,scale:.1}).scale,.5);
  assert.equal(constrainPart('focus',{...part,x:-20,y:-50}).x,0);
});
test('Layout validation rejects executable CSS, invalid fonts, missing parts and nonfinite values',()=>{
  for(const mutate of [
    l=>l.theme.panel='url(https://example.com)',
    l=>l.theme.font='custom-font;display:none',
    l=>l.theme.backgroundOpacity=2,
    l=>l.elements.radar.scale=Infinity,
    l=>l.elements.focus.opacity=.1,
    l=>delete l.elements.scoreboard,
    l=>l.version=2,
  ]){const layout=defaultLayout();mutate(layout);assert.throws(()=>validateLayout(layout));}
});
test('Layout normalization does not mutate imported data or accept arbitrary element selectors',()=>{
  const layout=defaultLayout();layout.elements.scoreboard.x=1900;layout.elements['body']={x:0};
  const result=validateLayout(layout);assert.equal(result.elements.scoreboard.x,1220);assert.equal(layout.elements.scoreboard.x,1900);
  assert.equal(result.elements.body,undefined);
});
test('Editor inherits existing visibility preferences until an explicit layout is saved',()=>{
  assert.equal(layoutForSettings({showRadar:false}).elements.radar.visible,false);
  assert.equal(layoutForSettings({showFocus:false}).elements.focus.visible,false);
  const layout=defaultLayout();
  assert.equal(layoutForSettings({showRadar:false,layout}).elements.radar.visible,true);
});

test('4:3, 5:4 and ultrawide overlays keep parts attached to viewport edges without distortion',()=>{
 const layout=defaultLayout();
 for(const [width,height] of [[1920,1080],[1440,1080],[1280,1024],[2560,1080],[960,540]]){
  const viewport=hudViewport(width,height),scale=viewport.scale;
  const left=viewportPosition('leftRoster',layout.elements.leftRoster,viewport.width,viewport.height);
  const right=viewportPosition('rightRoster',layout.elements.rightRoster,viewport.width,viewport.height);
  const radar=viewportPosition('radar',layout.elements.radar,viewport.width,viewport.height);
  const score=viewportPosition('scoreboard',layout.elements.scoreboard,viewport.width,viewport.height);
  const focus=viewportPosition('focus',layout.elements.focus,viewport.width,viewport.height);
  assert.ok(Math.abs(height-(left.y+432)*scale-8*scale)<1e-6);
  assert.ok(Math.abs(width-(right.x+333)*scale-8*scale)<1e-6);
  assert.equal(left.x,8);assert.deepEqual(radar,{x:8,y:8});
  assert.ok(Math.abs((score.x+350)*scale-width/2)<1e-6);
  assert.ok(Math.abs((focus.x+245)*scale-width/2)<1e-6);
 }
});
