'use strict';
const assert=require('node:assert/strict'),projection=require('../lib/session-order-estimates');
const rows=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events.filter(e=>e.sessionOrderEvidence),now=new Date('2026-10-10T23:00:00Z'),target=rows.find(e=>e.id.endsWith('184929')),first=rows.find(e=>e.id.endsWith('184942'));
assert(target&&first&&rows.length===4,'Actual visually reviewed Grandstand 2 sequence is required');const before=JSON.stringify(rows),initial=projection.estimate(target,rows,now);assert.equal(initial.startsAt,'2026-10-11T05:40:00.000Z');assert.equal(projection.apply(rows,now).find(e=>e.id===target.id).startTimeUtc,null);assert.equal(JSON.stringify(rows),before,'The raw official schedule remains intact');
assert.equal(projection.estimate({...target,sessionOrderEvidence:{...target.sessionOrderEvidence,court:'Stadium Court'}},rows,now),null,'Another court clock cannot time the match');
assert.equal(projection.estimate({...target,sessionOrderEvidence:{...target.sessionOrderEvidence,fixtureIds:[target.id,first.id]}},rows,now),null,'First clockless row cannot borrow a session clock');
const progressed=new Date('2026-10-11T05:00:00Z'),playing={...first,status:'live',statusCheckedAt:progressed.toISOString(),matchDurationSeconds:3600};assert.equal(projection.estimate(target,rows.map(e=>e.id===first.id?playing:e),progressed).startsAt,'2026-10-11T05:40:00.000Z');
const long=new Date('2026-10-11T06:00:00Z');assert.equal(projection.estimate(target,rows.map(e=>e.id===first.id?{...playing,statusCheckedAt:long.toISOString(),matchDurationSeconds:7200}:e),long).startsAt,'2026-10-11T06:25:00.000Z','A longer source-confirmed match shifts the provisional time');
for(const status of ['rain-delay','suspended','cancelled'])assert.equal(projection.estimate(target,rows.map(e=>e.id===first.id?{...playing,status}:e),progressed),null);
assert.equal(projection.estimate(target,rows.map(e=>e.id===first.id?{...playing,stale:true}:e),progressed),null);
const ended={...first,status:'completed',statusCheckedAt:progressed.toISOString(),actualEndTimeUtc:progressed.toISOString()};assert.equal(projection.estimate(target,rows.map(e=>e.id===first.id?ended:e),progressed).startsAt,'2026-10-11T05:10:00.000Z','Source-confirmed completion can advance an unsent estimate');
const provisional=projection.apply(rows,now).find(e=>e.id===target.id);assert.equal(require('../config/fixture-reminder-policy').timing(provisional,+now),null,'The derived clock cannot grant automatic timing');
assert.equal(projection.estimate(target,rows,new Date('2026-10-13T06:00:00Z')),null,'Old order-of-play inputs cannot schedule a reminder');
console.log('Actual court-bound provisional times: immutable official inputs, prior play/completion, interruption/failure holds and automatic exclusion passed.');
assert.equal(projection.estimate({...target,discipline:'doubles'},rows,now),null,'A singles duration model cannot schedule doubles');
assert.equal(projection.estimate(target,rows,new Date('2026-10-11T04:01:00Z')),null,'A stale scheduled predecessor cannot stand in for current play');
assert.equal(projection.contextIds([target.id],rows).length,4,'Selected timing reads include the bound preceding fixtures in their existing batch');
assert.equal(projection.contextIds(Array.from({length:60},(_,i)=>'qa:'+i),rows).length,60,'The existing sixty-ID read cap is hard');
const merged=require('../lib/live-fixtures').overlaySnapshots(rows,[{source_id:'tennis',checked_at:progressed.toISOString(),fixtures:[playing]}],{now:progressed});
assert.equal(merged.find(e=>e.id===target.id).manualStartEstimate.startsAt,'2026-10-11T05:40:00.000Z','The current shared source supplies preceding-match progress');
assert.equal(require('../lib/live-fixtures').overlaySnapshots(projection.apply(rows,now),[{source_id:'tennis',failure_count:1,fixtures:[playing]}],{now:progressed}).find(e=>e.id===target.id).manualStartEstimate,null,'A failed preceding source retracts its derived clock');
async function selectedRead(){
 const calls=[],handler=require('../lib/live-fixture-handler').createLiveFixtureHandler({clock:()=>progressed,publishedFixtures:()=>rows,read:async options=>{calls.push(options);return {sources:[{source_id:'tennis',checked_at:progressed.toISOString(),fixtures:[playing]}],revision:'qa',stale:false};}});
 const response={setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;},end(){}};
 await handler({method:'GET',url:'/api/fixtures?ids='+encodeURIComponent(target.id),headers:{}},response);
 assert.equal(response.statusCode,200);assert.equal(calls.length,1);assert(calls[0].ids.includes(first.id));assert.equal(response.body.sources[0].fixtures.length,1,'The preceding read does not expose unrequested fixtures');assert.equal(response.body.sources[0].fixtures[0].manualStartEstimate.startsAt,'2026-10-11T05:40:00.000Z');
 console.log('Shared and selected source progress uses one existing bounded read; missing, old and failed inputs hold estimates.');
}
selectedRead().catch(e=>{console.error(e);process.exitCode=1;});
