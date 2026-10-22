'use strict';
const assert=require('node:assert/strict');
const contract=require('../config/fixture-highlights'),media=require('../lib/fixture-highlights');
const fixture={...require('./fixtures/shanghai-highlights-184950.json'),status:'completed'};
delete fixture.highlights;
const now=new Date('2026-10-14T08:00:00Z');
const feed=c=>'<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><author><uri>https://www.youtube.com/channel/'+c.id+'</uri></author></feed>';
async function run(){
  for(const eventType of ['mens-singles','womens-singles'])for(const roundLabel of ['Round of 128','Round of 64','Round of 32','Round 1','Round unconfirmed']){
    const event={...fixture,eventType,roundLabel,key:eventType.startsWith('womens')?'tennis-women':'tennis'};
    const action=contract.viewing(event,now);assert.equal(action.highlightsLabel,'Watch highlights');
    const url=new URL(action.webUrl,'https://nothingsport.local');assert.equal(url.pathname,'/api/fixtures');assert.equal(url.searchParams.get('mode'),'highlight');assert.equal(action.highlightsTopResult,true);
    const query=contract.searchQuery(event,now);for(const name of media.names(event))assert(query.toLowerCase().includes(name));assert(query.includes('2026'));
    assert(query.includes(eventType.startsWith('womens')?'WTA':'ATP'));
  }
  assert(contract.tennisEligible({...fixture,isQualifying:true,eventType:'qualifying-singles'}));
  assert(contract.recent({...fixture,date:'2026-10-07'},now));assert(!contract.recent({...fixture,date:'2026-10-06'},now));
  for(const date of ['2026-10-15','2026-02-31','2026-99-99'])assert(!contract.recent({...fixture,date},now));
  assert(!contract.recent({...fixture,date:null,startTimeUtc:null},now),'A missing calendar and own-fixture UTC clock remain unknown');
  assert(contract.recent({...fixture,date:null},now),'The shared retained-calendar owner recognises an existing own-fixture UTC clock');
  assert(contract.searchQuery({...fixture,date:null},now).includes('2026'),'A bound UTC clock preserves the match year in the search');
  const unknownCalendar={...fixture,date:null,startDate:null,startTimeUtc:null,endDate:null,endTimeUtc:null,actualEndTimeUtc:null,completedAt:null,firstConfirmedCompleteAt:null};
  for(const alias of [{startDate:'2026-10-13'},{firstConfirmedCompleteAt:'2026-10-13T04:00:00Z'}]){
    const action=contract.viewing({...unknownCalendar,...alias,tournamentName:'Shanghai'},now);
    assert.equal(action?.highlightsLabel,'Watch highlights');assert(contract.searchQuery({...unknownCalendar,...alias,tournamentName:'Shanghai'},now).includes('2026'),'Every accepted shared-calendar alias preserves its match year');
  }
  const yearBoundary={...unknownCalendar,date:'2025-12-31',completedAt:'2026-01-01T04:00:00Z'};
  assert(contract.searchQuery(yearBoundary,new Date('2026-01-02T08:00:00Z')).includes('2025'),'A later confirmation preserves the original published match year');
  assert(contract.recent({...fixture,date:'2026-10-01',startTimeUtc:null,completedAt:new Date(+now-7*86400000).toISOString()},now));
  assert(contract.recent({...fixture,date:'2026-10-01',startTimeUtc:null,completedAt:new Date(+now-7*86400000-1).toISOString()},now),'A few elapsed hours cannot retire a retained Sydney-day-seven card');
  for(const [date,completedAt,lastRetained,firstRetired] of [
    ['2026-10-07','2026-10-07T01:00:00Z','2026-10-14T12:59:59.999Z','2026-10-14T13:00:00Z'],
    ['2026-10-01','2026-10-01T00:00:00Z','2026-10-08T12:59:59.999Z','2026-10-08T13:00:00Z'],
    ['2026-04-01','2026-04-01T00:00:00Z','2026-04-08T13:59:59.999Z','2026-04-08T14:00:00Z']
  ]){
    const event={...fixture,date,endDate:null,startTimeUtc:null,actualEndTimeUtc:null,completedAt,firstConfirmedCompleteAt:null};
    const epic=require('../config/epic-classics');
    assert(!epic.retired(event,new Date(lastRetained)));assert(epic.retired(event,new Date(firstRetired)));
    assert.equal(contract.viewing(event,new Date(lastRetained))?.highlightsLabel,'Watch highlights','Retained cards keep search through the final Sydney day, including both DST changes');
    assert.equal(contract.viewing(event,new Date(firstRetired)),null,'The search window ends with ordinary card retirement');
  }
  const rollover={...fixture,date:'2026-10-06',startTimeUtc:'2026-10-06T23:00:00Z',endTimeUtc:'2026-10-07T01:00:00Z'};
  assert(!require('../config/epic-classics').retired(rollover,now));assert.equal(contract.viewing(rollover,now)?.highlightsLabel,'Watch highlights','The existing endTime fallback keeps retained rollover cards actionable');
  assert(contract.recent({...fixture,actualEndTimeUtc:'2026-02-30T02:03:04Z',completedAt:'2026-10-13T07:00:00Z'},now),'invalid first receipt yields to a later valid one');
  assert(!contract.recent({...fixture,date:'2026-10-01',startTimeUtc:null,actualEndTimeUtc:'2026-10-15T00:00:00Z'},now),'future receipt cannot promote an old fixture');
  assert(!contract.recent({...fixture,date:'2026-10-01',startTimeUtc:'2026-10-15T00:00:00Z',actualEndTimeUtc:'2026-10-13T07:00:00Z'},now),'before-start receipt cannot promote an old fixture');
  for(const patch of [{status:'live'},{status:undefined},{date:'2026-10-06'}])assert.equal(contract.viewing({...fixture,...patch},now),null,JSON.stringify(patch));
  const direct=require('./fixtures/shanghai-highlights-184950.json').highlights;
  assert(direct,'The retained match receipt exercises verified-link precedence even after current links expire');
  assert.equal(contract.viewing({...fixture,highlights:direct},now).highlightsLabel,'Watch highlights');
  assert.equal(contract.viewing({...fixture,highlights:null},now).highlightsLabel,'Watch highlights');
  assert.equal(contract.viewing({...fixture,highlights:{...direct,regionStatus:'blocked'}},now).highlightsLabel,'Watch highlights');
  const low={...fixture,id:'low',participantIds:['competitor:tennis:wta:low'],participants:[]};
  const high={...fixture,id:'high',participantIds:['competitor:tennis:atp:high'],participants:[]};
  const unknown={...fixture,id:'unknown',participantIds:['competitor:tennis:atp:unknown'],participants:[]};
  const ranks=[{athleteId:high.participantIds[0],rankingSourceTrust:'verified',rankingSingles:1},{athleteId:low.participantIds[0],rankingSourceTrust:'verified',rankingSingles:2},{athleteId:unknown.participantIds[0],rankingSourceTrust:'unverified',rankingSingles:1}];
  assert.deepEqual(media.prioritise([unknown,low,high],now,ranks).map(e=>e.id),['high','low','unknown']);
  assert.deepEqual(media.rankPriority({...high,eventType:'mens-doubles'},ranks),[Infinity,Infinity],'singles ranks cannot invent doubles ranks');
  const early={...fixture,roundLabel:'Round of 64',roundNumber:2,tournamentRoundTotal:7};
  const v={videoId:'RPmOiRHHgX8',channelId:media.channels[0].id,title:'Alex de Minaur vs Karen Khachanov Highlights | Shanghai 2026 Round 2',publishedAt:'2026-10-13T07:16:25Z',url:'https://www.youtube.com/watch?v=RPmOiRHHgX8'};
  assert(media.suitable(v,early));assert(!media.suitable({...v,title:v.title.replace('Round 2','Round 1')},early));
  for(const alias of ['R1','R2','R3'])assert.equal(media.suitable({...v,title:v.title.replace('Round 2',alias)},early),alias==='R2','Ordinal round aliases must preserve known-round conflicts');
  const qualifying={...early,isQualifying:true,eventType:'qualifying-singles',roundLabel:'Round 1'};
  const qualifyingVideo={...v,title:v.title.replace('Round 2','Qualifying Round 1')};
  assert(!media.suitable({...v,title:v.title.replace('Round 2','Round 1')},qualifying),'A generic main-draw video cannot prove a qualifying match');
  assert(media.suitable(qualifyingVideo,qualifying),'Explicit qualifying phase and matching round are accepted');
  assert(!media.suitable(qualifyingVideo,{...early,roundLabel:'Round 1'}),'A main-draw match cannot accept a qualifying video');
  const legacyQualifying={...qualifying,isQualifying:undefined,qualifying:true,eventType:'mens-singles'};
  assert(!media.suitable({...v,title:v.title.replace('Round 2','Round 1')},legacyQualifying),'The existing qualifying boolean alias cannot accept a generic main-draw video');
  assert(media.suitable(qualifyingVideo,legacyQualifying),'Explicit phase evidence works for the existing qualifying alias');
  assert(!media.suitable({...qualifyingVideo,title:qualifyingVideo.title.replace('Round 1','R2')},qualifying),'A qualifying round alias conflict is rejected');
  assert(media.suitable({...qualifyingVideo,title:qualifyingVideo.title.replace('Qualifying ','').replace('Round 1','R1'),description:'Official qualification match highlights'},qualifying),'Explicit source description may establish qualification');
  const requests=[];
  const fetchImpl=async url=>{requests.push(new URL(url));if(url.includes('/feeds/')){const c=media.channels.find(c=>url.includes(c.id));return new Response(feed(c));}return new Response('{"items":[]}');};
  const oldBinding={...direct,videoId:v.videoId,url:v.url,channelId:v.channelId,publishedAt:v.publishedAt,matchTitle:v.title.replace('Round 2','Round 1'),verifiedAt:now.toISOString(),checkedAt:now.toISOString(),sourceCheckedAt:now.toISOString()};
  const rechecked=await media.refresh({events:[qualifying],previous:[{...qualifying,highlights:oldBinding}],now,fetchImpl});
  assert.equal(rechecked[0].highlights,null,'A retained receipt cannot bypass the newly checked qualifying/main-draw boundary');
  const coverage={_highlightQuota:{day:'2026-10-14',search:89,ordinary:499}};
  const bounded=await media.refresh({events:[fixture],coverage,now,apiKey:'controlled-key',fetchImpl,searchBudget:999});
  assert.equal(requests.filter(u=>u.pathname.endsWith('/search')).length,1);assert.equal(bounded.coverage._highlightQuota.search,90);assert(bounded.coverage.quotaLimited);
  const dayEnd=new Date('2026-10-15T06:59:59Z');assert(!media.reserveQuota(coverage,dayEnd,'search'),'UTC midnight is not the reset');
  assert(media.reserveQuota(coverage,new Date('2026-10-15T07:00:00Z'),'search'));assert.equal(coverage._highlightQuota.search,1,'reset follows Pacific midnight');
  assert(media.reserveQuota(coverage,new Date('2026-11-01T07:00:00Z'),'ordinary'));coverage._highlightQuota.search=90;
  assert(!media.reserveQuota(coverage,new Date('2026-11-02T07:59:59Z'),'search'),'25-hour Pacific day stays capped');
  assert(media.reserveQuota(coverage,new Date('2026-11-02T08:00:00Z'),'search'));
  for(const ledger of [{day:'2026-10-15',search:90,ordinary:500},{day:'2026-02-30',search:0,ordinary:0},{day:'bad',search:0,ordinary:0},{day:'2026-10-14',search:-1,ordinary:0}]){const state={_highlightQuota:{...ledger}};assert(!media.reserveQuota(state,now,'search'));assert(!media.reserveQuota(state,now,'ordinary'));assert.deepEqual(state._highlightQuota,ledger,'two regressed/malformed calls cannot reset the ledger');}
  const exhausted={_highlightQuota:{day:'2026-10-14',search:90,ordinary:500}};requests.length=0;
  await media.refresh({events:[fixture],coverage:exhausted,now,apiKey:'controlled-key',fetchImpl:async url=>{requests.push(new URL(url));return new Response('',{status:503});}});
  assert(!requests.some(u=>u.hostname==='www.googleapis.com'),'exhausted quota still permits only free provider attempts');
  // Rank priority applies to actual search calls and survives the next pass.
  const rankedEvents=[{...fixture,id:'low',eventId:'low',canonicalEventId:'low',sourceEventIds:[],participantIds:low.participantIds,participants:fixture.participants},{...fixture,id:'high',eventId:'high',canonicalEventId:'high',sourceEventIds:[],participantIds:high.participantIds,participants:fixture.participants}];
  let rankedCoverage={},queried=[];
  const rankedFetch=async url=>{const u=new URL(url);if(u.pathname.endsWith('/search'))queried.push(u.searchParams.get('q'));return fetchImpl(url);};
  rankedEvents[0].tournamentId='tournament:tennis:atp-paris-2026';
  const rankPass=await media.refresh({events:rankedEvents,coverage:rankedCoverage,now,apiKey:'controlled-key',fetchImpl:rankedFetch,rankings:ranks});assert(queried.length===2&&queried.every(q=>q.includes('shanghai')));
  queried=[];await media.refresh({events:rankedEvents,coverage:rankPass.coverage,now:new Date(+now+1800000),apiKey:'controlled-key',fetchImpl:rankedFetch,rankings:ranks});assert(queried.every(q=>q.includes('paris')),'higher-ranked attempted pairs yield to the remaining queue');
  const source=media.source({quotaReserve:null,published:[fixture],environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},loadArchives:async()=>[],loadCurrent:async args=>{assert.equal(args.scope,'participants');const error=Error('controlled timeout');error.payload={code:'supabase_timeout'};error.status=504;throw error;},fetchImpl});
  const fallback=await source.fetch({now,previous:[],privateCoverage:{}});assert.equal(fallback.coverage.inputState,'published-fallback');assert.equal(fallback.coverage.status,'partial');assert.deepEqual(fallback.coverage.inputFailure,{code:'supabase_timeout',status:504});assert(fallback.coverage.failures.some(f=>f.code==='supabase_timeout'));assert.equal(fallback.coverage.eligible,1);assert.equal(fixture.status,'completed');
  const live=require('../lib/live-fixtures'),scope=media.tennisScope([fixture],now);
  const originalSources=[{source_id:'controlled-tennis-cache',revision:1,fixtures:[fixture]}];
  let failRead=false;
  const currentStore={read:async()=>{if(failRead)throw Object.assign(Error('private diagnostic body'),{payload:{code:'supabase_timeout',details:'private upstream detail'},status:504});return originalSources;}};
  await live.readLiveSnapshots({...scope,store:currentStore,now:+now-1000,maxAgeMs:0});failRead=true;
  const loadCurrent=args=>live.readLiveSnapshots({...args,store:currentStore,now:+now,maxAgeMs:0});
  const cached=await loadCurrent(scope);assert(cached.stale);assert.deepEqual(cached.sources,originalSources);assert.deepEqual(cached.readFailure,{code:'supabase_timeout',status:504});assert(!JSON.stringify(cached).includes('private upstream detail'));
  const cachedSource=media.source({quotaReserve:null,published:[fixture],loadCurrent,loadArchives:async()=>[],fetchImpl,environment:{}});
  const cachedFallback=await cachedSource.fetch({now,previous:[],privateCoverage:{}});
  assert.equal(cachedFallback.coverage.status,'partial');assert.equal(cachedFallback.coverage.inputState,'published-fallback');assert.deepEqual(cachedFallback.coverage.inputFailure,cached.readFailure,'Cached last-good input retains the actual sanitised failure');
  failRead=false;const recovered=await loadCurrent(scope);assert.equal(recovered.stale,false);assert(!Object.hasOwn(recovered,'readFailure'));assert.deepEqual(recovered.sources,originalSources,'Input recovery changes no fixture facts');
  assert.deepEqual(live.snapshotReadFailure({payload:{code:'https://private.invalid/key'},status:999}),{code:'current_input_unavailable',status:null});
  let failedReport;
  const store={dueIds:async()=>[],claim:async()=>({fixtures:[],discovery_report:null}),fail:async(_id,_token,value)=>{failedReport=value.coverage;}};
  await require('../lib/live-fixtures').refreshDueSources({now,store,sources:[{id:media.SOURCE_ID,timeoutMs:5,retryMs:media.INTERVAL_MS,fetch:async({privateCoverage,signal})=>{assert(media.reserveQuota(privateCoverage,now,'search'));await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));}}]});
  assert.equal(failedReport._highlightQuota.search,1,'first-ever source timeout retains its pre-request reservation');
  assert(!Object.hasOwn(require('../lib/compact-fixture-observations').publicReport(failedReport),'_highlightQuota'));
  let providerCalls=0,publishedReport;
  const providerError=media.source({quotaReserve:null,published:[fixture],environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},loadArchives:async()=>[],loadCurrent:async()=>({sources:[]}),fetchImpl:async url=>{
    if(url.includes('/feeds/'))return new Response(feed(media.channels.find(c=>url.includes(c.id))));
    providerCalls++;return new Response('',{status:503});
  }});
  const errorStore={...store,publish:async(_id,_token,value)=>{publishedReport=value.coverage;}};
  await require('../lib/live-fixtures').refreshDueSources({now,store:errorStore,sources:[providerError]});
  assert.equal(providerCalls,2);assert.equal(publishedReport._highlightQuota.search,providerCalls,'actual failed API requests persist in the ordinary publish report');
  providerCalls=0;failedReport=null;
  const timedSource=media.source({quotaReserve:null,published:[fixture],environment:{YOUTUBE_DATA_API_KEY:'controlled-key'},loadArchives:async()=>[],loadCurrent:async()=>({sources:[]}),fetchImpl:async(url,{signal})=>{
    if(url.includes('/feeds/'))return new Response(feed(media.channels.find(c=>url.includes(c.id))));
    providerCalls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('controlled provider abort')),{once:true}));
  }});
  await require('../lib/live-fixtures').refreshDueSources({now,store,sources:[{...timedSource,timeoutMs:10}]});
  assert.equal(providerCalls,1);assert.equal(failedReport._highlightQuota.search,providerCalls,'actual in-flight API request survives the outer owner timeout');
  assert.equal(failedReport.status,'failed');
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),canonical=require('./refresh-fixture-highlights');
  const cwd=process.cwd(),oldKey=process.env.YOUTUBE_DATA_API_KEY,temp=fs.mkdtempSync(path.join(os.tmpdir(),'highlights-canonical-quota-'));
  try{
    for(const dir of ['feeds/incoming','data/canonical','data/follow-schedule'])fs.mkdirSync(path.join(temp,dir),{recursive:true});
    for(const file of ['feeds/incoming/events.json','data/events.json'])fs.writeFileSync(path.join(temp,file),JSON.stringify({version:'controlled-replay',events:[fixture]}));
    fs.writeFileSync(path.join(temp,'data/canonical/fixture-highlights.v1.json'),JSON.stringify({events:[]}));
    fs.writeFileSync(path.join(temp,'data/follow-schedule/tennis.json'),JSON.stringify({fixtures:[]}));
    process.env.YOUTUBE_DATA_API_KEY='controlled-canonical-key';process.chdir(temp);requests.length=0;
    const result=await canonical.refresh({now,fetchImpl});assert.equal(result.mode,'public-feeds');
    assert(!requests.some(u=>u.hostname==='www.googleapis.com'),'canonical refresh ignores an available key and cannot bypass the sole shared ledger');
  }finally{process.chdir(cwd);if(oldKey===undefined)delete process.env.YOUTUBE_DATA_API_KEY;else process.env.YOUTUBE_DATA_API_KEY=oldKey;fs.rmSync(temp,{recursive:true,force:true});}
  console.log('Seven-day Tennis highlights: all rounds/genders, automatic top-result routes, receipt/calendar bounds, verified-rank ordering, cooldowns, Pacific/DST caps, failed-call reservations and truthful input fallback passed.');
}

async function main(){const original=Date.now;Date.now=()=>+now;try{return await run();}finally{Date.now=original;}}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};
