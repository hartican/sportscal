'use strict';
const assert=require('node:assert/strict');
const {normalizeFixture}=require('./build-code-inspector');
const results=require('../config/cricket-innings');
const source=require('../data/follow-sources/coverage.v1.json').events.find(e=>e.id==='fixture:cricket:CA:41001');
assert(source?.innings?.length===2,'actual sourced final regression required');
const projected=normalizeFixture(source,'sport:cricket');
assert.deepEqual(projected.innings,source.innings,'actual sourced innings survive Code/Schedule projection');
assert.equal(projected.scoreCheckedAt,source.scoreCheckedAt,'projection is not a new score observation');
const rows=results.cricketInnings(projected);
assert.deepEqual(rows.rows.map(r=>r.score),['165/9','102 all out']);
assert.deepEqual(rows.rows.map(r=>r.overs),['20.0','17.3']);
assert.equal(rows.unavailable,0);
const fixture={key:'cricket',status:'completed',participants:[{id:'test:one',name:'One'},{id:'test:two',name:'Two'}],innings:[{inningNumber:1,participantId:'test:one',runsScored:0,numberOfWicketsFallen:0,oversBowled:'0.0'}]};
assert.equal(results.cricketInnings(fixture).rows[0].score,'0/0');
for(const patch of [{runsScored:null},{runsScored:''},{runsScored:-1},{runsScored:1.5},{numberOfWicketsFallen:null},{numberOfWicketsFallen:11},{oversBowled:'1.6'},{participantId:'unknown'},{inningNumber:0}]){
 const next={...fixture,innings:[{...fixture.innings[0],...patch}]};
 assert.equal(results.cricketInnings(next).rows.length,0,JSON.stringify(patch));assert.equal(results.cricketInnings(next).unavailable,1);
}
for(const flag of ['isDeclared','isFollowOn','isForfeited'])assert(results.cricketInnings({...fixture,innings:[{...fixture.innings[0],[flag]:true}]}).rows[0].notes);
const repeated={...fixture,innings:[{...fixture.innings[0],inningNumber:4,participantId:'test:two'},{...fixture.innings[0],inningNumber:1},{...fixture.innings[0],inningNumber:3},{...fixture.innings[0],inningNumber:2,participantId:'test:two'}]};
assert.deepEqual(results.cricketInnings(repeated).rows.map(r=>r.inningNumber),[1,2,3,4]);
assert.equal(results.cricketInnings({...fixture,innings:[fixture.innings[0],fixture.innings[0]]}).rows.length,0,'duplicate innings fail closed');
for(const status of ['scheduled','upcoming','abandoned','cancelled','postponed','unknown'])assert.equal(results.cricketInnings({...fixture,status}),null,status);
assert.equal(results.cricketInnings({...fixture,status:'live'}).label,'Latest sourced innings');
assert.equal(results.cricketInnings({...fixture,key:'football'}),null);
console.log('Cricket innings: real projection, original date, chronological innings, zero, missing/invalid facts, unknown identities, qualifiers and status boundaries passed.');
