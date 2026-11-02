import { defaultLayout, layoutForSettings, validateLayout, layoutParts, constrainPart, applyLayout } from './layout.js';
import { t } from './i18n.js';

export function createLayoutEditor({hud,getSettings,onSave,onChange=()=>{}}){
  let draft=defaultLayout(),baseline=JSON.stringify(draft),dirty=false,active=false,selected='scoreboard',signature='',saving=false,drag=null;
  const undo=[],redo=[];
  const panel=document.getElementById('editor-tab');
  const layer=document.createElement('div');layer.className='layout-guides';layer.hidden=true;hud.append(layer);
  for(const [id,base] of Object.entries(layoutParts)){
    const guide=document.createElement('div');guide.className='layout-guide';guide.dataset.part=id;guide.tabIndex=0;
    guide.innerHTML='<span class="layout-guide-label"></span><span class="layout-resize" aria-hidden="true"></span>';layer.append(guide);
  }
  const field=name=>panel.querySelector(`[name="${name}"]`);
  function push(before){if(before===JSON.stringify(draft))return;undo.push(before);if(undo.length>50)undo.shift();redo.length=0;}
  function show(){
    applyLayout(hud,draft);layer.hidden=!active;
    layer.classList.toggle('with-grid',field('grid').checked);
    for(const guide of layer.children){
      const id=guide.dataset.part,p=draft.elements[id],base=layoutParts[id];
      const node=hud.querySelector(base.selector),width=node?.offsetWidth||base.width,height=node?.offsetHeight||base.height;
      Object.assign(guide.style,{left:p.x+'px',top:p.y+'px',width:width*p.scale+'px',height:height*p.scale+'px'});
      guide.classList.toggle('selected',id===selected);guide.classList.toggle('element-hidden',!p.visible);
      guide.querySelector('.layout-guide-label').textContent=t('part_'+id);guide.setAttribute('aria-label',t('part_'+id));
    }
    const p=draft.elements[selected];
    field('part').value=selected;
    for(const key of ['x','y'])field(key).value=Math.round(p[key]);
    field('scale').value=Math.round(p.scale*100);field('opacity').value=Math.round(p.opacity*100);field('visible').checked=p.visible;
    panel.querySelector('[data-value="scale"]').textContent=Math.round(p.scale*100)+'%';panel.querySelector('[data-value="opacity"]').textContent=Math.round(p.opacity*100)+'%';
    for(const key of ['panel','text','muted','font','radius'])field(key).value=draft.theme[key];
    field('backgroundOpacity').value=Math.round(draft.theme.backgroundOpacity*100);
    panel.querySelector('[data-value="backgroundOpacity"]').textContent=Math.round(draft.theme.backgroundOpacity*100)+'%';
    panel.querySelector('[data-value="radius"]').textContent=draft.theme.radius+' px';
    panel.querySelector('[data-editor="undo"]').disabled=!undo.length||saving;panel.querySelector('[data-editor="redo"]').disabled=!redo.length||saving;
    panel.querySelector('[data-editor="save"]').disabled=saving||!dirty;
    panel.querySelector('#layout-status').textContent=t(saving?'layoutSaving':dirty?'layoutDraft':'layoutSaved');
  }
  function refresh(){dirty=JSON.stringify(draft)!==baseline;show();onChange();}
  function mutate(change){const before=JSON.stringify(draft);change();draft=validateLayout(draft);push(before);refresh();}
  function sync(settings={}){
    const next=JSON.stringify(layoutForSettings(settings));
    if(next!==signature){signature=next;baseline=next;if(!dirty){draft=JSON.parse(next);undo.length=0;redo.length=0;}show();}
    // The HUD content gets rebuilt on GSI packets; reapply its current draft.
    applyLayout(hud,draft);
  }
  field('part').onchange=()=>{selected=field('part').value;show();};
  for(const key of ['x','y','scale','opacity','visible'])field(key).addEventListener('input',()=>{
    if(saving)return;
    const value=key==='visible'?field(key).checked:Number(field(key).value);
    if(key!=='visible'&&field(key).value==='')return;
    mutate(()=>{draft.elements[selected]=constrainPart(selected,{...draft.elements[selected],[key]:key==='scale'||key==='opacity'?value/100:value});});
  });
  for(const key of ['panel','text','muted','font','radius','backgroundOpacity'])field(key).addEventListener('input',()=>{
    if(saving)return;
    mutate(()=>{draft.theme[key]=['radius','backgroundOpacity'].includes(key)?Number(field(key).value)/(key==='backgroundOpacity'?100:1):field(key).value;});
  });
  field('grid').onchange=show;
  const actions={
    undo(){if(!undo.length||saving)return;redo.push(JSON.stringify(draft));draft=JSON.parse(undo.pop());refresh();},
    redo(){if(!redo.length||saving)return;undo.push(JSON.stringify(draft));draft=JSON.parse(redo.pop());refresh();},
    resetPart(){mutate(()=>{draft.elements[selected]=defaultLayout().elements[selected];});},
    resetAll(){mutate(()=>{draft=defaultLayout();});},
    discard(){if(saving)return;const before=JSON.stringify(draft);draft=JSON.parse(baseline);push(before);refresh();},
    async save(){
      if(saving||!dirty)return;saving=true;show();
      const snapshot=validateLayout(draft);
      try{await onSave(snapshot);baseline=JSON.stringify(snapshot);signature=baseline;dirty=JSON.stringify(draft)!==baseline;}
      catch{panel.querySelector('#layout-status').textContent=t('layoutSaveError');saving=false;panel.querySelector('[data-editor="save"]').disabled=false;return;}
      saving=false;show();
    },
    export(){
      const blob=new Blob([JSON.stringify(validateLayout(draft),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='cs2-hud-layout.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    },
    import(){panel.querySelector('#layout-file').click();},
  };
  panel.addEventListener('click',event=>{const button=event.target.closest('[data-editor]');if(button&&!button.disabled)actions[button.dataset.editor]?.();});
  panel.querySelector('#layout-file').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{if(file.size>64000)throw new Error();const next=validateLayout(JSON.parse(await file.text()));mutate(()=>{draft=next;});}
    catch{panel.querySelector('#layout-status').textContent=t('layoutInvalid');}
  };
  layer.addEventListener('pointerdown',event=>{
    const guide=event.target.closest('[data-part]');if(!active||!guide||saving||event.button!==0)return;
    event.preventDefault();selected=guide.dataset.part;guide.focus({preventScroll:true});
    drag={pointer:event.pointerId,node:guide,resize:!!event.target.closest('.layout-resize'),screenX:event.clientX,screenY:event.clientY,part:{...draft.elements[selected]},before:JSON.stringify(draft)};
    guide.setPointerCapture(event.pointerId);show();
  });
  layer.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer)return;
    const scale=hud.getBoundingClientRect().width/1920,dx=(event.clientX-drag.screenX)/scale,dy=(event.clientY-drag.screenY)/scale;
    const base=layoutParts[selected];
    draft.elements[selected]=constrainPart(selected,drag.resize?{...drag.part,scale:drag.part.scale+(Math.abs(dx/base.width)>Math.abs(dy/base.height)?dx/base.width:dy/base.height)}:{...drag.part,x:drag.part.x+dx,y:drag.part.y+dy});
    refresh();
  });
  function finish(event){if(!drag||event.pointerId!==drag.pointer)return;push(drag.before);drag=null;refresh();}
  layer.addEventListener('pointerup',finish);layer.addEventListener('pointercancel',finish);
  layer.addEventListener('keydown',event=>{
    if(!active||saving)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();actions[event.shiftKey?'redo':'undo']();return;}
    const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},move=moves[event.key];if(!move)return;
    event.preventDefault();const step=event.shiftKey?10:1;mutate(()=>{const p=draft.elements[selected];draft.elements[selected]=constrainPart(selected,{...p,x:p.x+move[0]*step,y:p.y+move[1]*step});});
  });
  sync(getSettings());show();
  return {sync,getDraft:()=>draft,setActive(value){active=value;show();},translate(){show();},isDirty:()=>dirty};
}
