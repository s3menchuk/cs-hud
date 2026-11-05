export function bombProgress(state,now=Date.now()){
 const duration=Math.max(1,state.bombDuration||40);
 const seconds=Number.isFinite(state.bombSeconds)?state.bombSeconds:state.seconds;
 const elapsed=state.phase==='paused'?0:Math.max(0,now-state.updated)/1000;
 const remaining=Math.max(0,Math.min(duration,(Number(seconds)||0)-elapsed));
 return {duration,remaining,fraction:remaining/duration};
}
export function createBombProgressController(host){
 let state=null,frame=null;
 function paint(){
  frame=null;
  if(!state?.bomb)return;
  const bar=host.querySelector('.bomb-progress'),fill=bar?.querySelector('i');
  const value=bombProgress(state);
  if(fill)fill.style.transform=`scaleX(${value.fraction})`;
  if(bar){bar.setAttribute('aria-valuemax',String(value.duration));bar.setAttribute('aria-valuenow',String(Math.ceil(value.remaining)));}
  if(value.remaining>0&&state.phase!=='paused')frame=requestAnimationFrame(paint);
 }
 return {update(next){state=next;if(frame!==null)cancelAnimationFrame(frame);paint();}};
}
