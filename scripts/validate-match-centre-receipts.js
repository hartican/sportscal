'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{createRequire}=require('node:module'),path=require('node:path');
const model=require('../config/match-centre'),{createMatchCentreHandler}=require('../lib/match-centre-handler'),evidence=require('./lib/match-centre-read-evidence');
const fixed=Date.parse('2026-10-31T03:34:06.948Z'),base='7e6327e17defc4a2161f746d2f5814f2daf955b8';
function original(file,overrides={}){const m={exports:{}};new Function('require','module','exports',execFileSync('git',['show',base+':'+file],{encoding:'utf8'}))(name=>overrides[name]||createRequire(path.resolve(file))(name),m,m.exports);return m.exports;}
const oldModel=original('config/match-centre.js'),oldHandler=original('lib/match-centre-handler.js',{'../config/match-centre':oldModel}).createMatchCentreHandler;
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const fixture=(age=1000,fields={})=>({id:'fixture:nrl:receipt-test',key:'nrl',status:'live',startTimeUtc:new Date(fixed-1800000).toISOString(),scoreCheckedAt:new Date(fixed-age).toISOString(),statusCheckedAt:new Date(fixed-age).toISOString(),fixtureObservationSchema:'fixture-observations.v1',homeParticipantId:'team:nrl:h',awayParticipantId:'team:nrl:a',homeScore:0,awayScore:7,...fields});
const strip=body=>{const {scoreRead,freshnessReceipts,...rest}=body;return {...rest,fixtures:body.fixtures.map(({freshnessReceipt,...f})=>f)};};
async function run(){
 let checks=0;const mark=()=>checks++;
 async function compare(name,f,{listing=false,fail=false,membershipStale=false,advance=0}={}){
  let now=fixed;const options=()=>({enabled:()=>true,clock:()=>now,published:()=>[structuredClone(f)],snapshotRead:async()=>({readAt:now,stale:membershipStale,sources:[{fixtures:[structuredClone(f)]}]}),request:async()=>{if(fail)throw Error('PRIVATE_ERROR');return [{fixture:structuredClone(f),checked_at:f.scoreCheckedAt}];}});
  const url=listing?'/api/match-centre?membership=everything':'/api/match-centre?ids='+f.id;
  now+=advance;const a=response(),b=response();await oldHandler(options())({url},a);await createMatchCentreHandler(options())({url},b);
  assert.deepEqual(strip(b.body),a.body,name+' original facts, clocks, membership and scores unchanged');assert.equal(JSON.stringify(strip(b.body)),JSON.stringify(a.body),name+' exact original JSON bytes');
  const row=b.body.fixtures[0];assert.equal(b.body.freshnessReceipts.find(r=>r.id===row.id).returnedStale,row.stale);assert.equal(b.body.freshnessReceipts.find(r=>r.id===row.id).evaluatedAt,new Date(now).toISOString());assert.equal(b.body.freshnessReceipts.find(r=>r.id===row.id).budgetMs,240000);
  assert(!JSON.stringify(b.body.scoreRead).includes('PRIVATE_ERROR'));mark();return b.body;
 }
 for(const age of [239999,240000,240001]){const b=await compare('exact expiry '+age,fixture(age));assert.equal(b.fixtures[0].stale,age>240000);assert.equal(b.freshnessReceipts[0].reasons.ageExpired,age>240000);}
 let b=await compare('advancing actual clock',fixture(239999),{advance:273});assert.equal(b.fixtures[0].stale,true);
 b=await compare('fresh shared reuse',fixture(),{listing:true});assert.equal(b.scoreRead.outcome,'not-needed');assert.equal(b.scoreRead.attemptedBatches,0);
 b=await compare('successful selected',fixture());assert.equal(b.scoreRead.outcome,'succeeded');assert.equal(b.scoreRead.completedBatches,1);assert.equal(b.scoreRead.pendingBatches,0);
 b=await compare('fast selected failure',fixture(),{fail:true});assert.equal(b.scoreRead.outcome,'failed');assert.equal(b.scoreRead.failedBatches,1);assert.equal(b.freshnessReceipts[0].reasons.scoreReadFailed,true);
 b=await compare('membership degraded',fixture(),{listing:true,membershipStale:true});assert.equal(b.freshnessReceipts[0].reasons.membershipDegraded,true);
 for(const key of ['sourceStale','stale']){b=await compare('explicit flag '+key,fixture(1000,{[key]:true}));assert.equal(b.freshnessReceipts[0].reasons[key==='stale'?'explicitStale':'sourceMarkedStale'],true);}
 b=await compare('missing required score observation',fixture(1000,{scoreCheckedAt:null}));assert.equal(b.freshnessReceipts[0].reasons.missingScoreObservation,true);
 b=await compare('missing both observations',fixture(1000,{scoreCheckedAt:null,statusCheckedAt:null}));assert.equal(b.freshnessReceipts[0].reasons.missingCheckedAt,true);
 // Observation's actual retained-prior branches preserve the original return exactly.
 const prior=model.compact(fixture()),older={...prior,statusCheckedAt:new Date(fixed-10000).toISOString()},settled={...prior,status:'completed'};
 for(const [a,n,reason]of [[prior,older,'older-observation'],[settled,prior,'settled-prior'],[{...prior,status:'suspended'},{...prior,status:'suspended',score:{},scoreCheckedAt:prior.scoreCheckedAt},'interruption-score']]){
  const retained={};assert.deepEqual(model.observation(a,n,retained),oldModel.observation(a,n));assert.equal(retained.reason,reason);mark();
 }
 // Actual selected alias path: first merge admits a newer status-only alias,
 // while the final matching-row pass sees the older direct fixture only.
 // Existing shared reconciliation already protects the newer status here.
 const direct=fixture(10000),alias={id:'fixture:nrl:status-alias',sourceEventIds:[direct.id],key:'nrl',status:'live',fixtureObservationSchema:'fixture-observations.v1',statusCheckedAt:new Date(fixed-1000).toISOString()};
 const options=()=>({enabled:()=>true,clock:()=>fixed,published:()=>[],request:async()=>[{fixture:structuredClone(direct),checked_at:direct.statusCheckedAt},{fixture:structuredClone(alias),checked_at:alias.statusCheckedAt}]});
 const before=response(),after=response();await oldHandler(options())({url:'/api/match-centre?ids='+direct.id},before);await createMatchCentreHandler(options())({url:'/api/match-centre?ids='+direct.id},after);
 assert.deepEqual(strip(after.body),before.body);assert.equal(JSON.stringify(strip(after.body)),JSON.stringify(before.body));assert.equal(after.body.freshnessReceipts[0].retention,null);assert.equal(after.body.freshnessReceipts[0].decision,'projected');assert.equal(after.body.freshnessReceipts[0].returnedStatusCheckedAt,after.body.fixtures[0].statusCheckedAt);assert.equal(after.body.freshnessReceipts[0].returnedStale,after.body.fixtures[0].stale);assert.notEqual(after.body.freshnessReceipts[0].candidateCheckedAt,null);mark();
 // Mixed-ID two-batch failure: one failed batch cannot mean all completed.
 const many=Array.from({length:60},(_,i)=>fixture(1000,{id:'fixture:nrl:many:'+i,sourceEventIds:['fixture:nrl:alias:'+i]}));
 let finish,calls=0;const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>fixed,published:()=>many,request:()=>{calls++;return calls===1?Promise.reject(Error('PRIVATE_ERROR')):new Promise(resolve=>{finish=resolve;});}}),res=response();
 await handler({url:'/api/match-centre?ids='+many.map(f=>f.id).join(',')},res);assert.equal(calls,2);assert.deepEqual(res.body.scoreRead,{schemaVersion:'score-read.v1',outcome:'failed',plannedBatches:2,attemptedBatches:2,completedBatches:0,failedBatches:1,pendingBatches:1,unattemptedBatches:0});finish([]);await Promise.resolve();assert.equal(res.body.scoreRead.pendingBatches,1,'Serialized receipt is the response-time snapshot');mark();
 const sync=response();await createMatchCentreHandler({enabled:()=>true,clock:()=>fixed,published:()=>many,request:()=>{throw Error('PRIVATE_ERROR');}})({url:'/api/match-centre?ids='+many.map(f=>f.id).join(',')},sync);assert.equal(sync.body.scoreRead.unattemptedBatches,1);assert.equal(sync.body.scoreRead.failedBatches,1);mark();
 const c=evidence.collector();c.capture({kind:'membership',sha:base,body:{fixtures:[model.compact(fixture())]},read:{kind:'membership',serverMs:{}}});c.capture({kind:'selected',sha:base,body:{fixtures:[{...b.fixtures[0],privateAccount:'SECRET'}]},read:{kind:'selected',serverMs:{}}});assert.equal(c.report.reads[0].scoreRead.available,false);assert.equal(c.report.reads[0].scoreRead.outcome,null);assert(!JSON.stringify(c.report).includes('SECRET'));mark();
 // Malformed diagnostic metadata remains safely persisted as unknown.
 for(const invalid of [{},'invalid',[null],[null,{}]]){
  const bad=evidence.collector();const report=bad.capture({kind:'membership',sha:base,body:{fixtures:[model.compact(fixture())],freshnessReceipts:invalid,scoreRead:{schemaVersion:'score-read.v1',outcome:'succeeded'}},read:{serverMs:{private:'SECRET'}}});
  assert.equal(report.listing.freshnessReceipt.available,false);assert.equal(report.listing.freshnessReceipt.decision,null);assert.equal(report.reads[0].scoreRead.available,false);assert.equal(report.reads[0].scoreRead.outcome,null);assert(!JSON.stringify(report).includes('SECRET'));mark();
 }
 const coherent={schemaVersion:'score-read.v1',outcome:'succeeded',plannedBatches:1,attemptedBatches:1,completedBatches:1,failedBatches:0,pendingBatches:0,unattemptedBatches:0};assert.equal(evidence.scoreRead(coherent).available,true);assert.equal(evidence.scoreRead({...coherent,pendingBatches:1}).available,false);mark();
 const validReceipt=b.freshnessReceipts[0];assert.equal(evidence.project(b.fixtures[0],validReceipt).freshnessReceipt.available,true);assert.equal(evidence.project(b.fixtures[0],{...validReceipt,reasons:{}}).freshnessReceipt.available,false);assert.equal(evidence.project(b.fixtures[0],{...validReceipt,returnedStale:!b.fixtures[0].stale}).freshnessReceipt.available,false);mark();
 // Actual normal verifier must deliver evidence before a selected identity assertion fails.
 const collector=evidence.collector();let fetches=0;await assert.rejects(require('./verify-match-centre-public')({fetchImpl:async()=>{fetches++;const selected=fetches===2,fixtureRow={...model.compact(fixture()),...(selected?{awayParticipantId:'team:nrl:wrong'}:{})};return {status:200,headers:new Map([['Server-Timing','catalogue;dur=1,prepare;dur=1,snapshot;dur=1,merge;dur=1,selection;dur=1,scores;dur=1,projection;dur=1,total;dur=7']]),json:async()=>({enabled:true,membershipStale:false,events:[],fixtures:[fixtureRow]})};},onRead:data=>collector.capture(data),log:()=>{}}));assert.equal(fetches,2);assert.equal(collector.report.chosenId,fixture().id);assert.equal(collector.report.selected.awayParticipantId,'team:nrl:wrong');assert.equal(collector.report.reads.length,2);mark();
 const zero=fixture(1000,{homeScore:0,awayScore:0});await compare('zero scores',zero);
 const sixtyOptions=()=>({enabled:()=>true,clock:()=>fixed,published:()=>many,request:async(_p,o)=>many.filter(f=>[f.id,...f.sourceEventIds].some(id=>o.body.p_fixture_ids.includes(id))).map(f=>({fixture:structuredClone(f),checked_at:f.scoreCheckedAt}))});
 const sixtyOld=response(),sixtyNew=response();await oldHandler(sixtyOptions())({url:'/api/match-centre?ids='+many.map(f=>f.id).join(',')},sixtyOld);await createMatchCentreHandler(sixtyOptions())({url:'/api/match-centre?ids='+many.map(f=>f.id).join(',')},sixtyNew);assert.equal(sixtyNew.body.fixtures.length,60);assert.equal(sixtyNew.body.freshnessReceipts.length,60);assert.equal(new Set(sixtyNew.body.freshnessReceipts.map(r=>r.id)).size,60);assert.deepEqual(strip(sixtyNew.body),sixtyOld.body);assert.equal(JSON.stringify(strip(sixtyNew.body)),JSON.stringify(sixtyOld.body));mark();
 const oldBytes=Buffer.from(JSON.stringify(sixtyOld.body)),newBytes=Buffer.from(JSON.stringify(sixtyNew.body)),zlib=require('node:zlib'),payload60={beforeBytes:oldBytes.length,afterBytes:newBytes.length,addedBytes:newBytes.length-oldBytes.length,beforeGzipBytes:zlib.gzipSync(oldBytes).length,afterGzipBytes:zlib.gzipSync(newBytes).length};
 const perReceipt=Buffer.byteLength(JSON.stringify(b.freshnessReceipts[0])),perRead=Buffer.byteLength(JSON.stringify(b.scoreRead));
 console.log(JSON.stringify({passed:true,checks,oneFixtureReceiptBytes:perReceipt,scoreReadBytes:perRead,payload60,networkCalls:0,sqlCalls:0,releaseAcceptance:false}));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});module.exports=run;
