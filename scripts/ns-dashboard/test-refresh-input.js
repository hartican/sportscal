"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {collectQueue}=require('../../lib/ns-dashboard/queue-source');
const {prepareQueueRefresh}=require('../../lib/ns-dashboard/refresh-input');
const {serialize}=require('./hosted-contract');
const {overviewFixture,AS_OF}=require('./overview-fixture');
const later='2026-11-05T00:00:00Z';
const row=(id,draft=false,ref='main')=>({id,state:'open',draft,base:{ref},title:'PRIVATE_PROVIDER_TEXT_NOT_FOR_SNAPSHOT'});
const reply=(rows,headers={})=>new Response(JSON.stringify(rows),{headers});
test('public collector returns bounded aggregate facts without provider text or authorization',async()=>{
 let calls=0;
 const q=await collectQueue({now:()=>AS_OF,fetchImpl:async(url,options)=>{calls++;assert.match(url,/api.github.com\/repos\/hartican\/sportscal\/pulls/);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,undefined);return reply([row(1),row(2,true,'other')],{etag:'"one"'});}});
 assert.equal(calls,1);assert.equal(q.open,2);assert.equal(q.drafts,1);assert.equal(q.nonMainBases,1);assert.doesNotMatch(JSON.stringify(q),/PRIVATE_PROVIDER/);
});
test('conditional304 keeps observation clock and only advances the check clock',async()=>{
 const previous=await collectQueue({now:()=>AS_OF,fetchImpl:async()=>reply([row(1)],{etag:'"one"'})});
 const q=await collectQueue({previous,now:()=>later,fetchImpl:async(_,o)=>{assert.equal(o.headers['If-None-Match'],'"one"');return new Response(null,{status:304});}});
 assert.equal(q.observedAt,AS_OF);assert.equal(q.checkedAt,later);assert.equal(q.open,1);
});
test('first-page validator is not reused for multipage queues',async()=>{
 const previous={schemaVersion:'ns-dashboard-public-queue.v1',complete:true,observedAt:AS_OF,checkedAt:AS_OF,open:100,drafts:1,nonMainBases:0,etag:'"one"'};
 await assert.rejects(collectQueue({previous,fetchImpl:async(_,o)=>{assert.equal(o.headers['If-None-Match'],undefined);return new Response(null,{status:304});}}),/incomplete/);
});
test('partial, malformed, duplicate and over-limit queues fail rather than becoming zero',async()=>{
 for(const fetchImpl of [async()=>reply({}),async()=>new Response('denied',{status:429}),async()=>reply([row(1),row(1)]),async()=>reply([row(1)],{link:'<https://example.invalid>; rel="next"'})])await assert.rejects(collectQueue({fetchImpl}));
 let calls=0;await assert.rejects(collectQueue({fetchImpl:async()=>{const offset=100*calls++;return reply(Array.from({length:100},(_,i)=>row(offset+i+1)),{link:'<https://example.invalid>; rel="next"'});}}));assert.equal(calls,1);
});
test('whole-operation deadline rejects an unfinished public request',async()=>{
 await assert.rejects(collectQueue({timeoutMs:5,fetchImpl:()=>new Promise(()=>{})}),/timeout/);
});
test('queue refresh preserves historical/source clocks and owner decisions, aging production proof honestly',async()=>{
 const old=serialize(overviewFixture(),AS_OF).value;
 const queue=await collectQueue({now:()=>later,fetchImpl:async()=>reply([row(1)])});
 const next=prepareQueueRefresh(old,queue,later).value;
 assert.equal(next.projection.currentBacklogAtCollection.cutoff,AS_OF);assert.equal(next.projection.freshness.lastSuccessfulRefresh,AS_OF);
 assert.deepEqual(next.projection.briefing.decisions,old.projection.briefing.decisions);
 assert.equal(next.projection.release.verifiedLive,null);assert.equal(next.projection.release.verificationScopes[0].state,'stale');
 assert.equal(old.projection.briefing.work.length,1);assert.equal(next.projection.briefing.work.length,2);
 assert.match(next.projection.briefing.work[1].reason,/1 open requests/);
 assert.throws(()=>prepareQueueRefresh(old,{...queue,checkedAt:null},later));
 assert.throws(()=>prepareQueueRefresh(old,{...queue,checkedAt:'2027-01-01T00:00:00Z'},later));
});
