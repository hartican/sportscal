#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),m=require('../lib/mlb-postseason'),receipt=require('./fixtures/mlb-alds-20261006.json');
const options={checkedAt:receipt.checkedAt,now:new Date(receipt.checkedAt)},fixtures=m.parse(receipt.payload,options).fixtures;
const game=fixtures.find(f=>f.id==='fixture:mlb:849839');
assert.equal(game.time,'11:00');assert.equal(game.status,'completed');assert.equal(game.homeScore,5);assert.equal(game.awayScore,2);assert.deepEqual(game.participantIds,['team:mlb:139','team:mlb:147']);assert(!game.selectedSentence.includes('5–2'));
const copy=()=>structuredClone(receipt.payload),games=d=>d.dates.flatMap(d=>d.games);
for(const mutate of [d=>d.totalGames++,d=>games(d)[0].teams.home.score=null,d=>games(d)[0].status.statusCode='unknown',d=>games(d)[1].gamePk=games(d)[0].gamePk]){const d=copy();mutate(d);assert.throws(()=>m.parse(d,options));}
assert.throws(()=>m.parse(receipt.payload,{...options,now:new Date(+options.now+7*3600000)}));
const zeros=copy();games(zeros)[0].teams.home.score=0;assert.equal(m.parse(zeros,options).fixtures[0].homeScore,0);
const regular=copy();games(regular)[0].gameType='R';delete games(regular)[0].description;
const regularGame=m.parse(regular,{...options,universe:true}).fixtures[0];assert.equal(regularGame.competitionName,'MLB regular season');assert.equal(regularGame.roundLabel,'MLB regular season');assert(!require('../config/follow-first').reasonForEvent(regularGame,{selectedSelectorEntityIds:['sport:baseball'],followedSports:['baseball']}),'Everything regular-season coverage does not become broad-sport postseason Feed admission');assert(!m.parse(regular,options).fixtures.some(f=>f.id===regularGame.id),'existing postseason-only import stays scoped');
const conditional=copy();games(conditional)[2].ifNecessary='Y';const c=m.parse(conditional,options).fixtures[2];assert.equal(c.startTimeUtc,null);assert.equal(c.scheduleStatus,'conditional');
assert.deepEqual(m.merge(fixtures,fixtures.map(f=>({...f,sourceCheckedAt:new Date(+options.now+1000).toISOString()}))).filter(f=>f.status==='completed'),fixtures.filter(f=>f.status==='completed'),'an unchanged later check cannot rewrite accepted fixture facts or receipts');
assert.throws(()=>m.merge([game],[{...game,status:'upcoming'}]));
assert.throws(()=>m.merge([game],[{...game,participantIds:[...game.participantIds].reverse()}]));
const taxonomy=require('../config/selector-taxonomy');assert(taxonomy.nodes?.some(n=>n.id==='sport:baseball')||JSON.stringify(taxonomy).includes('sport:baseball'));
console.log('MLB postseason verified: official ALDS receipt, paired scores including zero, conditional clocks, identity, freshness, failure rejection and immutable final observations.');

