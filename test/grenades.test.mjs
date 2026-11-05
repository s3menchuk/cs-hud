import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGsi,createGrenadeTracker,defaults} from '../lib.mjs';
import {renderRadar} from '../public/radar.js';
import {radarMaps} from '../public/radar-data.js';

const map=radarMaps.de_ancient;
const position=(x,y,z=0)=>[map.posX+x*map.scale,map.posY-y*map.scale,z];
const packet=(grenades,round=0,mapName='de_ancient')=>normalizeGsi({map:{name:mapName,round},grenades,allplayers:{one:{name:'Thrower',team:'CT',state:{health:100},position:position(400,400)}}});
const grenade=(x,y,extra={})=>({type:'frag',position:position(x,y).join(', '),owner:'one',velocity:'200, 300, 100',lifetime:'0.2',...extra});

test('GSI normalizes projectile types, coordinates, ownership and effect state',()=>{
 const state=packet({he:grenade(400,400),smoke:grenade(300,300,{type:'smoke',effecttime:'4.1'}),flash:grenade(200,200,{type:'flashbang'}),fire:grenade(200,300,{type:'molotov'}),decoy:grenade(300,200,{type:'decoy'}),bad:grenade(0,0,{position:'1,,3'}),unknown:grenade(0,0,{type:'unknown'}),inferno:{type:'inferno',flames:{a:'0,0,0'}},nil:null});
 assert.deepEqual(state.grenades.map(g=>g.type),['he','smoke','flash','fire','decoy','fire']);
 assert.deepEqual(state.grenades[0].position,position(400,400));
 assert.deepEqual(state.grenades[0].velocity,[200,300,100]);
 assert.equal(state.grenades[0].owner,'one');assert.equal(state.grenades[1].effectTime,4.1);
 assert.deepEqual(packet(undefined).grenades,[]);
});

test('Measured trails advance, avoid duplicate points and do not mutate earlier snapshots',()=>{
 const tracker=createGrenadeTracker();
 const first=tracker.update(packet({a:grenade(200,200)}));
 const next=tracker.update(packet({a:grenade(220,230,{lifetime:'.3'})}));
 assert.equal(first.grenades[0].trajectory.length,1);
 assert.deepEqual(next.grenades[0].trajectory,[position(200,200),position(220,230)]);
 assert.equal(tracker.update(packet({a:grenade(220,230,{lifetime:'.4'})})).grenades[0].trajectory.length,2);
 assert.ok(renderRadar(next,defaults).includes('class="radar-grenade-trail radar-left"'));
 assert.ok(renderRadar(next,defaults).includes('data-radar-id="grenade-a"'));
});

test('Trails reset on removal, reused projectile IDs, new rounds, map changes and stale packets',()=>{
 const tracker=createGrenadeTracker();
 tracker.update(packet({a:grenade(100,100,{lifetime:'1'})}));
 assert.equal(tracker.update(packet({a:grenade(200,200,{lifetime:'.1'})})).grenades[0].trajectory.length,1);
 tracker.update(packet({}));
 assert.equal(tracker.update(packet({a:grenade(300,300)})).grenades[0].trajectory.length,1);
 assert.equal(tracker.update(packet({a:grenade(400,400)},1)).grenades[0].trajectory.length,1);
 assert.equal(tracker.update(packet({a:grenade(500,500)},1,'de_mirage')).grenades[0].trajectory.length,1);
 const state=packet({a:grenade(600,600)},1,'de_mirage');state.updated+=3000;
 assert.equal(tracker.update(state).grenades[0].trajectory.length,1);
});

test('Grenade rendering hides spent smoke trails and splits paths between floors',()=>{
 const state=packet({a:grenade(400,400,{type:'smoke',effecttime:'1'})});
 state.grenades[0].trajectory=[position(200,200),position(400,400)];
 let html=renderRadar(state,defaults);
 assert.ok(html.includes('radar-grenade-active'));assert.ok(!html.includes('class="radar-grenade-trail '));
 state.grenades[0].effectTime=0;html=renderRadar(state,defaults);
 assert.ok(html.includes('class="radar-grenade-trail '));
 const nuke=radarMaps.de_nuke,lower=nuke.layers.find(l=>l.name==='lower');
 const point=(x,z)=>[nuke.posX+x*nuke.scale,nuke.posY-400*nuke.scale,z];
 const low=lower.AltitudeMax-10,high=lower.AltitudeMax+10;
 const layers={...state,mapId:'de_nuke',players:[],grenades:[{...state.grenades[0],position:point(500,high),trajectory:[point(100,high),point(200,low),point(300,high),point(400,high)]}]};
 html=renderRadar(layers,defaults);
 assert.ok(html.includes('d="M100.00 400.00 M300.00 400.00 L400.00 400.00 '));
});

