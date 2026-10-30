'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function run(){
 const receipt=require('./fixtures/rugby-retained-start-20261030.json'),calendar=require('./lib/accepted-rugby-calendar'),evidence=require('./lib/reconcile-fixture-results'),{project}=require('./sync-live-coverage');
 const base=structuredClone(receipt.retained),final=structuredClone(receipt.rows.find(r=>r.fixture.status==='completed').fixture),saved=JSON.stringify({base,final}),now=new Date(receipt.now),result=evidence.rugbyResult(final,now);let checks=0;
 const fixed=calendar.apply(base,final);assert.notEqual(fixed,base);assert.equal(fixed.startTimeUtc,'2026-10-23T08:30:00.000Z');assert.deepEqual({...fixed,startTimeUtc:base.startTimeUtc},base);checks++;
 evidence.assertRetainedCoverage(base,final,result);assert.equal(calendar.apply(fixed,final),fixed);checks++;
 for(const change of [f=>f.sourceFixtureId='00000000-0000-4000-8000-000000000000',f=>f.id+='-other',f=>f.participantIds.reverse(),f=>[f.homeParticipantId,f.awayParticipantId]=[f.awayParticipantId,f.homeParticipantId],f=>f.sourceUrl+='&unreviewed=true',f=>f.startTimeUtc='2026-10-23T08:31:00.000Z',f=>f.homeScore++,f=>f.scoreFactObservedAt='2026-10-26T00:00:00Z',f=>f.statusFactObservedAt=null,f=>f.status='scheduled']){
  const other=structuredClone(final);change(other);assert.equal(calendar.apply(base,other),base,'Unreviewed source cannot correct this start');checks++;
 }
 for(const change of [f=>f.startTimeUtc='2026-10-23T08:46:00.000Z',f=>f.sourceCheckedAt='2026-10-14T00:00:00Z',f=>f.status='completed',f=>f.score='unreviewed final',f=>f.participantIds.reverse(),f=>f.sourceFixtureId='unreviewed']){
  const other=structuredClone(base);change(other);assert.equal(calendar.apply(other,final),other,'Unreviewed retained facts cannot inherit this receipt');checks++;
 }
 for(const key of ['retained','rows']){
  const original=receipt.sha256[key];try{receipt.sha256[key]='0'.repeat(64);assert.throws(()=>calendar.apply(base,final),/evidence changed/);}finally{receipt.sha256[key]=original;}checks++;
 }
 const unrelated={id:'retained-cricket',key:'cricket',status:'completed',score:'unchanged',unknown:{retained:true},sourceCheckedAt:'2026-10-01T00:00:00Z'},previous={events:[unrelated,base],participants:[],competitions:[],sources:[]};
 const projected=project(previous,[{...receipt.rows.find(r=>r.fixture.status==='completed'),fixture:final}],{now,strictSourceEvidence:true,coverageSport:'rugby-union'}),fixture=projected.document.events.find(f=>f.id===base.id);
 assert.deepEqual(projected.document.events.find(f=>f.id===unrelated.id),unrelated);assert.equal(fixture.startTimeUtc,fixed.startTimeUtc);assert.equal(fixture.homeScore,38);assert.equal(fixture.awayScore,31);assert.equal(fixture.status,'completed');assert.equal(fixture.scoreFactObservedAt,final.scoreFactObservedAt);assert.equal(fixture.statusFactObservedAt,final.statusFactObservedAt);assert.equal(fixture.sourceCheckedAt,final.sourceCheckedAt);checks++;
 const replay=project(projected.document,[{...receipt.rows.find(r=>r.fixture.status==='completed'),fixture:final}],{now,strictSourceEvidence:true,coverageSport:'rugby-union'});assert.deepEqual(replay.document.events,projected.document.events);assert.equal(replay.report.changed,0);checks++;
 assert.equal(JSON.stringify({base,final}),saved);checks++;
 const at=process.argv.indexOf('--capture-dir');if(at>=0){
  const dir=process.argv[at+1],rows=[0,1,2].flatMap(n=>{const b=fs.readFileSync(path.join(dir,'capture/page-0'+n+'.raw'));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),receipt.captureSha256['page-0'+n+'.raw']);return JSON.parse(b);}),prior=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/follow-sources/coverage.v1.json'))),before=JSON.stringify(prior),result=project(prior,rows,{now,strictSourceEvidence:true,coverageSport:'rugby-union'});
  const otherBefore=prior.events.filter(f=>f.key!=='rugby'),otherAfter=result.document.events.filter(f=>f.key!=='rugby');assert.deepEqual(otherAfter,otherBefore);assert.equal(JSON.stringify(prior),before);const out={scope:'saved1303-row projection only; no fresh read, canonical updater, runtime or publication',rows:rows.length,changed:result.report.changed,deferredResults:result.report.deferredResults,candidateHash:crypto.createHash('sha256').update(JSON.stringify(result.document)).digest('hex'),otherSportsUnchanged:true};console.log(JSON.stringify(out));checks++;
 }
 console.log('Reviewed Rugby start: '+checks+' exact-evidence, mismatch-refusal, unchanged replay and unrelated-sport controls passed; no provider/service call.');
}
if(require.main===module)try{run();}catch(error){console.error(error.message);process.exitCode=1;}
module.exports=run;
