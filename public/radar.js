import { radarMaps } from './radar-data.js';

// Valve overviews are calibrated on a 1024 × 1024 canvas, even when the
// extracted image has a different pixel resolution. World Y points upward.
export function worldToRadar(position,map){
  if(!Array.isArray(position)||position.length<2||!position.every(Number.isFinite)||!map||!(map.scale>0))return null;
  const x=(position[0]-map.posX)/(map.scale*map.radarSize);
  const y=(map.posY-position[1])/(map.scale*map.radarSize);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)return null;
  return {x:x*1024,y:y*1024};
}
export function radarLayer(map,z){
  if(!Number.isFinite(z))return map.layers.find(l=>l.name==='default')||map.layers[0];
  return map.layers.find(l=>Number.isFinite(l.AltitudeMin)&&Number.isFinite(l.AltitudeMax)&&z>=l.AltitudeMin&&z<l.AltitudeMax)||map.layers.find(l=>l.name==='default')||map.layers[0];
}
export function playerNumber(player,players,leftSide='CT'){
  const teammates=players.filter(p=>p.team===player.team);
  const index=teammates.findIndex(p=>p.id===player.id);
  if(index<0||index>=5)return '';
  return (index+(player.team===leftSide?1:6))%10;
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function shortestAngle(from,to){return ((to-from+180)%360+360)%360-180;}
export function sampleMotion(track,now){
  const t=track.duration>0?Math.max(0,Math.min(1,(now-track.start)/track.duration)):1;
  return {x:track.fromX+(track.x-track.fromX)*t,y:track.fromY+(track.y-track.fromY)*t,angle:track.fromAngle+shortestAngle(track.fromAngle,track.angle)*t};
}

// Keep the map image and keyed marker elements alive between GSI packets.
// Only marker transforms animate on the browser's animation clock.
export function createRadarController(host){
  let root=null,key=null,frame=null,lastStamp=null,packetInterval=100;
  const tracks=new Map();
  const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function paint(track,now){
    const value=sampleMotion(track,now);
    track.node.setAttribute('transform',`translate(${value.x.toFixed(2)} ${value.y.toFixed(2)})`);
    track.node.querySelector('.radar-direction')?.setAttribute('transform',`rotate(${value.angle.toFixed(2)})`);
  }
  function animate(now){
    frame=null;let moving=false;
    for(const track of tracks.values()){
      paint(track,now);
      if(now<track.start+track.duration)moving=true;
    }
    if(moving)frame=requestAnimationFrame(animate);
  }
  function clear(){
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null;tracks.clear();root?.remove();root=null;
  }
  function update(state,settings){
    const map=radarMaps[state.mapId||`de_${String(state.map).toLowerCase()}`];
    const observed=state.players.find(p=>p.id===state.observed);
    const layer=map?radarLayer(map,observed?.position?.[2]).name:'';
    const nextKey=`${state.mapId||state.map}|${state.round}|${state.mode}|${layer}|${settings.showRadar!==false}`;
    const now=performance.now();
    const gap=lastStamp===null?0:state.updated-lastStamp;
    if(gap>0&&gap<1000)packetInterval=packetInterval*.7+gap*.3;
    const reset=key!==nextKey||gap<0||gap>1500;
    if(reset){clear();key=nextKey;packetInterval=100;}
    lastStamp=state.updated;
    const template=document.createElement('template');
    template.innerHTML=renderRadar(state,settings);
    const next=template.content.firstElementChild;
    if(!next){clear();return;}
    if(!root){root=next;host.append(root);}
    const svg=root.querySelector('.radar-map');
    if(!svg)return;
    const nextMarkers=[...next.querySelectorAll('[data-radar-id]')];
    const active=new Set();
    for(const candidate of nextMarkers){
      const id=candidate.getAttribute('data-radar-id');active.add(id);
      const point=candidate.getAttribute('transform').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/);
      const x=Number(point[1]),y=Number(point[2]);
      const angle=Number(candidate.querySelector('.radar-direction')?.getAttribute('transform').match(/rotate\(([-\d.]+)\)/)?.[1]||0);
      let track=tracks.get(id);
      if(!track){
        // The initial template already owns these elements. Later arrivals
        // are appended without replacing any existing player marker.
        if(!root.contains(candidate))svg.append(candidate);
        track={node:candidate,fromX:x,fromY:y,x,y,fromAngle:angle,angle,start:now,duration:0};
        tracks.set(id,track);
      }else{
        const displayed=sampleMotion(track,now);
        const changed=x!==track.x||y!==track.y||shortestAngle(track.angle,angle)!==0;
        if(changed){
          const snap=reduced()||candidate.classList.contains('radar-dead')||Math.hypot(x-displayed.x,y-displayed.y)>220;
          Object.assign(track,{fromX:snap?x:displayed.x,fromY:snap?y:displayed.y,x,y,fromAngle:snap?angle:displayed.angle,angle,start:now,duration:snap?0:Math.max(80,Math.min(180,packetInterval))});
        }
        track.node.setAttribute('class',candidate.getAttribute('class'));
        // Keep the movement wrapper stable while updating HP/death,
        // observation ring, player number and viewing direction contents.
        if(track.node.innerHTML!==candidate.innerHTML)track.node.innerHTML=candidate.innerHTML;
      }
      paint(track,now);
    }
    for(const [id,track] of tracks){if(!active.has(id)){track.node.remove();tracks.delete(id);}}
    if(root!==next){
      for(const selector of ['.radar-waiting','.radar-level']){
        const old=root.querySelector(selector),replacement=next.querySelector(selector);
        if(old&&replacement){if(old.innerHTML!==replacement.innerHTML)old.innerHTML=replacement.innerHTML;}
        else if(old)old.remove();else if(replacement)root.append(replacement);
      }
    }
    if(frame===null&&[...tracks.values()].some(t=>now<t.start+t.duration))frame=requestAnimationFrame(animate);
  }
  return {update,destroy:clear};
}
export function renderRadar(state,settings){
  if(settings.showRadar===false)return '';
  const map=radarMaps[state.mapId||`de_${String(state.map).toLowerCase()}`];
  if(!map)return '<section class="radar radar-unavailable"><span>МИНИ-КАРТА</span><small>Для этой карты пока нет плана</small></section>';
  const observed=state.players.find(p=>p.id===state.observed);
  const layer=radarLayer(map,observed?.position?.[2]);
  const positioned=state.players.filter(p=>worldToRadar(p.position,map));
  const markers=positioned.map(p=>{
    const point=worldToRadar(p.position,map),dead=p.health<=0,selected=p.id===state.observed;
    const otherLayer=radarLayer(map,p.position[2]).name!==layer.name;
    const forward=p.forward;
    const angle=Array.isArray(forward)&&forward.every(Number.isFinite)?Math.atan2(-forward[1],forward[0])*180/Math.PI+90:null;
    const team=p.team===settings.leftSide?'radar-left':'radar-right';
    return `<g data-radar-id="player-${escape(p.id)}" class="radar-player ${team} ${dead?'radar-dead':''} ${selected?'radar-observed':''} ${otherLayer?'radar-other-floor':''}" transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})"><title>${escape(p.name)} · ${p.health} HP${otherLayer?' · другой этаж':''}</title>${selected?'<circle class="radar-ring" r="32"/>':''}${dead?'<path class="radar-death" d="m-13-13 26 26m0-26-26 26"/>':`${angle===null?'':`<path class="radar-direction" d="M-13-19 0-43 13-19Z" transform="rotate(${angle.toFixed(1)})"/>`}<circle class="radar-dot" r="21"/><text class="radar-number" y="1">${playerNumber(p,state.players,settings.leftSide)}</text>${otherLayer?`<text class="radar-floor-indicator" x="27" y="-17">${p.position[2]<(observed?.position?.[2]??0)?'↓':'↑'}</text>`:''}`}</g>`;
  }).join('');
  const bombPoint=['planted','defusing','dropped','planting'].includes(state.bombState)?worldToRadar(state.bombPosition,map):null;
  const bomb=bombPoint?`<g data-radar-id="bomb" class="radar-bomb ${state.bomb?'radar-bomb-planted':''}" transform="translate(${bombPoint.x} ${bombPoint.y})"><title>C4</title><rect x="-17" y="-17" width="34" height="34" rx="4"/><text y="1">C4</text></g>`:'';
  const sites=map.sites.map(site=>`<g class="radar-site" transform="translate(${site.x*1024} ${site.y*1024})"><rect x="-25" y="-25" width="50" height="50" rx="5"/><text y="2">${site.label}</text></g>`).join('');
  return `<section class="radar" aria-label="Мини-карта ${escape(map.name)}"><svg class="radar-map" viewBox="0 0 1024 1024"><image href="${layer.image}" width="1024" height="1024"/>${sites}${markers}${bomb}</svg>${map.layers.length>1?`<span class="radar-level">${layer.name==='lower'?'НИЖНИЙ ЭТАЖ':'ВЕРХНИЙ ЭТАЖ'}</span>`:''}${positioned.length===0?'<div class="radar-waiting">ОЖИДАНИЕ КООРДИНАТ<span>Обновите GSI-конфиг и перезапустите CS2</span></div>':''}</section>`;
}
