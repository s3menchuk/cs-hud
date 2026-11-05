import { seriesDefaults } from './public/series.js';
export const demoSeries={seriesFormat:5,currentMap:4,seriesMaps:[
  {map:'Mirage',leftScore:8,rightScore:13,completed:true},
  {map:'Nuke',leftScore:13,rightScore:10,completed:true},
  {map:'Dust2',leftScore:11,rightScore:13,completed:true},
  {map:'Ancient',leftScore:null,rightScore:null,completed:false},
  {map:'Inferno',leftScore:null,rightScore:null,completed:false},
]};
export const defaults = { event: 'COUNTER-STRIKE 2', stage: 'SHOWMATCH · BEST OF 5', leftName: 'FALCONS', rightName: 'TEAM SPIRIT', leftTag: 'FAL', rightTag: 'TS', leftLogo: '', rightLogo: '', leftSide: 'CT', accentLeft: '#78d5f5', accentRight: '#edc67a', showEquipment: true, showFocus: true, showRadar: true, playerAvatars:{}, layout:null, ...seriesDefaults, ...demoSeries };
export function vector(value) {
  const values=Array.isArray(value)?value:typeof value==='string'?value.split(','):null;
  if(!values||values.length!==3||values.some(v=>v===null||String(v).trim()===''))return null;
  const numbers=values.map(Number);
  return numbers.every(Number.isFinite)?numbers:null;
}
export function demo() {
  const names = ['NiKo','m0NESY','kyousuke','TeSeS','karrigan','donk','sh1ro','zont1x','tN1R','magixx'];
  const hp = [100,100,73,0,100,100,42,0,100,100];
  const players = names.map((name,i)=>({ id:String(i), name, slot:i+1, team:i<5?'CT':'T', health:hp[i], armor:hp[i]?100:0, helmet:true, kit:i<5&&i!==2&&hp[i]>0, money:[4200,150,2300,950,1700,3100,650,1200,450,100][i], kills:[24,18,14,11,9,19,10,16,21,17][i], deaths:[12,10,14,16,15,12,17,15,13,11][i], assists: i%4, weapon:i===1||i===6?'AWP':i<5?'M4A1-S':'AK-47', grenades:hp[i]?['smoke','flash',...(i%2?[]:['he','fire'])]:[], ammo:i===1?5:24, reserve:90, equipment:hp[i]?5200:0 }));
  const demoPositions=[[0.506,0.258],[0.642,0.259],[0.294,0.262],[0.423,0.46],[0.765,0.432],[0.514,0.70],[0.633,0.614],[0.205,0.56],[0.482,0.54],[0.745,0.674]];
  players.forEach((p,i)=>{const [x,y]=demoPositions[i];p.position=[-2953+x*5*1024,2164-y*5*1024,0];p.roundKills=[2,0,1,0,0,3,0,1,0,0][i];p.primaryWeapon=p.weapon;p.hasBomb=i===5;p.forward=[Math.cos(i),Math.sin(i),0];p.ammoClipMax=p.weapon==='AWP'?5:p.weapon==='M4A1-S'?20:30;p.ammo=p.weapon==='AWP'?5:p.weapon==='M4A1-S'?17:24;p.reserve=3;p.reserveUnit='magazines';});
  return { mode:'demo', map:'ANCIENT', mapId:'de_ancient', round:22, scoreCT:12, scoreT:9, seconds:67, phase:'live', bomb:false, bombPosition:null, observed:'0', players, updated:Date.now() };
}
// Defuse packets contain a defuse countdown, so retain the independent C4 clock.
export function createBombTracker(){
 let key=null,previous=null,duration=40;
 return {update(state){
  const nextKey=`${state.mode}|${state.mapId}|${state.round}`;
  if(nextKey!==key||!state.bomb||previous&&state.updated<previous.updated){previous=null;duration=40;}
  key=nextKey;
  if(!state.bomb)return {...state,bombSeconds:null};
  const elapsed=previous&&previous.phase!=='paused'?Math.max(0,state.updated-previous.updated)/1000:0;
  const remaining=Number.isFinite(state.bombSeconds)?state.bombSeconds:previous?previous.bombSeconds-elapsed:40;
  duration=Math.max(duration,remaining);
  previous={...state,bombSeconds:Math.max(0,remaining),bombDuration:duration};
  return previous;
 }};
}
// Death markers belong to the death location, not subsequent corpse/observer positions.
export function createDeathPositionTracker(){
  const deaths=new Map(),lastAlive=new Map();let key=null,lastUpdated=null;
  return {update(state){
    const nextKey=`${state.mode}|${state.mapId}|${state.round}`;
    if(nextKey!==key||lastUpdated!==null&&state.updated<lastUpdated){deaths.clear();lastAlive.clear();}
    key=nextKey;lastUpdated=state.updated;
    const active=new Set(state.players.map(player=>player.id));
    const players=state.players.map(player=>{
      const position=vector(player.position);
      if(player.health>0){
        deaths.delete(player.id);
        if(position)lastAlive.set(player.id,position);
        return player;
      }
      if(!deaths.has(player.id)){
        const death=position||lastAlive.get(player.id);
        if(death)deaths.set(player.id,[...death]);
      }
      return deaths.has(player.id)?{...player,position:[...deaths.get(player.id)]}:player;
    });
    for(const map of [deaths,lastAlive])for(const id of map.keys())if(!active.has(id))map.delete(id);
    return {...state,players};
  }};
}
// Keep measured flight paths server-side so a newly opened HUD receives them too.
export function createGrenadeTracker(){
  const tracks=new Map();let key=null,lastUpdated=null;
  return {update(state){
    const nextKey=`${state.mode}|${state.mapId}|${state.round}`;
    if(nextKey!==key||lastUpdated!==null&&(state.updated<lastUpdated||state.updated-lastUpdated>2000))tracks.clear();
    key=nextKey;lastUpdated=state.updated;
    const active=new Set();
    const grenades=(state.grenades||[]).filter(grenade=>!grenade.detonated&&!(['he','flash'].includes(grenade.type)&&grenade.effectTime>0)).map(grenade=>{
      active.add(grenade.id);
      let track=tracks.get(grenade.id);
      if(!track||track.owner!==grenade.owner||track.type!==grenade.type||grenade.lifetime<track.lifetime){
        track={owner:grenade.owner,type:grenade.type,lifetime:grenade.lifetime,points:[]};tracks.set(grenade.id,track);
      }
      track.lifetime=grenade.lifetime;
      const previous=track.points.at(-1),point=grenade.position;
      if(previous&&Math.hypot(...point.map((v,i)=>v-previous[i]))>2048)track.points=[];
      if(!previous||point.some((value,i)=>value!==previous[i]))track.points.push([...point]);
      if(track.points.length>128)track.points.shift();
      return {...grenade,trajectory:track.points.map(point=>[...point])};
    });
    for(const id of tracks.keys())if(!active.has(id))tracks.delete(id);
    return {...state,grenades};
  }};
}
function normalizeGrenades(data){
  const types={frag:'he',hegrenade:'he',flashbang:'flash',smoke:'smoke',smokegrenade:'smoke',molotov:'fire',firebomb:'fire',incendiary:'fire',incgrenade:'fire',inferno:'fire',decoy:'decoy'};
  return Object.entries(data||{}).slice(0,128).flatMap(([id,g])=>{
    if(!g||typeof g!=='object')return [];
    const type=types[g.type];
    const flames=type==='fire'?Object.values(g.flames||{}).map(vector).filter(Boolean):[];
    const position=vector(g.position)||(flames.length?[0,1,2].map(axis=>flames.reduce((sum,point)=>sum+point[axis],0)/flames.length):null);
    if(!position||!type)return [];
    const velocity=vector(g.velocity);
    const lifetime=Number.isFinite(Number(g.lifetime))?Math.max(0,Number(g.lifetime)):0;
    const effectTime=Number.isFinite(Number(g.effecttime))?Math.max(0,Number(g.effecttime)):0;
    // HE entities can remain in GSI after exploding, frozen in place without effecttime.
    // A stationary grenade before its fuse expires is still live and must stay visible.
    const detonated=['he','flash'].includes(type)&&effectTime>0||type==='he'&&lifetime>=1.6&&velocity!==null&&velocity.every(value=>value===0);
    return [{id,type,owner:String(g.owner??''),position,velocity,lifetime,effectTime,detonated,active:flames.length>0||g.type==='inferno'}];
  });
}
export function normalizeGsi(data) {
  const players = Object.entries(data.allplayers || {}).map(([id,p])=>{
    const state=p.state||{}, stats=p.match_stats||{}, weapons=Object.values(p.weapons||{});
    const primary=weapons.find(w=>['Rifle','SniperRifle','Submachine Gun','Machine Gun','Shotgun'].includes(w.type))||weapons.find(w=>w.type==='Pistol')||weapons.find(w=>w.type==='Knife');
    const gun=weapons.find(w=>w.state==='active')||primary;
    const label = n => ({m4a1_silencer:'M4A1-S',m4a1:'M4A4',ak47:'AK-47',usp_silencer:'USP-S',hkp2000:'P2000'}[n]||n?.replaceAll('_',' ').toUpperCase()||'—');
    const grenades=weapons.filter(w=>w.type==='Grenade').flatMap(w=>Array.from({length:Math.min(4,Math.max(1,Number(w.ammo_reserve)||1))},()=>w.name.includes('smoke')?'smoke':w.name.includes('flash')?'flash':w.name.includes('hegrenade')?'he':w.name.includes('decoy')?'decoy':'fire'));
    return { id,name:p.name||'Player',slot:p.observer_slot??0,team:p.team,position:vector(p.position),forward:vector(p.forward),health:state.health??0,armor:state.armor??0,helmet:!!state.helmet,hasBomb:(state.health??0)>0&&(weapons.some(w=>w.name==='weapon_c4')||(['carried','planting'].includes(data.bomb?.state)&&String(data.bomb?.player)===id)),kit:!!state.defusekit,money:state.money??0,kills:stats.kills??0,roundKills:Number.isInteger(state.round_kills)&&state.round_kills>0?state.round_kills:0,deaths:stats.deaths??0,assists:stats.assists??0,weapon:label(gun?.name?.replace('weapon_','')),primaryWeapon:label(primary?.name?.replace('weapon_','')),grenades,ammo:Number.isInteger(gun?.ammo_clip)?gun.ammo_clip:null,ammoClipMax:Number.isInteger(gun?.ammo_clip_max)?gun.ammo_clip_max:null,reserve:Number.isInteger(gun?.ammo_reserve)?gun.ammo_reserve:null,reserveUnit:gun?.type==='Shotgun'?'shells':gun?.name==='weapon_revolver'?'rounds':'magazines',equipment:state.equip_value??0 };
  }).sort((a,b)=>a.slot-b.slot);
  const mapId=(data.map?.name||'').split('/').pop().toLowerCase();
  return { bombSeconds:data.bomb?.state==='planted'&&data.bomb?.countdown!=null&&Number.isFinite(Number(data.bomb.countdown))?Math.max(0,Number(data.bomb.countdown)):data.phase_countdowns?.phase==='bomb'?Math.max(0,Number(data.phase_countdowns.phase_ends_in)||0):null,grenades:normalizeGrenades(data.grenades),mode:'live',map:mapId.replace(/^(de_|cs_)/,'').toUpperCase()||'—',mapId,round:(data.map?.round??0)+1,scoreCT:data.map?.team_ct?.score??0,scoreT:data.map?.team_t?.score??0,seconds:Math.max(0,Number(data.phase_countdowns?.phase_ends_in)||0),phase:data.phase_countdowns?.phase||data.round?.phase||'waiting',bomb:['planted','defusing'].includes(data.bomb?.state),bombPosition:vector(data.bomb?.position),bombState:data.bomb?.state||null,observed:data.player?.spectarget||data.player?.steamid,players,updated:Date.now() };
}
