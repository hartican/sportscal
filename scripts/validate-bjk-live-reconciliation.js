#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),adapter=require('../lib/bjk-live'),{refreshInterval,contentHash}=require('../lib/live-fixtures');
const canonical=require('../data/canonical/tennis-team-contests.v1.json').fixtures.filter(f=>f.tournamentId==='tournament:tennis:bjk-cup-finals-2026');
const now=new Date('2026-10-01T01:00:00Z');
const stale=structuredClone(canonical).map((f,i)=>{if(i>2){f.status=i===3?'live':'upcoming';delete f.result;delete f.score;delete f.winnerParticipantId;}return f;});
(async()=>{
 let calls=0;const fetchImpl=()=>{calls++;throw Error('No reports should be fetched for reconciled terminal ties');};
 assert.equal(refreshInterval(stale,now),120000);
 const result=await adapter.refresh({previous:stale,now,fetchImpl});
 assert.equal(result.filter(f=>f.status==='completed').length,7,'All seven reviewed results must replace the stale live source, even outside the one-day report window');
 assert.deepEqual(result.map(f=>f.id),stale.map(f=>f.id));assert.equal(calls,0);assert.equal(refreshInterval(result,now),1800000);
 for(const f of result){assert.equal(f.result.score,canonical.find(c=>c.id===f.id).result.score);assert.equal(f.result.checkedAt,canonical.find(c=>c.id===f.id).result.checkedAt);}
 let published;const run=await require('../lib/live-fixtures').refreshDueSources({sources:[{id:'live-bjk-cup',seed:canonical,fetch:adapter.refresh}],now,store:{dueIds:async()=>[],claim:async()=>({fixtures:stale}),publish:async(id,token,value)=>{assert.equal(id,'live-bjk-cup');published=value;},fail:async()=>{throw Error('Unexpected source failure');}}});
 assert.deepEqual(run.failed,[]);assert.deepEqual(run.refreshed,['live-bjk-cup']);assert.equal(published.fixtures.filter(f=>f.status==='completed').length,7);assert.equal(published.intervalMs,1800000,'The existing leased owner must publish the ordinary idle interval');
 const repeated=await adapter.refresh({previous:result,now:new Date(+now+3600000),fetchImpl});assert.equal(contentHash(repeated),contentHash(result),'Unchanged canonical reconciliation must not create another fact revision');
 const corrected=structuredClone(result);corrected[0].result={...corrected[0].result,score:'2-1',checkedAt:'2026-10-01T00:00:00Z'};corrected[0].score='2-1';
 const preserved=await adapter.refresh({previous:corrected,now,fetchImpl});assert.equal(preserved[0].result.score,'2-1','A newer official correction must survive an older canonical result');
 const unknown={...stale[3],id:'unknown-bjk-slot',eventId:'unknown-bjk-slot'};const withUnknown=await adapter.refresh({previous:[unknown],now,fetchImpl});assert.deepEqual(withUnknown,[unknown],'Unknown identities cannot inherit a different tie’s result');
 for(const mutate of [f=>f.result.sourceUrl='',f=>f.result.status='unconfirmed',f=>f.winnerParticipantId='unknown',f=>f.result.checkedAt='2026-10-02T00:00:00Z']){const known=structuredClone(canonical[3]);mutate(known);assert.deepEqual(adapter.reconcileReviewed([stale[3]],[known],now),[stale[3]],'Invalid or future reviewed facts cannot complete a tie');}
 const mismatched={...canonical[3],bracketSlot:'other'};assert.deepEqual(adapter.reconcileReviewed([stale[3]],[mismatched],now),[stale[3]]);
 console.log('BJK live reconciliation: confirmed exact-ID results, older stale window, newer correction, unknown preservation, no extra fetch, 30-minute idle cadence and no-op hash passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
