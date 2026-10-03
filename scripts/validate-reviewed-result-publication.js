'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {applySelectedResults}=require('./apply-current-card-evidence');
const participant=require('./apply-reviewed-participant-fixtures');
const {applyOfficialResults}=require('./sync-official-card-results');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-reviewed-results-'));
const files=['feeds/incoming/events.json','data/events.json','data/canonical/official-card-results-2026.json','data/canonical/current-card-evidence-2026.json','data/canonical/afl-nrl-2026.json'];
const ids=['event-aflw-cd_m20262640803','fixture-tennis-atp-beijing-2026-r16-de-minaur-halys'];
const evidence=JSON.parse(fs.readFileSync(path.join(root,files[3]))),selected=evidence.resultOverrides.filter(e=>ids.includes(e.id));
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])];
const selectedRecord=e=>selected.some(row=>aliases(e).some(id=>[row.id,row.canonicalId].includes(id)));
try{
 for(const file of files){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(temp,file));}
 const before=files.slice(0,2).map(file=>JSON.parse(fs.readFileSync(path.join(temp,file))));
 applySelectedResults(ids,{root:temp});
 for(const [index,file] of files.slice(0,2).entries()){
  const after=JSON.parse(fs.readFileSync(path.join(temp,file)));
  assert.deepEqual(after.events.map(e=>e.id),before[index].events.map(e=>e.id),'selected result writer retains every identity and order');
  assert.deepEqual(after.events.filter(e=>!selectedRecord(e)),before[index].events.filter(e=>!selectedRecord(e)),'unrelated facts, editorial and observation dates are exact');
  for(const row of selected){const old=before[index].events.find(e=>aliases(e).includes(row.id)||aliases(e).includes(row.canonicalId)),next=after.events.find(e=>e.id===old.id);assert.equal(next.status,'completed');assert.equal(next.score,row.score);assert.equal(next.resultSourceCheckedAt,row.sourceCheckedAt);for(const key of ['participantIds','date','time','startTimeUtc','timePrecision','viewingOptions'])assert.deepEqual(next[key],old[key],'original sporting schedule/viewing survives');}
 }
 const once=files.slice(0,3).map(file=>fs.readFileSync(path.join(temp,file)));applySelectedResults(ids,{root:temp});
 const canonical=JSON.parse(fs.readFileSync(path.join(temp,files[4])));assert.equal(canonical.events.find(e=>e.id===selected[0].canonicalId).status,'completed','canonical rebuild retains the reviewed existing match');
 const ledger=JSON.parse(fs.readFileSync(path.join(temp,files[2])));
 for(const row of selected){const raw=before[0].events.find(e=>aliases(e).includes(row.id)||aliases(e).includes(row.canonicalId));const replay=applyOfficialResults([{...raw,status:'scheduled',score:null}],ledger).events[0];assert.equal(replay.status,'completed','stored result resolves the actual incoming alias');assert.equal(replay.score,row.score);}
 for(const [i,file] of files.slice(0,3).entries())assert(fs.readFileSync(path.join(temp,file)).equals(once[i]),'identical result rerun is byte-stable');
 const missing=JSON.parse(fs.readFileSync(path.join(temp,files[1])));missing.events=missing.events.filter(e=>!aliases(e).includes(selected[0].id));fs.writeFileSync(path.join(temp,files[1]),JSON.stringify(missing));
 const unchanged=files.slice(0,3).map(file=>fs.readFileSync(path.join(temp,file)));
 assert.throws(()=>applySelectedResults(ids,{root:temp}),/exactly one retained fixture/);
 for(const [i,file] of files.slice(0,3).entries())assert(fs.readFileSync(path.join(temp,file)).equals(unchanged[i]),'missing second-surface identity rejects before any write');
 // Replay through the ordinary owner uses per-result dates, not the old batch clock.
 const row=selected[1],result=applyOfficialResults([{id:row.id,name:'Reviewed final'}],{checkedAt:evidence.checkedAt,results:[row]}).events[0];
 assert.equal(result.resultPublishedAt,row.resultPublishedAt);assert.equal(result.lastReviewedAt,row.lastReviewedAt);assert.equal(result.sourceCheckedAt,row.sourceCheckedAt);
 const doc=structuredClone(participant.validate()),pending=doc.events.find(e=>e.resultStatus==='pending');assert(pending);
 for(const change of [e=>delete e.resultAvailabilityEvidence,e=>e.resultSourceCheckedAt='2100-01-01T00:00:00Z',e=>e.score='Invented score',e=>e.resultAvailabilityEvidence.fixtureId='another-match']){const bad=structuredClone(doc);change(bad.events.find(e=>e.id===pending.id));assert.throws(()=>participant.validate(bad));}
 // A later confirmed final must survive an older reviewed availability record.
 const final={...pending,status:'completed',score:'Synthetic verified final',sourceUrl:'https://example.org/result',sourceCheckedAt:'2026-10-03T06:30:54.629Z',resultStatus:'official',resultSourceCheckedAt:'2026-10-03T06:30:54.629Z'};delete final.resultAvailabilityEvidence;
 for(const file of files.slice(0,2))fs.writeFileSync(path.join(temp,file),JSON.stringify({events:[final]}));
 participant.apply({root:temp});
 for(const file of files.slice(0,2)){const kept=JSON.parse(fs.readFileSync(path.join(temp,file))).events.find(e=>e.id===final.id);assert.deepEqual(kept,final,'pending review never regresses a later final or its source clock');}
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Reviewed results: actual scoped writers, ID/fact retention, pre-write rejection, idempotence, individual clocks, unavailable-result validation and later-final retention passed.');
