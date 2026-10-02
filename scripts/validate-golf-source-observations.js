#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const observations=require('../lib/golf-source-observations'),golf=require('../lib/golf-participation'),owner=require('./refresh-pga-schedule'),results=require('../lib/lpga-results');
const source=require('./fixtures/golf/korn-ferry-status-2026.json'),rawResults=require('./fixtures/golf/lpga-walmart-results-2026.json');
const now=new Date('2026-10-02T16:00:00Z'),clock=()=>now,oldStamp='2026-10-01T15:00:00.000Z';
const nextPage=queries=>'<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{dehydratedState:{queries}}}})+'</script>';
const rsc=objects=>'<script>self.__next_f.push('+JSON.stringify([1,objects.map((o,i)=>i+':'+JSON.stringify(o)).join('\n')]) +')</script>';
const statusBase={id:'fixture:golf:pga:H2026166',tournamentId:'H2026166',season:2026,status:'upcoming'};
assert.equal(golf.pgaStatus(source.queries,statusBase),'live','actual organiser response contains several tours; choose the exact tournament');
assert.equal(golf.pgaStatus(source.queries,{...statusBase,tournamentId:'missing'}),null);
assert.throws(()=>golf.pgaStatus(source.queries,{...statusBase,season:2025}),/edition/);
assert.throws(()=>golf.pgaStatus([...source.queries,{queryKey:['tournament'],state:{data:{id:'H2026166',seasonYear:2026,tournamentStatus:'COMPLETED'}}}],statusBase),/disagree/);
const player={id:'123',firstName:'Example',lastName:'Golfer',countryFlag:'AUS'};
const queries=[...source.queries,{queryKey:['field'],state:{data:{id:'H2026166',players:[player]}}},{queryKey:['teeTimes'],state:{data:{id:'H2026166',rounds:[{roundInt:1,roundStatus:'OFFICIAL',groups:[{groupNumber:1,players:[player],teeTime:1790841600000}]}]}}}];
const parsed=golf.parsePga(nextPage(queries),{base:statusBase,sourceUrl:source.sourceUrl,checkedAt:now.toISOString()});
assert.equal(parsed.status,'live');assert(!parsed.outcomeText&&!parsed.fixtureResults,'official round status cannot invent a tournament final');
const completed=structuredClone(queries);completed.find(q=>q.state?.data?.id==='H2026166'&&q.queryKey[0]==='tournament').state.data.tournamentStatus='COMPLETED';
assert.equal(golf.parsePga(nextPage(completed),{base:statusBase,sourceUrl:source.sourceUrl}).status,'upcoming','a field response alone cannot create a final result');
assert.equal(golf.parsePga(nextPage(queries),{base:{...statusBase,status:'completed',outcomeText:'Verified winner'},sourceUrl:source.sourceUrl}).status,'completed','participation cannot retract settled primary facts');
const unknown=structuredClone(completed);unknown.find(q=>q.state?.data?.id==='H2026166'&&q.queryKey[0]==='tournament').state.data.tournamentStatus='UNRECOGNISED';
assert.equal(golf.parsePga(nextPage(unknown),{base:statusBase,sourceUrl:source.sourceUrl}).status,'upcoming');
const retimed=structuredClone(parsed);retimed.sourceCheckedAt=oldStamp;retimed.participationCheckedAt=oldStamp;retimed.statusCheckedAt=oldStamp;retimed.entries.forEach(e=>e.sourceCheckedAt=oldStamp);retimed.participants.forEach(e=>e.sourceCheckedAt=oldStamp);retimed.appearances.forEach(e=>{e.sourceCheckedAt=oldStamp;e.participants.forEach(p=>p.sourceCheckedAt=oldStamp)});
assert.strictEqual(golf.mergeObservation(parsed,retimed),retimed,'same facts retain exact original bytes and observation dates');
assert.equal(observations.sourceUrl('https://www.lpga.com/tournaments/test/results?token=private#secret'),'https://www.lpga.com/tournaments/test/results');
assert.equal(observations.sourceUrl('https://user:private@www.lpga.com/tournaments/test/results'),null);
assert.equal(observations.sourceUrl('https://other.invalid/data'),null);
assert.equal(observations.errorCode(Error('HTTP 503 Bearer private')),'http-503');
assert.equal(observations.errorCode(Object.assign(Error('private'),{name:'TimeoutError'})),'timeout');

