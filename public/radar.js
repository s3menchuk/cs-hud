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

// Play snapshots on a short delayed timeline to absorb uneven GSI delivery.
export function sampleBufferedMotion(samples,time){
  if(time<=samples[0].time)return {...samples[0]};
  for(let i=1;i<samples.length;i++){
    const to=samples[i],from=samples[i-1];
    if(time<=to.time){
      const t=(time-from.time)/(to.time-from.time||1);
      return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t,angle:from.angle+shortestAngle(from.angle,to.angle)*t};
    }
  }
  return {...samples.at(-1)};
}
// Critically damped tracking keeps player velocity continuous as packet targets change.
export function smoothRadarMotion(current,target,elapsed){
  if(!current)return {...target,vx:0,vy:0,va:0};
  const dt=Math.max(0,Math.min(50,elapsed)),omega=2/90,decay=Math.exp(-omega*dt);
  const axis=(from,to,velocity)=>{
    const offset=from-to,temp=(velocity+omega*offset)*dt;
    const value=to+(offset+temp)*decay;
    if((to-from)*(value-to)>0||from===to)return [to,0];
    return [value,(velocity-omega*temp)*decay];
  };
  const [x,vx]=axis(current.x,target.x,current.vx||0),[y,vy]=axis(current.y,target.y,current.vy||0);
  const [angle,va]=axis(current.angle,current.angle+shortestAngle(current.angle,target.angle),current.va||0);
  return {x,y,angle,vx,vy,va};
}
// Adjust playback speed gently; packet jitter must never jump the displayed clock.
export function advanceRadarClock(playhead,elapsed,now,delay){
  const step=Math.max(0,Math.min(50,elapsed));
  const error=now-delay-(playhead+step);
  return playhead+step+Math.max(-step*.15,Math.min(step*.15,error));
}
export function radarBufferDelay(intervals){
  if(!intervals.length)return 160;
  const ordered=[...intervals].sort((a,b)=>a-b);
  return Math.max(140,Math.min(400,ordered[Math.ceil(ordered.length*.9)-1]+40));
}
// Trim measured history at the interpolated marker instead of drawing ahead of it.
export function clipGrenadeTrail(points,position,segmentEnd=null){
  if(points.length<2)return '';
  let closest=Infinity,end=segmentEnd?points.findLastIndex(point=>Math.abs(point.x-segmentEnd.x)<.02&&Math.abs(point.y-segmentEnd.y)<.02):-1;
  const knownSegment=end>=0;
  if(!knownSegment)end=0;
  for(let i=1;!knownSegment&&i<points.length;i++){
    const a=points[i-1],b=points[i];if(b.move)continue;
    const dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((position.x-a.x)*dx+(position.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const distance=(position.x-a.x-dx*t)**2+(position.y-a.y-dy*t)**2;
    if(distance<closest){closest=distance;end=i;}
  }
  if(!end)return '';
  return points.slice(0,end).map((p,i)=>`${i===0||p.move?'M':'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')+` L${position.x.toFixed(2)} ${position.y.toFixed(2)}`;
}
// Keep the map image and keyed marker elements alive between GSI packets.
// Only marker transforms animate on the browser's animation clock.
export function createRadarController(host){
  let root=null,key=null,frame=null,lastStamp=null,delay=160,playhead=-Infinity,lastFrame=null,clockOffset=0;
  const tracks=new Map(),intervals=[];
  function paint(track,time,elapsed=0){
    const target=sampleBufferedMotion(track.samples,time);
    const smoothPlayer=track.node.classList.contains('radar-player')&&!track.node.classList.contains('radar-dead');
    const value=smoothPlayer?smoothRadarMotion(track.displayed,target,elapsed):target;
    track.displayed=value;
    track.node.setAttribute('transform',`translate(${value.x.toFixed(2)} ${value.y.toFixed(2)})`);
    track.node.querySelector('.radar-direction')?.setAttribute('transform',`rotate(${value.angle.toFixed(2)})`);
    if(track.trail){
      const endpoint=track.samples.find(sample=>sample.time>=time)||track.samples.at(-1);
      track.trail.setAttribute('d',clipGrenadeTrail(track.trailPoints,value,endpoint));
    }
  }
  function animate(now){
    frame=null;
    const latest=Math.max(...[...tracks.values()].map(track=>track.samples.at(-1).time));
    // Never run past the last received snapshot: otherwise the next late packet jumps forward.
    playhead=Math.min(latest,advanceRadarClock(playhead,lastFrame===null?0:now-lastFrame,now,delay));
    const elapsed=lastFrame===null?0:now-lastFrame;
    lastFrame=now;
    for(const track of tracks.values())paint(track,playhead,elapsed);
    // Keep one steady animation clock even when a packet is late or a player stops.
    if(root&&tracks.size)frame=requestAnimationFrame(animate);
  }
  function clear(){
    if(frame!==null)cancelAnimationFrame(frame);
    frame=null;tracks.clear();root?.remove();root=null;playhead=-Infinity;lastFrame=null;
  }
  function update(state,settings){
    const map=radarMaps[state.mapId||`de_${String(state.map).toLowerCase()}`];
    const observed=state.players.find(p=>p.id===state.observed);
    const layer=map?radarLayer(map,observed?.position?.[2]).name:'';
    const nextKey=`${state.mapId||state.map}|${state.round}|${state.mode}|${layer}|${settings.showRadar!==false}`;
    const now=performance.now();
    const gap=lastStamp===null?0:state.updated-lastStamp;
    const reset=key!==nextKey||gap<0||gap>1500;
    if(reset){clear();key=nextKey;intervals.length=0;clockOffset=now-state.updated;}
    else if(gap>0&&gap<1000){intervals.push(gap);if(intervals.length>24)intervals.shift();}
    const sampleTime=state.updated+clockOffset;
    const fresh=lastStamp!==state.updated;
    lastStamp=state.updated;
    delay=radarBufferDelay(intervals);
    if(!Number.isFinite(playhead)){playhead=now-delay;lastFrame=now;}
    const template=document.createElement('template');
    template.innerHTML=renderRadar(state,settings);
    const next=template.content.firstElementChild;
    if(!next){clear();return;}
    if(!root){root=next;host.append(root);}
    const svg=root.querySelector('.radar-map');
    if(!svg)return;
    // Keep each trail path stable; only its visible endpoint advances per frame.
    const trailHost=root.querySelector('.radar-grenade-trails');
    const trailCandidates=[...next.querySelectorAll('[data-trail-id]')];
    const trailIds=new Set(trailCandidates.map(node=>node.getAttribute('data-trail-id')));
    for(const old of trailHost.querySelectorAll('[data-trail-id]'))if(!trailIds.has(old.getAttribute('data-trail-id')))old.remove();
    for(const candidate of trailCandidates){
      const id=candidate.getAttribute('data-trail-id');
      const old=[...trailHost.children].find(node=>node.getAttribute('data-trail-id')===id);
      if(old){old.setAttribute('class',candidate.getAttribute('class'));old.setAttribute('data-path',candidate.getAttribute('d'));}
      else{candidate.setAttribute('data-path',candidate.getAttribute('d'));trailHost.append(candidate);}
    }
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
        track={node:candidate,samples:[{x,y,angle,time:sampleTime}],trail:null,trailPoints:[]};
        tracks.set(id,track);
      }else{
        const previous=track.samples.at(-1);
        const snap=candidate.classList.contains('radar-dead')||Math.hypot(x-previous.x,y-previous.y)>220;
        if(snap){track.samples=[{x,y,angle,time:sampleTime}];track.displayed=null;}
        else if(fresh){
          track.samples.push({x,y,angle,time:sampleTime});
          while(track.samples.length>2&&track.samples[1].time<playhead)track.samples.shift();
          if(track.samples.length>32)track.samples.shift();
        }
        track.node.setAttribute('class',candidate.getAttribute('class'));
        // Keep the movement wrapper stable while updating HP/death,
        // observation ring, player number and viewing direction contents.
        if(track.node.innerHTML!==candidate.innerHTML)track.node.innerHTML=candidate.innerHTML;
      }
      track.trail=[...trailHost.children].find(node=>node.getAttribute('data-trail-id')===id)||null;
      track.trailPoints=track.trail?[...(track.trail.getAttribute('data-path')||'').matchAll(/([ML])([-\d.]+) ([-\d.]+)/g)].map(match=>({move:match[1]==='M',x:Number(match[2]),y:Number(match[3])})):[];
      paint(track,playhead);
    }
    for(const [id,track] of tracks){if(!active.has(id)){track.node.remove();tracks.delete(id);}}
    if(root!==next){
      for(const selector of ['.radar-waiting','.radar-level']){
        const old=root.querySelector(selector),replacement=next.querySelector(selector);
        if(old&&replacement){if(old.innerHTML!==replacement.innerHTML)old.innerHTML=replacement.innerHTML;}
        else if(old)old.remove();else if(replacement)root.append(replacement);
      }
    }
    if(frame===null&&tracks.size){lastFrame=now;frame=requestAnimationFrame(animate);}
  }
  return {update,destroy:clear};
}
const grenadeSymbols={
  he:'<path d="M9 5h6v3c7 5 4 14-3 14S2 13 9 8ZM11 2h6v3M6 12h12m-12 4h12M12 9v11"/>',
  flash:'<path d="M8 8h8v13H8ZM10 3h6v5m-8 5h8M4 3 2 1m18 3 2-2"/>',
  smoke:'<path d="M8 7h8v14H8ZM10 3h6v4m-6 5h6m-6 5h6"/>',
  fire:'<path d="M10 2h4v8l4 6v6H6v-6l4-6ZM7 17h10M14 4h5l2 3"/>',
  decoy:'<path d="M8 7h8v14H8ZM10 3h6v4m-5 5h2m-2 4h2"/>'
};
const grenadeNames={he:'Осколочная граната',flash:'Световая граната',smoke:'Дымовая граната',fire:'Зажигательная граната',decoy:'Ложная граната'};
function renderGrenades(state,settings,map,layer){
  let markers='',trails='';
  for(const grenade of state.grenades||[]){
    if(grenade.detonated||['he','flash'].includes(grenade.type)&&grenade.effectTime>0)continue;
    const point=worldToRadar(grenade.position,map),symbol=grenadeSymbols[grenade.type];
    if(!point||!symbol)continue;
    const otherLayer=radarLayer(map,grenade.position[2]).name!==layer.name;
    const owner=state.players.find(p=>p.id===grenade.owner);
    const team=owner?(owner.team===settings.leftSide?'radar-left':'radar-right'):'radar-neutral';
    // GSI supplies measured positions, not a predicted landing point.
    // Break the line at floor changes or invalid points instead of connecting across them.
    let path='',connected=false;
    if(!grenade.effectTime&&!grenade.active){
      for(const position of grenade.trajectory||[]){
        const sample=worldToRadar(position,map);
        if(!sample||radarLayer(map,position[2]).name!==layer.name){connected=false;continue;}
        path+=`${connected?'L':'M'}${sample.x.toFixed(2)} ${sample.y.toFixed(2)} `;connected=true;
      }
    }
    if(path.includes('L'))trails+=`<path data-trail-id="grenade-${escape(grenade.id)}" class="radar-grenade-trail ${team}" d="${path}"/>`;
    markers+=`<g data-radar-id="grenade-${escape(grenade.id)}" class="radar-grenade grenade-${grenade.type} ${otherLayer?'radar-other-floor':''} ${grenade.effectTime||grenade.active?'radar-grenade-active':''}" transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})"><title>${grenadeNames[grenade.type]}${owner?' · '+escape(owner.name):''}${otherLayer?' · другой этаж':''}</title><circle class="radar-grenade-disc" r="23"/><g transform="translate(-15 -15) scale(1.25)" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${symbol}</g></g>`;
  }
  return {markers,trails:`<g class="radar-grenade-trails">${trails}</g>`};
}
export const isBombCarrier=(player,state)=>player.health>0&&!!player.hasBomb&&!['planted','defusing','dropped','defused','exploded'].includes(state.bombState);
export function renderRadar(state,settings){
  if(settings.showRadar===false)return '';
  const map=radarMaps[state.mapId||`de_${String(state.map).toLowerCase()}`];
  if(!map)return '<section class="radar radar-unavailable"><span>МИНИ-КАРТА</span><small>Для этой карты пока нет плана</small></section>';
  const observed=state.players.find(p=>p.id===state.observed);
  const layer=radarLayer(map,observed?.position?.[2]);
  const grenades=renderGrenades(state,settings,map,layer);
  const positioned=state.players.filter(p=>worldToRadar(p.position,map));
  const markers=positioned.map(p=>{
    const point=worldToRadar(p.position,map),dead=p.health<=0,selected=p.id===state.observed;
    const carrier=isBombCarrier(p,state);
    const otherLayer=radarLayer(map,p.position[2]).name!==layer.name;
    const forward=p.forward;
    const angle=Array.isArray(forward)&&forward.every(Number.isFinite)?Math.atan2(-forward[1],forward[0])*180/Math.PI+90:null;
    const team=p.team===settings.leftSide?'radar-left':'radar-right';
    return `<g data-radar-id="player-${escape(p.id)}" class="radar-player ${team} ${dead?'radar-dead':''} ${selected?'radar-observed':''} ${carrier?'radar-carrier':''} ${otherLayer?'radar-other-floor':''}" transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})"><title>${escape(p.name)} · ${p.health} HP${carrier?' · C4':''}${otherLayer?' · другой этаж':''}</title>${selected?'<circle class="radar-ring" r="32"/>':''}${dead?'<path class="radar-death" d="m-13-13 26 26m0-26-26 26"/>':`${angle===null?'':`<path class="radar-direction" d="M-13-19 0-43 13-19Z" transform="rotate(${angle.toFixed(1)})"/>`}${carrier?'<circle class="radar-carrier-ring" r="28"/>':''}<circle class="radar-dot" r="21"/><text class="radar-number" y="1">${playerNumber(p,state.players,settings.leftSide)}</text>${carrier?'<g class="radar-carrier-badge" transform="translate(16 17)"><rect width="40" height="26" rx="5"/><text x="20" y="14">C4</text></g>':''}${otherLayer?`<text class="radar-floor-indicator" x="27" y="-17">${p.position[2]<(observed?.position?.[2]??0)?'↓':'↑'}</text>`:''}`}</g>`;
  }).join('');
  const bombPoint=['planted','defusing','dropped','planting'].includes(state.bombState)?worldToRadar(state.bombPosition,map):null;
  const bomb=bombPoint?`<g data-radar-id="bomb" class="radar-bomb ${state.bomb?'radar-bomb-planted':''}" transform="translate(${bombPoint.x} ${bombPoint.y})"><title>C4</title><rect x="-17" y="-17" width="34" height="34" rx="4"/><text y="1">C4</text></g>`:'';
  const sites=map.sites.map(site=>`<g class="radar-site" transform="translate(${site.x*1024} ${site.y*1024})"><rect x="-25" y="-25" width="50" height="50" rx="5"/><text y="2">${site.label}</text></g>`).join('');
  return `<section class="radar" aria-label="Мини-карта ${escape(map.name)}"><svg class="radar-map" viewBox="${(layer.bounds||[0,0,1024,1024]).join(' ')}" preserveAspectRatio="xMinYMin meet"><image href="${layer.image}" width="1024" height="1024"/>${sites}${grenades.trails}${markers}${grenades.markers}${bomb}</svg>${map.layers.length>1?`<span class="radar-level">${layer.name==='lower'?'НИЖНИЙ ЭТАЖ':'ВЕРХНИЙ ЭТАЖ'}</span>`:''}${positioned.length===0?'<div class="radar-waiting">ОЖИДАНИЕ КООРДИНАТ<span>Обновите GSI-конфиг и перезапустите CS2</span></div>':''}</section>`;
}
