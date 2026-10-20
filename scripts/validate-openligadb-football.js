'use strict';
const assert=require('node:assert/strict');
const {normalizeLeague,resolveLeagueIdentities,assertResultAdmission,rawScheduleFixtures,COMPETITIONS}=require('./lib/openligadb-football');
const options={league:'ucl',checkedAt:'2026-09-27T12:00:00Z'};
function fixtureSet(league='ucl'){
  return Array.from({length:8},(_,round)=>Array.from({length:18},(_,i)=>{
    const a={teamId:i+1,teamName:`Club ${i+1}`,teamIconUrl:'https://unlicensed.invalid/logo.svg'};
    const b={teamId:19+(i+round)%18,teamName:`Club ${19+(i+round)%18}`};
    return {matchID:round*18+i+1,leagueId:COMPETITIONS[league].leagueId,leagueShortcut:league,leagueSeason:2026,group:{groupOrderID:round+1},
      matchDateTimeUTC:new Date(Date.UTC(2026,9,1+round*7,19)).toISOString(),team1:round%2?a:b,team2:round%2?b:a,matchIsFinished:false,matchResults:[]};
  })).flat();
}
function rejects(mutate,pattern){const input=fixtureSet();mutate(input);assert.throws(()=>normalizeLeague(input,options),pattern);}
for(const league of Object.keys(COMPETITIONS)){
 const input=fixtureSet(league);const normal=normalizeLeague(input,{...options,league});assert.equal(normal.fixtures.length,144);assert.equal(normal.teams.length,36);
 assert.deepEqual(normal,normalizeLeague(input.reverse(),{...options,league}),'provider order does not change normalized facts');
 assert.equal(normal.source.type,'community');assert(!JSON.stringify(normal).includes('teamIconUrl'),'no unlicensed logos propagated');
 assert(normal.fixtures.every(f=>f.result===null&&f.status==='upcoming'));
}
rejects(x=>x.pop(),/144/);rejects(x=>x[1].matchID=x[0].matchID,/duplicate fixture/);
rejects(x=>x[0].leagueSeason=2025,/season/);rejects(x=>x[0].leagueId=6000,/competition/);
rejects(x=>x[0].matchDateTimeUTC='2026-10-01T19:00:00',/UTC kickoff/);
rejects(x=>x[0].matchDateTimeUTC='2026-09-31T19:00:00Z',/UTC kickoff/);
rejects(x=>x[0].team2=x[0].team1,/twice|itself/);
const invalidFinal=fixtureSet();Object.assign(invalidFinal[0],{matchDateTimeUTC:'2026-09-08T16:45:00Z',matchIsFinished:true});
const quarantined=normalizeLeague(invalidFinal,options);assert.equal(quarantined.fixtures.length,143);assert.match(quarantined.resultIsolation.repairs[0].reason,/full-time result/);
const premature=fixtureSet();premature[0].matchResults=[{resultTypeID:2}];assert.match(normalizeLeague(premature,options).resultIsolation.repairs[0].reason,/unfinished fixture/);
rejects(x=>{x[0].matchIsFinished=true;x[0].matchResults=[{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:1,pointsTeam2:0}];},/future fixture/);
const completed=fixtureSet();Object.assign(completed[0],{matchDateTimeUTC:'2026-09-08T16:45:00Z',matchIsFinished:true,matchResults:[{resultTypeID:1,pointsTeam1:0,pointsTeam2:0},{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:2,pointsTeam2:3}]});
assert.deepEqual(normalizeLeague(completed,options).fixtures[0].result,{homeScore:2,awayScore:3},'half-time scores never replace full time');
completed[0].matchIsFinished=false;completed[0].matchResults=[];assert.equal(normalizeLeague(completed,options).fixtures[0].status,'unknown','clock alone cannot invent a result or live status');
assert.throws(()=>normalizeLeague(fixtureSet(),{...options,season:2027}),/unreviewed/);
console.log('OpenLigaDB: complete league-phase structure, stable ordering, scope, UTC, club consistency, explicit results, stale-status honesty and image exclusion passed.');

