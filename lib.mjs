export const defaults = { event: 'COUNTER-STRIKE 2', stage: 'SHOWMATCH · BEST OF 3', leftName: 'TEAM SPIRIT', rightName: 'NATUS VINCERE', leftTag: 'TS', rightTag: 'NAVI', leftLogo: '', rightLogo: '', leftSide: 'CT', accentLeft: '#78d5f5', accentRight: '#edc67a', showEquipment: true, showFocus: true, showRadar: true };
export function vector(value) {
  const values=Array.isArray(value)?value:typeof value==='string'?value.split(','):null;
  if(!values||values.length!==3||values.some(v=>v===null||String(v).trim()===''))return null;
  const numbers=values.map(Number);
  return numbers.every(Number.isFinite)?numbers:null;
}
export function demo() {
  const names = ['donk','sh1ro','zont1x','magixx','chopper','b1t','Aleksib','iM','jL','w0nderful'];
  const hp = [100,100,73,0,100,100,42,0,100,100];
  const players = names.map((name,i)=>({ id:String(i), name, slot:i+1, team:i<5?'CT':'T', health:hp[i], armor:hp[i]?100:0, helmet:true, kit:i<5&&i!==2&&hp[i]>0, money:[4200,150,2300,950,1700,3100,650,1200,450,100][i], kills:[24,18,14,11,9,19,10,16,21,17][i], deaths:[12,10,14,16,15,12,17,15,13,11][i], assists: i%4, weapon:i===1||i===9?'AWP':i<5?'M4A1-S':'AK-47', grenades:hp[i]?['smoke','flash',...(i%2?[]:['he','fire'])]:[], ammo:i===1?5:24, reserve:90, equipment:hp[i]?5200:0 }));
  const demoPositions=[[0.57,0.31],[0.68,0.4],[0.36,0.38],[0.3,0.43],[0.58,0.55],[0.29,0.65],[0.42,0.63],[0.5,0.56],[0.69,0.65],[0.6,0.72]];
  players.forEach((p,i)=>{const [x,y]=demoPositions[i];p.position=[-2953+x*5*1024,2164-y*5*1024,0];p.forward=[Math.cos(i),Math.sin(i),0];});
  return { mode:'demo', map:'ANCIENT', mapId:'de_ancient', round:22, scoreCT:12, scoreT:9, seconds:67, phase:'live', bomb:false, bombPosition:null, observed:'0', players, updated:Date.now() };
}
export function normalizeGsi(data) {
  const players = Object.entries(data.allplayers || {}).map(([id,p])=>{
    const state=p.state||{}, stats=p.match_stats||{}, weapons=Object.values(p.weapons||{});
    const gun=weapons.find(w=>w.state==='active')||weapons.find(w=>['Rifle','SniperRifle','Submachine Gun','Machine Gun','Shotgun'].includes(w.type))||weapons.find(w=>w.type==='Pistol');
    const label = n => ({m4a1_silencer:'M4A1-S',m4a1:'M4A4',ak47:'AK-47',usp_silencer:'USP-S',hkp2000:'P2000'}[n]||n?.replaceAll('_',' ').toUpperCase()||'—');
    const grenades=weapons.filter(w=>w.type==='Grenade').flatMap(w=>Array.from({length:Math.min(4,Math.max(1,Number(w.ammo_reserve)||1))},()=>w.name.includes('smoke')?'smoke':w.name.includes('flash')?'flash':w.name.includes('hegrenade')?'he':w.name.includes('decoy')?'decoy':'fire'));
    return { id,name:p.name||'Player',slot:p.observer_slot??0,team:p.team,position:vector(p.position),forward:vector(p.forward),health:state.health??0,armor:state.armor??0,helmet:!!state.helmet,kit:!!state.defusekit,money:state.money??0,kills:stats.kills??0,deaths:stats.deaths??0,assists:stats.assists??0,weapon:label(gun?.name?.replace('weapon_','')),grenades,ammo:gun?.ammo_clip??0,reserve:gun?.ammo_reserve??0,equipment:state.equip_value??0 };
  }).sort((a,b)=>a.slot-b.slot);
  const mapId=(data.map?.name||'').split('/').pop().toLowerCase();
  return { mode:'live',map:mapId.replace(/^(de_|cs_)/,'').toUpperCase()||'—',mapId,round:(data.map?.round??0)+1,scoreCT:data.map?.team_ct?.score??0,scoreT:data.map?.team_t?.score??0,seconds:Math.max(0,Number(data.phase_countdowns?.phase_ends_in)||0),phase:data.phase_countdowns?.phase||data.round?.phase||'waiting',bomb:['planted','defusing'].includes(data.bomb?.state),bombPosition:vector(data.bomb?.position),bombState:data.bomb?.state||null,observed:data.player?.spectarget||data.player?.steamid,players,updated:Date.now() };
}
