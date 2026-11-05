import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGsi, demo, createDeathPositionTracker } from '../lib.mjs';

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

test('GSI preserves magazine reserve counts and distinguishes missing ammo from an empty magazine',()=>{
  const result=normalizeGsi({map:{name:'de_mirage'},allplayers:{
    rifle:{team:'CT',weapons:{gun:{name:'weapon_ak47',type:'Rifle',state:'active',ammo_clip:24,ammo_clip_max:30,ammo_reserve:3}}},
    empty:{team:'T',weapons:{gun:{name:'weapon_glock',type:'Pistol',state:'active',ammo_clip:0,ammo_clip_max:20,ammo_reserve:0}}},
    knife:{team:'T',weapons:{knife:{name:'weapon_knife',type:'Knife',state:'active'}}},
  }});
  const rifle=result.players.find(p=>p.id==='rifle'),empty=result.players.find(p=>p.id==='empty'),knife=result.players.find(p=>p.id==='knife');
  assert.equal(rifle.ammo,24);assert.equal(rifle.ammoClipMax,30);assert.equal(rifle.reserve,3);assert.equal(rifle.reserveUnit,'magazines');
  assert.equal(empty.ammo,0);assert.equal(empty.reserve,0);assert.equal(knife.ammo,null);assert.equal(knife.reserve,null);
});

test('Roster weapon prioritizes primary, pistol and knife independently of active equipment',()=>{
  const rifle={name:'weapon_ak47',type:'Rifle',ammo_clip:24};
  const pistol={name:'weapon_glock',type:'Pistol',ammo_clip:12};
  const knife={name:'weapon_knife',type:'Knife'};
  const grenade={name:'weapon_smokegrenade',type:'Grenade',state:'active'};
  const normalize=weapons=>normalizeGsi({allplayers:{one:{weapons:Object.fromEntries(weapons.map((w,i)=>[i,w]))}}}).players[0];
  for(const [inventory,expected] of [
    [[knife,pistol,rifle,grenade],'AK-47'],
    [[knife,{...pistol,state:'active'},rifle],'AK-47'],
    [[{...knife,state:'active'},pistol],'GLOCK'],
    [[knife,grenade],'KNIFE'],
    [[grenade],'—'],
  ])assert.equal(normalize(inventory).primaryWeapon,expected);
  const p=normalize([rifle,{...pistol,state:'active'}]);
  assert.equal(p.weapon,'GLOCK');assert.equal(p.ammo,12);
  for(const type of ['SniperRifle','Submachine Gun','Machine Gun','Shotgun'])assert.equal(normalize([pistol,{name:'weapon_awp',type}]).primaryWeapon,'AWP');
});

test('Round kill stars use round statistics, reset next round and survive player death',()=>{
 const player=(roundKills,health=100)=>normalizeGsi({allplayers:{one:{state:{health,round_kills:roundKills},match_stats:{kills:24}}}}).players[0];
 assert.equal(player(3).roundKills,3);
 assert.equal(player(3,0).roundKills,3);
 assert.equal(player(0).roundKills,0);
 for(const value of [undefined,null,-1,1.5,'3'])assert.equal(player(value).roundKills,0);
 assert.equal(player(3).kills,24);
});

test('Death markers stay at the first death position until revival or a new round',()=>{
 const tracker=createDeathPositionTracker();
 const state=(health,position,round=1,mapId='de_ancient',updated=1000)=>({mode:'live',mapId,round,updated,players:[{id:'one',health,position}]});
 tracker.update(state(100,[10,20,30]));
 const death=tracker.update(state(0,[15,25,35]));
 assert.deepEqual(death.players[0].position,[15,25,35]);
 assert.deepEqual(tracker.update(state(0,[500,600,-300])).players[0].position,[15,25,35]);
 assert.deepEqual(tracker.update(state(0,null)).players[0].position,[15,25,35]);
 assert.deepEqual(death.players[0].position,[15,25,35]);
 tracker.update(state(100,[40,50,60]));
 assert.deepEqual(tracker.update(state(0,null)).players[0].position,[40,50,60]);
 assert.deepEqual(tracker.update(state(0,[70,80,90],2)).players[0].position,[70,80,90]);
 assert.deepEqual(tracker.update(state(0,[100,110,120],2,'de_mirage')).players[0].position,[100,110,120]);
 assert.deepEqual(tracker.update(state(0,[130,140,150],2,'de_mirage',500)).players[0].position,[130,140,150]);
});