const venues=fixtureSet();venues[0].location={locationStadium:'  BayArena  ',locationCity:'Leverkusen'};
venues[1].location={locationStadium:'TBC',locationCity:42};
const venueFacts=normalizeLeague(venues,options);
assert.equal(venueFacts.fixtures.find(f=>f.providerFixtureId==='1').venue,'BayArena');
assert.equal(venueFacts.fixtures.find(f=>f.providerFixtureId==='1').venueCity,'Leverkusen');
assert.equal(venueFacts.fixtures.find(f=>f.providerFixtureId==='2').venue,null);
assert.equal(venueFacts.fixtures.find(f=>f.providerFixtureId==='2').venueCity,null);
assert.equal(venueFacts.fixtures.find(f=>f.providerFixtureId==='3').venue,null,'missing stadium is not inferred from a home club');
const facts=normalizeLeague(fixtureSet(),options);
const mapping={teams:facts.teams.map(t=>({providerId:t.providerId,participantId:`team:football:test:${t.providerId}`,displayName:t.sourceName,sourceNames:[t.sourceName]}))};
const venueEvent=require('./refresh-openligadb-football').eventsForLeague(resolveLeagueIdentities(venueFacts,mapping)).find(e=>e.id.endsWith(':1'));
assert.equal(venueEvent.venue,'BayArena');assert.equal(venueEvent.venueCity,'Leverkusen');assert.equal(venueEvent.venueSourceUrl,venueFacts.source.url);
assert.equal(resolveLeagueIdentities(facts,mapping).fixtures[0].participants[0].participantId,'team:football:test:19');
const missing=structuredClone(mapping);missing.teams.pop();assert.throws(()=>resolveLeagueIdentities(facts,missing),/unreviewed club/);
const changed=structuredClone(facts);changed.teams[0].sourceName='Different club';assert.throws(()=>resolveLeagueIdentities(changed,mapping),/unreviewed club/);
const registry=require('../config/football-openligadb-identities.json');
assert.equal(registry.teams.length,72);assert.equal(new Set(registry.teams.map(t=>t.participantId)).size,72);
for(const [provider,id] of [['370','team:football:epl:10'],['2617','team:football:epl:1'],['5707','team:football:club:bod-glimt']])assert.equal(registry.teams.find(t=>t.providerId===provider).participantId,id,'existing follow identities are preserved');
const known=[...require('../data/canonical/football-directory.v1.json').teams,...require('../data/canonical/uefa-champions-league-2026-27.json').participants];
for(const team of registry.teams.filter(t=>t.preservesExistingId))assert(known.some(t=>t.id===team.participantId&&t.displayName===team.displayName));
console.log('Identity map: 72 reviewed clubs, 46 existing identities retained, ambiguous or unreviewed changes rejected.');



const {resolveUserFollowFixtures}=require('../lib/follow-fixture-resolver');
const {buildServerFeed,normalizeUserFollowState}=require('../lib/server-feed-pipeline');
function europeanFeed(entityFollows){
 const userState=normalizeUserFollowState({preferences:{selectedSelectorEntityIds:['sport:football'],preferenceGraph:{entityFollows}}});
 const before=JSON.stringify(userState);const resolved=resolveUserFollowFixtures({events:[],userState});
 const feed=buildServerFeed({events:resolved.events,userState,userId:'00000000-0000-4000-8000-000000000009',now:new Date('2026-09-27T00:00:00Z'),limit:500});
 assert.equal(JSON.stringify(userState),before,'source expansion does not change consent');
 return feed.events.filter(e=>e.sourceAttribution?.provider==='OpenLigaDB');
}
assert.equal(europeanFeed([]).length,0,'broad Football alone does not opt into club fixtures');
const published=require('../data/providers/openligadb/football-2026-27.json');
const liverpool=europeanFeed([{participantId:'team:football:epl:10',followLevel:'follow'}]);
const liverpoolCase=require('./fixtures/openligadb-liverpool-omission-20261021.json');
function assertLiverpoolFollow(records,document){
 const dated=f=>f.participants.some(p=>p.participantId===liverpoolCase.participantId)&&Date.parse(f.startTimeUtc)>=Date.parse(liverpoolCase.from);
 const id=(league,f)=>`fixture:football:openligadb:${league.competitionId.replace('competition:','')}:${f.providerFixtureId}`;
 const raw=document.leagues.flatMap(l=>rawScheduleFixtures(l).filter(dated).map(f=>id(l,f))).sort();
 const expected=liverpoolCase.datedIds.map(providerFixtureId=>id({competitionId:liverpoolCase.competitionId},{providerFixtureId})).sort();
 assert.deepEqual(raw,expected,'the complete dated Liverpool identity inventory is unchanged');
 const admitted=document.leagues.flatMap(l=>l.fixtures.filter(dated).map(f=>({id:id(l,f),fixture:f})));
 const omitted=new Set(document.leagues.flatMap(l=>(l.resultIsolation?.repairs||[]).filter(r=>r.disposition==='omitted'&&dated(r.rawFixture)).map(r=>id(l,r.rawFixture))));
 const byId=new Map(records.map(e=>[e.id,e]));
 assert.equal(byId.size,records.length,'no duplicate followed fixture identities');
 for(const e of records)assert(expected.includes(e.id),'no unexplained Liverpool fixture');
 for(const {id:fixtureId,fixture}of admitted){
  const e=byId.get(fixtureId);assert(e,'every admitted peer fixture is preserved');
  assert.deepEqual([...e.participantIds].sort(),fixture.participants.map(p=>p.participantId).sort());
  assert.equal(e.startTimeUtc,fixture.startTimeUtc);
  if(fixture.status==='completed')for(const key of ['homeScore','awayScore'])assert.equal(e[key],fixture.result[key],'admitted peer result remains exact');
 }
 for(const fixtureId of expected)if(!byId.has(fixtureId))assert(omitted.has(fixtureId),'only an explicitly omitted identity may be absent');
 // Source omission is not permission to discard a separately retained known
 // schedule, or to leak the rejected result. This captured case binds every
 // retained identity/calendar/provenance field and its original observation.
 for(const e of records.filter(e=>omitted.has(e.id))){
  assert.equal(e.id,liverpoolCase.retained.id,'retained omission requires captured prior evidence');
  for(const [key,value]of Object.entries(liverpoolCase.retained))assert.deepEqual(e[key],value,`retained omission preserves ${key}`);
  for(const key of ['homeScore','awayScore','score','result','outcomeText','recapText','scoreCheckedAt','resultSourceCheckedAt','statusCheckedAt'])assert.equal(e[key]??null,null,'rejected result or invented observation cannot leak into retained schedule');
 }
}
assertLiverpoolFollow(liverpool,published);

