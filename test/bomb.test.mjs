import test from 'node:test';
import assert from 'node:assert/strict';
import {createBombTracker,normalizeGsi} from '../lib.mjs';
import {bombProgress} from '../public/bomb.js';

const state=(bombState,phase,seconds,countdown,updated)=>({...normalizeGsi({map:{name:'de_ancient',round:3},bomb:{state:bombState,countdown},phase_countdowns:{phase,phase_ends_in:String(seconds)}}),updated});
test('C4 progress keeps counting toward explosion during defusing and resets after the round',()=>{
 const tracker=createBombTracker();
 let value=tracker.update(state('planted','bomb',32,32,1000));
 assert.equal(value.bombSeconds,32);assert.equal(value.bombDuration,40);
 value=tracker.update(state('defusing','defuse',5,5,2000));assert.equal(value.bombSeconds,31);
 value=tracker.update(state('defusing','defuse',4,4,3000));assert.equal(value.bombSeconds,30);
 value=tracker.update(state('planted','bomb',29,29,4000));assert.equal(value.bombSeconds,29);
 value=tracker.update(state('defused','over',7,null,5000));assert.equal(value.bomb,false);assert.equal(value.bombSeconds,null);
 value=tracker.update(state('planted','bomb',40,40,6000));assert.equal(value.bombSeconds,40);
});
test('C4 bar decreases smoothly between packets and stops at zero',()=>{
 const planted={bombSeconds:20,bombDuration:40,seconds:5,phase:'defuse',updated:1000};
 assert.equal(bombProgress(planted,1000).fraction,.5);
 assert.equal(bombProgress(planted,1500).fraction,.4875);
 assert.equal(bombProgress(planted,99999).fraction,0);
 assert.equal(bombProgress({...planted,phase:'paused'},1500).fraction,.5);
});
