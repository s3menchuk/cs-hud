import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defaults, demo, normalizeGsi } from './lib.mjs';
import { radarMaps } from './public/radar-data.js';

const root = new URL('./',import.meta.url);
const port=Number(process.env.HUD_PORT||3199);
let settings={...defaults};
try { settings={...defaults,...JSON.parse(await readFile(new URL('settings.json',root),'utf8'))}; } catch {}
let state=demo(), lastGsi=0;
const clients=new Set();
const broadcast=()=>{ const message=`data: ${JSON.stringify({state,settings,connected:Date.now()-lastGsi<10000})}\n\n`; for(const res of clients) res.write(message); };
const files={'/':'public/index.html','/overlay':'public/index.html','/app.js':'public/app.js','/radar.js':'public/radar.js','/radar-data.js':'public/radar-data.js','/style.css':'public/style.css','/gamestate_integration_broadcast.cfg':'gamestate_integration_broadcast.cfg'};
for(const map of Object.values(radarMaps))for(const layer of map.layers)files[layer.image]='public'+layer.image;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.cfg':'text/plain; charset=utf-8','.png':'image/png'};
async function jsonBody(req) { let body=''; for await(const chunk of req){ body+=chunk; if(Buffer.byteLength(body)>2_000_000) throw new Error('Payload too large'); } return JSON.parse(body); }
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  try {
    if(path==='/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});clients.add(res);broadcast();req.on('close',()=>clients.delete(res));return;}
    if(path==='/api/state'&&req.method==='GET') return reply(200,{state,settings,connected:Date.now()-lastGsi<10000});
    if(path==='/gsi'&&req.method==='POST'){ const data=await jsonBody(req); if(!data.map) return reply(400,{error:'Expected a GSI map payload'}); state=normalizeGsi(data);lastGsi=Date.now();broadcast();return reply(200,{ok:true}); }
    if(path==='/api/settings'&&req.method==='POST'){
      const data=await jsonBody(req),next={...settings};
      for(const key of Object.keys(defaults)) {
        if(typeof data[key]!==typeof defaults[key]) continue;
        if(key.startsWith('accent')&&!/^#[\da-f]{6}$/i.test(data[key])) continue;
        if(key.endsWith('Logo')&&data[key]&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(data[key])) continue;
        next[key]=typeof data[key]==='string'?data[key].slice(0,key.endsWith('Logo')?700000:100):data[key];
      }
      if(!['CT','T'].includes(next.leftSide)) next.leftSide='CT';
      await writeFile(new URL('settings.json',root),JSON.stringify(next,null,2));settings=next;broadcast();return reply(200,{ok:true});
    }
    if(path==='/api/demo'&&req.method==='POST'){const action=await jsonBody(req);if(Date.now()-lastGsi<10000)return reply(409,{error:'CS2 подключена. Дождитесь отключения GSI.'});if(action.type==='reset')state=demo();if(action.type==='focus'&&state.players.some(p=>p.id===action.id))state.observed=action.id;if(action.type==='damage'){const p=state.players.find(p=>p.id===state.observed);if(p)p.health=Math.max(0,p.health-25);}if(action.type==='bomb')state.bomb=!state.bomb;broadcast();return reply(200,{ok:true});}
    if(req.method!=='GET'||!files[path])return reply(404,{error:'Not found'});
    const file=files[path],body=await readFile(new URL(file,root));res.writeHead(200,{'Content-Type':mime[file.slice(file.lastIndexOf('.'))],'Cache-Control':'no-cache'});res.end(body);
  }catch(error){reply(400,{error:error.message});}
});
setInterval(()=>{if(state.mode==='demo') {state.seconds=state.seconds>0?state.seconds-1:115;state.updated=Date.now();}broadcast();},1000).unref();
server.on('error',error=>{
  if(error.code==='EADDRINUSE') {
    console.error(`Порт ${port} уже занят. Если HUD уже запущен, откройте http://localhost:${port}\nПовторный запуск не нужен. Для перезапуска сначала остановите предыдущий экземпляр HUD.`);
  } else console.error('Не удалось запустить HUD:',error.message);
  process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>console.log(`CS2 HUD: http://localhost:${port}\nOBS: http://localhost:${port}/overlay`));