assert(liverpool.every(e=>e.participantIds.includes('team:football:epl:10')));
assert(liverpool.every(e=>e.footballMatchContext?.teams.length===2),'Personalised Feed preserves the same source-backed context');
assert.equal(europeanFeed([{participantId:'team:football:epl:10',followLevel:'mute'}]).length,0);
// Exercise the actual resolver with one constructed omitted result, first with
// its captured old schedule still available and then with that input absent.
{
 const competitionFixtures=require('../lib/competition-fixtures'),compact=require('../data/follow-fixtures.v1.json');
 const saved={leagues:published.leagues,events:published.events,fixtures:competitionFixtures.fixtures,compact:compact.events};
 try{
  const league=structuredClone(published.leagues.find(l=>l.competitionId===liverpoolCase.competitionId)),raw=rawScheduleFixtures(league),prior=raw.find(f=>f.providerFixtureId===liverpoolCase.omittedProviderId);
  league.fixtures=league.fixtures.filter(f=>f.providerFixtureId!==prior.providerFixtureId);
  league.resultIsolation={rawFixtureIds:raw.map(f=>f.providerFixtureId),repairs:[...(league.resultIsolation?.repairs||[]).filter(r=>r.providerFixtureId!==prior.providerFixtureId),{providerFixtureId:prior.providerFixtureId,code:'unfinished-with-final',reason:'unfinished fixture has a final result',disposition:'omitted',rawFixture:{...prior,status:'unknown',result:null},resultEvidence:liverpoolCase.invalidResultEvidence}]};
  published.leagues=published.leagues.map(l=>l.competitionId===league.competitionId?league:l);published.events=published.events.filter(e=>e.id!==liverpoolCase.retained.id);
  const follows=[{participantId:liverpoolCase.participantId,followLevel:'follow'}],retained=europeanFeed(follows);assertLiverpoolFollow(retained,published);assert(retained.some(e=>e.id===liverpoolCase.retained.id),'actual resolver retains the captured scoreless schedule');
  const mutations=[
   rows=>rows.push({...rows[0]}),rows=>rows.push({...rows[0],id:'fixture:football:openligadb:unreviewed:999'}),
   rows=>rows.splice(rows.findIndex(e=>e.id.endsWith(':87452')),1),
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).id='wrong-identity';},
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).participantIds=['wrong-team',liverpoolCase.participantId];},
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).startTimeUtc='2026-10-20T20:00:00.000Z';},
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).sourceUrl='https://example.invalid/';},
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).homeScore=2;},
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).status='completed';},
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).sourceCheckedAt='2026-10-20T19:49:47.137Z';},
   rows=>{rows.find(e=>e.id===liverpoolCase.retained.id).scoreCheckedAt=liverpoolCase.retained.sourceCheckedAt;},
  ];
  for(const mutate of mutations){const damaged=structuredClone(retained);mutate(damaged);assert.throws(()=>assertLiverpoolFollow(damaged,published),{name:'AssertionError'});}
  competitionFixtures.fixtures=(...args)=>saved.fixtures(...args).filter(e=>e.id!==liverpoolCase.retained.id);compact.events=saved.compact.filter(e=>e.id!==liverpoolCase.retained.id);
  const absent=europeanFeed(follows);assert(!absent.some(e=>e.id===liverpoolCase.retained.id),'actual resolver absence is accepted only for the documented omission');assertLiverpoolFollow(absent,published);
  console.log('Liverpool omission: actual retained/absent resolver paths and11 wrong-ID/peer/result/provenance/freshness negatives passed.');
 }finally{published.leagues=saved.leagues;published.events=saved.events;competitionFixtures.fixtures=saved.fixtures;compact.events=saved.compact;}
}

