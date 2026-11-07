#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const bundle=require('../data/canonical/afl-nrl-2026.json');
const {syncCanonicalFixtures}=require('./sync-canonical-fixtures-to-feed');
const {mergeFixtureRecords}=require('./build-code-inspector');
function validate(){
 const {canonical:fixture,previous:supplied}=require('./fixtures/aflw-canonical-live-transition.json');
 // Replay the real missed transition, independently of later source refreshes.
 const live={...fixture,status:'live',source:{...fixture.source,checkedAt:'2026-10-04T05:49:24.432Z'}};
 const previous={...supplied,status:'upcoming',statusCheckedAt:'2026-09-27T09:10:54.000Z',sourceCheckedAt:'2026-10-01T11:50:40.000Z'};
 const output=syncCanonicalFixtures({events:[previous]},{...bundle,events:[live]},{publishedAt:'2026-10-04T06:00:00Z'}).output;
 const projected=output.events;
 assert.equal(projected.length,1,'A live transition retains one existing action identity');
 assert.equal(projected[0].status,'live','Actual canonical LIVE must survive the Feed publication writer');
 assert.equal(projected[0].statusCheckedAt,live.source.checkedAt,'The source observation, not assembly time, dates the status');
 const validateFeed=require('./lib/feed-utils').validateFeed;
 assert.deepEqual(validateFeed(output),[],'The actual legacy canonical card passes publication validation');
 assert(validateFeed({...output,events:[{...projected[0],statusCheckedAt:'2099-01-01T00:00:00Z'}]}).some(e=>e.includes('.status')),'Canonical provenance cannot waive an invalid status observation');
 for(const records of [[live,previous],[previous,live]]){
  const merged=mergeFixtureRecords([],records,'sport:aflw',new Set([live]));
  assert.equal(merged.length,1);
  assert.equal(merged[0].status,'live','Code/Schedule publication cannot let an older preview shadow canonical LIVE');
  assert.equal(merged[0].statusCheckedAt,live.source.checkedAt);
 }
 const apply=require('../lib/canonical-status-observations').apply;
 const next=apply(previous,live);
 const statusKeys=new Set(['status','statusCheckedAt','statusSourceUrl']);
 for(const key of new Set([...Object.keys(previous),...Object.keys(next)]))if(!statusKeys.has(key))assert.deepEqual(next[key],previous[key],key+': status-only publication preserves the previous fact');
 assert.deepEqual(apply(next,live),next,'Unchanged reruns cannot renew the observation');
 for(const patch of [
  {source:{...live.source,checkedAt:'2099-01-01T00:00:00Z'}},
  {source:{...live.source,checkedAt:'2026-02-30T00:00:00Z'}},
  {source:{...live.source,checkedAt:'2026-10-04T03:00:00Z'}},
  {source:{...live.source,sourceUrl:'https://user:password@example.test/fixture'}},
  {source:{...live.source,sourceUrl:'javascript:alert(1)'}},
  {source:{...live.source,sourceType:'community'}},
  {participantIds:[...live.participantIds].reverse()},
  {startTimeUtc:'2026-10-04T04:06:00Z'},
  {competitionId:'competition:afl-premiership-2026'},
  {id:'unrelated-fixture'},
 ])assert.deepEqual(apply(previous,{...live,...patch}),previous,'Reject invalid, premature or different-fixture live observations');
 for(const status of ['completed','finished','final','abandoned','cancelled','postponed'])assert.deepEqual(apply({...previous,status},live),{...previous,status},'Live cannot reopen a settled/non-playing fixture: '+status);
 for(const stamp of [live.source.checkedAt,'2026-10-04T05:50:00Z'])assert.deepEqual(apply({...previous,statusCheckedAt:stamp},live),{...previous,statusCheckedAt:stamp},'Equal/older contradictory facts cannot replace a status');
 for(const status of ['postponed','cancelled'])assert.equal(apply(previous,{...live,status}).status,status,'Explicit source non-playing states reach an existing fixture');
 const generated=syncCanonicalFixtures({events:[]},{...bundle,events:[live]},{publishedAt:'2026-10-04T06:00:00Z'}).output.events;
 assert.equal(generated.length,1,'A first publication during play retains the sourced fixture');
 assert.equal(generated[0].status,'live');
 assert.equal(generated[0].statusCheckedAt,live.source.checkedAt);
 const final={...previous,status:'completed',homeScore:71,awayScore:16,scoreCheckedAt:'2026-10-04T05:49:24.432Z'};
 assert.equal(syncCanonicalFixtures({events:[final]},{...bundle,events:[live]},{publishedAt:'2026-10-04T06:00:00Z'}).output.events[0].status,'completed','The actual writer never reopens an existing final');
 const timing=require('../config/card-timing'),controls=require('../config/feed-controls');
 assert.equal(timing.presentation(next,'2026-10-04T06:00:00Z').status,'LIVE','A fresh explicit observation is live');
 for(const status of ['live','upcoming']){
  const stale={...next,status};
  assert.equal(timing.presentation(stale,'2026-10-04T08:00:00Z').status,'Awaiting match update','Stale or missing match observations cannot claim ongoing play');
  assert.equal(controls.timingState(stale,new Date('2026-10-04T08:00:00Z')).key,'awaiting-update');
 }
 assert.equal(timing.presentation({...next,status:'completed'},'2026-10-04T08:00:00Z').status,'FINISHED','Verified final status retains precedence');
 console.log('Actual canonical LIVE survives Feed and both Code merge orders with its original observation');
}
if(require.main===module)validate();
module.exports={validate};