// Captured official postponement/successor pair; no live provider calls.
const postponement=require('./fixtures/mlb-postponed-successor-20261023.json');
const fixed={checkedAt:postponement.checkedAt,now:new Date(postponement.checkedAt)};
const captured=()=>structuredClone(postponement.payload);
const pair=d=>games(d).filter(g=>g.gamePk===849817);
const prior=d=>pair(d).find(g=>g.status.statusCode==='DR');
const successor=d=>pair(d).find(g=>g.status.statusCode!=='DR');
const projected=m.parse(captured(),fixed).fixtures;
const corrected=projected.find(f=>f.id==='fixture:mlb:849817');
assert.equal(games(postponement.payload).length,13);
assert.equal(projected.length,12);assert.equal(projected.filter(f=>f.id===corrected.id).length,1);
assert.equal(corrected.status,'completed');assert.equal(corrected.homeScore,1);assert.equal(corrected.awayScore,3);
assert.equal(corrected.startTimeUtc,'2026-10-18T21:08:00.000Z');
assert.equal(corrected.sourceCheckedAt,postponement.checkedAt);
assert.equal(corrected.roundLabel,'ALCS Game 5, Makeup of 10/16');
assert(!corrected.selectedSentence.includes('1–3'));assert.equal(corrected.winnerParticipantId,'team:mlb:139');
const shuffled=captured();shuffled.dates.reverse();for(const date of shuffled.dates)date.games.reverse();
const sorted=fs=>[...fs].sort((a,b)=>a.id.localeCompare(b.id));
assert.deepEqual(sorted(m.parse(shuffled,fixed).fixtures),sorted(projected),'selection is independent of response row order');
const one=captured(),old=structuredClone(prior(one));one.dates=[{date:'2026-10-16',totalGames:1,games:[old]}];one.totalGames=1;
const postponed=m.parse(one,fixed).fixtures[0];assert.equal(postponed.status,'postponed');assert.equal(postponed.score,undefined);assert.equal(postponed.resultStatus,undefined);
const mutations=[
 d=>delete prior(d).rescheduleDate,
 d=>delete successor(d).rescheduledFrom,
 d=>prior(d).rescheduleDate='2026-10-18T22:08:00Z',
 d=>successor(d).rescheduledFrom='2026-10-17T01:00:00Z',
 d=>prior(d).rescheduleDate='2026-02-30T21:08:00Z',
 d=>successor(d).gameDate=prior(d).gameDate,
 d=>successor(d).gameGuid='different',
 d=>delete prior(d).gameGuid,
 d=>{prior(d).gameGuid=1;successor(d).gameGuid=1;},
 d=>{prior(d).gameGuid='not-a-guid';successor(d).gameGuid='not-a-guid';},
 d=>successor(d).season='2025',
 d=>successor(d).gameType='W',
 d=>{const g=successor(d);[g.teams.home,g.teams.away]=[g.teams.away,g.teams.home];},
 d=>successor(d).teams.home.team.name='Changed participant',
 d=>prior(d).status.codedGameState='F',
 d=>prior(d).status.detailedState='Final',
 d=>prior(d).teams.home.score=0,
 d=>successor(d).status.statusCode='unreviewed',
 d=>successor(d).status.codedGameState='I',
 d=>{const g=prior(d);g.status={statusCode:'F',codedGameState:'F',detailedState:'Final'};g.teams.home.score=4;g.teams.away.score=2;},
 d=>{const row=structuredClone(successor(d));d.dates[0].games.push(row);d.dates[0].totalGames++;d.totalGames++;},
 d=>d.totalGames--,
 d=>d.dates[0].totalGames++
];
for(const [i,mutate] of mutations.entries()){const d=captured();mutate(d);assert.throws(()=>m.parse(d,fixed),undefined,'captured negative '+i);}
const unchanged=m.merge(projected,m.parse(captured(),{checkedAt:new Date(+fixed.now+1000).toISOString(),now:new Date(+fixed.now+1000)}).fixtures);
assert.deepEqual(unchanged,projected,'repeat observations do not renew accepted facts or clocks');
const capturedPersistence=(async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),root=fs.mkdtempSync(path.join(os.tmpdir(),'mlb-captured-'));
 const files=['data/canonical/mlb-postseason.v1.json','feeds/incoming/events.json','data/events.json'];
 const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('unallocated network');};
 try{
  for(const file of files){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.copyFileSync(path.join(__dirname,'..',file),path.join(root,file));}
  const originalCanonical=JSON.parse(fs.readFileSync(path.join(root,files[0])));
  const source=()=>Promise.resolve({ok:true,json:async()=>captured()});
  await m.refresh({root,now:fixed.now,fetchImpl:source});
  for(const file of files){const doc=JSON.parse(fs.readFileSync(path.join(root,file)));const rows=doc.fixtures||doc.events;const target=rows.filter(f=>f.id===corrected.id);assert.equal(target.length,1,file);assert.equal(target[0].status,'completed',file);assert.equal(target[0].sourceCheckedAt,postponement.checkedAt,file);assert.equal(target[0].homeScore,1,file);assert.equal(target[0].awayScore,3,file);}
  const adopted=JSON.parse(fs.readFileSync(path.join(root,files[0]))).fixtures;
  const updatedIds=new Set(projected.map(f=>f.id));
  for(const retained of originalCanonical.fixtures.filter(f=>!updatedIds.has(f.id)))assert.deepEqual(adopted.find(f=>f.id===retained.id),retained,'unobserved accepted facts and clocks remain unchanged');
  const before=files.map(file=>fs.readFileSync(path.join(root,file)));
  await m.refresh({root,now:new Date(+fixed.now+1000),fetchImpl:source});
  for(const [i,file] of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),before[i],'repeat captured persistence '+file);
  const invalid=captured();delete successor(invalid).rescheduledFrom;
  await assert.rejects(()=>m.refresh({root,now:fixed.now,fetchImpl:async()=>({ok:true,json:async()=>invalid})}));
  for(const [i,file] of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),before[i],'invalid successor writes nothing '+file);
  for(const badGuid of [1,'not-a-guid']){
   const malformed=captured();prior(malformed).gameGuid=badGuid;successor(malformed).gameGuid=badGuid;
   await assert.rejects(()=>m.refresh({root,now:fixed.now,fetchImpl:async()=>({ok:true,json:async()=>malformed})}));
   for(const [i,file] of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),before[i],'invalid shared GUID writes nothing '+file);
  }
  console.log(`MLB captured DR/successor: 13 raw rows -> 12 identities, order independent, ${mutations.length} strict negatives, persisted single final, repeat clocks unchanged, failure writes nothing; zero network.`);
 }finally{globalThis.fetch=oldFetch;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});

