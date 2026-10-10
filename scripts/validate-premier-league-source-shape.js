#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),https=require('node:https');
const {EventEmitter}=require('node:events');
const pl=require('./refresh-premier-league-cards');
const liveReceipt=require('./fixtures/epl-live-20261010.json');
const firstHalfReceipt=require('./fixtures/epl-first-half-20261010.json');
// A controlled 20-club double round robin, never published sporting evidence.
const fixtures=[],ring=Array.from({length:20},(_,i)=>i+1);
for(let round=0;round<19;round++){
 for(let i=0;i<10;i++)for(const leg of[0,1]){
  const pair=leg?[ring[19-i],ring[i]]:[ring[i],ring[19-i]],week=round+1+19*leg;
  fixtures.push({id:700000+fixtures.length,gameweek:{gameweek:week,compSeason:{id:841,competition:{id:1}}},status:'U',kickoff:{millis:Date.UTC(2026,7,1+7*(week-1),14),completeness:3},teams:pair.map(id=>({team:{id,name:'QA Club '+id,club:{id}}}))});
 }
 ring.splice(1,0,ring.pop());
}
fixtures.sort((a,b)=>a.gameweek.gameweek-b.gameweek.gameweek);
fixtures[0].status='C';fixtures[0].teams.forEach(t=>t.score=0);
const pages=Array.from({length:4},(_,page)=>({pageInfo:{page,numPages:4,pageSize:100,numEntries:380},content:fixtures.slice(page*100,page*100+100)}));
async function responseSequence(edit,run){
 const inputs=structuredClone(pages);edit(inputs);const calls=[],original=https.get;
 https.get=(url,options,callback)=>{
  const page=Number(new URL(url).searchParams.get('page'));calls.push(page);
  if(!inputs[page])throw Error('Unexpected request beyond the four supplied QA pages');
  const request=new EventEmitter();request.setTimeout=()=>request;request.destroy=error=>request.emit('error',error);
  queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=200;response.setEncoding=()=>response;callback(response);response.emit('data',JSON.stringify(inputs[page]));response.emit('end');});return request;
 };
 try{await run(calls);}finally{https.get=original;}
}
async function rejects(name,edit,expectedCalls){
 await responseSequence(edit,async calls=>{await assert.rejects(pl.loadFixtures,/Premier League.*(page|season|fixture|club|pair|matchweek|competition)/i,name);assert.equal(calls.length,expectedCalls,name+': stop at the invalid boundary');});
}
async function streamingDeadline(){
 const originalGet=https.get,originalSet=global.setTimeout,originalClear=global.clearTimeout;
 let expired,request,pending,started=false,cleared=0;const timer={unref(){}};
 global.setTimeout=(callback,ms,...args)=>{if(ms===20000){expired=callback;return timer;}return originalSet(callback,ms,...args);};
 global.clearTimeout=id=>{if(id===timer){cleared++;return;}return originalClear(id);};
 https.get=(url,options,callback)=>{
  request=new EventEmitter();request.setTimeout=()=>request;request.destroy=error=>request.emit('error',error);
  queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=200;response.setEncoding=()=>response;callback(response);response.emit('data','{"content":[');started=true;});return request;
 };
 try{pending=pl.loadFixtures();pending.catch(()=>{});assert.equal(typeof expired,'function','an active response requires the fixed existing-duration deadline');await Promise.resolve();assert(started,'partial response is active before the network deadline');expired();await assert.rejects(pending,/20-second deadline/);assert.equal(cleared,1,'timeout error clears its timer');}
 finally{if(pending&&!cleared)request.destroy(Error('QA stream cleanup'));https.get=originalGet;global.setTimeout=originalSet;global.clearTimeout=originalClear;}
}
async function interruptedResponse(kind){
 const original=https.get;
 https.get=(url,options,callback)=>{const request=new EventEmitter();request.setTimeout=()=>request;queueMicrotask(()=>{const response=new EventEmitter();response.statusCode=200;response.setEncoding=()=>response;callback(response);response.emit('data','{"content":[');response.emit(kind,Error('QA response error'));});return request;};
 try{await assert.rejects(pl.loadFixtures,kind==='error'?/QA response error/:/page ended before completion/);}finally{https.get=original;}
}
(async()=>{
 const actualLive=pl.cardForFixture(liveReceipt.fixture,liveReceipt.checkedAt);
 assert.equal(actualLive.status,'live','The actual naturally observed L record is admitted through the existing card builder');
 assert.equal(actualLive.homeScore,2);assert.equal(actualLive.awayScore,1);
 assert.equal(actualLive.scoreDisplay,'2–1');assert.equal(actualLive.statusCheckedAt,liveReceipt.checkedAt);
 assert.equal(actualLive.scoreCheckedAt,liveReceipt.checkedAt);assert(!actualLive.outcomeText&&!actualLive.recapText&&!actualLive.resultSourceCheckedAt,'A live score cannot become a completed outcome');
 assert.equal(actualLive.id,'epl-2026-27-128973');assert.equal(actualLive.canonicalEventId,'event:premier-league:128973');
 assert.deepEqual(actualLive.participants.map(p=>[p.id,p.displayName,p.role]),[['team:football:epl:1','Arsenal','home'],['team:football:epl:9','Leeds United','away']],'Live score names bind to the existing source-ordered canonical identities');
 const actualFirstHalf=pl.cardForFixture(firstHalfReceipt.fixture,firstHalfReceipt.checkedAt);
 assert.equal(firstHalfReceipt.fixture.phase,'1');assert.equal(actualFirstHalf.status,'live');assert.equal(actualFirstHalf.scoreDisplay,'0–0','The naturally observed first-half zero score is present, not treated as missing');
 assert.equal(actualFirstHalf.statusCheckedAt,firstHalfReceipt.checkedAt);assert.equal(actualFirstHalf.scoreCheckedAt,firstHalfReceipt.checkedAt);
 assert(!actualFirstHalf.outcomeText&&!actualFirstHalf.resultSourceCheckedAt,'First-half play is not a final');
 const actualFinal=pl.cardForFixture(firstHalfReceipt.recoveredFinal,firstHalfReceipt.checkedAt);
 assert.equal(actualFinal.id,actualLive.id);assert.equal(actualFinal.status,'completed');assert.equal(actualFinal.homeScore,2);assert.equal(actualFinal.awayScore,1);assert.equal(actualFinal.resultSourceCheckedAt,firstHalfReceipt.checkedAt,'Actual primary completion retains identity, score and its later real receipt');
 assert.equal(require('../config/card-timing').presentation(actualLive,new Date(liveReceipt.checkedAt)).status,'LIVE');
 assert.equal(require('../config/card-timing').presentation(actualLive,new Date(Date.parse(liveReceipt.checkedAt)+31*60000)).status,'Awaiting match update','Old captured play does not remain live');
 for(const phase of ['1','2'])assert.equal(pl.cardForFixture({...liveReceipt.fixture,phase},liveReceipt.checkedAt).status,'live','Only the playing-period admission is supported; no halftime/interruption label is inferred');
 for(const phase of [undefined,null,'H','HT','P','F','QA_UNKNOWN',2])assert.throws(()=>pl.cardForFixture({...liveReceipt.fixture,phase},liveReceipt.checkedAt),/unreviewed.*phase|phase.*unreviewed/,'Unreviewed or missing live periods keep last-good data');
 for(const score of [undefined,null,-1,1.5,Infinity,'2']){const bad=structuredClone(liveReceipt.fixture);bad.teams[0].score=score;assert.throws(()=>pl.cardForFixture(bad,liveReceipt.checkedAt),/integer score/);}
 const zeroLive=structuredClone(liveReceipt.fixture);zeroLive.teams.forEach(t=>t.score=0);assert.equal(pl.cardForFixture(zeroLive,liveReceipt.checkedAt).scoreDisplay,'0–0');
 assert.throws(()=>pl.cardForFixture(liveReceipt.fixture,'invalid'),/observation/);
 const laterChecked=new Date(Date.parse(liveReceipt.checkedAt)+60000).toISOString();
 assert.equal(require('../lib/live-fixtures').contentHash([actualLive]),require('../lib/live-fixtures').contentHash([pl.cardForFixture(liveReceipt.fixture,laterChecked)]),'Repeated real-source checks cannot create a new fact revision just from observation clocks');
 const withLive=p=>{const fixture=p[0].content[1];fixture.status='L';fixture.phase='2';fixture.teams[0].score=2;fixture.teams[1].score=1;};
 await responseSequence(withLive,async calls=>{const source=require('../lib/live-source-adapters').liveSources(async()=>{throw Error('QA must not call another provider');},{environment:{}}).find(s=>s.id==='live-premier-league');const events=await source.fetch({now:new Date(liveReceipt.checkedAt)});assert.equal(events.length,380);assert.equal(events.filter(e=>e.status==='live').length,1);assert.equal(events.find(e=>e.status==='live').scoreDisplay,'2–1');assert.deepEqual(calls,[0,1,2,3],'The real live adapter keeps the same four complete page reads');});
 await rejects('unreviewed live period',p=>{withLive(p);p[0].content[1].phase='HT';},1);
 await rejects('incomplete live scores',p=>{withLive(p);delete p[0].content[1].teams[0].score;},1);
 await streamingDeadline();
 await interruptedResponse('error');await interruptedResponse('aborted');
 await responseSequence(()=>{},async calls=>{const loaded=await pl.loadFixtures();assert.equal(loaded.length,380);assert.deepEqual(calls,[0,1,2,3]);assert.equal(pl.cardForFixture(loaded[0],'2026-10-03T00:00:00Z').homeScore,0,'zero is a confirmed final');});
 await rejects('unbounded pagination',p=>p.forEach(x=>x.pageInfo.numPages=10000),1);
 await rejects('changed pagination',p=>p[1].pageInfo.numPages=5,2);
 await rejects('wrong page index',p=>p[1].pageInfo.page=0,2);
 await rejects('incomplete declared collection',p=>p[0].pageInfo.numEntries=379,1);
 await rejects('short page',p=>p[0].content.pop(),1);
 await rejects('missing page metadata',p=>delete p[0].pageInfo,1);
 await rejects('wrong season',p=>p[0].content[0].gameweek.compSeason.id=840,4);
 await rejects('wrong competition',p=>p[0].content[0].gameweek.compSeason.competition.id=2,4);
 for(const value of ['QA_UNREVIEWED',undefined,null,'',false,{},'c','u']){
  await rejects('missing or unreviewed status',p=>{if(value===undefined)delete p[0].content[1].status;else p[0].content[1].status=value;},1);
  const fixture=structuredClone(fixtures[1]);if(value===undefined)delete fixture.status;else fixture.status=value;
  assert.throws(()=>pl.cardForFixture(fixture,'2026-10-03T00:00:00Z'),/missing or unreviewed source status/,'direct canonical/live card calls cannot bypass status admission');
 }
 await rejects('self match',p=>p[0].content[0].teams[1]=structuredClone(p[0].content[0].teams[0]),4);
 await rejects('duplicate identity',p=>p[0].content[1].id=p[0].content[0].id,4);
 await rejects('duplicate pairing',p=>p[0].content[1].teams=structuredClone(p[0].content[0].teams),4);
 await rejects('invalid matchweek despite 38 distinct rounds',p=>p.forEach(x=>x.content.forEach(f=>{if(f.gameweek.gameweek===1)f.gameweek.gameweek=39;})),4);
 await rejects('ambiguous third participant',p=>p[0].content[0].teams.push(structuredClone(p[0].content[1].teams[0])),4);
 await responseSequence(p=>{p[0].content[1].kickoff.millis+=3*86400000;},async()=>{const loaded=await pl.loadFixtures();assert.equal(loaded[1].kickoff.millis,fixtures[1].kickoff.millis+3*86400000,'a genuine reschedule remains accepted without changing identity/round');});
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-epl-shape-')),file=path.join(directory,'events.json');
 const options={checkedAt:'2026-10-03T00:00:00Z',backupOptions:{directory,outputPath:path.join(directory,'delayed.json'),coordinator:async()=>{throw Error('QA backup unavailable; no provider request');}}};
 try{
  fs.writeFileSync(file,JSON.stringify({schemaVersion:'events.v1',version:'epl-source-qa',publishedAt:'2026-10-03T00:00:00Z',events:[]}));
  await responseSequence(()=>{},async()=>pl.refreshPremierLeagueCards(file,file,options));
  const saved=fs.readFileSync(file);const actual=JSON.parse(saved);assert.equal(actual.events.length,380);assert(actual.events.some(e=>e.homeScore===0&&e.awayScore===0));
  await responseSequence(()=>{},async()=>pl.refreshPremierLeagueCards(file,file,options));assert.deepEqual(fs.readFileSync(file),saved,'an unchanged controlled primary rerun retains bytes');
  await responseSequence(p=>p.forEach(x=>x.pageInfo.numPages=10000),async calls=>{await assert.rejects(pl.refreshPremierLeagueCards(file,file,options));assert.equal(calls.length,1);});
  assert.deepEqual(fs.readFileSync(file),saved,'the actual writer preserves every last-good fixture/clock after malformed primary and unavailable backup');
  const diagnostics=JSON.parse(fs.readFileSync(path.join(directory,'report.json'),'utf8'));assert(diagnostics.checks.some(c=>c.state==='last-good'&&c.primaryFailure.includes('fixture page')),'existing exception readout retains the primary failure and last-good state');
  const backupFile=path.join(directory,'delayed.json');assert(!fs.existsSync(backupFile));
  await responseSequence(p=>{p[0].content[1].status='QA_UNREVIEWED';},async calls=>{await assert.rejects(pl.refreshPremierLeagueCards(file,file,{...options,checkedAt:'2026-10-03T00:15:00Z'}),/unreviewed source status/);assert.equal(calls.length,1,'stop before requesting later pages');});
  assert.deepEqual(fs.readFileSync(file),saved,'unreviewed status plus unavailable backup cannot renew last-good status, score, identity or source clocks');
  assert(!fs.existsSync(backupFile),'failed status admission cannot create a delayed result');
  const statusReport=JSON.parse(fs.readFileSync(path.join(directory,'report.json'),'utf8'));assert(statusReport.checks.some(c=>c.state==='last-good'&&c.primaryFailure.includes('unreviewed source status')),'existing exception readout makes primary status verification actionable');
  const liveSource=require('../lib/live-source-adapters').liveSources(async()=>{throw Error('QA must not call any other provider');},{environment:{}}).find(source=>source.id==='live-premier-league');
  assert(liveSource,'the existing live owner uses this shared reader');
  let publishes=0,failures=0;const prior=structuredClone(actual.events),priorBytes=JSON.stringify(prior);
  const store={claim:async()=>({fixtures:prior}),publish:async()=>{publishes++;},fail:async()=>{failures++;}};
  await responseSequence(p=>{p[0].content[1].status='QA_UNREVIEWED';},async calls=>{
   const result=await require('../lib/live-fixtures').refreshDueSources({sources:[liveSource],store,now:new Date('2026-10-03T00:15:00Z')});
   assert.deepEqual(result.failed,[{sourceId:'live-premier-league',code:'source_refresh_failed'}]);assert.deepEqual(result.refreshed,[]);assert.equal(calls.length,1,'live failure stops at the unsupported page');
  });
  assert.equal(publishes,0,'the actual live owner cannot publish an invented upcoming observation');assert.equal(failures,1,'the existing live failure path records the exception');assert.equal(JSON.stringify(prior),priorBytes,'the live snapshot and its original fixture clocks remain intact');
  await responseSequence(()=>{},async()=>pl.refreshPremierLeagueCards(file,file,options));assert.deepEqual(fs.readFileSync(file),saved,'a reviewed primary response recovers without changing unchanged facts or clocks');
  const liveOptions={...options,checkedAt:liveReceipt.checkedAt};
  await responseSequence(withLive,async()=>pl.refreshPremierLeagueCards(file,file,liveOptions));
  const liveSaved=fs.readFileSync(file),liveEvents=JSON.parse(liveSaved).events,live=liveEvents.find(e=>e.id===`epl-2026-27-${fixtures[1].id}`);
  assert.equal(live.status,'live');assert.equal(live.scoreDisplay,'2–1');assert.equal(live.scoreCheckedAt,liveReceipt.checkedAt);
  assert(!live.outcomeText&&!live.recapText&&!live.resultSourceCheckedAt,'The actual writer persists live facts without final copy');
  assert.deepEqual(liveEvents.map(e=>e.id).sort(),actual.events.map(e=>e.id).sort(),'Live ingestion preserves every existing fixture identity');
  await responseSequence(withLive,async()=>pl.refreshPremierLeagueCards(file,file,liveOptions));assert.deepEqual(fs.readFileSync(file),liveSaved,'An unchanged live source rerun retains bytes');
  await responseSequence(p=>{withLive(p);p[0].content[1].phase='HT';},async()=>assert.rejects(pl.refreshPremierLeagueCards(file,file,{...liveOptions,checkedAt:laterChecked}),/unreviewed.*phase/));
  assert.deepEqual(fs.readFileSync(file),liveSaved,'Unknown non-playing phases preserve the actual live snapshot and its original clocks');
  await responseSequence(p=>{withLive(p);p[0].content[1].status='C';},async()=>pl.refreshPremierLeagueCards(file,file,{...liveOptions,checkedAt:laterChecked}));
  const finalSaved=fs.readFileSync(file),final=JSON.parse(finalSaved).events.find(e=>e.id===live.id);
  assert.equal(final.status,'completed');assert.equal(final.homeScore,2);assert.equal(final.awayScore,1);assert.equal(final.resultSourceCheckedAt,laterChecked,'Validated primary completion advances the existing fixture');
  await responseSequence(withLive,async()=>assert.rejects(pl.refreshPremierLeagueCards(file,file,liveOptions),/continuity failed/));
  assert.deepEqual(fs.readFileSync(file),finalSaved,'An older live response cannot reopen the persisted final');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
 console.log('EPL source shape: bounded four-page reads, complete directed pairings, valid season/round/status admission, reschedules, zero finals and actual last-good writer preservation/recovery passed; controlled source, no network.');
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