test('HE and flash icons and paths disappear in the first detonation packet',()=>{
 for(const type of ['frag','flashbang']){
  const tracker=createGrenadeTracker();
  tracker.update(packet({a:grenade(200,200,{type,lifetime:'.1'})}));
  const flying=tracker.update(packet({a:grenade(300,300,{type,lifetime:'.2'})}));
  assert.ok(renderRadar(flying,defaults).includes('data-radar-id="grenade-a"'));
  assert.ok(renderRadar(flying,defaults).includes('class="radar-grenade-trail '));
  const exploded=packet({a:grenade(300,300,{type,lifetime:'.3',effecttime:'.01'})});
  exploded.grenades[0].trajectory=flying.grenades[0].trajectory;
  const html=renderRadar(exploded,defaults);
  assert.ok(!html.includes('data-radar-id="grenade-a"'));
  assert.ok(!html.includes('class="radar-grenade-trail '));
  assert.deepEqual(tracker.update(exploded).grenades,[]);
  assert.deepEqual(tracker.update(packet({a:grenade(300,300,{type,lifetime:'.4',effecttime:'.1'})})).grenades,[]);
  tracker.update(packet({}));
  const reused=tracker.update(packet({a:grenade(400,400,{type,lifetime:'.1'})}));
  assert.equal(reused.grenades[0].trajectory.length,1);
 }
});

test('Frozen HE entities disappear after the fuse even when GSI retains them without effecttime',()=>{
 const tracker=createGrenadeTracker();
 const state=(lifetime,velocity='0, 0, 0')=>packet({he:grenade(300,300,{lifetime:String(lifetime),velocity})});
 const live=tracker.update(state(1.5));assert.equal(live.grenades.length,1);
 const moving=tracker.update(state(1.6,'100, 0, 0'));assert.equal(moving.grenades.length,1);
 const exploded=state(1.6);assert.equal(exploded.grenades[0].detonated,true);
 assert.ok(!renderRadar(exploded,defaults).includes('data-radar-id="grenade-he"'));
 assert.deepEqual(tracker.update(exploded).grenades,[]);
 assert.deepEqual(tracker.update(state(5.9)).grenades,[]);
 const smoke=packet({smoke:grenade(300,300,{type:'smoke',lifetime:'5.9',velocity:'0, 0, 0'})});
 assert.equal(tracker.update(smoke).grenades.length,1);
});

test('Firebomb, Molotov and incendiary projectiles render measured flight paths',()=>{
 for(const type of ['firebomb','molotov','incendiary','incgrenade']){
  const tracker=createGrenadeTracker();
  tracker.update(packet({fire:grenade(200,200,{type,lifetime:'.1'})}));
  const flying=tracker.update(packet({fire:grenade(300,300,{type,lifetime:'.2'})}));
  assert.equal(flying.grenades[0].type,'fire');assert.equal(flying.grenades[0].active,false);
  const html=renderRadar(flying,defaults);
  assert.ok(html.includes('data-radar-id="grenade-fire"'));
  assert.ok(html.includes('grenade-fire '));
  assert.ok(html.includes('data-trail-id="grenade-fire"'));
 }
});

test('Inferno flames supply the fire marker position without an invented flight path',()=>{
 const state=packet({fire:{type:'inferno',owner:'one',lifetime:'2',flames:{a:position(200,200).join(','),b:position(400,400).join(','),invalid:'1,,3'}}});
 assert.equal(state.grenades.length,1);
 assert.deepEqual(state.grenades[0].position,position(300,300));
 assert.equal(state.grenades[0].active,true);
 state.grenades[0].trajectory=[position(100,100),position(300,300)];
 const html=renderRadar(state,defaults);
 assert.ok(html.includes('radar-grenade-active'));assert.ok(html.includes('data-radar-id="grenade-fire"'));
 assert.ok(!html.includes('data-trail-id="grenade-fire"'));
 assert.deepEqual(packet({bad:{type:'inferno',flames:{a:'invalid'}}}).grenades,[]);
});
