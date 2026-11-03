import test from 'node:test';
import assert from 'node:assert/strict';
import { worldToRadar, radarLayer, playerNumber, renderRadar, shortestAngle, sampleMotion } from '../public/radar.js';
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
