import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGsi, demo } from '../lib.mjs';

test('GSI maps player equipment, stats, observer and team scores',()=>{
  const result=normalizeGsi({map:{name:'de_ancient',round:21,team_ct:{score:12},team_t:{score:9}},player:{steamid:'observer',spectarget:'p1'},phase_countdowns:{phase:'bomb',phase_ends_in:'32.5'},bomb:{state:'planted'},allplayers:{p1:{name:'Player',team:'CT',observer_slot:1,state:{health:42,armor:87,helmet:true,defusekit:true,money:1450},match_stats:{kills:20,deaths:11,assists:3},weapons:{a:{name:'weapon_m4a1_silencer',type:'Rifle',state:'active',ammo_clip:12,ammo_reserve:80},b:{name:'weapon_flashbang',type:'Grenade',ammo_reserve:2}}}}});
  assert.equal(result.observed,'p1');assert.equal(result.round,22);assert.equal(result.scoreCT,12);assert.equal(result.bomb,true);assert.equal(result.seconds,32.5);
  const p=result.players[0];assert.equal(p.weapon,'M4A1-S');assert.equal(p.kit,true);assert.equal(p.health,42);assert.equal(p.armor,87);assert.equal(p.kills,20);assert.equal(p.ammo,12);assert.deepEqual(p.grenades,['flash','flash']);
});
test('GSI tolerates missing observer-only fields without demo data',()=>{
  const result=normalizeGsi({map:{name:'de_mirage'},player:{steamid:'1'}});
  assert.equal(result.map,'MIRAGE');assert.deepEqual(result.players,[]);assert.equal(result.mode,'live');assert.equal(result.seconds,0);
});
test('Demo contains two full teams and a valid observed player',()=>{
  const state=demo();assert.equal(state.players.filter(p=>p.team==='CT').length,5);assert.equal(state.players.filter(p=>p.team==='T').length,5);assert.ok(state.players.some(p=>p.id===state.observed));
});
