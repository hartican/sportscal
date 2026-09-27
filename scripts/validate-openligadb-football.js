'use strict';
const assert=require('node:assert/strict');
const {normalizeLeague,resolveLeagueIdentities,COMPETITIONS}=require('./lib/openligadb-football');
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
rejects(x=>x[0].matchIsFinished=true,/full-time result/);
rejects(x=>x[0].matchResults=[{resultTypeID:2}],/unfinished fixture/);
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
const liverpool=europeanFeed([{participantId:'team:football:epl:10',followLevel:'follow'}]);
assert.equal(liverpool.length,7,'existing Liverpool follow admits all seven remaining UCL league matches');
assert(liverpool.every(e=>e.participantIds.includes('team:football:epl:10')));
assert.equal(europeanFeed([{participantId:'team:football:epl:10',followLevel:'mute'}]).length,0);
const published=require('../data/providers/openligadb/football-2026-27.json');
const rights=require('../config/follow-first');
for(const competition of Object.values(COMPETITIONS)){
 const events=published.events.filter(e=>e.competitionId===competition.competitionId);assert.equal(events.length,144);
 assert(events.every(e=>e.participantIds.length===2&&e.sourceType==='community'&&e.sourceAttribution));
 assert.deepEqual(rights.viewingOptions(events.find(e=>e.status==='upcoming')).map(o=>o.providerId),['stan']);
}
const september=published.events.find(e=>e.startTimeUtc==='2026-09-08T16:45:00.000Z');assert.equal(september.time,'02:45');assert.equal(september.date,'2026-09-09');
const october=published.events.find(e=>e.startTimeUtc==='2026-10-13T16:45:00.000Z');assert.equal(october.time,'03:45');assert.equal(october.date,'2026-10-14');
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
  const partial=await refresh({...args,fetchImpl:async url=>url.includes('/ucl/')?fetchGood(url):{ok:true,json:async()=>[]}});assert.equal(partial.failures.length,1);assert.equal(partial.payload.events.length,288,'partial season never replaces complete retained data');
  await assert.rejects(refresh({...args,outputPath:path.join(dir,'empty.json'),fetchImpl:async()=>({ok:false,status:503})}),/first import incomplete/);
  assert(!fs.existsSync(path.join(dir,'empty.json')),'failed first import is not published');
  console.log('Refresh recovery: atomic first import, scoped IDs, partial/total failure retention and unchanged failed-source freshness passed.');
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
