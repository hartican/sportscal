'use strict';
const assert=require('node:assert/strict');
const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
const follow=require('../config/follow-first');
const rows=require('../config/fixture-identity').mergeOverlays(require('../data/follow-sources/coverage.v1.json').events,require('../lib/competition-fixtures').fixtures());
const finalId='fixture:rugby:wr:e492d961-1f1e-4c37-b9d7-e9fd811459be';
const selected=rows.filter(f=>['fixture:cricket:espn:1525659','rugby-new-zealand-australia-2026-10-10',finalId].includes(f.id));
const unknown=rows.find(f=>f.competitionName==='Top 14 2027' && f.date>='2026-10-02');assert(unknown);
(async()=>{
 let reads=0;assert.equal(selected.length,3);const handler=createLiveFixtureHandler({clock:()=>new Date('2026-10-02T09:00:00Z'),publishedFixtures:()=>[...selected,unknown],read:async()=>{reads++;return {revision:'unchanged-primary',stale:false,sources:[{source_id:'rugby-primary',fixtures:[{...unknown,broadcaster:'Stan Sport',sourceCheckedAt:'2026-10-02T06:00:00Z'}]}]};}});
 const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;},end(){}});
 const r=response();await handler({method:'GET',url:'/api/fixtures',headers:{}},r);assert.equal(r.statusCode,200);assert.equal(reads,1,'no additional snapshot query');
 const fixtures=r.body.sources[0].fixtures;
 for(const fixture of fixtures){const providers=follow.viewingOptions(fixture).map(o=>o.providerId);if(fixture.id===unknown.id){assert.deepEqual(providers,[]);assert.equal(fixture.sourceCheckedAt,'2026-10-02T06:00:00Z');}else if(fixture.id==='rugby-new-zealand-australia-2026-10-10')assert.deepEqual(providers,['nine-tv','nine','stan']);else if(fixture.id===finalId){assert.deepEqual(providers,['youtube','stan']);assert.equal(fixture.venue,'Scotch College Playing Fields, Swanbourne, Perth');assert.equal(fixture.startTimeUtc,'2026-10-03T06:30:00.000Z');}else assert.deepEqual(providers,['kayo','foxtel']);}
 assert.equal(fixtures.length,4,'known and unknown fixture identities survive');
 const cached=response();await handler({method:'GET',url:'/api/fixtures',headers:{'if-none-match':r.headers.ETag}},cached);assert.equal(cached.statusCode,304,'unchanged sporting and viewing revisions retain cache semantics');assert.equal(reads,2,'one existing read per request');
 console.log('Reviewed AU viewing API: retained snapshot facts, same public/private presentation, unknown-state protection, one read and unchanged revision caching passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
