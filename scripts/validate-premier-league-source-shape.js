#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),https=require('node:https');
const {EventEmitter}=require('node:events');
const pl=require('./refresh-premier-league-cards');
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
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
 console.log('EPL source shape: bounded four-page reads, complete directed pairings, valid season/round identity, reschedules, zero finals and actual last-good writer preservation passed; controlled source, no network.');
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
