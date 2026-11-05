import http from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { defaults, demo, normalizeGsi, createGrenadeTracker, createDeathPositionTracker, createBombTracker } from './lib.mjs';
import { radarMaps } from './public/radar-data.js';
import { validateSeries } from './public/series.js';
import { createTeamTracker } from './public/teams.js';
import { validatePlayerId, decodeAvatar } from './avatars.mjs';
import { validateLayout } from './public/layout.js';

const root = new URL('./',import.meta.url);
const port=Number(process.env.HUD_PORT||3199);
const settingsFile=process.env.HUD_SETTINGS_FILE||new URL('settings.json',root);
const avatarDirectory=process.env.HUD_AVATAR_DIRECTORY||new URL('uploads/avatars/',root);
const avatarFile=name=>typeof avatarDirectory==='string'?join(avatarDirectory,name):new URL(name,avatarDirectory);
let settings={...defaults};
try { settings={...defaults,...JSON.parse(await readFile(settingsFile,'utf8'))}; } catch {}
let settingsQueue=Promise.resolve();
function saveSettings(build){
  const operation=settingsQueue.then(async()=>{
    const next=build(settings);
    const temporary=typeof settingsFile==='string'?settingsFile+'.tmp':new URL(settingsFile.href+'.tmp');
    await writeFile(temporary,JSON.stringify(next,null,2));await rename(temporary,settingsFile);
    settings=next;return next;
  });
  settingsQueue=operation.catch(()=>{});return operation;
}
let state=demo(), lastGsi=0;
const teams=createTeamTracker();
const grenadeTracker=createGrenadeTracker();
const deathPositions=createDeathPositionTracker();
const bombClock=createBombTracker();
const clients=new Set();
const broadcast=()=>{ const message=`data: ${JSON.stringify({state,settings,connected:Date.now()-lastGsi<10000})}\n\n`; for(const res of clients) res.write(message); };
const files={'/':'public/index.html','/overlay':'public/index.html','/app.js':'public/app.js','/radar.js':'public/radar.js','/radar-data.js':'public/radar-data.js','/style.css':'public/style.css','/gamestate_integration_broadcast.cfg':'gamestate_integration_broadcast.cfg'};
files['/series.js']='public/series.js';
files['/teams.js']='public/teams.js';
files['/i18n.js']='public/i18n.js';
files['/ammo.js']='public/ammo.js';
files['/bomb.js']='public/bomb.js';
files['/player-avatars.js']='public/player-avatars.js';
files['/layout.js']='public/layout.js';
files['/layout-editor.js']='public/layout-editor.js';
for(const map of Object.values(radarMaps))for(const layer of map.layers)files[layer.image]='public'+layer.image;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.cfg':'text/plain; charset=utf-8','.png':'image/png'};
async function jsonBody(req) { let body=''; for await(const chunk of req){ body+=chunk; if(Buffer.byteLength(body)>2_000_000) throw new Error('Payload too large'); } return JSON.parse(body); }
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try {
    if(path==='/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});clients.add(res);broadcast();req.on('close',()=>clients.delete(res));return;}
    if(path==='/api/state'&&req.method==='GET') return reply(200,{state,settings,connected:Date.now()-lastGsi<10000});
    if(path.startsWith('/avatars/')&&req.method==='GET'){
      const filename=path.slice('/avatars/'.length);
      if(!/^[a-f0-9]{64}\.(png|jpg|webp)$/.test(filename))return reply(404,{error:'Not found'});
      let body;try{body=await readFile(avatarFile(filename));}catch(error){if(error.code==='ENOENT')return reply(404,{error:'Not found'});throw error;}
      const type=filename.endsWith('.jpg')?'jpeg':filename.endsWith('.webp')?'webp':'png';
      res.writeHead(200,{'Content-Type':'image/'+type,'Cache-Control':'public, max-age=31536000, immutable'});res.end(body);return;
    }
    if(path==='/api/avatars'&&['POST','DELETE'].includes(req.method)){
      const data=await jsonBody(req),id=validatePlayerId(data.id);
      let image;
      if(req.method==='POST'){image=decodeAvatar(data.image);await mkdir(avatarDirectory,{recursive:true});await writeFile(avatarFile(image.filename),image.bytes);}
      await saveSettings(current=>{
        const avatars={...current.playerAvatars};
        if(image)avatars[id]={url:image.url,name:(state.players.find(p=>p.id===id)?.name||id).slice(0,100)};
        else delete avatars[id];
        return {...current,playerAvatars:avatars};
      });
      broadcast();return reply(200,{ok:true,playerAvatars:settings.playerAvatars});
    }
    if(path==='/gsi'&&req.method==='POST'){ const data=await jsonBody(req); if(!data.map) return reply(400,{error:'Expected a GSI map payload'}); state=bombClock.update(deathPositions.update(grenadeTracker.update(normalizeGsi(data))));state.teamLeftSide=teams.update(state,settings.leftSide);lastGsi=Date.now();broadcast();return reply(200,{ok:true}); }
    if(path==='/api/settings'&&req.method==='POST'){
      const data=await jsonBody(req);
      await saveSettings(current=>{const next={...current};
      for(const key of Object.keys(defaults)) {
        if(['seriesFormat','currentMap','seriesMaps','playerAvatars','layout'].includes(key))continue;
        if(typeof data[key]!==typeof defaults[key]) continue;
        if(key.startsWith('accent')&&!/^#[\da-f]{6}$/i.test(data[key])) continue;
        if(key.endsWith('Logo')&&data[key]&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(data[key])) continue;
        next[key]=typeof data[key]==='string'?data[key].slice(0,key.endsWith('Logo')?700000:100):data[key];
      }
      if(!['CT','T'].includes(next.leftSide)) next.leftSide='CT';
      Object.assign(next,validateSeries({...next,...Object.fromEntries(['seriesFormat','currentMap','seriesMaps'].filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]))}));
      if(Object.hasOwn(data,'layout'))next.layout=validateLayout(data.layout);
      return next;});
      if(Object.hasOwn(data,'leftSide')&&settings.leftSide!==(state.teamLeftSide||settings.leftSide)){state.teamLeftSide=teams.reset(state,settings.leftSide);}
      broadcast();return reply(200,{ok:true});
    }
    if(path==='/api/demo'&&req.method==='POST'){const action=await jsonBody(req);if(Date.now()-lastGsi<10000)return reply(409,{error:'CS2 подключена. Дождитесь отключения GSI.'});if(action.type==='reset')state=demo();if(action.type==='focus'&&state.players.some(p=>p.id===action.id))state.observed=action.id;if(action.type==='damage'){const p=state.players.find(p=>p.id===state.observed);if(p)p.health=Math.max(0,p.health-25);}if(action.type==='bomb'){state.bomb=!state.bomb;state.bombSeconds=state.bomb?40:null;state.bombDuration=40;if(state.bomb)state.seconds=40;state.updated=Date.now();}broadcast();return reply(200,{ok:true});}
    if(req.method!=='GET'||!files[path])return reply(404,{error:'Not found'});
    const file=files[path],body=await readFile(new URL(file,root));res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))],'Cache-Control':'no-cache'});res.end(body);
  }catch(error){reply(400,{error:error.message});}
});
setInterval(()=>{if(state.mode==='demo') {state.seconds=state.seconds>0?state.seconds-1:115;if(state.bomb)state.bombSeconds=Math.max(0,(state.bombSeconds??40)-1);state.updated=Date.now();}broadcast();},1000).unref();
server.on('error',error=>{
  if(error.code==='EADDRINUSE') {
    console.error(`Порт ${port} уже занят. Если HUD уже запущен, откройте http://localhost:${port}\nПовторный запуск не нужен. Для перезапуска сначала остановите предыдущий экземпляр HUD.`);
  } else console.error('Не удалось запустить HUD:',error.message);
  process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>console.log(`CS2 HUD: http://localhost:${port}\nOBS: http://localhost:${port}/overlay`));
