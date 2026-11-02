import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Pin the upstream revision so a refresh produces the same asset bundle.
const revision='64ccdcbc0a1bfe4ada0630416ae20087c239a38b';
const prefix='cs2/panorama/images/icons/equipment/';
const root=new URL('../',import.meta.url);
const directory=new URL('public/assets/equipment/',root);
await mkdir(directory,{recursive:true});
async function get(url){const response=await fetch(url);if(!response.ok)throw new Error(`${response.status}: ${url}`);return response;}
const tree=await (await get(`https://api.github.com/repos/Juknum/counter-strike-icons/git/trees/${revision}?recursive=1`)).json();
const paths=tree.tree.filter(entry=>entry.path.startsWith(prefix)&&entry.path.endsWith('.svg')).map(entry=>entry.path).sort();
const atlas={};
for(let start=0;start<paths.length;start+=8){
  await Promise.all(paths.slice(start,start+8).map(async path=>{
    const name=path.slice(prefix.length,-4);
    const raw=await (await get(`https://raw.githubusercontent.com/Juknum/counter-strike-icons/${revision}/${path}`)).text();
    const match=raw.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/i);
    if(!match)throw new Error(`Invalid SVG: ${name}`);
    const viewBox=match[1].match(/viewBox="([\d.\s-]+)"/i)?.[1];
    const body=match[2].replace(/<!--[\s\S]*?-->/g,'').replace(/\s+id="[^"]*"/g,'').replace(/fill="(?:#[\da-f]{3,8}|white)"/gi,'fill="currentColor"').replace(/\s+/g,' ').trim();
    if(!viewBox||/<(?:script|foreignObject|image|use|style|iframe)\b|\bon\w+\s*=|(?:href|url\s*\()/i.test(body))throw new Error(`Unsafe SVG: ${name}`);
    atlas[name]={viewBox,body};
    await writeFile(new URL(`${name}.svg`,directory),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor">${body}</svg>\n`);
  }));
}
const ordered=Object.fromEntries(Object.entries(atlas).sort(([a],[b])=>a.localeCompare(b)));
const markerStart='// BEGIN GENERATED EQUIPMENT ICONS';
const markerEnd='// END GENERATED EQUIPMENT ICONS';
let app=await readFile(new URL('public/app.js',root),'utf8');
if(app.includes(markerStart))app=app.slice(app.indexOf(markerEnd)+markerEnd.length).trimStart();
await writeFile(new URL('public/app.js',root),`${markerStart}\n// Valve game assets via Juknum/counter-strike-icons @ ${revision}.\nconst equipmentIcons=${JSON.stringify(ordered)};\n${markerEnd}\n${app}`);
await writeFile(new URL('SOURCE.md',directory),`# Equipment icons\n\nOriginal Counter-Strike 2 game assets, copyright Valve Corporation.\nSource: https://github.com/Juknum/counter-strike-icons\nPinned revision: ${revision}\nPath: ${prefix}\n\n${paths.length} SVG files. Fill colors normalized to currentColor; metadata and element IDs removed.\nThe same vectors are embedded into public/app.js for local, request-free rendering in OBS.\nRegenerate with: node scripts/download-icons.mjs\n`);
console.log(`Downloaded and embedded ${paths.length} CS2 equipment icons.`);
