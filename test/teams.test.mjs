import test from 'node:test';
import assert from 'node:assert/strict';
import { displaySettings, createTeamTracker } from '../public/teams.js';
import { defaults } from '../lib.mjs';

const roster=side=>({players:Array.from({length:10},(_,i)=>({id:String(i),team:i<5?side:side==='CT'?'T':'CT'}))});
test('Team identity follows players across halves, overtime and map changes',()=>{
  const tracker=createTeamTracker();
  assert.equal(tracker.update(roster('CT'),'CT'),'CT');
  assert.equal(tracker.update(roster('T'),'CT'),'T');
  assert.equal(tracker.update({...roster('T'),mapId:'de_nuke'},'CT'),'T');
  assert.equal(tracker.update(roster('CT'),'CT'),'CT');
});
test('One player changing side does not swap both teams',()=>{
  const tracker=createTeamTracker(),state=roster('CT');tracker.update(state,'CT');
  state.players[0].team='T';assert.equal(tracker.update(state,'CT'),'CT');
});
test('Broadcast keeps names, logos, colors, series results and rosters in place across side switches',()=>{
  const settings={...defaults,leftName:'Alpha',rightName:'Bravo',leftLogo:'a',rightLogo:'b',seriesMaps:[{map:'Dust2',leftScore:13,rightScore:8,completed:true}]};
  const tracker=createTeamTracker();
  for(const side of ['CT','T','CT']){
    const state=roster(side),view=displaySettings(settings,tracker.update(state,'CT'));
    assert.equal(view.leftSide,side);
    for(const key of ['leftName','rightName','leftLogo','rightLogo','accentLeft','accentRight','seriesMaps'])assert.deepEqual(view[key],settings[key]);
    assert.deepEqual(state.players.filter(p=>p.team===view.leftSide).map(p=>p.id),['0','1','2','3','4']);
    assert.deepEqual(state.players.filter(p=>p.team!==view.leftSide).map(p=>p.id),['5','6','7','8','9']);
  }
});

test('Manual correction resets the tracked team assignment',()=>{
  const tracker=createTeamTracker();tracker.update(roster('CT'),'CT');tracker.reset(roster('CT'),'T');
  assert.equal(tracker.update(roster('CT'),'T'),'T');
  assert.equal(tracker.update(roster('T'),'T'),'CT');
});
