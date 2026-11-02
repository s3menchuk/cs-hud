import { mkdir, writeFile } from 'node:fs/promises';
const revision='8366882e4c2a50aaa6920f033ab074e04e271952';
const upstream=`https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/${revision}/`;
const root=new URL('../',import.meta.url),directory=new URL('public/assets/radars/',root);
await mkdir(directory,{recursive:true});
async function get(path){const response=await fetch(upstream+path);if(!response.ok)throw new Error(`${response.status}: ${path}`);return response;}
const available=await (await get('data/available.json')).json();
const selected=['de_dust2','de_mirage','de_inferno','de_nuke','de_ancient','de_anubis','de_overpass','de_train','de_vertigo','de_cache','de_ancient_night','cs_office','cs_italy'];
const catalog={};
for(const id of selected){
  const entry=available.maps[id],info=entry?.radar_info;
  if(!info||!Number.isFinite(info.scale))throw new Error(`Missing calibration: ${id}`);
  const raw=await (await get(`data/radar_info/${id}.txt`)).text();
  const field=name=>{const value=raw.match(new RegExp(`"${name}"\\s+"([^"\\r\\n]+)"`,'i'))?.[1];return value===undefined?null:Number(value);};
  const sites=['A','B'].flatMap(label=>{const x=field(`bomb${label}_x`),y=field(`bomb${label}_y`);return x===null||y===null?[]:[{label,x,y}];});
  const layers=[];
  for(const url of entry.radar_paths){
    const filename=new URL(url).pathname.split('/').pop();
    const lower=filename.includes('_lower_');
    // Only use the exact primary image and its lower-floor variant.
    if(![`${id}_radar_psd.png`,`${id}_radar_tga.png`,`${id}_radar.png`,`${id}_lower_radar_psd.png`].includes(filename))continue;
    if(layers.some(l=>l.name===(lower?'lower':'default')))continue;
    const response=await get(`images/radars/${filename}`),buffer=Buffer.from(await response.arrayBuffer());
    if(buffer.readUInt32BE(0)!==0x89504e47)throw new Error(`Invalid PNG: ${filename}`);
    const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);
    if(width!==height)throw new Error(`Non-square radar: ${filename}`);
    await writeFile(new URL(filename,directory),buffer);
    layers.push({name:lower?'lower':'default',image:`/assets/radars/${filename}`,...(info.verticalsections?.[lower?'lower':'default']||{})});
  }
  if(!layers.some(l=>l.name==='default'))throw new Error(`Missing primary radar: ${id}`);
  layers.sort((a,b)=>a.name==='default'?-1:b.name==='default'?1:0);
  catalog[id]={name:entry.display_name,posX:info.pos_x,posY:info.pos_y,scale:info.scale,radarSize:1024,sites,layers};
  await writeFile(new URL(`${id}.txt`,directory),raw);
}
await writeFile(new URL('public/radar-data.js',root),`// Valve map assets via MurkyYT/cs2-map-icons @ ${revision}.\nexport const radarMaps=${JSON.stringify(catalog,null,2)};\n`);
await writeFile(new URL('SOURCE.md',directory),`# Radar assets\n\nMap images and overview calibration: copyright Valve Corporation.\nSource: https://github.com/MurkyYT/cs2-map-icons\nPinned revision: ${revision}\nWorld-to-image conversion uses the overview origin and scale, on the unrotated 1024-unit radar canvas. The overview rotate/zoom flags are spectator camera preferences, not an additional image transform.\n\nRegenerate: node scripts/download-radars.mjs\n`);
console.log(`Downloaded calibrated radars for ${Object.keys(catalog).length} maps.`);
