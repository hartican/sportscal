'use strict';
const assert=require('node:assert/strict'),{createLiveFixtureHandler}=require('../lib/live-fixture-handler'),{refreshDueSources,contentHash}=require('../lib/live-fixtures'),fpl=require('../lib/fantasy/providers/fpl'),sample=require('./fixtures/fantasy-fpl.json');
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;},end(){}});
async function main(){
 const overlays=fpl.normalize(sample),base={...sample.events[0],date:new Date(Date.now()+86400000).toISOString().slice(0,10),startTimeUtc:new Date(Date.now()+86400000).toISOString()},id=base.canonicalEventId;
 let checkedAt='2026-08-20T00:00:00Z';const read=async()=>({revision:'same-content',stale:false,sources:[{source_id:'base',fixtures:[base]},{source_id:'live-fantasy-fpl',checked_at:checkedAt,fixtures:overlays}]});
 const environment={FANTASY_FPL_ENABLED:'true',FANTASY_FPL_ACCESS_APPROVED:'true'};const handler=createLiveFixtureHandler({publishedFixtures:()=>[base],read,environment});
 let res=response();await handler({url:`/api/fixtures?ids=${id}&fantasy=1`,headers:{}},res);assert.equal(res.statusCode,200);assert.equal(res.body.sources[0].fixtures[0].fantasyDeadlines[0].mappingStatus,'verified');const revision=res.body.revision;
 res=response();await handler({url:`/api/fixtures?ids=${id}&fantasy=1&revision=${revision}`,headers:{}},res);assert.equal(res.statusCode,304);
 checkedAt='2026-08-20T00:30:00Z';res=response();await handler({url:`/api/fixtures?ids=${id}&fantasy=1&revision=${revision}`,headers:{}},res);assert.equal(res.statusCode,200);assert.equal(res.body.fantasySources['live-fantasy-fpl'].checkedAt,checkedAt);
 res=response();await handler({url:`/api/fixtures?ids=${id}`,headers:{}},res);assert(!res.body.fantasySources);assert(!res.body.sources[0].fixtures[0].fantasyDeadlines,'ordinary clients get no enrichment');
 const disabled=createLiveFixtureHandler({publishedFixtures:()=>[base],read,environment:{}});res=response();await disabled({url:`/api/fixtures?ids=${id}&fantasy=1&revision=${revision}`,headers:{}},res);assert.equal(res.body.fantasySources['live-fantasy-fpl'].enabled,false);assert(!res.body.sources[0].fixtures[0].fantasyDeadlines);
 const evaluationEnvironment={FANTASY_FPL_ENABLED:'true',FANTASY_FPL_EVALUATION_ENABLED:'true'};
 const evaluation=createLiveFixtureHandler({publishedFixtures:()=>[base],read,environment:evaluationEnvironment});res=response();await evaluation({url:`/api/fixtures?ids=${id}&fantasy=1`,headers:{}},res);
 assert.equal(res.body.fantasySources['live-fantasy-fpl'].accessStatus,'evaluation');assert(res.body.sources[0].fixtures[0].fantasyDeadlines);const evaluationRevision=res.body.revision;
 evaluationEnvironment.FANTASY_FPL_ACCESS_APPROVED='true';res=response();await evaluation({url:`/api/fixtures?ids=${id}&fantasy=1&revision=${evaluationRevision}`,headers:{}},res);assert.equal(res.statusCode,200);assert.equal(res.body.fantasySources['live-fantasy-fpl'].accessStatus,'approved');
 evaluationEnvironment.FANTASY_FPL_ENABLED='false';res=response();await evaluation({url:`/api/fixtures?ids=${id}&fantasy=1`,headers:{}},res);assert.equal(res.body.fantasySources['live-fantasy-fpl'].accessStatus,'disabled');assert(!res.body.sources[0].fixtures[0].fantasyDeadlines);
 const withdrawn=overlays.map(e=>({...e,fantasyDeadlines:e.fantasyDeadlines.map(r=>({...r,mappingStatus:'withdrawn'}))}));assert.notEqual(contentHash(overlays),contentHash(withdrawn));
 let published;const store={dueIds:async()=>[],claim:async()=>({fixtures:overlays}),publish:async(id,token,p)=>{published=p;},fail:async()=>{throw Error('unexpected failure');}};
 const result=await refreshDueSources({store,now:new Date(Date.parse(overlays[0].fantasyDeadlines[0].deadlineAt)-3600000),sources:[{id:'live-fantasy-fpl',refreshInterval:require('../config/fantasy-deadlines').interval,fetch:async()=>overlays}]});assert.deepEqual(result.failed,[]);assert.equal(published.intervalMs,120000);assert.equal(published.hash,contentHash(overlays));
 console.log('Fantasy API: opt-in isolation, kill switch, freshness validators, withdrawal hashing and shared source cadence passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
