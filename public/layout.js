export const layoutParts={
  scoreboard:{selector:'.scoreboard',x:610,y:18,width:700,height:90},
  leftRoster:{selector:'.team-column.left',x:28,y:487,width:333,height:555},
  rightRoster:{selector:'.team-column.right',x:1559,y:487,width:333,height:555},
  radar:{selector:'.radar',x:28,y:90,width:333,height:300},
  focus:{selector:'.focus-card',x:715,y:925,width:490,height:117},
};
export function defaultLayout(){return {version:1,theme:{panel:'#111c23',text:'#ecf3f5',muted:'#9aadb7',backgroundOpacity:.94,radius:0,font:'condensed'},elements:Object.fromEntries(Object.entries(layoutParts).map(([id,p])=>[id,{x:p.x,y:p.y,scale:1,opacity:1,visible:true}]))};}
const bounded=(value,min,max)=>Math.max(min,Math.min(max,value));
export function constrainPart(id,part){
  const base=layoutParts[id],scale=bounded(part.scale,.5,1.5);
  return {...part,scale,x:bounded(part.x,0,1920-base.width*scale),y:bounded(part.y,0,1080-base.height*scale)};
}
export function validateLayout(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==1)throw new Error('layoutInvalid');
  const result=defaultLayout();
  if(!input.theme||!input.elements)throw new Error('layoutInvalid');
  for(const key of ['panel','text','muted']){
    if(typeof input.theme[key]!=='string'||!/^#[a-f0-9]{6}$/i.test(input.theme[key]))throw new Error('layoutInvalid');
    result.theme[key]=input.theme[key];
  }
  if(!['condensed','sans','mono'].includes(input.theme.font))throw new Error('layoutInvalid');
  result.theme.font=input.theme.font;
  for(const [key,min,max] of [['backgroundOpacity',0,1],['radius',0,24]]){
    if(typeof input.theme[key]!=='number'||!Number.isFinite(input.theme[key])||input.theme[key]<min||input.theme[key]>max)throw new Error('layoutInvalid');
    result.theme[key]=input.theme[key];
  }
  for(const id of Object.keys(layoutParts)){
    const part=input.elements[id];
    if(!part||typeof part.visible!=='boolean')throw new Error('layoutInvalid');
    for(const [key,min,max] of [['x',0,1920],['y',0,1080],['scale',.5,1.5],['opacity',.2,1]])if(typeof part[key]!=='number'||!Number.isFinite(part[key])||part[key]<min||part[key]>max)throw new Error('layoutInvalid');
    result.elements[id]=constrainPart(id,{x:part.x,y:part.y,scale:part.scale,opacity:part.opacity,visible:part.visible});
  }
  return result;
}
export function resolveLayout(input){try{return validateLayout(input);}catch{return defaultLayout();}}
export function layoutForSettings(settings={}){
  if(settings.layout)return resolveLayout(settings.layout);
  const layout=defaultLayout();layout.elements.radar.visible=settings.showRadar!==false;layout.elements.focus.visible=settings.showFocus!==false;
  return layout;
}
export function applyLayout(hud,input){
  const layout=resolveLayout(input);
  for(const [id,base] of Object.entries(layoutParts)){
    const node=hud.querySelector(base.selector);if(!node)continue;
    const part=layout.elements[id];
    Object.assign(node.style,{left:part.x+'px',top:part.y+'px',right:'auto',bottom:'auto',transform:`scale(${part.scale})`,transformOrigin:'top left',opacity:String(part.opacity),display:part.visible?'':'none'});
  }
  hud.classList.add('custom-layout');hud.dataset.font=layout.theme.font;
  const hex=layout.theme.panel;
  hud.style.setProperty('--layout-panel',`${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`);
  hud.style.setProperty('--layout-text',layout.theme.text);hud.style.setProperty('--layout-muted',layout.theme.muted);
  hud.style.setProperty('--layout-background-opacity',String(layout.theme.backgroundOpacity));hud.style.setProperty('--layout-radius',layout.theme.radius+'px');
}