const rights=require('../config/follow-first');
for(const competition of Object.values(COMPETITIONS)){
 const league=published.leagues.find(l=>l.competitionId===competition.competitionId);assertResultAdmission(league);
 const events=published.events.filter(e=>e.competitionId===competition.competitionId);assert.equal(events.length,league.fixtures.length);
 assert.deepEqual(events.map(e=>e.id.split(':').at(-1)),league.fixtures.map(f=>f.providerFixtureId),'published events contain exactly the admitted fixture identities');
 assert(events.every(e=>e.participantIds.length===2&&e.sourceType==='community'&&e.sourceAttribution));
 const rightsCase=events.find(e=>e.status==='upcoming')||{key:'football',competitionId:competition.competitionId,status:'upcoming'};
 assert.deepEqual(rights.viewingOptions(rightsCase).map(o=>o.providerId),['stan']);
}
// Fixed Sydney/DST controls do not depend on a current match being quarantined.
const timingCase=utc=>require('../config/fixture-identity').normalizeCore({id:'controlled-dst',key:'football',startTimeUtc:utc,timePrecision:'exact'});
const september=timingCase('2026-09-08T16:45:00.000Z');assert.equal(september.time,'02:45');assert.equal(september.date,'2026-09-09');
const october=timingCase('2026-10-13T16:45:00.000Z');assert.equal(october.time,'03:45');assert.equal(october.date,'2026-10-14');
console.log('Published UEFA facts: 288 fixtures, Australian viewing, Sydney DST conversion and existing Follow consent passed.');

const ics=require('../config/calendar-export').buildIcs(liverpool).replace(/\r\n /g,'');assert(ics.includes('Data from OpenLigaDB under ODbL:'));assert(ics.includes('/data/providers/openligadb/football-2026-27.json'),'calendar exports retain source and licence attribution');

const identities=require('../config/card-identities');const unmappedArtwork=published.events.find(e=>e.participantIds.includes('team:football:club:lech-poznan'));const sides=identities.matchupSidesForEvent(unmappedArtwork,[],unmappedArtwork.name);assert(sides.some(s=>s.participant?.id==='team:football:club:lech-poznan'),'missing artwork must not remove a confirmed club profile identity');

