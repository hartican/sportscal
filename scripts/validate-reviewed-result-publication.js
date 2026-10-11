'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {applySelectedResults,applyEvidence,observedCompletionBoundary,hasCompletionBoundary}=require('./apply-current-card-evidence');
const {validateCurrentCardCoverage}=require('./validate-current-card-coverage');
const participant=require('./apply-reviewed-participant-fixtures');
const {applyOfficialResults}=require('./sync-official-card-results');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-reviewed-results-'));
const files=['feeds/incoming/events.json','data/events.json','data/canonical/official-card-results-2026.json','data/canonical/current-card-evidence-2026.json','data/canonical/afl-nrl-2026.json'];
const ids=['event-aflw-cd_m20262640803','fixture-tennis-atp-beijing-2026-r16-de-minaur-halys','supercars-bathurst-1000-2026'];
const evidence=JSON.parse(fs.readFileSync(path.join(root,files[3]))),selected=evidence.resultOverrides.filter(e=>ids.includes(e.id));
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
const selectedRecord=e=>selected.some(row=>aliases(e).some(id=>[row.id,row.canonicalId].includes(id)));
try{
 for(const file of files){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(temp,file));}
 const before=files.slice(0,2).map(file=>JSON.parse(fs.readFileSync(path.join(temp,file))));
 applySelectedResults(ids,{root:temp});
 for(const [index,file] of files.slice(0,2).entries()){
  const after=JSON.parse(fs.readFileSync(path.join(temp,file)));
  assert.deepEqual(after.events.map(e=>e.id),before[index].events.map(e=>e.id),'selected result writer retains every identity and order');
  assert.deepEqual(after.events.filter(e=>!selectedRecord(e)),before[index].events.filter(e=>!selectedRecord(e)),'unrelated facts, editorial and observation dates are exact');
  for(const row of selected){const old=before[index].events.find(e=>aliases(e).includes(row.id)||aliases(e).includes(row.canonicalId)),next=after.events.find(e=>e.id===old.id);assert.equal(next.status,'completed');assert.equal(next.score,row.score);assert.equal(next.resultSourceCheckedAt,row.sourceCheckedAt);for(const key of ['participantIds','date','time','startTimeUtc','timePrecision','viewingOptions'])assert.deepEqual(next[key],old[key],'original sporting schedule/viewing survives');if(Object.hasOwn(row,'endTimeUtc')&&row.endTimeUtc===null)assert.equal(next.endTimeUtc,null,'Official result without a published finish clock preserves explicit unknown');}
 }
 const once=files.slice(0,3).map(file=>fs.readFileSync(path.join(temp,file)));applySelectedResults(ids,{root:temp});
 const canonical=JSON.parse(fs.readFileSync(path.join(temp,files[4])));assert.equal(canonical.events.find(e=>e.id===selected[0].canonicalId).status,'completed','canonical rebuild retains the reviewed existing match');
 const ledger=JSON.parse(fs.readFileSync(path.join(temp,files[2])));
 for(const row of selected){const raw=before[0].events.find(e=>aliases(e).includes(row.id)||aliases(e).includes(row.canonicalId));const replay=applyOfficialResults([{...raw,status:'scheduled',score:null}],ledger).events[0];assert.equal(replay.status,'completed','stored result resolves the actual incoming alias');assert.equal(replay.score,row.score);if(Object.hasOwn(row,'resultPublishedAt')&&row.resultPublishedAt===null)assert.equal(replay.resultPublishedAt,null,'Stored observation cannot invent an explicitly unknown provider publication time');}
 for(const [i,file] of files.slice(0,3).entries())assert(fs.readFileSync(path.join(temp,file)).equals(once[i]),'identical result rerun is byte-stable');
 const missing=JSON.parse(fs.readFileSync(path.join(temp,files[1])));missing.events=missing.events.filter(e=>!aliases(e).includes(selected[0].id));fs.writeFileSync(path.join(temp,files[1]),JSON.stringify(missing));
 const unchanged=files.slice(0,3).map(file=>fs.readFileSync(path.join(temp,file)));
 assert.throws(()=>applySelectedResults(ids,{root:temp}),/exactly one retained fixture/);
 for(const [i,file] of files.slice(0,3).entries())assert(fs.readFileSync(path.join(temp,file)).equals(unchanged[i]),'missing second-surface identity rejects before any write');
 // Replay through the ordinary owner uses per-result dates, not the old batch clock.
 const row=selected[1],result=applyOfficialResults([{id:row.id,name:'Reviewed final'}],{checkedAt:evidence.checkedAt,results:[row]}).events[0];
 assert.equal(result.resultPublishedAt,row.resultPublishedAt);assert.equal(result.lastReviewedAt,row.lastReviewedAt);assert.equal(result.sourceCheckedAt,row.sourceCheckedAt);
 const doc=structuredClone(participant.validate()),pending=doc.events.find(e=>e.id.includes('alcaraz-arnaldi'));assert(pending);
 doc.pairingCorrections=[]; // This isolated historical availability case has no Wuhan fixtures.
 // Controlled historical availability branch after the actual draw result
 // has arrived; it cannot be mistaken for a current publication.
 Object.assign(pending,{status:'scheduled',resultStatus:'pending',score:null,resultSourceCheckedAt:'2026-10-03T06:30:54.629Z',resultAvailabilityEvidence:{kind:'official-draw-result-unpublished',fixtureId:pending.id,sourceUrl:pending.resultSourceUrl,checkedAt:'2026-10-03T06:30:54.629Z',sourceSha256:'3708c48a839d83d58ff943873469ec1545b7a70c3051ae8df7b0e7e4d4c751d7',matchRow:'Round of 16: C. Alcaraz [1] v M. Arnaldi',winnerCell:'unpublished'}});
 for(const change of [e=>delete e.resultAvailabilityEvidence,e=>e.resultSourceCheckedAt='2100-01-01T00:00:00Z',e=>e.score='Invented score',e=>e.resultAvailabilityEvidence.fixtureId='another-match']){const bad=structuredClone(doc);change(bad.events.find(e=>e.id===pending.id));assert.throws(()=>participant.validate(bad));}
 // A later confirmed final must survive an older reviewed availability record.
 const final={...pending,status:'completed',score:'Synthetic verified final',sourceUrl:'https://example.org/result',sourceCheckedAt:'2026-10-03T06:30:54.629Z',resultStatus:'official',resultSourceCheckedAt:'2026-10-03T06:30:54.629Z'};delete final.resultAvailabilityEvidence;
 for(const file of files.slice(0,2))fs.writeFileSync(path.join(temp,file),JSON.stringify({events:[final]}));
 participant.apply({root:temp,doc});
 for(const file of files.slice(0,2)){const kept=JSON.parse(fs.readFileSync(path.join(temp,file))).events.find(e=>e.id===final.id);assert.deepEqual(kept,final,'pending review never regresses a later final or its source clock');}
 const complete=fs.mkdtempSync(path.join(os.tmpdir(),'ns-complete-evidence-'));
 try{
  for(const file of [...files,'data/follow-sources/coverage.v1.json','data/major-events.v1.json','data/canonical/fiba-women-sailgp-motogp-2026.json','data/follow-schedule/cricket.json','data/follow-schedule/tennis.json','index.html','scripts/quick-results.js']){fs.mkdirSync(path.dirname(path.join(complete,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(complete,file));}
  applyEvidence({root:complete});applyEvidence({root:complete,check:true});
  execFileSync(process.execPath,[path.join(root,'scripts/publish-feed.js'),path.join(complete,'feeds/incoming/events.json'),path.join(complete,'data/events.json'),path.join(complete,'data/feed-meta.json'),path.join(complete,'events-data.js'),'--preserve-known'],{cwd:root,stdio:'pipe'});
  validateCurrentCardCoverage({root:complete});
  const final=JSON.parse(fs.readFileSync(path.join(complete,files[0]))).events.find(e=>e.id==='supercars-bathurst-1000-2026');
  assert.equal(final.endTimeUtc,null);assert(observedCompletionBoundary(final),'Complete ordinary writer/check accepts genuine recorded completion without guessing a finish clock');
  const baseline=fs.readFileSync(path.join(complete,'data/events.json'));
  for(const change of [e=>delete e.statusFactObservedAt,e=>delete e.firstConfirmedCompleteAt,e=>e.firstConfirmedCompleteAt='2100-01-01T00:00:00Z',e=>e.statusFactObservedAt='2100-01-01T00:00:00Z',e=>e.resultSourceCheckedAt='2100-01-01T00:00:00Z',e=>e.firstConfirmedCompleteAt=e.startTimeUtc,e=>e.resultSourceCheckedAt=e.startTimeUtc,e=>e.statusFactObservedAt='2026-10-11',e=>e.firstConfirmedCompleteAt='2026-10-11T06:32:05',e=>e.status='scheduled',e=>e.resultStatus='provisional',e=>e.sourceType='unverified']){const bad=structuredClone(final);change(bad);assert.equal(observedCompletionBoundary(bad),false,'Unsupported completion cannot clear the ordinary check');assert.equal(hasCompletionBoundary(bad),false,'Both ordinary checks reject unsupported unknown-finish results');const doc=JSON.parse(baseline);doc.events[doc.events.findIndex(e=>e.id===bad.id)]=bad;fs.writeFileSync(path.join(complete,'data/events.json'),JSON.stringify(doc));assert.throws(()=>validateCurrentCardCoverage({root:complete}),/must be completed|completion boundary is missing/,'Published coverage rejects the same invalid receipts');}
 }finally{fs.rmSync(complete,{recursive:true,force:true});}
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Reviewed results: actual scoped writers, ID/fact retention, pre-write rejection, idempotence, individual clocks, unavailable-result validation and later-final retention passed.');
