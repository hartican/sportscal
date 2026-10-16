'use strict';
const assert=require('node:assert/strict');
const scores=require('../config/feed-live-scores');
const captured=require('./fixtures/cricket-result-fallback-20261016.json');
const fixture=captured.fixture,before=JSON.stringify(fixture);
assert.equal(captured.sourceSha,'419db41a29d2015726e56bb7941423d2087d6598');
assert.equal(fixture.id,'fixture:cricket:espn:1525659');
assert.equal(fixture.status,'completed');
assert.equal(fixture.outcomeText,'Australia won by 214 runs');
assert.equal(scores.presentation(fixture,{resultsOn:true}),null,'No innings are invented to replace the sourced outcome');
function card(){
 let retained=true;
 const line={remove(){retained=false;}};
 return {classList:{contains:()=>false},querySelector:selector=>selector==='.card-result-line'&&retained?line:null,querySelectorAll:()=>[],retained:()=>retained};
}
const visible=card();
scores.install(visible,fixture,{resultsOn:true});
assert(visible.retained(),'An unavailable detailed score must retain the confirmed winner and margin');
scores.install(visible,fixture,{resultsOn:true});
assert(visible.retained(),'Repeated enhancement retains the original outcome');
scores.install(visible,fixture,{resultsOn:false});
assert(!visible.retained(),'Results OFF removes any previously visible outcome');
const hidden=card();scores.install(hidden,fixture,{resultsOn:false});
assert(!hidden.retained(),'An initially hidden policy cannot leak the static result');
assert.equal(JSON.stringify(fixture),before,'Enhancement preserves every captured fact and observation clock');
console.log('Cricket outcome fallback: captured 214-run winner, unavailable innings, repeat enhancement, Results OFF and immutable evidence passed.');
