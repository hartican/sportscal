'use strict';
const assert=require('node:assert/strict'),follow=require('../config/follow-first');
const {reviewedAuViewing}=require('../lib/reviewed-au-viewing');
async function main(){
const catalogue=require('../data/coverage/stan-football-programmes.v1.json');
const published=require('../data/follow-schedule/football.json').fixtures.find(f=>f.id==='fixture:football:openligadb:uefa-champions-league:87418');
const source={...structuredClone(published),status:'upcoming'}; // Controlled earlier state; today's fixture may already be final.
const now=Math.max(...catalogue.programmes.map(p=>Date.parse(p.observedAt)))+1000;
const original=Date.now;Date.now=()=>now;
try{
 const fixture={...structuredClone(source),status:'completed'},before=JSON.stringify(fixture);
 const projected=reviewedAuViewing(fixture),stan=follow.viewingOptions(projected).find(p=>p.providerId==='stan');
 assert.equal(stan?.webUrl,'https://play.stan.com.au/programs/8097690/play','completed actual match gets exact programme from reviewed Rapid Recap catalogue');
 assert.equal(stan.linkScope,'fixture');assert.equal(stan.replayVerified,true);assert.equal(stan.accessType,'subscription');
 const receipt=projected.viewingOptions.find(p=>p.providerId==='stan');assert.equal(receipt.programmeKind,'rapid_recap');assert.equal(receipt.variantSpecific,false,'shared programme URL cannot claim selected-variant autoplay');
 assert.equal(follow.viewingOptions(require('../config/fixture-identity').normalizeCore(projected)).find(p=>p.providerId==='stan').webUrl,stan.webUrl,'normalised card identity preserves the same source-bound programme');
 const fallbackSeason={...fixture,season:undefined,footballMatchContext:{...fixture.footballMatchContext,season:'2026/27'}};
 const fallbackProjection=reviewedAuViewing(fallbackSeason);
 assert.equal(follow.viewingOptions(fallbackProjection).find(p=>p.providerId==='stan').webUrl,stan.webUrl,'supported nested season can bind the programme');
 assert(!follow.viewingOptions({...fallbackProjection,footballMatchContext:{...fallbackProjection.footballMatchContext,season:'2025/26'}}).some(p=>p.webUrl.includes('/programs/')),'changed nested season cannot reuse a cached programme');
 assert.equal(JSON.stringify(fixture),before,'projection cannot mutate input');
 for(const key of ['id','date','startTimeUtc','status','participants','participantIds','roundNumber','roundLabel','season'])assert.deepEqual(projected[key],fixture[key],'source sporting field preserved: '+key);
 assert.equal(follow.viewingOptions(reviewedAuViewing(source))[0].linkScope,'sport','upcoming source cannot be declared complete from a clip');
 let reads=0;
 const handler=require('../lib/live-fixture-handler').createLiveFixtureHandler({environment:{},clock:()=>new Date(now),publishedFixtures:()=>[source],read:async()=>{reads++;return {sources:[{source_id:'controlled-football',fixtures:[fixture]}],revision:'controlled',stale:false};}});
 const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;},end(){}};
 await handler({method:'GET',url:'/api/fixtures?ids='+encodeURIComponent(source.id),headers:{}},response);
 assert.equal(reads,1,'programme projection adds no database read');assert.equal(response.code,200);
 assert.equal(follow.viewingOptions(response.body.sources[0].fixtures[0]).find(p=>p.providerId==='stan').webUrl,stan.webUrl,'actual selected API overlays source completion before programme selection');
 for(const patch of [{season:'2025/26'},{date:'2026-10-16'},{roundNumber:3},{participants:[fixture.participants[0],{name:'Arsenal',role:'away'}]}]){
  const stale=follow.viewingOptions({...projected,...patch}).find(p=>p.providerId==='stan');assert(!stale?.webUrl.includes('/programs/'),'copied receipt cannot bind changed fixture context');
 }
 Date.now=()=>now+7*86400000;
 assert(!follow.viewingOptions(projected).some(p=>p.webUrl.includes('/programs/')),'stale cached receipt returns to existing competition fallback');
 const hull=require('../data/events.json').events.find(e=>e.id==='epl-2026-27-128978');
 Date.now=()=>Date.parse('2026-10-19T01:00:00Z');
 const cachedBoundary=reviewedAuViewing(hull);
 assert(follow.viewingOptions(cachedBoundary).some(p=>p.webUrl==='https://play.stan.com.au/programs/8424086/play'),'Sydney day seven retains the cached exact programme');
 Date.now=()=>Date.parse('2026-10-20T01:00:00Z');
 assert(!follow.viewingOptions(cachedBoundary).some(p=>p.webUrl.includes('/programs/')),'Sydney day eight rejects the cached programme even while its receipt is fresh');
 console.log('Stan projection: exact reviewed fixture programme, Rapid Recap preference, no variant autoplay claim, lifecycle/context/cache expiry and unchanged sporting facts passed.');
}finally{Date.now=original;}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
