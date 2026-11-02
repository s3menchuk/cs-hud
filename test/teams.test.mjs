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
test('Broadcast swaps names, logos, colors and series scores with team identities',()=>{
  const settings={...defaults,leftName:'Alpha',rightName:'Bravo',leftLogo:'a',rightLogo:'b',seriesMaps:[{map:'Dust2',leftScore:13,rightScore:8,completed:true}]};
  const view=displaySettings(settings,'T');
  assert.equal(view.leftSide,'CT');assert.equal(view.leftName,'Bravo');assert.equal(view.rightName,'Alpha');
  assert.equal(view.leftLogo,'b');assert.equal(view.rightLogo,'a');assert.equal(view.accentLeft,settings.accentRight);
  assert.equal(view.seriesMaps[0].leftScore,8);assert.equal(view.seriesMaps[0].rightScore,13);
  assert.equal(settings.seriesMaps[0].leftScore,13);assert.equal(settings.leftName,'Alpha');
});
test('Manual correction resets the tracked team assignment',()=>{
  const tracker=createTeamTracker();tracker.update(roster('CT'),'CT');tracker.reset(roster('CT'),'T');
  assert.equal(tracker.update(roster('CT'),'T'),'T');
  assert.equal(tracker.update(roster('T'),'T'),'CT');
});