(async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {refresh}=require('./refresh-openligadb-football');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-openliga-test-'));const outputPath=path.join(dir,'facts.json');
 try{
  const fetchGood=async url=>({ok:true,json:async()=>fixtureSet(url.includes('/ucl/')?'ucl':'uel2026')});
  const args={outputPath,identityRegistry:mapping,now:new Date(options.checkedAt)};
  const initial=await refresh({...args,fetchImpl:fetchGood});assert.equal(initial.payload.events.length,288);assert.equal(new Set(initial.payload.events.map(e=>e.id)).size,288,'competitions never share fixture IDs');
  const before=fs.readFileSync(outputPath,'utf8');
  const failed=await refresh({...args,fetchImpl:async()=>{throw new Error('offline')}});assert.equal(failed.failures.length,2);assert.equal(fs.readFileSync(outputPath,'utf8'),before,'total failure leaves last-good bytes and freshness untouched');
  await assert.rejects(refresh({...args,fetchImpl:async url=>url.includes('/ucl/')?fetchGood(url):{ok:true,json:async()=>[]}}),/144/);assert.equal(fs.readFileSync(outputPath,'utf8'),before,'malformed raw season is fatal before any partial file is written');
  await assert.rejects(refresh({...args,outputPath:path.join(dir,'empty.json'),fetchImpl:async()=>({ok:false,status:503})}),/first import incomplete/);
  assert(!fs.existsSync(path.join(dir,'empty.json')),'failed first import is not published');
  const packets=Object.fromEntries(Object.keys(COMPETITIONS).map(league=>[league,fixtureSet(league)]));
  for(const rows of Object.values(packets))for(const row of rows.slice(0,2))Object.assign(row,{matchDateTimeUTC:'2026-09-08T16:45:00Z',matchIsFinished:true,matchResults:[{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:1,pointsTeam2:0}]});
  const fetchFor=input=>async url=>({ok:true,json:async()=>structuredClone(input[url.includes('/ucl/')?'ucl':'uel2026'])});
  const compareIds=rows=>[...rows].sort((a,b)=>a.localeCompare(b));
  function accounting(payload,input){
   for(const [shortcut,definition] of Object.entries(COMPETITIONS)){
    const league=payload.leagues.find(l=>l.competitionId===definition.competitionId);assertResultAdmission(league);
    const accepted=league.fixtures.map(f=>f.providerFixtureId),omitted=(league.resultIsolation?.repairs||[]).filter(r=>r.disposition==='omitted').map(r=>r.providerFixtureId),raw=input[shortcut].map(r=>String(r.matchID));
    assert.equal(new Set([...accepted,...omitted]).size,raw.length,'accepted and explicit omissions are unique/disjoint');
    assert.deepEqual(compareIds([...accepted,...omitted]),compareIds(raw),'compare against the complete RAW packet, not a filtered candidate');
    assert.deepEqual(compareIds(payload.events.filter(e=>e.competitionId===definition.competitionId).map(e=>e.id.split(':').at(-1))),compareIds(accepted),'fixtures and events share exactly one admission decision');
   }
  }
  // A transport failure keeps only that competition's last-good snapshot;
  // it must not suppress an independently validated peer competition update.
  for(const failedLeague of Object.keys(COMPETITIONS)){
   const peerLeague=Object.keys(COMPETITIONS).find(key=>key!==failedLeague),partialPath=path.join(dir,'transport-'+failedLeague+'.json');
   const baseline=await refresh({...args,outputPath:partialPath,fetchImpl:fetchFor(packets)});
   const input=structuredClone(packets);input[peerLeague][1].matchResults[0].pointsTeam1=2;
   const partial=await refresh({...args,now:new Date(+args.now+3600000),outputPath:partialPath,fetchImpl:async url=>url.includes('/'+failedLeague+'/2026')?{ok:false,status:503}:fetchFor(input)(url)});
   const failedId=COMPETITIONS[failedLeague].competitionId,peerId=COMPETITIONS[peerLeague].competitionId;
   assert.deepEqual(partial.failures,[{league:failedLeague,message:'HTTP 503'}]);assert.deepEqual(partial.primaryFailures,partial.failures,'transport failure remains explicit, including after peer success');
   assert.deepEqual(partial.payload.leagues.find(l=>l.competitionId===failedId),baseline.payload.leagues.find(l=>l.competitionId===failedId),'failed competition retains all facts and original individual/collection clocks');
   for(const key of ['events','standings'])assert.deepEqual(partial.payload[key].filter(row=>row.competitionId===failedId),baseline.payload[key].filter(row=>row.competitionId===failedId),'failed competition derived output and clocks remain unchanged');
   assert.equal(partial.payload.leagues.find(l=>l.competitionId===peerId).fixtures.find(f=>f.providerFixtureId==='2').result.homeScore,2,'an HTTP failure cannot discard an independently valid peer update');
   assert.equal(partial.payload.events.find(e=>e.competitionId===peerId&&e.id.endsWith(':2')).homeScore,2,'derived event preserves the same peer update');
   assert.deepEqual(JSON.parse(fs.readFileSync(partialPath,'utf8')),partial.payload,'scoped partial success persists the admitted candidate');accounting(partial.payload,input);
  }
  let isolationCases=0;
  for(const scenario of require('./fixtures/openligadb-result-isolation-20261018.json').cases){
   const input=structuredClone(packets),bad=input.uel2026[0],peer=input.uel2026[1];
   Object.assign(bad,{matchIsFinished:scenario.finished,matchResults:scenario.results});peer.matchResults[0].pointsTeam1=2;
   const freshPath=path.join(dir,scenario.name+'-new.json'),retainedPath=path.join(dir,scenario.name+'-prior.json');
   const first=await refresh({...args,outputPath:freshPath,fetchImpl:fetchFor(input)});accounting(first.payload,input);
   const league=first.payload.leagues.find(l=>l.competitionId===COMPETITIONS.uel2026.competitionId);
   assert.equal(first.failures.length,0);assert.equal(first.payload.events.length,287);assert.equal(league.fixtures.length,143);assert.equal(first.resultRepairs.length,1);assert.equal(first.resultRepairs[0].disposition,'omitted');
   assert(!first.payload.events.some(e=>e.competitionId===league.competitionId&&e.id.endsWith(':1')),'untrusted result cannot leak through event derivation');
   assert(first.payload.standings.filter(r=>r.competitionId===league.competitionId).every(r=>r.partial&&r.provisional&&r.omittedFixtureCount===1&&/Partial/.test(r.tableNote)));
   for(const mutate of [l=>l.fixtures.pop(),l=>l.fixtures.push(structuredClone(l.fixtures[0])),l=>l.fixtures.push(structuredClone(l.resultIsolation.repairs[0].rawFixture)),l=>l.resultIsolation.repairs[0].reason='unexplained',l=>l.resultIsolation.repairs[0].resultEvidence={matchIsFinished:true,matchResults:[{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:0,pointsTeam2:0}]}]){
    const damaged=structuredClone(league);mutate(damaged);assert.throws(()=>require('./refresh-openligadb-football').eventsForLeague(damaged),/OpenLigaDB rejected/,'missing, duplicate, reintroduced or unexplained omissions remain fatal');
   }
   const prior=await refresh({...args,outputPath:retainedPath,fetchImpl:fetchFor(packets)}),old=prior.payload.leagues.find(l=>l.competitionId===league.competitionId).fixtures.find(f=>f.providerFixtureId==='1');
   const later=new Date(+args.now+3600000),retained=await refresh({...args,now:later,outputPath:retainedPath,fetchImpl:fetchFor(input)});accounting(retained.payload,input);
   const next=retained.payload.leagues.find(l=>l.competitionId===league.competitionId),kept=next.fixtures.find(f=>f.providerFixtureId==='1');
   assert.deepEqual(kept,old,'eligible last-good fixture/result/identity/calendar and all literal observation fields are retained');
   assert.equal(next.fixtures.find(f=>f.providerFixtureId==='2').result.homeScore,2);
   assert.equal(retained.payload.events.find(e=>e.competitionId===league.competitionId&&e.id.endsWith(':2')).homeScore,2);
   assert.equal(retained.resultRepairs[0].disposition,'retained');assert(retained.payload.standings.filter(r=>r.competitionId===league.competitionId).every(r=>r.partial&&r.provisional&&r.omittedFixtureCount===0&&!r.rankPending));
   const repeated=await refresh({...args,now:new Date(+later+3600000),outputPath:retainedPath,fetchImpl:fetchFor(input)});
   assert.deepEqual(repeated.payload.leagues.map(l=>l.fixtures),retained.payload.leagues.map(l=>l.fixtures),'repeated failure preserves every fixture/result field and original clock');
   const withoutBuildClock=events=>events.map(e=>({...e,footballMatchContext:{...e.footballMatchContext,checkedAt:null}}));
   assert.deepEqual(withoutBuildClock(repeated.payload.events),withoutBuildClock(retained.payload.events),'only the derived context collection clock advances, never fixture/result observations');
   const repairedInput=structuredClone(input);Object.assign(repairedInput.uel2026[0],{matchIsFinished:true,matchResults:[{resultTypeID:2,resultTypeKind:'After90Minutes',pointsTeam1:0,pointsTeam2:0}]});
   const healed=await refresh({...args,now:later,outputPath:freshPath,fetchImpl:fetchFor(repairedInput)});accounting(healed.payload,repairedInput);
   assert.equal(healed.payload.events.length,288);assert.equal(healed.resultRepairs.length,0);assert(!healed.payload.leagues.find(l=>l.competitionId===league.competitionId).resultIsolation);assert.equal(healed.payload.events.find(e=>e.competitionId===league.competitionId&&e.id.endsWith(':1')).homeScore,0,'valid0-0 is never quarantined or fabricated');
   isolationCases++;
  }
  // A prior result is eligible only with the same provenance/calendar and
  // genuine original clocks. An old score alone cannot justify a fallback.
  const fallbackPath=path.join(dir,'ineligible-prior.json');
  const baseline=(await refresh({...args,outputPath:fallbackPath,fetchImpl:fetchFor(packets)})).payload;
  const invalidResultInput=structuredClone(packets);invalidResultInput.uel2026[0].matchResults=[];
  const ineligible=[
   l=>{l.source.url='https://example.invalid/other-source';},
   l=>{l.fixtures.find(f=>f.providerFixtureId==='1').startTimeUtc='2026-09-16T21:00:00Z';},
   l=>{l.fixtures.find(f=>f.providerFixtureId==='1').roundNumber=2;},
   l=>{l.fixtures.find(f=>f.providerFixtureId==='1').sourceCheckedAt='not-an-observation';},
   l=>{l.fixtures.find(f=>f.providerFixtureId==='1').scoreCheckedAt='2028-01-01T00:00:00Z';},
   l=>{l.fixtures.find(f=>f.providerFixtureId==='1').scoreCheckedAt='2025-01-01T00:00:00Z';},
  ];
  for(const mutate of ineligible){
   const prior=structuredClone(baseline);mutate(prior.leagues.find(l=>l.competitionId===COMPETITIONS.uel2026.competitionId));fs.writeFileSync(fallbackPath,JSON.stringify(prior));
   const result=await refresh({...args,now:new Date(+args.now+3600000),outputPath:fallbackPath,fetchImpl:fetchFor(invalidResultInput)});accounting(result.payload,invalidResultInput);
   assert.equal(result.resultRepairs[0].disposition,'omitted','ineligible earlier evidence cannot supply a retained result');assert.equal(result.payload.events.length,287);
  }
  fs.writeFileSync(fallbackPath,JSON.stringify(baseline));const originalBytes=fs.readFileSync(fallbackPath),unexpected=new TypeError('controlled parser programming failure');
  await assert.rejects(refresh({...args,outputPath:fallbackPath,fetchImpl:async()=>({ok:true,json:async()=>{throw unexpected;}})}),error=>error===unexpected,'unexpected parsing/programming failures remain fatal');
  assert(fs.readFileSync(fallbackPath).equals(originalBytes),'a programming failure cannot publish or substitute retained output');
  const structuralPath=path.join(dir,'structural.json');await refresh({...args,outputPath:structuralPath,fetchImpl:fetchFor(packets)});const structuralBefore=fs.readFileSync(structuralPath);
  for(const mutate of [x=>x.uel2026.pop(),x=>x.uel2026[2].matchID=x.uel2026[1].matchID,x=>x.uel2026[2].leagueSeason=2025,x=>x.uel2026[2].matchDateTimeUTC='bad',x=>x.uel2026[2].team1.teamName='Different club',x=>x.uel2026[2].matchResults=null,x=>x.uel2026[2]=null,x=>{[x.uel2026[0].matchID,x.uel2026[1].matchID]=[x.uel2026[1].matchID,x.uel2026[0].matchID];}]){
   const input=structuredClone(packets);input.uel2026[0].matchResults=[];mutate(input);
   const files=fs.readdirSync(dir).sort();await assert.rejects(refresh({...args,now:new Date(+args.now+3600000),outputPath:structuralPath,fetchImpl:fetchFor(input)}),/OpenLigaDB rejected/);
   assert(fs.readFileSync(structuralPath).equals(structuralBefore));assert.deepEqual(fs.readdirSync(dir).sort(),files,'structural failure writes no partial/temporary file');
  }
  const atomicRoot=path.join(dir,'atomic');for(const name of ['data','feeds','assets/js'])fs.mkdirSync(path.join(atomicRoot,name),{recursive:true});
  const originals={'data/facts.json':'accepted-data','feeds/events.json':'accepted-feed','assets/js/app-shell-runtime.js':'accepted-runtime'};for(const [name,value]of Object.entries(originals))fs.writeFileSync(path.join(atomicRoot,name),value);
  const cwd=process.cwd();try{
   process.chdir(atomicRoot);const input=structuredClone(packets);input.uel2026.pop();
   await assert.rejects(require(cwd+'/scripts/quick-results').atomicRefresh({},{refreshOperation:async()=>{for(const name of Object.keys(originals))fs.writeFileSync(name,'candidate');fs.writeFileSync('data/new.json','{}');await refresh({...args,outputPath:structuralPath,fetchImpl:fetchFor(input)});}}),/OpenLigaDB rejected/);
   for(const [name,value]of Object.entries(originals))assert.equal(fs.readFileSync(name,'utf8'),value);assert(!fs.existsSync('data/new.json'));
   const transportOutput=path.resolve('data/football.json');fs.writeFileSync(transportOutput,JSON.stringify(baseline));const transportBefore=fs.readFileSync(transportOutput),dataFiles=fs.readdirSync('data').sort();
   const transportInput=structuredClone(packets);transportInput.uel2026[1].matchResults[0].pointsTeam1=2;
   const transportFailure=new Error('OpenLigaDB scoped source failed: HTTP 503');
   await assert.rejects(require(cwd+'/scripts/quick-results').atomicRefresh({},{refreshOperation:async()=>{
    for(const name of Object.keys(originals))fs.writeFileSync(name,'transport-candidate');fs.writeFileSync('data/transport-new.json','{}');
    const result=await refresh({...args,now:new Date(+args.now+3600000),outputPath:transportOutput,fetchImpl:async url=>url.includes('/ucl/')?{ok:false,status:503}:fetchFor(transportInput)(url)});
    assert.equal(result.payload.events.find(e=>e.competitionId===COMPETITIONS.uel2026.competitionId&&e.id.endsWith(':2')).homeScore,2,'source candidate contains the valid peer correction before outer rollback');
    assert.equal(result.failures.length,1,'canonical source failure is still reported');throw transportFailure;
   }}),error=>error===transportFailure,'the outer canonical wrapper still rejects the reported source failure');
   assert(fs.readFileSync(transportOutput).equals(transportBefore));for(const [name,value]of Object.entries(originals))assert.equal(fs.readFileSync(name,'utf8'),value);assert.deepEqual(fs.readdirSync('data').sort(),dataFiles,'canonical rollback removes new provider/runtime candidates and restores original bytes');

  }finally{process.chdir(cwd);}
  console.log(`OpenLiga result isolation: ${isolationCases} constructed missing/ambiguous/invalid-score cases cover actual refresh, last-good clocks, explicit omissions, RAW identity reconciliation, events, partial tables, healed0-0, repeat stability and structural/atomic rollback.`);
  console.log('Refresh recovery: atomic first import, scoped IDs, bidirectional HTTP partial success, original failed-source facts/clocks and outer canonical rollback passed.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

// Exercise the same timing contract used by Feed and Schedule cards.
{
 const controls=require('../config/feed-controls'),timeline=require('../config/feed-timeline');
 const fixture={...require('../data/providers/openligadb/football-2026-27.json').events[0],status:'upcoming',startTimeUtc:'2026-10-01T19:00:00Z'};
 const unchanged=JSON.stringify(fixture);
 assert.equal(controls.timingState(fixture,new Date('2026-10-01T18:30:00Z')).key,'starts-soon');
 for(const status of ['upcoming','unknown','past','live'])for(const time of ['2026-10-01T19:00:00Z','2026-10-01T20:00:00Z','2026-10-02T19:00:00Z']){
  const record={...fixture,status},now=new Date(time);
  assert.equal(controls.timingState(record,now).key,'awaiting-update');
  assert.equal(controls.matchesTiming(record,'live_now',now),false);
  assert.equal(timeline.status(record,now),'unknown');
  assert.equal(require('../config/card-timing').presentation(record,now).status,'Awaiting match update');
 }
 const now=new Date('2026-10-01T20:00:00Z');
 assert.equal(controls.timingState({...fixture,status:'live',statusCheckedAt:now.toISOString()},now).key,'live-now','fresh explicit live observations remain usable');
 assert.notEqual(controls.timingState({...fixture,status:'completed'},now)?.key,'awaiting-update');
 for(const status of ['cancelled','postponed','suspended','abandoned'])assert.equal(controls.timingState({...fixture,status},now),null);
 assert.equal(JSON.stringify(fixture),unchanged,'display must not mutate source facts or stable identities');
 console.log('Daily Football timing: no clock-inferred live/final labels, explicit live evidence, terminal states and unchanged facts passed.');
}

// Match context must never use this match or a later result as pre-match form.
{
 const {matchContext}=require('./lib/football-match-context');
 const teams=[{participantId:'club:a',name:'Club A'},{participantId:'club:b',name:'Club B'}];
 const match=(day,homeScore,awayScore)=>({startTimeUtc:`2026-09-${day}T12:00:00.000Z`,status:'completed',participants:teams,result:{homeScore,awayScore}});
 const target=match('20',9,0),league={competitionId:'test',season:'2026/27',checkedAt:'2026-09-27T00:00:00.000Z',fixtures:[match('10',1,0),target,match('25',0,8)]};
 const context=matchContext(league,target);assert.deepEqual(context.teams.map(t=>[t.played,t.won,t.drawn,t.lost]),[[1,1,0,0],[1,0,0,1]]);
 assert.equal(matchContext(league,match('01',0,0)).teams[0].played,0,'No earlier evidence is not invented form');
 const pending={...match('15',2,0),status:'unknown'};league.fixtures.push(pending);assert.equal(matchContext(league,target).teams[0].played,1,'Unknown results excluded');
 league.fixtures.push(match('16',-1,0));assert.throws(()=>matchContext(league,target),/confirmed/);
}
