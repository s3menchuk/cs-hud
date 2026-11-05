import test from 'node:test';
import assert from 'node:assert/strict';
import { worldToRadar, radarLayer, playerNumber, renderRadar, shortestAngle, sampleMotion, sampleBufferedMotion, advanceRadarClock, radarBufferDelay, clipGrenadeTrail, smoothRadarMotion } from '../public/radar.js';
import { radarMaps } from '../public/radar-data.js';
import { vector, normalizeGsi, demo, defaults } from '../lib.mjs';

test('Radar projects world origin, Y inversion and image center',()=>{
  const map=radarMaps.de_dust2;
  assert.deepEqual(worldToRadar([map.posX,map.posY,0],map),{x:0,y:0});
  assert.deepEqual(worldToRadar([map.posX+map.scale*512,map.posY-map.scale*512,0],map),{x:512,y:512});
  assert.equal(worldToRadar([map.posX-1,map.posY,0],map),null);
  assert.equal(worldToRadar(null,map),null);
  assert.equal(worldToRadar([NaN,0,0],map),null);
});
test('Nuke and Vertigo switch floors at calibrated height boundary',()=>{
  for(const id of ['de_nuke','de_vertigo']){
    const map=radarMaps[id],lower=map.layers.find(l=>l.name==='lower');
    assert.equal(radarLayer(map,lower.AltitudeMax-1).name,'lower');
    assert.equal(radarLayer(map,lower.AltitudeMax).name,'default');
    assert.equal(radarLayer(map,undefined).name,'default');
  }
});
test('GSI preserves valid coordinates and rejects missing or malformed vectors',()=>{
  assert.deepEqual(vector('-123.5, 200, -40'),[-123.5,200,-40]);
  for(const value of [null,'','1,2','1,,3','1,2,Infinity',[0,null,0]])assert.equal(vector(value),null);
  const state=normalizeGsi({map:{name:'workshop/123/de_dust2'},bomb:{state:'planted',position:'100, 200, 300'},allplayers:{one:{team:'CT',position:'-500,1200,-10',forward:'0,1,0'}}});
  assert.equal(state.mapId,'de_dust2');assert.deepEqual(state.players[0].position,[-500,1200,-10]);assert.deepEqual(state.bombPosition,[100,200,300]);
});
test('Radar numbers stay unique when GSI omits observer slots',()=>{
  const players=Array.from({length:10},(_,i)=>({id:String(i),slot:0,team:i%2===0?'CT':'T'}));
  assert.deepEqual(players.map(p=>playerNumber(p,players)),[1,6,2,7,3,8,4,9,5,0]);
  assert.deepEqual(players.map(p=>playerNumber(p,players,'T')),[6,1,7,2,8,3,9,4,0,5]);
  const d=demo();assert.deepEqual(d.players.map(p=>playerNumber(p,d.players)),[1,2,3,4,5,6,7,8,9,0]);
});
test('Radar renders demo, missing coordinates and unsupported maps honestly',()=>{
  const d=demo();const rendered=renderRadar(d,defaults);
  assert.ok(rendered.includes('de_ancient_radar'));assert.ok(rendered.includes('radar-observed'));assert.ok(!rendered.includes('ОЖИДАНИЕ КООРДИНАТ'));
  assert.equal(renderRadar(d,{...defaults,showRadar:false}),'');
  assert.ok(renderRadar({...d,mapId:'workshop_unknown'},defaults).includes('пока нет плана'));
  assert.ok(renderRadar({...d,players:d.players.map(p=>({...p,position:null}))},defaults).includes('ОЖИДАНИЕ КООРДИНАТ'));
});

test('Radar interpolates position between packets and stops at the last sample',()=>{
  const track={fromX:100,fromY:200,x:200,y:400,fromAngle:0,angle:90,start:1000,duration:100};
  assert.deepEqual(sampleMotion(track,950),{x:100,y:200,angle:0});
  assert.deepEqual(sampleMotion(track,1050),{x:150,y:300,angle:45});
  assert.deepEqual(sampleMotion(track,2000),{x:200,y:400,angle:90});
  assert.deepEqual(sampleMotion({...track,duration:0},1000),{x:200,y:400,angle:90});
});
test('Radar turns across angle wrap by the shortest path and retargets without jumping',()=>{
  assert.equal(shortestAngle(359,1),2);assert.equal(shortestAngle(1,359),-2);
  const previous={fromX:100,fromY:200,x:200,y:300,fromAngle:359,angle:1,start:0,duration:100};
  const displayed=sampleMotion(previous,50);
  assert.deepEqual(displayed,{x:150,y:250,angle:360});
  const next={fromX:displayed.x,fromY:displayed.y,fromAngle:displayed.angle,x:300,y:400,angle:2,start:50,duration:100};
  assert.deepEqual(sampleMotion(next,50),displayed);
  assert.equal(sampleMotion(next,100).angle,361);
});

