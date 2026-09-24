'use strict';
const assert=require('node:assert/strict');
const {overlaySnapshots}=require('../lib/live-fixtures');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const base={id:'fixture:cricket:espn:1525655',key:'cricket',status:'scheduled',startTimeUtc:'2026-09-24T08:00:00Z',homeParticipantId:'team:cricket:south-africa',awayParticipantId:'team:cricket:australia'};
const scoreTime='2026-09-24T11:42:00Z',scheduleTime='2026-09-24T11:44:00Z';
const live={...base,status:'live',innings:[{team:'South Africa Men',runs:235,wickets:5,overs:'44.1'}]};
const snapshots=[{checked_at:scoreTime,fixtures:[live]},{checked_at:scheduleTime,fixtures:[{...base,innings:[]}]}];
const merged=overlaySnapshots([base],snapshots)[0];
assert.equal(merged.status,'live','schedule-only update must not regress confirmed live status');
assert.equal(merged.innings[0].runs,235);assert.equal(merged.scoreCheckedAt,scoreTime);assert.equal(merged.statusCheckedAt,scoreTime);
assert.deepEqual(overlaySnapshots([base],[...snapshots].reverse()),overlaySnapshots([base],snapshots));
for(const status of ['stumps','suspended','completed','cancelled','postponed']){
 const e=overlaySnapshots([base],[...snapshots,{checked_at:'2026-09-24T11:46:00Z',fixtures:[{...base,status}]}])[0];
 assert.equal(e.status,status);assert.equal(e.innings[0].runs,235);assert.equal(e.scoreCheckedAt,scoreTime);
 assert.equal(e.statusCheckedAt,'2026-09-24T11:46:00Z');
}
(async()=>{let output;
 const h=createMatchCentreHandler({enabled:()=>true,published:()=>[base],request:async()=>snapshots.map(s=>({checked_at:s.checked_at,fixture:s.fixtures[0]}))});
 await h({url:'/api/match-centre?ids='+base.id},{setHeader(){},status(){return this;},json(d){output=d.fixtures[0];}});
 assert.equal(output.status,'live');assert.equal(output.checkedAt,scoreTime);assert.equal(output.scoreCheckedAt,scoreTime);assert.equal(output.statusCheckedAt,scoreTime);
 console.log('Match observations: score/status provenance, schedule regression, interruptions, cancellation and unordered sources passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
