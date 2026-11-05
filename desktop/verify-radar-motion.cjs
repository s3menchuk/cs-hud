const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ensureHudServer}=require('./runtime.cjs');
const folder=fs.mkdtempSync(path.resolve(__dirname,'../node_modules/.cache/radar-motion-'));
app.setPath('userData',path.join(folder,'profile'));app.on('window-all-closed',()=>{});
let server,win;
app.whenReady().then(async()=>{try{
 server=await ensureHudServer({port:32197,settingsFile:path.join(folder,'settings.json')});assert.equal(server.owned,true);
 win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});await win.loadURL('http://127.0.0.1:32197/overlay');
 const result=await win.webContents.executeJavaScript(`(async()=>{
  const {createRadarController}=await import('/radar.js');
  let now=0,seq=0,queue=new Map();
  const originalNow=Object.getOwnPropertyDescriptor(performance,'now'),originalRAF=requestAnimationFrame,originalCancel=cancelAnimationFrame,originalMatchMedia=window.matchMedia;
  window.matchMedia=()=>({matches:true});
  Object.defineProperty(performance,'now',{configurable:true,value:()=>now});
  window.requestAnimationFrame=fn=>{queue.set(++seq,fn);return seq};window.cancelAnimationFrame=id=>queue.delete(id);
  const host=document.createElement('div');document.body.append(host);const controller=createRadarController(host);
  const xAt=t=>307.2+t*.08;
  const position=t=>[-2953+xAt(t)*5,2164-500*5,0];
  const settings={leftSide:'CT',showRadar:true};
  const trajectory=[];
  const packet=t=>{trajectory.push(position(t));return {mode:'live',mapId:'de_ancient',round:1,updated:10000+t,observed:'one',players:[{id:'one',name:'Player',team:'CT',health:100,position:position(t),forward:[1,0,0]}],grenades:[{id:'flight',type:'flash',owner:'one',position:position(t),effectTime:0,trajectory:[...trajectory]}]}};
  const arrivals=[0,100,200,430,440,550,650,760,860,1100,1110,1230,1330,1430,1530,1630,1730,1830];let packetIndex=0,previous=null,maxStep=0,backwards=0,endpointError=0,identity=null,retained=true,jumps=[],previousStep=null,maxSpeedChange=0;
  try{
   for(now=0;now<2050;now+=16){
    while(packetIndex<arrivals.length&&arrivals[packetIndex]<=now)controller.update(packet(arrivals[packetIndex++]),settings);
    const callbacks=[...queue.values()];queue.clear();callbacks.forEach(fn=>fn(now));
    const marker=host.querySelector('[data-radar-id="player-one"]');
    if(!marker)continue;
    if(!identity)identity=marker;else retained&&=identity===marker;
    const x=Number(marker.getAttribute('transform').match(/translate\\(([-\\d.]+)/)[1]);
    if(previous!==null){const step=x-previous;if(previousStep!==null)maxSpeedChange=Math.max(maxSpeedChange,Math.abs(step-previousStep));previousStep=step;if(x-previous>3)jumps.push({now,x,previous});maxStep=Math.max(maxStep,x-previous);if(x<previous-.01)backwards++}previous=x;
    const path=host.querySelector('[data-trail-id]')?.getAttribute('d');
    if(path){const pairs=[...path.matchAll(/[ML]([-\\d.]+) ([-\\d.]+)/g)];const grenadeX=Number(host.querySelector('[data-radar-id="grenade-flight"]').getAttribute('transform').match(/translate\\(([-\\d.]+)/)[1]);endpointError=Math.max(endpointError,Math.abs(Number(pairs.at(-1)[1])-grenadeX));}
   }
   controller.update({...packet(2050),grenades:[]},settings);
   return {jumps,maxStep,maxSpeedChange,backwards,endpointError,retained,cleared:!host.querySelector('[data-radar-id="grenade-flight"], [data-trail-id]')};
  }finally{controller.destroy();host.remove();if(originalNow)Object.defineProperty(performance,'now',originalNow);else delete performance.now;window.requestAnimationFrame=originalRAF;window.cancelAnimationFrame=originalCancel;window.matchMedia=originalMatchMedia;}
 })()`);
 assert.ok(result.maxStep<3,JSON.stringify(result));assert.ok(result.maxSpeedChange<.4,JSON.stringify(result));assert.equal(result.backwards,0);assert.ok(result.endpointError<=.02);assert.equal(result.retained,true);assert.equal(result.cleared,true);
 console.log('PASS: uneven packet playback, stable marker nodes, continuous motion, matching trail endpoint, immediate grenade cleanup',result);
 win.destroy();server.stop();app.exit(0);
}catch(e){console.error(e);win?.destroy();server?.stop();app.exit(1);}});
