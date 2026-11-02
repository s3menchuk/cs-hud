export const seriesDefaults={seriesFormat:3,currentMap:1,seriesMaps:[]};

export function validateSeries(settings){
  const {seriesFormat,currentMap,seriesMaps}=settings;
  if(![1,3,5].includes(seriesFormat))throw new Error('Формат серии должен быть BO1, BO3 или BO5.');
  if(!Number.isInteger(currentMap)||currentMap<1||currentMap>seriesFormat)throw new Error('Выберите текущую карту в пределах серии.');
  if(!Array.isArray(seriesMaps)||seriesMaps.length>seriesFormat)throw new Error(`В BO${seriesFormat} может быть не больше ${seriesFormat} карт.`);
  const needed=Math.ceil(seriesFormat/2);let left=0,right=0,gap=false;
  const maps=seriesMaps.map((row,index)=>{
    if(!row||typeof row!=='object'||typeof row.map!=='string'||row.map.length>40||typeof row.completed!=='boolean')throw new Error(`Проверьте данные карты ${index+1}.`);
    for(const score of [row.leftScore,row.rightScore])if(score!==null&&(!Number.isInteger(score)||score<0||score>99))throw new Error(`Счёт карты ${index+1}: целое число от 0 до 99.`);
    if(row.completed){
      if(gap)throw new Error('Заполняйте результаты сыгранных карт по порядку.');
      if(left===needed||right===needed)throw new Error('После победы в серии дополнительные сыгранные карты невозможны.');
      if(!row.map.trim()||row.leftScore===null||row.rightScore===null||row.leftScore===row.rightScore)throw new Error(`Для сыгранной карты ${index+1} укажите название и счёт без ничьей.`);
      if(row.leftScore>row.rightScore)left++;else right++;
    }else gap=true;
    return {map:row.map.trim(),leftScore:row.leftScore,rightScore:row.rightScore,completed:row.completed};
  });
  return {seriesFormat,currentMap,seriesMaps:maps};
}

export function seriesSummary(settings){
  let series;
  try{series=validateSeries({...seriesDefaults,...settings});}catch{series={...seriesDefaults};}
  let leftWins=0,rightWins=0;
  const maps=Array.from({length:series.seriesFormat},(_,i)=>{
    const row=series.seriesMaps[i]||{map:'',leftScore:null,rightScore:null,completed:false};
    const winner=row.completed?(row.leftScore>row.rightScore?'left':'right'):null;
    if(winner==='left')leftWins++;if(winner==='right')rightWins++;
    return {...row,index:i+1,winner,current:i+1===series.currentMap&&!row.completed};
  });
  const needed=Math.ceil(series.seriesFormat/2);
  const winner=leftWins===needed?'left':rightWins===needed?'right':null;
  return {...series,maps:maps.map(m=>({...m,current:m.current&&!winner})),leftWins,rightWins,needed,winner};
}

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function winnerLogo(settings,side){
  const name=settings[side+'Name']||'',logo=settings[side+'Logo'];
  const image=typeof logo==='string'&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(logo);
  return `<span class="map-winner-logo" title="${escape(name)}">${image?`<img src="${escape(logo)}" alt="${escape(name)}">`:`<span class="map-winner-tag">${escape(settings[side+'Tag']||name.slice(0,3))}</span>`}</span>`;
}
export function renderSeriesHistory(settings,state){
  const series=seriesSummary(settings);
  const winner=series.winner?settings[series.winner+'Name']:null;
  return `<div class="map-history" aria-label="История карт BO${series.seriesFormat}">${series.maps.map(row=>`<div title="${escape(row.map||(row.current?state.map:'КАРТА '+row.index))}${row.winner?' · '+row.leftScore+':'+row.rightScore+' · '+escape(settings[row.winner+'Name']):''}" class="map-result ${row.winner?'won-'+row.winner:row.current?'map-current':'map-pending'}"><span class="map-result-index">${String(row.index).padStart(2,'0')}</span>${row.winner?winnerLogo(settings,row.winner):''}<div class="map-result-info"><strong>${escape(row.map||(row.current?state.map:'КАРТА '+row.index))}</strong><small>${row.winner?escape(settings[row.winner+'Name']):row.current?'ТЕКУЩАЯ КАРТА':series.winner?'НЕ ПОТРЕБОВАЛАСЬ':'ВПЕРЕДИ'}</small></div><span class="map-result-score">${row.completed?`${row.leftScore}<i>:</i>${row.rightScore}`:row.current?'<b class="map-live-dot"></b>':'—'}</span></div>`).join('')}${winner?`<div class="series-winner won-${series.winner}">ПОБЕДИТЕЛЬ СЕРИИ <strong>${escape(winner)}</strong><b>${series.leftWins}:${series.rightWins}</b></div>`:''}</div>`;
}
