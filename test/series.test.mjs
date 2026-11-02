import test from 'node:test';
import assert from 'node:assert/strict';
import { seriesDefaults, validateSeries, seriesSummary, renderSeriesHistory } from '../public/series.js';

const win=(side,map='Mirage')=>({map,leftScore:side==='left'?13:8,rightScore:side==='right'?13:8,completed:true});
test('BO1 has one current map and ends after one win for either team',()=>{
  const settings={seriesFormat:1,currentMap:1,seriesMaps:[]};
  const live=seriesSummary(settings);
  assert.equal(live.maps.length,1);assert.equal(live.needed,1);assert.equal(live.maps[0].current,true);assert.equal(live.winner,null);
  for(const side of ['left','right']){
    const result=seriesSummary({...settings,seriesMaps:[win(side)]});
    assert.equal(result.winner,side);assert.equal(result.maps[0].current,false);assert.equal(result[side+'Wins'],1);
  }
  assert.throws(()=>validateSeries({...settings,currentMap:2}));
  assert.throws(()=>validateSeries({...settings,seriesMaps:[win('left'),win('right')]}));
});
test('BO3 counts map wins and ends at 2:0',()=>{
  const result=seriesSummary({...seriesDefaults,seriesMaps:[win('left'),win('left','Nuke')]});
  assert.equal(result.leftWins,2);assert.equal(result.rightWins,0);assert.equal(result.winner,'left');
  assert.equal(result.maps[2].current,false);assert.equal(result.maps[0].winner,'left');
});
test('BO5 can reach the deciding fifth map and end at 3:2',()=>{
  const settings={seriesFormat:5,currentMap:5,seriesMaps:['left','right','right','left'].map(side=>win(side))};
  const before=seriesSummary(settings);assert.equal(before.leftWins,2);assert.equal(before.rightWins,2);assert.equal(before.winner,null);assert.equal(before.maps[4].current,true);
  const after=seriesSummary({...settings,seriesMaps:[...settings.seriesMaps,win('right')]});
  assert.equal(after.winner,'right');assert.equal(after.rightWins,3);assert.equal(after.leftWins,2);
});
test('Series rejects ties, gaps, excess maps and results after clinch',()=>{
  for(const settings of [
    {...seriesDefaults,seriesMaps:[{...win('left'),leftScore:13,rightScore:13}]},
    {...seriesDefaults,seriesMaps:[{map:'',leftScore:null,rightScore:null,completed:false},win('left')]},
    {...seriesDefaults,seriesMaps:[win('left'),win('left'),win('right')]},
    {...seriesDefaults,seriesMaps:Array(4).fill(win('left'))},
    {...seriesDefaults,currentMap:4},
    {...seriesDefaults,seriesMaps:[{...win('left'),leftScore:-1}]},
  ])assert.throws(()=>validateSeries(settings));
});
test('Round score and CT/T swaps do not change series results; markup escapes team names',()=>{
  const settings={...seriesDefaults,leftName:'A <script>',rightName:'B',leftSide:'CT',seriesMaps:[win('right')]};
  assert.equal(seriesSummary(settings).rightWins,seriesSummary({...settings,leftSide:'T'}).rightWins);
  const html=renderSeriesHistory({...settings,seriesMaps:[win('left'),win('left')]},{map:'ANCIENT',scoreCT:99,scoreT:0});
  assert.ok(html.includes('A &lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('ПОБЕДИТЕЛЬ СЕРИИ'));
});
test('Completed maps display the winning team logo, including after a side swap',async()=>{
  const {displaySettings}=await import('../public/teams.js');
  const settings={...seriesDefaults,leftName:'Alpha',rightName:'Bravo',leftTag:'A',rightTag:'B',leftLogo:'data:image/png;base64,AA==',rightLogo:'data:image/png;base64,AQ==',seriesMaps:[win('right'),win('left')]};
  for(const view of [settings,displaySettings(settings,'T')]){
    const html=renderSeriesHistory(view,{map:'Ancient'});
    assert.ok(html.indexOf('src="data:image/png;base64,AQ=="')<html.indexOf('src="data:image/png;base64,AA=="'));
    assert.equal((html.match(/class="map-winner-logo"/g)||[]).length,2);
    assert.ok(!html.includes('◂')&&!html.includes('▸'));
  }
});
