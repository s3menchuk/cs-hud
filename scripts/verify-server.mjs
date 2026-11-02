import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port=32199;
const testDirectory=await mkdtemp(join(tmpdir(),'cs2-hud-test-'));
const testSettings=join(testDirectory,'settings.json');
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,HUD_PORT:String(port),HUD_SETTINGS_FILE:testSettings},stdio:['ignore','pipe','pipe']});
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
    server.stdout.once('data',()=>{clearTimeout(timeout);resolve();});
    server.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Server exited: ${code}`));});
    server.once('error',reject);
  });
  const base=`http://127.0.0.1:${port}`;
  const get=path=>fetch(base+path);
  const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  for(const path of ['/','/overlay','/app.js','/series.js','/radar.js','/radar-data.js','/style.css','/gamestate_integration_broadcast.cfg']) assert.equal((await get(path)).status,200,path);
  const image=await get('/assets/radars/de_dust2_radar_psd.png');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
  assert.equal((await get('/assets/radars/unknown.png')).status,404);
  let payload=await (await get('/api/state')).json();assert.equal(payload.state.players.length,10);
  const stream=await get('/events');const reader=stream.body.getReader();assert.ok(new TextDecoder().decode((await reader.read()).value).startsWith('data: '));await reader.cancel();
  const series={seriesFormat:5,currentMap:2,seriesMaps:[{map:'Mirage',leftScore:13,rightScore:8,completed:true}]};
  assert.equal((await post('/api/settings',series)).status,200);
  payload=await (await get('/api/state')).json();assert.deepEqual(payload.settings.seriesMaps,series.seriesMaps);assert.equal(payload.settings.seriesFormat,5);
  assert.deepEqual(JSON.parse(await readFile(testSettings,'utf8')).seriesMaps,series.seriesMaps);
  assert.equal((await post('/api/settings',{seriesMaps:[{map:'Nuke',leftScore:13,rightScore:13,completed:true}]})).status,400);
  payload=await (await get('/api/state')).json();assert.deepEqual(payload.settings.seriesMaps,series.seriesMaps);
  assert.equal((await post('/api/settings',{leftSide:'T'})).status,200);
  payload=await (await get('/api/state')).json();assert.deepEqual(payload.settings.seriesMaps,series.seriesMaps);
  await post('/api/demo',{type:'damage'});payload=await (await get('/api/state')).json();assert.equal(payload.state.players[0].health,75);
  assert.equal((await post('/gsi',{map:{name:'de_nuke',round:4,team_ct:{score:3},team_t:{score:1}},allplayers:{one:{name:'Live player',team:'CT',position:'-500, 1200, -600',forward:'0, 1, 0',state:{health:81,armor:90,defusekit:true}}}})).status,200);
  payload=await (await get('/api/state')).json();assert.equal(payload.state.mode,'live');assert.equal(payload.connected,true);assert.equal(payload.state.players[0].health,81);
  assert.deepEqual(payload.state.players[0].position,[-500,1200,-600]);assert.deepEqual(payload.state.players[0].forward,[0,1,0]);assert.equal(payload.state.mapId,'de_nuke');
  assert.equal((await post('/api/demo',{type:'reset'})).status,409);
  assert.equal((await post('/gsi',{})).status,400);
  console.log('PASS: HTTP assets, SSE, series validation/persistence, CT/T swaps, demo actions, GSI, live/demo isolation.');
} finally {server.kill();await unlink(testSettings).catch(error=>{if(error.code!=='ENOENT')throw error;});await rmdir(testDirectory);}