// Actual accepted preimages: adding slot scores or correcting calendar/copy
// cannot create a newly observed score or status fact.
const retainedFinals=require('./fixtures/mlb-retained-final-clocks-20261023.json');
const oldFinals=retainedFinals.fixtures,latestById=new Map(projected.map(f=>[f.id,f]));
function assertOriginalClocks(result,old){
 for(const key of ['scoreCheckedAt','statusCheckedAt','resultSourceCheckedAt'])assert.equal(result[key],old[key],old.id+' '+key);
 assert.equal(result.scoreFactObservedAt,old.scoreFactObservedAt??old.scoreCheckedAt,old.id+' score observation');
 assert.equal(result.statusFactObservedAt,old.statusFactObservedAt??old.statusCheckedAt,old.id+' status observation');
 assert.equal(result.sourceCheckedAt,postponement.checkedAt,old.id+' actual new source receipt');
 assert.deepEqual(result.sourceRefs,latestById.get(old.id).sourceRefs);
 assert.equal(result.firstConfirmedCompleteAt,undefined,'no historical finish invented');
}
const retainedMerge=m.merge(oldFinals,oldFinals.map(f=>latestById.get(f.id)));
for(const old of oldFinals)assertOriginalClocks(retainedMerge.find(f=>f.id===old.id),old);
const oldFinal=oldFinals[0],incoming=latestById.get(oldFinal.id);
const calendar={...incoming,date:'2026-10-17',startTimeUtc:'2026-10-16T01:00:00.000Z',time:'12:00',roundLabel:'Official updated round',stage:'Official updated round',recapText:'Updated description of the same final'};
const calendarMerged=m.merge([oldFinal],[calendar])[0];assertOriginalClocks(calendarMerged,oldFinal);assert.equal(calendarMerged.roundLabel,calendar.roundLabel);assert.equal(calendarMerged.startTimeUtc,calendar.startTimeUtc);
const different={...incoming,homeScore:5,score:'Los Angeles Dodgers 5–6 Milwaukee Brewers',outcomeText:'Los Angeles Dodgers 5–6 Milwaukee Brewers'};
const correctedScore=m.merge([oldFinal],[different])[0];assert.equal(correctedScore.scoreFactObservedAt,postponement.checkedAt);assert.equal(correctedScore.scoreCheckedAt,postponement.checkedAt);assert.equal(correctedScore.resultSourceCheckedAt,postponement.checkedAt);assert.equal(correctedScore.statusFactObservedAt,oldFinal.statusFactObservedAt);
const livePrior={...oldFinal,status:'live',resultStatus:undefined,winnerParticipantId:undefined};
const newlyCompleted=m.merge([livePrior],[incoming])[0];assert.equal(newlyCompleted.statusFactObservedAt,postponement.checkedAt);assert.equal(newlyCompleted.statusCheckedAt,postponement.checkedAt);assert.equal(newlyCompleted.scoreFactObservedAt,oldFinal.scoreFactObservedAt,'same oriented score is independent of newly observed completion');
const earliest=oldFinal.statusCheckedAt;
const firstCompleted=m.merge([{...oldFinal,firstConfirmedCompleteAt:earliest}],[{...incoming,firstConfirmedCompleteAt:postponement.checkedAt}])[0];assert.equal(firstCompleted.firstConfirmedCompleteAt,earliest);
const earlier='2026-10-16T01:00:00.000Z';assert.equal(m.merge([{...oldFinal,firstConfirmedCompleteAt:earliest}],[{...incoming,firstConfirmedCompleteAt:earlier}])[0].firstConfirmedCompleteAt,earlier);
const explicitUnknown=m.merge([{...oldFinal,scoreFactObservedAt:null,statusFactObservedAt:null}],[incoming])[0];assert.equal(explicitUnknown.scoreFactObservedAt,null);assert.equal(explicitUnknown.statusFactObservedAt,null);
const pendingScore=m.merge([{...oldFinal,status:'upcoming'}],[incoming])[0];assert.equal(pendingScore.scoreFactObservedAt,postponement.checkedAt,'unplayed prior cannot lend a score observation');
const foreign=m.merge([{...oldFinal,sourceName:'Other source'}],[incoming])[0];assert.equal(foreign.scoreFactObservedAt,postponement.checkedAt,'foreign provenance cannot lend an original clock');
assert.throws(()=>m.merge([{...oldFinal,scoreFactObservedAt:'2026-10-23T00:00:00Z'}],[incoming]));
assert.throws(()=>m.merge([{...oldFinal,scoreFactObservedAt:'malformed'}],[incoming]));
assert.throws(()=>m.merge([{...oldFinal,scoreFactObservedAt:'2026-02-30T00:00:00Z'}],[incoming]));
const knownFinish='2026-10-16T03:00:00+00:00';const finished=m.merge([{...oldFinal,actualEndTimeUtc:knownFinish,completedAt:knownFinish}],[calendar])[0];assert.equal(finished.actualEndTimeUtc,knownFinish);assert.equal(finished.completedAt,knownFinish);
assert.equal(m.merge([{...oldFinal,actualEndTimeUtc:knownFinish}],[{...calendar,actualEndTimeUtc:null}])[0].actualEndTimeUtc,null,'explicit unknown finish is not overridden');
assert.throws(()=>m.merge([oldFinal],[{...incoming,season:2025}]));
// Constructed live 0-0 rechecks retain first facts, but prove fresh contact.
function liveBody(){const body=captured(),game=games(body).find(g=>g.gamePk===849818);game.status={statusCode:'I',codedGameState:'I',detailedState:'In Progress'};game.teams.home.score=0;game.teams.away.score=0;return body;}
const liveFirst=m.parse(liveBody(),fixed).fixtures.find(f=>f.id==='fixture:mlb:849818');
const liveLaterTime=new Date(+fixed.now+3000);
const liveNext=m.parse(liveBody(),{now:liveLaterTime,checkedAt:liveLaterTime.toISOString()}).fixtures.find(f=>f.id===liveFirst.id);
const liveMerged=m.merge([liveFirst],[liveNext])[0];
for(const key of ['scoreCheckedAt','statusCheckedAt','resultSourceCheckedAt'])assert.equal(liveMerged[key],liveLaterTime.toISOString(),'equal-score live contact retains fresh '+key);
for(const key of ['scoreFactObservedAt','statusFactObservedAt'])assert.equal(liveMerged[key],liveFirst[key],'equal-score live contact retains original '+key);
capturedPersistence.then(async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),root=fs.mkdtempSync(path.join(os.tmpdir(),'mlb-retained-clocks-'));
 const files=['data/canonical/mlb-postseason.v1.json','feeds/incoming/events.json','data/events.json'];
 const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('unallocated network');};
 try{
  for(const file of files){
   const doc=JSON.parse(fs.readFileSync(path.join(__dirname,'..',file)));
   const key=doc.fixtures?'fixtures':'events';doc[key]=doc[key].map(f=>oldFinals.find(old=>old.id===f.id)||f);
   fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify(doc,null,2)+'\n');
  }
  await m.refresh({root,now:fixed.now,fetchImpl:async()=>({ok:true,json:async()=>captured()})});
  for(const file of files){const doc=JSON.parse(fs.readFileSync(path.join(root,file)));for(const old of oldFinals){const f=(doc.fixtures||doc.events).find(f=>f.id===old.id);assertOriginalClocks(f,old);assert.equal(f.participantSlots[0].score,f.homeScore);assert.equal(f.participantSlots[1].score,f.awayScore);}}
  let accepted=files.map(file=>fs.readFileSync(path.join(root,file)));
  await m.refresh({root,now:new Date(+fixed.now+1000),fetchImpl:async()=>({ok:true,json:async()=>captured()})});
  for(const [i,file] of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),accepted[i],'same captured receipt rerun '+file);

  // Constructed subsequent observation: a real score change must advance only
  // its own fact/receipt clocks, never the already-confirmed completed status.
  const changedBody=captured();games(changedBody).find(g=>g.gamePk===849818).teams.home.score=4;
  const later=new Date(+fixed.now+1000),changedFetch=async()=>({ok:true,json:async()=>structuredClone(changedBody)});
  await m.refresh({root,now:later,fetchImpl:changedFetch});
  for(const file of files){const doc=JSON.parse(fs.readFileSync(path.join(root,file))),f=(doc.fixtures||doc.events).find(f=>f.id==='fixture:mlb:849818');assert.equal(f.homeScore,4);assert.equal(f.scoreCheckedAt,later.toISOString());assert.equal(f.scoreFactObservedAt,later.toISOString());assert.equal(f.resultSourceCheckedAt,later.toISOString());assert.equal(f.statusFactObservedAt,oldFinals[1].statusCheckedAt);assert.equal(f.statusCheckedAt,oldFinals[1].statusCheckedAt);}
  accepted=files.map(file=>fs.readFileSync(path.join(root,file)));
  await m.refresh({root,now:new Date(+later+1000),fetchImpl:changedFetch});
  for(const [i,file] of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),accepted[i],'changed score same-receipt rerun '+file);
  for(const mutate of [d=>{for(const g of pair(d))g.gameGuid='bad-guid';},d=>delete successor(d).rescheduledFrom]){
   const invalid=captured();mutate(invalid);
   await assert.rejects(()=>m.refresh({root,now:fixed.now,fetchImpl:async()=>({ok:true,json:async()=>invalid})}));
   for(const [i,file] of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),accepted[i],'bad identity/link writes nothing '+file);
  }
  for(const file of files){const doc=JSON.parse(fs.readFileSync(path.join(root,file))),key=doc.fixtures?'fixtures':'events';doc[key]=doc[key].map(f=>f.id===liveFirst.id?liveFirst:f);fs.writeFileSync(path.join(root,file),JSON.stringify(doc,null,2)+'\n');}
  await m.refresh({root,now:liveLaterTime,fetchImpl:async()=>({ok:true,json:async()=>liveBody()})});
  for(const file of files){const doc=JSON.parse(fs.readFileSync(path.join(root,file))),f=(doc.fixtures||doc.events).find(f=>f.id===liveFirst.id);assert.equal(f.status,'live');assert.equal(f.homeScore,0);assert.equal(f.awayScore,0);for(const key of ['scoreCheckedAt','statusCheckedAt','resultSourceCheckedAt'])assert.equal(f[key],liveLaterTime.toISOString(),'persisted live current contact '+file+' '+key);for(const key of ['scoreFactObservedAt','statusFactObservedAt'])assert.equal(f[key],liveFirst[key],'persisted live first facts '+file+' '+key);}
  console.log('MLB retained clocks verified: actual 849810/849818 prior facts, numeric-slot enrichment, calendar/copy edits, source receipts, changed score/status independence, earliest completion, unknown/provenance guards, actual three-file persistence and stable captured rerun.');
 }finally{globalThis.fetch=oldFetch;fs.rmSync(root,{recursive:true,force:true});}
}).catch(error=>{console.error(error);process.exitCode=1;});
