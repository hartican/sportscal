#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const contract=require('../config/fixture-highlights'),media=require('../lib/fixture-highlights'),identity=require('../config/fixture-identity');
const actual=require('./fixtures/shanghai-highlights-184950.json');
const fixture={...actual,status:'completed'},now=new Date('2026-10-13T15:00:00Z');
delete fixture.highlights;
const channel=media.channels[0],video={videoId:'RPmOiRHHgX8',channelId:channel.id,title:'Alex de Minaur vs Karen Khachanov Highlights | Shanghai 2026 Round 4',description:'',publishedAt:'2026-10-13T07:16:25Z',url:'https://www.youtube.com/watch?v=RPmOiRHHgX8',short:false};
function feed(c,entries=[]){return '<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><author><uri>https://www.youtube.com/channel/'+c.id+'</uri></author>'+entries.map(v=>'<entry><yt:videoId>'+v.videoId+'</yt:videoId><yt:channelId>'+v.channelId+'</yt:channelId><title>'+v.title+'</title><link rel="alternate" href="'+v.url+'"/><published>'+v.publishedAt+'</published><media:description>'+v.description+'</media:description></entry>').join('')+'</feed>';}
let oembedCount=0,apiCount=0,fail=false,deleted=false,blocked=false;
async function fetchImpl(url){
 if(fail)return new Response('',{status:503});
 if(url.includes('/feeds/')){const c=media.channels.find(c=>url.includes(c.id));return new Response(feed(c,c.id===channel.id?[video]:[]));}
 if(url.includes('/oembed')){oembedCount++;return new Response(JSON.stringify({type:'video',author_name:channel.label,author_url:'https://www.youtube.com/@'+channel.handle,title:video.title}),{status:deleted?404:200});}
 if(url.includes('/youtube/v3/videos')){apiCount++;return new Response(JSON.stringify({items:[{id:video.videoId,snippet:{channelId:channel.id,title:video.title,publishedAt:video.publishedAt},contentDetails:{duration:'PT5M',...(blocked?{regionRestriction:{blocked:['AU']}}:{})},status:{privacyStatus:'public',uploadStatus:'processed'}}]}));}
 if(url.includes('/youtube/v3/search')){apiCount++;return new Response('{"items":[]}');}
 throw Error('Unexpected request');
}
async function run(){
 const realNow=Date.now;Date.now=()=>+now;
 try{
 for(const roundLabel of ['Round of 16','Last 16','Quarterfinal','QF','Semifinal','SF','Final'])assert(contract.tennisEligible({...fixture,roundLabel}),roundLabel);
 for(const roundLabel of ['Round of 128','Round of 64','Round of 32','Round 4','Round unconfirmed'])assert(contract.tennisEligible({...fixture,roundLabel,roundNumber:null,tournamentRoundTotal:null,totalRounds:null}));
 assert(contract.tennisEligible({...fixture,roundLabel:'Round 2',roundNumber:2,tournamentRoundTotal:5}));
 for(const eventType of ['boys-singles','girls-doubles','wheelchair-singles'])assert(!contract.tennisEligible({...fixture,eventType}));
 assert(!contract.tennisEligible({...fixture,status:'live',score:'6-3'}));assert(!contract.tennisEligible({...fixture,status:undefined,score:'6-3'}));
 for(const patch of [{tournamentParent:true},{isEditionOverview:true},{cardType:'tennis_parent'}])assert(!contract.tennisEligible({...fixture,...patch}),'tournament overviews cannot compete with their match for a highlights binding');
 assert(media.suitable(video,fixture));assert.equal(media.parseFeed(feed(channel,[video]),channel,now)[0].videoId,video.videoId);
 for(const roundLabel of ['Last 16','R16'])assert(media.suitable(video,{...fixture,roundLabel}));
 for(const round of ['Quarterfinal','Semifinal','SF'])assert(!media.suitable({...video,title:video.title.replace('Round 4',round)},fixture));
 for(const patch of [{channelId:'UCaaaaaaaaaaaaaaaaaaaaaa'},{short:true},{title:video.title.replace('2026','2025')},{title:video.title.replace('Shanghai','Paris')},{title:video.title.replace('Khachanov','Sinner')},{title:video.title.replace('Highlights','Interview')},{title:video.title.replace('Round 4','Quarter Final')}])assert(!media.suitable({...video,...patch},fixture),JSON.stringify(patch));
 assert(!media.suitable({...video,publishedAt:'2026-10-12T07:00:00Z'},fixture),'an earlier encounter cannot supply this match');
 assert.throws(()=>media.parseFeed('<!DOCTYPE feed>'+feed(channel,[video]),channel,now));assert.equal(media.parseFeed(feed(channel,[{...video,channelId:media.channels[1].id}]),channel,now).length,0);
 const doubles={...fixture,eventType:'mixed-doubles',participants:[{name:'Alex de Minaur'},{name:'Maya Joint'},{name:'Karen Khachanov'},{name:'Aryna Sabalenka'}]};
 assert(!media.suitable(video,doubles));assert(media.suitable({...video,title:'Alex de Minaur / Maya Joint vs Karen Khachanov / Aryna Sabalenka Mixed Doubles Highlights | Shanghai 2026 Round 4'},doubles));
 for(const label of ['Doubles','Mixed Doubles','Mixed']){const title='Alex de Minaur / Maya Joint vs Karen Khachanov / Aryna Sabalenka '+label+' Highlights | Shanghai 2026 Round 4';assert(!media.suitable({...video,title},fixture),'explicit '+label+' video cannot bind to the only wanted singles fixture');}
 const originalTitle=video.title;video.title='Alex de Minaur / Maya Joint vs Karen Khachanov / Aryna Sabalenka Mixed Doubles Highlights | Shanghai 2026 Round 4';assert.equal((await media.refresh({events:[fixture],now,fetchImpl})).length,0,'single-fixture discovery rejects a four-player mixed-doubles title');video.title=originalTitle;
 const first=await media.refresh({events:[fixture],now,fetchImpl});assert.equal(first.length,1);assert.equal(first[0].highlights.videoId,video.videoId);assert.equal(first[0].highlights.regionStatus,'unknown');assert.equal(apiCount,0,'keyless discovery never calls authenticated API');assert.equal(oembedCount,1);
 assert(contract.valid(first[0].highlights));const baseline={...fixture,score:'3-6 4-6',firstConfirmedCompleteAt:'2026-10-13T06:00:00Z',editorialNarrative:{text:'Saved copy'}};
 const enriched=identity.mergeOverlays([baseline],[{...first[0],status:'live',score:'0-0',startTimeUtc:'2027-01-01T00:00:00Z'}])[0];assert.deepEqual({...enriched,highlights:undefined},{...baseline,highlights:undefined});
 assert.equal(identity.mergeOverlays([],first).length,0,'media never creates a fixture');assert.equal(contract.viewing({...enriched,status:'live'}),null);assert.equal(contract.viewing(enriched).webUrl,'/api/fixtures?mode=highlight&ids='+encodeURIComponent(enriched.canonicalEventId||enriched.eventId||enriched.id));
 const second=await media.refresh({events:[fixture],previous:first,coverage:first.coverage,now:new Date(+now+1800000),fetchImpl});assert.deepEqual(second[0].highlights,first[0].highlights);assert.equal(oembedCount,1,'stable link skips repeated verification');
 fail=true;const failed=await media.refresh({events:[fixture],previous:first,coverage:first.coverage,now:new Date(+now+2*86400000),fetchImpl});assert.deepEqual(failed[0].highlights,first[0].highlights);assert(failed.coverage.failures.length);fail=false;
 deleted=true;const removed=await media.refresh({events:[fixture],previous:first,coverage:first.coverage,now:new Date(+now+2*86400000),fetchImpl});assert.equal(removed[0].highlights,null);assert.equal(identity.mergeOverlays([enriched],removed)[0].highlights,null);deleted=false;
 blocked=true;const restricted=await media.refresh({events:[fixture],now,fetchImpl,apiKey:'controlled-test-key'});assert.equal(restricted.length,0,'known AU restriction does not get a button');blocked=false;
 blocked=true;const blockedPublished=await media.refresh({events:[{...fixture,highlights:first[0].highlights}],previous:first,coverage:first.coverage,now:new Date(+now+1800000),fetchImpl,apiKey:'controlled-test-key'});assert.equal(blockedPublished[0].highlights,null,'API arrival checks a fresh keyless link and withdraws a restricted published fallback');blocked=false;const publishedAfterKeyLoss=await media.refresh({events:[{...fixture,highlights:first[0].highlights}],previous:blockedPublished,coverage:blockedPublished.coverage,now:new Date(+now+3600000),fetchImpl});assert.equal(require('../lib/fixture-snapshot').mergeFixtureSnapshot(blockedPublished,publishedAfterKeyLoss).events[0].highlights,null,'explicit source withdrawal beats a still-published last-good link when the key is lost');
 const allowed=await media.refresh({events:[fixture],now,fetchImpl,apiKey:'controlled-test-key'});assert.equal(allowed[0].highlights.regionStatus,'allowed');assert(apiCount>0);
 const callsBefore=apiCount;await media.refresh({events:[{...fixture,tournamentId:'tournament:tennis:atp-paris-2026'}],now,fetchImpl,apiKey:'controlled-test-key',searchBudget:0});assert.equal(apiCount,callsBefore,'canonical projections do not duplicate historical searches');
  const noKeyAfterBlock=await media.refresh({events:[fixture],coverage:restricted.coverage,now:new Date(+now+1800000),fetchImpl});assert.equal(noKeyAfterBlock.length,0,'losing the key cannot undo a known regional restriction');
  const archived={...fixture,id:'older-classic',canonicalEventId:'older-classic',date:'2026-09-01'};
  const archiveApi=require('../lib/highlight-archives');let readCount=0;
  const archivedRows=await archiveApi.candidates({request:async(url,{body})=>{assert.equal(url,'/rest/v1/rpc/nothingsports_referenced_classics');assert.equal(body.page_limit,201);return [{event_id:archived.id,fixture:archived}];}});assert.equal(archivedRows.fixtures.length,1);
  const archiveSource={...first[0],id:archived.id,sourceEventIds:[],highlights:first[0].highlights};
  const saved=await archiveApi.publish([archiveSource],[archived],{request:async(url,{body})=>{readCount++;assert.equal(url,'/rest/v1/rpc/nothingsports_hydrate_classic_highlights');assert.equal(body.p_event_id,'older-classic');assert.deepEqual(body.p_record,first[0].highlights);return true;}});assert.equal(saved.changed,1);assert.equal(readCount,1);assert(!archived.highlights,'archive source input is immutable');
  const cleared={...actual,highlights:null};assert.deepEqual((await archiveApi.hydrate([cleared]))[0],cleared,'cached fallback never restores withdrawn media');
  assert.equal((await archiveApi.candidates({request:async()=>{const e=Error();e.status=404;throw e;}})).state,'archive-not-ready');
 const publicReport=require('../lib/compact-fixture-observations').publicReport(first.coverage);assert(!Object.keys(publicReport).some(k=>k.startsWith('_highlight')));
 // More candidates than the per-pass budget must share one bounded API and
 // oEmbed batch; the four beyond the batch remain pending for a later pass.
 const batchFixtures=Array.from({length:28},(_,i)=>({...fixture,id:'fixture:tennis:batch:'+i,eventId:'fixture:tennis:batch:'+i,canonicalEventId:'fixture:tennis:batch:'+i,sourceEventIds:[],participants:[{id:'player:batch:home'+i,name:'Replay Home'+i,displayName:'Replay Home'+i},{id:'player:batch:away'+i,name:'Replay Away'+i,displayName:'Replay Away'+i}],participantIds:['player:batch:home'+i,'player:batch:away'+i]}));
 const batchVideos=batchFixtures.map((f,i)=>({...video,videoId:'batch'+String(i).padStart(6,'0'),url:'https://www.youtube.com/watch?v=batch'+String(i).padStart(6,'0'),title:'Replay Home'+i+' vs Replay Away'+i+' Highlights | Shanghai 2026 Round 4'}));
 const apiIds=[],embedIds=[];let batchApiCalls=0;
 const bounded=await media.refresh({events:batchFixtures,now,apiKey:'controlled-test-key',fetchImpl:async url=>{
  if(url.includes('/feeds/')){const c=media.channels.find(c=>url.includes(c.id));return new Response(feed(c,c.id===channel.id?batchVideos:[]));}
  if(url.includes('/youtube/v3/videos')){batchApiCalls++;const list=new URL(url).searchParams.get('id').split(',');apiIds.push(...list);return new Response(JSON.stringify({items:list.map(id=>{const v=batchVideos.find(v=>v.videoId===id);return {id,snippet:{channelId:v.channelId,title:v.title,publishedAt:v.publishedAt},contentDetails:{duration:'PT5M'},status:{privacyStatus:'public',uploadStatus:'processed'}};})}));}
  if(url.includes('/oembed')){const id=new URL(new URL(url).searchParams.get('url')).searchParams.get('v'),v=batchVideos.find(v=>v.videoId===id);embedIds.push(id);return new Response(JSON.stringify({type:'video',author_name:channel.label,author_url:'https://www.youtube.com/@'+channel.handle,title:v.title}));}
  throw Error('Unexpected bounded-batch request');
 }});
 assert.equal(batchApiCalls,1,'the shared batch needs only one API availability request');assert.equal(apiIds.length,24,'API availability IDs obey the same twenty-four candidate cap');assert.equal(embedIds.length,24,'oEmbed obeys the shared cap');assert.deepEqual(new Set(apiIds),new Set(embedIds),'both verifiers consume the identical batch');assert.equal(bounded.filter(r=>r.highlights).length,24);assert.equal(bounded.coverage.pending,4);
 const source=media.source({quotaReserve:null,published:[fixture],fetchImpl,loadCurrent:async scope=>{assert.equal(scope.scope,'participants');assert(scope.sportKeys.includes('tennis')&&scope.sportKeys.includes('tennis-women')&&scope.sportKeys.includes('wimbledon'));assert(scope.participantIds.includes(fixture.participantIds[0]));assert(scope.preserveIds.includes(fixture.canonicalEventId));return {sources:[]};},loadArchives:async()=>[]});assert.equal(source.minimumIntervalMs,1800000);assert.equal(source.refreshInterval(),1800000);
 const store={dueIds:async()=>[],claim:async()=>({fixtures:[],discovery_report:{}}),publish:async(_id,_token,value)=>{assert.equal(value.intervalMs,1800000);assert.equal(value.fixtures[0].highlights.videoId,video.videoId);},fail:async()=>assert.fail('source failed')};
 const result=await require('../lib/live-fixtures').refreshDueSources({sources:[source],store,now});assert.deepEqual(result.refreshed,[media.SOURCE_ID]);
 const apiFixture={...fixture,id:'fixture:tennis:test:highlights',canonicalEventId:'fixture:tennis:test:highlights',sourceEventIds:[]};let liveMedia=[];
 const handler=require('../lib/live-fixture-handler').createLiveFixtureHandler({publishedFixtures:()=>[apiFixture],clock:()=>now,read:async()=>({revision:require('../lib/live-fixtures').contentHash(liveMedia),stale:false,sources:[{source_id:media.SOURCE_ID,fixtures:liveMedia}]})});
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;},end(){}});
 const request=revision=>({url:'/api/fixtures?ids='+apiFixture.id+(revision?'&revision='+revision:''),headers:{}});
 let res=response();await handler(request(),res);assert.equal(res.code,200);const beforeRevision=res.body.revision;
 liveMedia=[{...first[0],id:apiFixture.id,sourceEventIds:[]}];res=response();await handler(request(beforeRevision),res);assert.equal(res.code,200,'new media invalidates the selected-reader validator');const served=res.body.sources[0].fixtures[0];assert.deepEqual(served.highlights,first[0].highlights);assert.equal(served.status,fixture.status);assert.equal(served.startTimeUtc,fixture.startTimeUtc);
 const lifecycle=require('../config/feed-refresh-lifecycle');assert.notEqual(lifecycle.presentationFingerprint({events:[apiFixture]}),lifecycle.presentationFingerprint({events:[served]}),'media arrival redraws through the existing presentation lifecycle');
 const linkedRevision=res.body.revision;liveMedia=[{...liveMedia[0],highlights:null}];res=response();await handler(request(linkedRevision),res);assert.equal(res.code,200);assert.equal(res.body.sources[0].fixtures[0].highlights,null,'the public selected reader carries explicit removal');
 // Actual default published owner has no discovered ESPN fixture. A current
 // database-only row still receives its canonical media after the live merge.
 const cache=require('../data/canonical/fixture-highlights.v1.json'),savedCache=cache.events;
 const currentOnly={...fixture};delete currentOnly.highlights;const controlledCache=[first[0]];
 const defaultOwner=identity.mergeOverlays(require('../data/follow-sources/coverage.v1.json').events,require('../lib/competition-fixtures').fixtures());
 assert(!defaultOwner.some(e=>[e.id,e.canonicalEventId,...(e.sourceEventIds||[])].includes(currentOnly.canonicalEventId)),'regression fixture is absent from the actual default published owner');
 let currentRows=[currentOnly],readerNow=new Date(now),selectedReads=0;
 const defaultHandler=require('../lib/live-fixture-handler').createLiveFixtureHandler({clock:()=>readerNow,read:async()=>{selectedReads++;return {revision:'same-current-only-snapshot',stale:false,sources:[{source_id:'live-tennis-atp',fixtures:currentRows}]};}});
 const readCurrent=async(id=currentOnly.canonicalEventId,revision)=>{const r=response();await defaultHandler({url:'/api/fixtures?ids='+id+(revision?'&revision='+revision:''),headers:{}},r);return r;};
 try{
  cache.events=[];const unlinked=await readCurrent();assert.equal(unlinked.code,200);assert(!unlinked.body.sources[0].fixtures[0].highlights);
  cache.events=controlledCache;const fallback=await readCurrent(currentOnly.canonicalEventId,unlinked.body.revision);assert.equal(fallback.code,200,'old no-link validator receives media arrival');
  const attached=fallback.body.sources[0].fixtures[0];assert(attached.highlights?.url);assert(!fallback.body.sources.some(s=>s.source_id===media.SOURCE_ID),'no highlights discovery snapshot is required');
  assert.deepEqual({...attached,highlights:undefined},{...unlinked.body.sources[0].fixtures[0],highlights:undefined},'actual starts/results/participants and sporting facts are preserved');
  const aliased=await readCurrent(currentOnly.id);assert.equal(aliased.body.sources[0].fixtures[0].highlights.url,attached.highlights.url,'published aliases resolve the same current-only media');
  assert.notEqual(lifecycle.presentationFingerprint({events:unlinked.body.sources[0].fixtures}),lifecycle.presentationFingerprint({events:fallback.body.sources[0].fixtures}),'native Feed consumer detects fallback media arrival');
  const unchanged=await readCurrent(currentOnly.canonicalEventId,fallback.body.revision);assert.equal(unchanged.code,304,'unchanged media retains the response validator');
  currentRows=[{...currentOnly,highlights:null}];const withdrawn=await readCurrent(currentOnly.canonicalEventId,fallback.body.revision);assert.equal(withdrawn.code,200);assert.equal(withdrawn.body.sources[0].fixtures[0].highlights,null,'explicit live withdrawal cannot be restored by canonical media');
  currentRows=[{...currentOnly,highlights:{...attached.highlights,regionStatus:'blocked'}}];const knownBlocked=await readCurrent();assert.equal(knownBlocked.body.sources[0].fixtures[0].highlights,null,'owned known restriction is withdrawn rather than overwritten');
  const owned={...attached.highlights,videoId:'OWNED000001',url:'https://www.youtube.com/watch?v=OWNED000001'};
  currentRows=[{...currentOnly,highlights:owned}];assert.equal((await readCurrent()).body.sources[0].fixtures[0].highlights.url,owned.url,'fresh source-owned media wins');
  readerNow=new Date(Math.max(...controlledCache.map(r=>Date.parse(r.highlights.checkedAt||r.highlights.verifiedAt)))+contract.MAX_CACHE_AGE_MS);
  // Synthetic end-date keeps this isolated expiry replay in the active window.
  const expiryRow={...currentOnly,endDate:readerNow.toISOString().slice(0,10)};currentRows=[expiryRow];const expiredFallback=await readCurrent(currentOnly.canonicalEventId,fallback.body.revision);assert.equal(expiredFallback.code,200);assert.equal(expiredFallback.body.sources[0].fixtures[0].highlights,null,'expired static fallback is explicit and invalidates the old link');
  currentRows=[{...expiryRow,highlights:owned}];assert.equal((await readCurrent()).body.sources[0].fixtures[0].highlights,null,'expired owned metadata is also withdrawn');
  assert(selectedReads>0);
 }finally{cache.events=savedCache;}
 const failedStore={dueIds:async()=>[],claim:async()=>({fixtures:[],discovery_report:restricted.coverage}),fail:async(_id,_token,value)=>assert.deepEqual(value.coverage._highlightVideos,restricted.coverage._highlightVideos)};
 await require('../lib/live-fixtures').refreshDueSources({sources:[{...source,fetch:async()=>{throw Error('controlled source failure');}}],store:failedStore,now});
 const ajv=new (require('ajv/dist/2020'))({strict:false});require('ajv-formats')(ajv);const validate=ajv.compile(JSON.parse(fs.readFileSync('schemas/fixture-highlights.schema.json')));assert(validate(first[0].highlights),JSON.stringify(validate.errors));assert(!validate({...first[0].highlights,unexpected:true}));
 assert(require('./update-cards').buildSteps({localOnly:true}).some(step=>step[0]==='scripts/refresh-fixture-highlights.js'));
 assert(require('./quick-results').projectionSteps(['Tennis highlights']).some(step=>step[0]==='scripts/build-paged-feed.js'));
 await require('./validate-fixture-highlights-cache').main();
 await require('./validate-tennis-highlights-seven-days').main();
  require('./validate-all-sport-highlights').main();
  await require('./validate-youtube-top-result').main();
  await require('./validate-missing-fixture-metadata').main();
  await require('./validate-highlight-navigation').run();
  await require('./validate-highlights-recency').main();
  await require('./validate-direct-highlight-policy').main();
  await require('./validate-highlight-fixture-fallback').main();
 await require('./validate-highlight-provider-query').main();
 await require('./validate-highlight-cache-continuity').main();
  await require('./validate-stan-football-recaps').main();
  await require('./validate-stan-football-recap-projection').main();
  await require('./validate-cross-sport-highlight-selection').main();
  require('./validate-feed-highlight-title-gaps');
  await require('./validate-cross-sport-highlight-cache').main();
  require('./validate-highlight-context-regressions').main();
  await require('./validate-youtube-top-result-database').main();
  await require('./validate-highlight-search-reuse').main();
  await require('./validate-reviewed-publisher-highlights').main();
 console.log('Highlights: sourced rounds, draw/publisher/edition matching, public feeds, key fallback, removal/outage, safe persisted overlays, cadence, schemas and canonical owners passed.');
 }finally{Date.now=realNow;}
}

async function main(){const original=Date.now;Date.now=()=>+now;try{return await run();}finally{Date.now=original;}}
main().catch(error=>{console.error(error);process.exitCode=1;});