test('C4 carrier follows inventory and ownership, and clears on death or planting completion',()=>{
  const d=demo(),position=d.players[5].position;
  const packet=(bomb,weapons,health=100)=>normalizeGsi({map:{name:'de_ancient'},bomb,allplayers:{carrier:{name:'Carrier',team:'T',position,state:{health},weapons},other:{team:'T',position,state:{health:100}}}});
  for(const state of [packet({state:'carried'},{c4:{name:'weapon_c4',state:'holstered'}}),packet({state:'carried',player:'carrier'},{}),packet({state:'planting',player:'carrier'},{})]){
    assert.equal(state.players[0].hasBomb,true);
    assert.equal(state.players[1].hasBomb,false);
    const html=renderRadar(state,defaults);
    assert.equal((html.match(/class="radar-carrier-ring"/g)||[]).length,1);
    assert.ok(html.includes(' · C4'));
    for(const bombState of ['planted','defusing','dropped','defused','exploded'])assert.ok(!renderRadar({...state,bombState},defaults).includes('class="radar-carrier-ring"'));
  }
  assert.equal(packet({state:'carried'},{c4:{name:'weapon_c4'}},0).players[0].hasBomb,false);
  assert.ok(!renderRadar(packet({state:'dropped'},{}),defaults).includes('class="radar-carrier-ring"'));
});

test('Radar playback clock remains continuous when the jitter buffer changes',()=>{
 let playhead=1000;
 for(const delay of [140,400,140,300,160]){
  const next=advanceRadarClock(playhead,16,1200,delay);
  assert.ok(next-playhead>=13.6-1e-9&&next-playhead<=18.4+1e-9);
  playhead=next;
 }
 assert.equal(advanceRadarClock(1000,0,1400,140),1000);
 assert.ok(advanceRadarClock(1000,1000,2000,140)-1000<=57.5);
 assert.equal(radarBufferDelay([100,100,100,250,100]),290);
 assert.equal(radarBufferDelay([10,10]),140);
 assert.equal(radarBufferDelay([900]),400);
});

test('Buffered motion interpolates uneven packet arrivals without overshooting',()=>{
 const samples=[{x:0,y:0,angle:359,time:0},{x:100,y:50,angle:1,time:100},{x:200,y:100,angle:3,time:260}];
 const sampled=sampleBufferedMotion(samples,180);
 assert.deepEqual(sampled,{x:150,y:75,angle:2});
 assert.equal(sampleBufferedMotion(samples,1000).x,200);
 assert.equal(sampleBufferedMotion(samples,-10).x,0);
});

test('Grenade trails follow the timed segment through crossings and stop at the marker',()=>{
 const points=[{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}];
 assert.equal(clipGrenadeTrail(points,{x:50,y:50},{x:100,y:0}),'M0.00 0.00 L100.00 100.00 L0.00 100.00 L50.00 50.00');
 assert.equal(clipGrenadeTrail(points,{x:50,y:50},{x:100,y:100}),'M0.00 0.00 L50.00 50.00');
 assert.equal(clipGrenadeTrail(points,{x:0,y:0},{x:0,y:0}),'');
});

test('Radar aligns visible map bounds to the top left without changing world projection',()=>{
 const state=demo(),layer=radarMaps.de_ancient.layers[0];
 assert.deepEqual(layer.bounds,[127,77,746,860]);
 const html=renderRadar(state,defaults);
 assert.ok(html.includes('viewBox="127 77 746 860" preserveAspectRatio="xMinYMin meet"'));
 assert.ok(html.includes('<image href="'+layer.image+'" width="1024" height="1024"'));
 for(const map of Object.values(radarMaps))for(const layer of map.layers){
  const [x,y,w,h]=layer.bounds;
  assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1024&&y+h<=1024);
 }
});

test('Player smoothing preserves position and velocity across changed packet targets',()=>{
 let current={x:0,y:0,angle:359,vx:0,vy:0,va:0};
 const target={x:100,y:50,angle:1};
 const unchanged=smoothRadarMotion(current,target,0);
 assert.equal(unchanged.x,0);assert.equal(unchanged.angle,359);
 current=smoothRadarMotion(current,target,16);
 assert.ok(current.x>0&&current.x<10);assert.ok(current.vx>0);
 const previous=current;
 current=smoothRadarMotion(current,{x:200,y:100,angle:2},0);
 assert.equal(current.x,previous.x);assert.equal(current.vx,previous.vx);
 for(let i=0;i<100;i++)current=smoothRadarMotion(current,target,16);
 assert.ok(Math.abs(current.x-100)<.01);assert.ok(Math.abs(current.y-50)<.01);
 assert.ok(Math.abs(shortestAngle(current.angle,1))<.01);
});