(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-golf-observation-test-'));
 try{
  // Synthetic prior observation dates keep retention scenarios independent of later refresh dates.
  const baseline=JSON.parse(JSON.stringify(require('../data/canonical/pga-tour-schedule.json'),(key,value)=>['checkedAt','sourceCheckedAt','participationCheckedAt','statusCheckedAt','scoreCheckedAt'].includes(key)?oldStamp:value)),outputPath=path.join(tmp,'schedule.json');
  const reportFile=path.join(tmp,'sources.json');
  const tournament={...require('./fixtures/golf/lpga-walmart-2026.json').tournament,tournamentId:2026068,name:'LOTTE Championship presented by Hoakalei',startDate:'2026-10-01T00:00:00',endDate:'2026-10-04T00:00:00',timeZone:'Hawaiian Standard Time'};
  const currentStatus={status:'In Progress',active:true,refresh:true};
  const draw={currentRound:1,rounds:[{roundNum:1,date:'2026-10-01',name:'Round 1'}],pairings:[[{players:[{playerId:1,firstName:'Test',lastName:'Player',countryAbbr:'AUS'}]},{type:'text',text:'10:00 AM'}]]};
  const entries={entries:[{columns:[{text:'Player'},{text:'Entry Status'}],rows:[[{players:[{playerId:1,firstName:'Test',lastName:'Player',countryAbbr:'AUS'}]},{text:'Entered'}]]}],reserves:[]};
  const month=date=>new Date(date+'T12:00:00Z').toLocaleString('en-US',{month:'short',timeZone:'UTC'});
  function calendar(year){return nextPage([{queryKey:['schedule'],state:{data:{tourCode:'R',season:String(year),tournaments:baseline.tournaments.filter(t=>t.season===year).map(t=>({display:'SHOW',tournamentId:t.id,name:t.name,displayDate:`${month(t.startDate)} ${Number(t.startDate.slice(8))} - ${month(t.endDate)} ${Number(t.endDate.slice(8))}`,status:({completed:'COMPLETED',live:'IN_PROGRESS',cancelled:'CANCELED'})[t.status]||'UPCOMING',courseData:{name:t.venue,city:t.city,countryCode:t.countryCode},champions:t.winners.map(w=>({playerId:w.id,displayName:w.name}))}))}}}]);}
  function provider({fieldFailure=false,entryFailure=false,calendarFailure=false,resultFailure=false,calendarInvalid=false,emptyEntries=false,timeoutField=false}={}){
   const calls=[];
   return {calls,fetchImpl:async(url,{signal}={})=>{
    assert(signal,'every actual source request has a deadline');calls.push(url);
    let html;
    if(/\/schedule\//.test(url)){if(calendarFailure)return {ok:false,status:502};html=calendar(Number(url.split('/').at(-1)));}
    else if(/pgatour\.com.*\/(field|tee-times)$/.test(url)){
     const id=/\/([RH]\d{7})\//.exec(url)[1];if(timeoutField&&id==='H2026166'&&url.endsWith('/field'))throw Object.assign(Error('deadline'),{name:'TimeoutError'});if(fieldFailure&&id==='H2026166'&&url.endsWith('/field'))return {ok:false,status:503};
     const qs=structuredClone(queries);qs.filter(q=>['field','teeTimes'].includes(q.queryKey[0])).forEach(q=>q.state.data.id=id);
     if(id!=='H2026166')qs.push({queryKey:['tournament'],state:{data:{id,seasonYear:2026,tournamentStatus:'IN_PROGRESS'}}});
     // Source fixture has an R2026554 query; keep only the matching status once.
     const unique=qs.filter((q,i)=>q.queryKey[0]!=='tournament'||qs.findIndex(p=>p.queryKey[0]==='tournament'&&p.state.data.id===q.state.data.id)===i);
     html=nextPage(unique);
    }else if(url==='https://www.lpga.com/tournaments')html=calendarInvalid?'invalid':rsc([{tournamentCode:'2026068',month:'October 2026',dateRange:'Oct 1 - 4',link:{href:'/tournaments/lotte-championship/overview'}}]);
    else if(url.endsWith('/pairings'))html=rsc([tournament,draw,currentStatus]);
    else if(url.endsWith('/entries')){if(entryFailure)return {ok:false,status:503};html=rsc([tournament,emptyEntries?{entries:[],reserves:[]}:entries]);}
    else if(url.endsWith('/results')){if(resultFailure)return {ok:false,status:429};html=rsc([rawResults]);}
    else throw Error('Unexpected test URL '+url);
    return {ok:true,status:200,text:async()=>html};
   }};
  }
  const reset=()=>fs.writeFileSync(outputPath,JSON.stringify(baseline,null,2)+'\n');
  async function run(options={}){
   const observer=observations.create({file:reportFile,runId:crypto.randomUUID(),mode:'quick',clock}),p=provider(options);
   const document=await owner.refresh({years:[2026,2027],outputPath,now,clock,observer,fetchImpl:p.fetchImpl});
   assert.equal(new Set(p.calls).size,p.calls.length,'no same-resource retry or duplicate final fetch inside owner');
   assert.deepEqual(document.lpga.map(e=>e.id).sort(),baseline.lpga.map(e=>e.id).sort(),'existing LPGA fixture IDs survive');
   return {document,observer,p};
  }
  reset();const before=fs.readFileSync(outputPath),broken=provider({calendarFailure:true}),brokenObserver=observations.create({file:reportFile,runId:crypto.randomUUID(),clock});
  await assert.rejects(owner.refresh({years:[2026],outputPath,now,clock,observer:brokenObserver,fetchImpl:broken.fetchImpl}),/HTTP 502/);
  assert(fs.readFileSync(outputPath).equals(before),'mandatory primary calendar failure preserves actual persisted bytes');assert.equal(broken.calls.length,1);assert.equal(brokenObserver.report.checks[0].code,'http-502');
  reset();const partial=await run({fieldFailure:true,entryFailure:true,resultFailure:true});
  for(const [key,id]of [['pgaParticipation','H2026166'],['lpga','2026068'],['lpga','2026063']])assert.deepEqual(partial.document[key].find(e=>e.tournamentId===id),baseline[key].find(e=>e.tournamentId===id),'failed field, entries and final requests retain full original observations including withdrawals/results');
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath)),JSON.parse(JSON.stringify(partial.document)),'retention is actually persisted');
  assert(partial.observer.report.checks.some(c=>c.resource==='entries'&&c.code==='http-503'));
  assert(partial.observer.report.checks.some(c=>c.resource==='results'&&c.code==='http-429'&&c.retainedFactAt));
  const callsBefore=partial.p.calls.length;
  const reuse=await results.refreshOnce(partial.document,{file:reportFile,runId:partial.observer.report.runId,now,clock,fetchImpl:partial.p.fetchImpl});
  assert(reuse.reused);assert.equal(partial.p.calls.length,callsBefore,'quick step reuses completed owner pass without retrying a failed source');assert.equal(reuse.failures[0].code,'http-429');assert.strictEqual(reuse.document,partial.document);
  assert(!JSON.stringify(partial.observer.report).includes('Bearer'));
  reset();const healthy=await run();assert.equal(healthy.document.pgaParticipation.find(e=>e.tournamentId==='H2026166').status,'live');assert(!healthy.document.pgaParticipation.find(e=>e.tournamentId==='H2026166').outcomeText);
  const successfulCalls=healthy.p.calls.length;const successfulReuse=await results.refreshOnce(healthy.document,{file:reportFile,runId:healthy.observer.report.runId,now,clock,fetchImpl:healthy.p.fetchImpl});assert(successfulReuse.reused&&successfulReuse.failures.length===0);assert.equal(healthy.p.calls.length,successfulCalls);
  const healthyBytes=fs.readFileSync(outputPath);await run();assert(fs.readFileSync(outputPath).equals(healthyBytes),'unchanged owner rerun preserves whole persisted bytes');
  reset();const empty=await run({emptyEntries:true});assert.deepEqual(empty.document.lpga.find(e=>e.tournamentId==='2026068'),baseline.lpga.find(e=>e.tournamentId==='2026068'),'HTTP 200 without a previously published field cannot erase entries');assert(empty.observer.report.checks.some(c=>c.resource==='participation'&&c.code==='invalid-response'));
  reset();const timedOut=await run({timeoutField:true});assert.deepEqual(timedOut.document.pgaParticipation.find(e=>e.tournamentId==='H2026166'),baseline.pgaParticipation.find(e=>e.tournamentId==='H2026166'));assert(timedOut.observer.report.checks.some(c=>c.resource==='field'&&c.code==='timeout'));
  reset();const unavailable=await run({calendarInvalid:true});assert.deepEqual(unavailable.document.lpga,baseline.lpga,'malformed optional calendar retains known observations');assert(unavailable.observer.report.checks.some(c=>c.resource==='calendar'&&c.sourceUrl.includes('lpga')&&c.code==='invalid-response'));
  reset();const noField=JSON.parse(fs.readFileSync(outputPath)),unpublished=noField.lpga.find(e=>e.tournamentId==='2026068');Object.assign(unpublished,{entryListPublished:false,entries:[],participants:[],participantIds:[],appearances:[],participantsConfirmed:false});fs.writeFileSync(outputPath,JSON.stringify(noField));const provisional=await run({entryFailure:true});assert(provisional.observer.report.checks.some(c=>c.resource==='entries'&&c.code==='field-not-attested'));assert.equal(provisional.document.lpga.find(e=>e.tournamentId==='2026068').entryListPublished,false,'pairings are not a complete field attestation');
  const newRun=crypto.randomUUID();let network=0;const oneFetch=async()=>{network++;return {ok:false,status:503}};
  const mismatch=await results.refreshOnce(baseline,{file:reportFile,runId:newRun,now,clock,fetchImpl:oneFetch});assert(!mismatch.reused&&network===1,'different invocation cannot reuse the earlier pass');
  const oldReport=observations.create({file:reportFile,runId:newRun,clock});oldReport.report.checkedAt='2026-10-02T08:00:00Z';oldReport.report.resultsPasses[0].checkedAt=oldReport.report.checkedAt;oldReport.report.checks=[];fs.writeFileSync(reportFile,JSON.stringify(oldReport.report));
  const expired=await results.refreshOnce(baseline,{file:reportFile,runId:newRun,now,clock,fetchImpl:oneFetch});assert(!expired.reused&&network===2,'expired pass performs the ordinary bounded check');
  const future=structuredClone(healthy.observer.report);future.checkedAt='2099-01-01T00:00:00Z';assert.throws(()=>observations.validate(future,now),/invalid/);
  for(const mutation of [d=>d.checks[0].sourceUrl='https://other.invalid/data',d=>d.checks[0].checkedAt='invalid',d=>d.checks[0].retainedFactAt='2099-01-01T00:00:00Z',d=>d.checks[0].code='Bearer private',d=>d.checks=Array(501).fill(d.checks[0])]){const d=structuredClone(healthy.observer.report);mutation(d);assert.throws(()=>observations.validate(d,now),/invalid/);}
  fs.writeFileSync(reportFile,'not JSON');assert.throws(()=>observations.read({file:reportFile,runId:newRun}));
  console.log('Golf source observations: exact official status, no invented final, actual persistence/partial-outage retention, dated exceptions, unchanged bytes, bounded final-pass reuse and malformed/future evidence passed.');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
