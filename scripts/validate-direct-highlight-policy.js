'use strict';
// No provider/database calls: real published fixture context and direct-record
// shape are replayed under controlled identities with injected metadata/cache.
const assert=require('node:assert/strict');
const contract=require('../config/fixture-highlights');
const media=require('../lib/fixture-highlights');
const selection=require('../lib/highlight-selection');
const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
const {createTopResultResolver}=require('./highlight-resolver-test');
const now=new Date('2026-10-15T00:00:00Z');
const published=require('../data/events.json').events;
const saved=require('./fixtures/shanghai-highlights-184950.json');assert(saved.highlights,'The retained real match receipt survives expiry of the current upload window');
const source=published.find(e=>(e.canonicalEventId||e.id)===(saved.canonicalEventId||saved.id));assert(source);
function controlled(event,suffix){return {...event,id:'controlled:direct:'+suffix,eventId:'controlled:direct:'+suffix,canonicalEventId:'controlled:direct:'+suffix,sourceEventIds:[],fixtureIdAliases:[],status:'completed'};}
const fixture=controlled(source,'tennis');
const base={...saved.highlights,publishedAt:'2026-10-13T15:00:00Z',verifiedAt:now.toISOString(),checkedAt:now.toISOString(),sourceCheckedAt:now.toISOString(),durationSeconds:300,defaultAudioLanguage:'en',regionStatus:'allowed'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(body){this.body=body;return this;}});
const request=event=>({method:'GET',headers:{},url:'/api/fixtures?mode=highlight&ids='+encodeURIComponent(event.canonicalEventId||event.id)});
const metadata=h=>({id:h.videoId,snippet:{channelId:h.channelId,title:h.matchTitle,description:h.description||'',publishedAt:h.publishedAt,defaultAudioLanguage:h.defaultAudioLanguage,defaultLanguage:h.defaultLanguage},contentDetails:{duration:Number.isFinite(h.durationSeconds)?'PT'+h.durationSeconds+'S':undefined,regionRestriction:h.regionStatus==='blocked'?{blocked:['AU']}:undefined},status:{privacyStatus:h.availability==='public'?'public':'private',uploadStatus:'processed'}});
async function route(event,resolveHighlights){
  const handler=createLiveFixtureHandler({publishedFixtures:()=>[event],read:async()=>({sources:[],revision:'controlled',stale:false}),clock:()=>now,environment:{},resolveHighlights});
  const res=response();await handler(request(event),res);return res;
}
async function main(){
  const original=JSON.stringify({fixture,base});
  assert.equal(contract.valid(base,now),true,'legacy direct envelope can remain a source receipt; it is not sufficient playback proof');
  const negatives=[
    ['wrong pair',{...base,matchTitle:'Novak Djokovic v Carlos Alcaraz | Shanghai 2026 Highlights'}],
    ['old edition in fresh upload',{...base,matchTitle:base.matchTitle.replace('2026','2022')}],
    ['missing duration',Object.fromEntries(Object.entries(base).filter(([key])=>key!=='durationSeconds'))],
    ['three hour broadcast',{...base,durationSeconds:10800}],
    ['over20 minute video',{...base,durationSeconds:1201}],
    ['zero duration',{...base,durationSeconds:0}],
    ['declared foreign audio',{...base,defaultAudioLanguage:'id'}],
    ['blocked in Australia',{...base,regionStatus:'blocked'}],
    ['old upload',{...base,publishedAt:'2022-10-13T15:00:00Z'}],
    ['future upload',{...base,publishedAt:new Date(+now+1).toISOString()}]
  ];
  for(const [label,record] of negatives){
    assert.equal(selection.select([metadata(record)],fixture,now),null,'strict selector independently rejects '+label);
    let calls=0;
    const res=await route({...fixture,highlights:record},async event=>{calls++;assert.equal(event.canonicalEventId,fixture.canonicalEventId);throw Error('highlights_unavailable');});
    assert.equal(calls,1,label+' direct metadata must reach the current-policy resolver instead of bypassing it');
    assert.equal(res.code,503,label+' cannot redirect without a suitable result');assert(!res.headers.Location);
    const action=contract.viewing({...fixture,highlights:record},now);assert(action,'recent completed fixture retains resolver action');assert.match(action.webUrl,/^\/api\/fixtures\?mode=highlight&ids=/,label+' client action is resolver-owned');
    const cached=media.applyCached([fixture],[{id:fixture.id,highlightsOnly:true,highlights:record}],now)[0];
    assert.match(contract.viewing(cached,now).webUrl,/^\/api\/fixtures\?mode=highlight&ids=/,label+' cached enrichment cannot recreate a direct shortcut');
  }
  const f1source=published.find(e=>e.key==='f1'&&/Practice 1/.test(e.stage));assert(f1source);
  const f1=controlled(f1source,'f1'),wrongSession={...base,channelId:'UCB_qr75-ydFVKSF9Dmo6izg',matchTitle:'Singapore GP Practice 2 2026 Highlights'};
  assert.equal(selection.select([metadata(wrongSession)],f1,now),null);
  let sessionChecks=0;const sessionRes=await route({...f1,highlights:wrongSession},async()=>{sessionChecks++;throw Error('highlights_unavailable');});assert.equal(sessionChecks,1,'verified envelope cannot bypass exact race session validation');assert.equal(sessionRes.code,503);assert(!sessionRes.headers.Location);
  assert(selection.select([metadata(base)],fixture,now),'matching recent strict metadata remains eligible');
  const cache={video_id:'SAFEVIDEO01',selected_at:now.toISOString(),published_at:base.publishedAt,duration_seconds:300};
  let reads=0,resolverCalls=0;
  const resolver=createTopResultResolver({environment:{},diagnose:()=>{},request:async(path,options={})=>{assert(path.startsWith('/rest/v1/nothingsports_youtube_selections?'),'warm direct click needs only its current-policy cache read');assert.notEqual(options.method,'POST');reads++;return [cache];},fetchImpl:()=>assert.fail('eligible current-policy cached selection consumes no provider request'),discoverOfficial:()=>assert.fail('eligible warm cache needs no public-feed lookup')});
  for(let n=0;n<2;n++){
    const res=await route({...fixture,highlights:base},async(...args)=>{resolverCalls++;return resolver.resolve(...args);});
    assert.equal(res.code,302);assert.equal(res.headers.Location,'https://www.youtube.com/watch?v='+cache.video_id);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body,undefined,'one redirect without results/choice screen');
  }
  assert.equal(resolverCalls,2,'even existing valid direct envelopes pass through current-policy authority');assert.equal(reads,2,'repeated eligible opens reuse service cache without quota reservations');
  const action=contract.viewing({...fixture,highlights:base},now);assert.match(action.webUrl,/^\/api\/fixtures\?mode=highlight&ids=/);assert(!action.highlightsFeedOnly,'existing verified Tennis direct action retains Events eligibility');
  const archiveSource=require('../data/follow-schedule/tennis.json').fixtures.find(e=>e.status==='completed'&&e.date==='2026-10-07');assert(archiveSource);
  const archive=controlled(archiveSource,'archive'),archiveRecord={...base,matchTitle:archiveSource.name+' | '+archiveSource.tournamentName+' 2026 Highlights'};
  assert.equal(contract.searchQuery(archive,now),null,'archived fixture must not gain general discovery admission');
  assert.match(contract.viewing({...archive,highlights:archiveRecord},now).webUrl,/^\/api\/fixtures\?mode=highlight&ids=/,'recent direct upload for an archived fixture still reaches policy authority');
  let archiveChecks=0;const archivedRes=await route({...archive,highlights:archiveRecord},async(event)=>{archiveChecks++;assert.equal(event.date,archive.date);return {url:'https://www.youtube.com/watch?v=SAFEVIDEO01',selection:'youtube-top-result',cached:true};});
  assert.equal(archiveChecks,1,'archive known-video validation cannot be blocked by missing general search admission');assert.equal(archivedRes.code,302);
  function providerRun({event,known,official=[],searched=[],noDiscovery=false}){
    const grants=[],batches=[],saves=[];let searches=0;
    const resolver=createTopResultResolver({environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},diagnose:()=>{},discoverOfficial:async()=>{assert(!noDiscovery,'archived known video must not discover official uploads');return official.map(v=>({videoId:v.id}));},request:async(path,options={})=>{
      if(path.includes('reserve_youtube_quota')){grants.push(options.body.p_bucket);return {granted:true};}
      if(options.method==='POST'){saves.push(options.body);return null;}return [];
    },fetchImpl:async url=>{
      const u=new URL(url);assert.equal(u.hostname,'www.googleapis.com');
      if(u.pathname.endsWith('/search')){assert(!noDiscovery,'archive known-video validation cannot dispatch search');searches++;assert.equal(grants.at(-1),'search');return new Response(JSON.stringify({items:searched.map(v=>({id:{videoId:v.id},snippet:v.snippet}))}));}
      assert.equal(grants.at(-1),'ordinary');const ids=u.searchParams.get('id').split(',');batches.push(ids);
      const available=[known,...official,...searched].filter(Boolean);return new Response(JSON.stringify({items:ids.flatMap(id=>{const match=available.find(v=>v.id===id);return match?[match]:[];})}));
    }});return {resolver,grants,batches,saves,get searches(){return searches;},event};
  }
  const reelRecord={...base,videoId:'REELVIDEO01',url:'https://www.youtube.com/watch?v=REELVIDEO01',standalone:false,videoScope:'tournament-day',matchTitle:'Alex de Minaur v Karen Khachanov; Shanghai 2026 Highlights Day 8',description:'Alex de Minaur v Karen Khachanov'};
  const dedicatedRecord={...base,videoId:'DEDICATED01',url:'https://www.youtube.com/watch?v=DEDICATED01'};
  const coBatch=providerRun({event:{...fixture,highlights:reelRecord},known:metadata(reelRecord),official:[metadata(dedicatedRecord)]});
  assert.equal((await coBatch.resolver.resolve(coBatch.event,now)).url,dedicatedRecord.url,'official dedicated video replaces an existing known day reel');
  assert.deepEqual(coBatch.grants,['ordinary'],'known video and official feed candidates share one ordinary reservation');assert.deepEqual(coBatch.batches,[[reelRecord.videoId,dedicatedRecord.videoId]]);assert.equal(coBatch.searches,0);assert.equal(coBatch.saves[0].video_id,dedicatedRecord.videoId);
  const invalidKnown={...base,matchTitle:'Novak Djokovic v Carlos Alcaraz | Shanghai 2026 Highlights'};
  const generalRecord={...dedicatedRecord,channelId:'unreviewed'};
  const recovered=providerRun({event:{...fixture,highlights:invalidKnown},known:metadata(invalidKnown),searched:[metadata(generalRecord)]});
  assert.equal((await recovered.resolver.resolve(recovered.event,now)).url,generalRecord.url,'invalid known video cannot suppress normal suitable discovery/search');assert.deepEqual(recovered.grants,['ordinary','search','ordinary']);assert.equal(recovered.searches,1);
  const archiveProvider=providerRun({event:{...archive,highlights:archiveRecord},known:metadata(archiveRecord),noDiscovery:true});
  assert.equal((await archiveProvider.resolver.resolve(archiveProvider.event,now)).url,archiveRecord.url,'archived fixture revalidates only its recent known upload');assert.deepEqual(archiveProvider.grants,['ordinary']);assert.deepEqual(archiveProvider.batches,[[archiveRecord.videoId]]);assert.equal(archiveProvider.searches,0);
  const wrongArchive={...archiveRecord,matchTitle:'Novak Djokovic v Carlos Alcaraz | Shanghai 2026 Highlights'};
  const archiveDenied=providerRun({event:{...archive,highlights:wrongArchive},known:metadata(wrongArchive),noDiscovery:true});
  await assert.rejects(archiveDenied.resolver.resolve(archiveDenied.event,now),/highlights_unavailable/,'unsuitable archived known metadata fails closed');assert.deepEqual(archiveDenied.grants,['ordinary']);assert.equal(archiveDenied.searches,0);assert.equal(archiveDenied.saves.length,0);
  assert.equal(JSON.stringify({fixture,base}),original,'direct validation cannot mutate sporting facts');
  console.log('Direct highlight policy: real legacy envelope replay, wrong pair/edition/session, upload/duration/audio/Australian suitability, cached enrichment, resolver-owned client actions, known/reel/official metadata co-batching, invalid-seed recovery, archive-only validation and repeated cached one-tap redirects passed; zero live service/provider calls.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
