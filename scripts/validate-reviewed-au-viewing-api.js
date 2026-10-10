'use strict';
const assert=require('node:assert/strict');
const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
const follow=require('../config/follow-first');
const rows=require('../config/fixture-identity').mergeOverlays(require('../data/follow-sources/coverage.v1.json').events,require('../lib/competition-fixtures').fixtures());
const finalId='fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be';
const selected=rows.filter(f=>['fixture:cricket:espn:1525659','rugby-new-zealand-australia-2026-10-10',finalId].includes(f.id));
const golf=require('../data/canonical/pga-tour-schedule.json').lpga.filter(f=>['fixture:golf:lpga:2026068','fixture:golf:lpga:2026070'].includes(f.id));assert.equal(golf.length,2);
const unknown=rows.find(f=>f.competitionName==='Top 14 2027' && f.date>='2026-10-02');assert(unknown);
(async()=>{
 let reads=0;assert.equal(selected.length,3);const handler=createLiveFixtureHandler({clock:()=>new Date('2026-10-02T14:00:00Z'),publishedFixtures:()=>[...selected,unknown,...golf],read:async()=>{reads++;return {revision:'unchanged-primary',stale:false,sources:[{source_id:'rugby-primary',fixtures:[{...unknown,broadcaster:'Stan Sport',sourceCheckedAt:'2026-10-02T06:00:00Z'}]},{source_id:'golf-primary',fixtures:golf}]};}});
 const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;},end(){}});
 const r=response();await handler({method:'GET',url:'/api/fixtures',headers:{}},r);assert.equal(r.statusCode,200);assert.equal(reads,1,'no additional snapshot query');
 const fixtures=r.body.sources[0].fixtures;
 for(const fixture of fixtures){const providers=follow.viewingOptions(fixture).map(o=>o.providerId);if(fixture.id===unknown.id){assert.deepEqual(providers,[]);assert.equal(fixture.sourceCheckedAt,'2026-10-02T06:00:00Z');}else if(fixture.id==='rugby-new-zealand-australia-2026-10-10')assert.deepEqual(providers,['nine-tv','nine','stan']);else if(fixture.id===finalId){assert.deepEqual(providers,['youtube','stan']);assert.equal(fixture.venue,'Scotch College Playing Fields, Swanbourne, Perth');assert.equal(fixture.startTimeUtc,'2026-10-03T06:30:00.000Z');}else assert.deepEqual(providers,['kayo','foxtel']);
  const original=golf.find(row=>row.id===fixture.id);if(original){assert(follow.viewingOptions(fixture).every(o=>o.rightsScope==='competition'&&!o.replayVerified));for(const field of ['id','date','endDate','status','sourceCheckedAt','participationCheckedAt','participantIds','entries','appearances'])assert.deepEqual(fixture[field],original[field],`API overlay retains golf ${field}`);}
 }
 assert.equal(fixtures.length,6,'known, unknown and Golf fixture identities survive without duplicates');
 const cached=response();await handler({method:'GET',url:'/api/fixtures',headers:{'if-none-match':r.headers.ETag}},cached);assert.equal(cached.statusCode,304,'unchanged sporting and viewing revisions retain cache semantics');assert.equal(reads,2,'one existing read per request');
 const hockey=require('../data/code-inspector/ice-hockey.json').fixtures;
 const nhl=[hockey.find(f=>f.id==='fixture:nhl:2026020035'),hockey.find(f=>f.id==='fixture:nhl:2026020001'),hockey.find(f=>f.id==='fixture:nhl:2026010063')];assert(nhl.every(Boolean));
 let nhlReads=0;const nhlHandler=createLiveFixtureHandler({clock:()=>new Date('2026-10-03T14:00:00Z'),publishedFixtures:()=>nhl,read:async()=>{nhlReads++;return {revision:'unchanged-nhl-primary',stale:false,sources:[{source_id:'nhl-primary',fixtures:nhl}]};}});
 const live=response();await nhlHandler({method:'GET',url:'/api/fixtures',headers:{}},live);assert.equal(live.statusCode,200);assert.equal(nhlReads,1);assert.equal(live.body.sources[0].fixtures.length,3);
 for(const f of live.body.sources[0].fixtures){
  const original=nhl.find(row=>row.id===f.id);assert(original);
  for(const field of ['id','canonicalEventId','sourceEventIds','startTimeUtc','date','status','sourceCheckedAt','scoreCheckedAt','participantSlots','scoreDisplay'])assert.deepEqual(f[field]??null,original[field]??null,`NHL API preserves ${field}`);
  const options=follow.viewingOptions(f);assert.deepEqual(options.map(o=>o.providerId),original.roundLabel==='Regular season'?['disney']:[]);assert(options.every(o=>o.rightsScope==='competition'&&o.linkScope==='sport'&&!o.replayVerified));
 }
 const nhlCached=response();await nhlHandler({method:'GET',url:'/api/fixtures',headers:{'if-none-match':live.headers.ETag}},nhlCached);assert.equal(nhlCached.statusCode,304);assert.equal(nhlReads,2,'viewing enrichment adds no snapshot query');
 const aflw=require('../data/canonical/afl-nrl-2026.json').events.find(f=>f.id==='event:aflw:cd_m20262641601');assert(aflw);let aflwReads=0;
 const aflwHandler=createLiveFixtureHandler({clock:()=>new Date('2026-10-11T00:00:00Z'),publishedFixtures:()=>[aflw],read:async()=>{aflwReads++;return {revision:'unchanged-aflw-primary',stale:false,sources:[{source_id:'live-aflw',fixtures:[aflw]}]};}});
 const ar=response();await aflwHandler({method:'GET',url:'/api/fixtures?ids='+encodeURIComponent(aflw.id),headers:{}},ar);
 assert.equal(ar.statusCode,200);assert.equal(aflwReads,1);const aflwPresented=ar.body.sources[0].fixtures.find(f=>f.id===aflw.id);assert(aflwPresented);
 const aflwOptions=follow.viewingOptions(aflwPresented);assert.deepEqual(aflwOptions.map(o=>o.providerId),['seven','kayo','foxtel']);assert.equal(aflwOptions[0].webUrl,'https://7plus.com.au/aflw');
 assert.equal(aflwPresented.date,aflw.date);assert.equal(aflwPresented.startTimeUtc,aflw.startTimeUtc);assert.equal(aflwPresented.status,aflw.status);assert.deepEqual(aflwPresented.source,aflw.source);assert.deepEqual(aflwPresented.participantIds,aflw.participantIds);
 console.log('Reviewed AU viewing API: retained Rugby/Cricket/Golf/NHL/AFLW snapshot facts, exact final and competition-scoped presentation, unknown-state protection, one read and unchanged revision caching passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
