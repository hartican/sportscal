'use strict';
// Captured-only regression; exported to the existing accepted-result gate.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const projection=require('./lib/accepted-result-projection'),writer=require('./apply-current-card-evidence'),official=require('./sync-official-card-results'),reconciler=require('./lib/reconcile-fixture-results');
const receipt=require('./fixtures/cricket-ca39991-final-receipt-20261023.json');
const row=require('../data/canonical/current-card-evidence-2026.json').resultOverrides.find(r=>r.id==='fixture-cricket-espn-1525660');
const clone=v=>structuredClone(v),now=new Date(receipt.checkedAt);
const records=['feeds/incoming/events.json','data/events.json'].map(file=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',file))).events.find(e=>[e.id,e.canonicalEventId].includes(receipt.canonicalId)));
function retag(value){value.acceptedResultProjection.payloadSha256=projection.hash(projection.payload(value));return value;}
// Construct the negative's entire evidence boundary. Never spread a generated
// completed card: its retained official tuples would make this a valid final.
function unresolved(event){return {
 id:event.id,eventId:event.eventId,canonicalEventId:event.canonicalEventId,sourceEventIds:clone(event.sourceEventIds||[]),
 key:'cricket',date:event.date,startTimeUtc:event.startTimeUtc,competitionId:event.competitionId,participantIds:clone(event.participantIds),
 status:'upcoming',sourceName:'Cricket Australia',sourceType:'official',
 sourceUrl:'https://www.cricket.com.au/matches/series/CA%3A4568/',sourceCheckedAt:'2026-09-30T22:50:31.966Z',
};}
function unsupported(event){return {
 ...unresolved(event),status:'completed',sourceType:'trusted-reporting',sourceCheckedAt:receipt.checkedAt,scoreDisplay:row.score,
};}
async function run(){
 const originals={fetch:globalThis.fetch};const http=require('node:http'),https=require('node:https'),net=require('node:net');
 const saved=[http.request,http.get,https.request,https.get,net.Socket.prototype.connect];const deny=()=>{throw Error('No network in captured Cricket result regression');};globalThis.fetch=deny;http.request=http.get=https.request=https.get=net.Socket.prototype.connect=deny;
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'official-cricket-final-'));
 try{
  projection.validateAcceptedResult(row);
  assert.equal(row.acceptedResultProjection.sourceSha256,receipt.sourceSha256);
  for(const event of records){
   const pending=unresolved(event),unverified=unsupported(event);
   for(const key of ['score','outcomeText','recapText','resultSourceUrl','resultSourceType','statusSourceUrl','officialScorecardUrl','firstConfirmedCompleteAt']){assert(!Object.hasOwn(pending,key),'pending control has no inherited '+key);assert(!Object.hasOwn(unverified,key),'unsupported control has no inherited '+key);}
   assert.throws(()=>reconciler.reconcile([pending],[unverified],{now}),/lacks supported official evidence/,'unsupported ESPN result is not made official by schedule attribution');
   assert.throws(()=>reconciler.reconcile([pending],[{...unverified,sourceType:'official'}],{now}),/unsupported official Cricket result source/,'series schedule remains unsupported');
   const projected=projection.mergeAcceptedResult(event,row);
   assert.equal(projected.id,event.id);assert.equal(projected.status,'completed');assert.equal(projected.resultSourceCheckedAt,row.resultSourceCheckedAt);assert.equal(projected.sourceCheckedAt,receipt.bodyCompletedAt);
   assert.equal(projected.lastReviewedAt,event.lastReviewedAt);assert.deepEqual(projected.editorialNarrative,event.editorialNarrative);
   assert.equal(projected.selectedSentence,event.selectedSentence);assert.equal(projected.fullSpiel,event.fullSpiel);
   assert.equal(projected.storyline.hookSpoilerOff,event.storyline.hookSpoilerOff);assert.equal(projected.storyline.synopsisSpoilerOff,event.storyline.synopsisSpoilerOff);
   assert.equal(projected.storyline.hookSpoilerOn,row.outcomeText);assert.equal(projected.storyline.synopsisSpoilerOn,row.recapText);assert.equal(projected.storyline.arcStage,'recap');
   for(const key of ['actualEndTimeUtc','completedAt','resultPublishedAt'])assert.equal(projected[key],event[key],'no invented '+key);
   assert.equal(projected.firstConfirmedCompleteAt,'2026-10-22T14:02:02.904168+00:00','actual stored first completion, not fresh contact');
   assert.equal(projected.endTimeUtc,null);projection.validateAcceptedProjection(projected,row);
   assert.deepEqual(projection.mergeAcceptedResult(projected,row),projected,'same receipt replay is exact');
   const a=writer.mergeRecord(event,row,receipt.checkedAt),b=official.applyOfficialResults([event],{results:[row]}).events[0];assert.deepEqual(a,projected);assert.deepEqual(b,projected);
   const normalized=require('../config/fixture-identity').normalizeCore(projected);
   assert.equal(normalized.sourceUrl,row.sourceUrl,'calendar normalisation cannot relabel official result provenance');projection.validateAcceptedProjection(normalized,row);
   assert.deepEqual(require('../config/fixture-identity').normalizeCore(normalized),normalized,'unchanged normalisation is exact');
   assert.equal(reconciler.reconcile([projected],[projected],{now}).changed.length,0,'strict reconciler accepts bound official final without changing it');
  }
  const source=records[1];
  const mismatch=require('../config/fixture-identity').normalizeCore({...projection.mergeAcceptedResult(source,row),sourceType:'trusted-reporting'});assert.equal(mismatch.sourceUrl,'https://www.cricket.com.au/matches/series/CA%3A4568/','nonofficial observation does not get the official-result provenance exception');
  for(const change of [{startTimeUtc:'2026-10-18T09:00:00Z'},{competitionId:'competition:other'},{participantIds:[...source.participantIds].reverse()},{id:'other',eventId:'other',canonicalEventId:'other',sourceEventIds:[]},{date:'2026-10-19'},{status:'completed',score:'Australia win by 31 runs'},{status:'completed',score:row.score,winnerParticipantId:'team:cricket:australia'}])assert.throws(()=>projection.mergeAcceptedResult({...source,...change},row),'changed identity or contradictory result must reject');
  for(const change of [{sourceType:'trusted-reporting'},{sourceUrl:'https://www.cricket.com.au/matches/series/CA%3A4568/'},{score:'Unsupported result'},{sourceCheckedAt:'2026-10-22T21:20:20.000Z'},{firstConfirmedCompleteAt:receipt.checkedAt},{resultPublishedAt:receipt.checkedAt},{startTimeUtc:'2026-10-18T09:00:00Z'}])assert.throws(()=>projection.mergeAcceptedResult(source,retag({...clone(row),...change})),undefined,'tampered capsule or invented sporting clock');
  const identity=require('../config/fixture-identity');assert.equal(identity.canonicalFixtureId('fixture:cricket:CA:39991'),'fixture:cricket:CA:39991');assert(!identity.fixtureAliases(receipt.canonicalId).includes('fixture:cricket:CA:39991'),'no global/private identity cutover');
  const forged=clone(row);for(const key of ['id','canonicalId','canonicalEventId'])forged[key]='unreviewed';forged.sourceEventIds=['unreviewed'];forged.acceptedResultProjection.aliases=['unreviewed'];forged.acceptedResultProjection.sourceSha256='0'.repeat(64);assert.throws(()=>projection.validateAcceptedResult(forged),'official API host is not admitted outside this exact reviewed capsule');
  const wrongHash=clone(row);wrongHash.acceptedResultProjection.sourceSha256='0'.repeat(64);assert.throws(()=>projection.validateAcceptedResult(wrongHash));
  const stored=require('./fixtures/cricket-ca39991-retained-facts-20261023.json');
  const current=stored.rows.find(r=>r.relation==='current').public_result_facts,score=stored.rows.find(r=>r.relation==='score').public_result_facts;
  const actualPrior={...source,...current,...score,id:source.id,eventId:source.eventId,canonicalEventId:source.canonicalEventId,sourceEventIds:source.sourceEventIds};
  const actualMerged=projection.mergeAcceptedResult(actualPrior,row);
  for(const key of ['scoreCheckedAt','statusCheckedAt'])assert.equal(actualMerged[key],score[key],'actual original score-row '+key);
  for(const key of ['scoreFactObservedAt','statusFactObservedAt','firstConfirmedCompleteAt'])assert.equal(actualMerged[key],current[key],'actual original current-row '+key);
  assert.equal(actualMerged.sourceCheckedAt,receipt.checkedAt,'actual new scorecard contact stays separate');assert.equal(actualMerged.resultSourceUrl,current.sourceUrl);assert.equal(actualMerged.resultSourceCheckedAt,current.sourceCheckedAt);
  projection.validateAcceptedProjection(actualMerged,row);assert.deepEqual(projection.mergeAcceptedResult(actualMerged,row),actualMerged,'actual stored facts do not renew on replay');
  assert.throws(()=>projection.mergeAcceptedResult({...actualPrior,statusSourceName:'ESPNcricinfo',statusSourceType:'trusted-reporting',statusSourceUrl:'https://www.espncricinfo.com/live-cricket-score'},row),'real CA score with independent ESPN status must reject');
  const prior=projection.mergeAcceptedResult(source,row),older='2026-10-22T13:00:00.123+00:00';
  for(const key of ['scoreCheckedAt','statusCheckedAt','resultSourceCheckedAt','scoreFactObservedAt','statusFactObservedAt'])prior[key]=older;
  prior.firstConfirmedCompleteAt=older;
  assert.throws(()=>projection.mergeAcceptedResult({...prior,resultSourceUrl:'https://www.cricket.com.au/matches/CA%3A39991'},row),'an unqualified earlier endpoint still needs explicit reconciliation');
  for(const change of [{statusSourceName:'ESPNcricinfo'},{statusSourceType:'trusted-reporting'},{statusSourceUrl:'https://www.espncricinfo.com/live-cricket-score'},{statusSourceUrl:null},{resultSourceName:'ESPNcricinfo'},{resultSourceType:'trusted-reporting'}])assert.throws(()=>projection.mergeAcceptedResult({...prior,...change},row),'independent mixed score/status attribution must fail');
  assert.throws(()=>projection.mergeAcceptedResult({...prior,statusFactObservedAt:'2026-10-22T21:21:00Z',statusCheckedAt:'2026-10-22T21:21:00Z',statusSourceName:'ESPNcricinfo',statusSourceType:'trusted-reporting',statusSourceUrl:'https://www.espncricinfo.com/live-cricket-score'},row),'newer mixed status also fails independently');
  const ownTuples={...prior,sourceName:'ESPNcricinfo',sourceType:'trusted-reporting',sourceUrl:'https://www.espncricinfo.com/live-cricket-score',resultSourceName:'Cricket Australia',resultSourceType:'official'};
  assert.equal(projection.mergeAcceptedResult(ownTuples,row).scoreFactObservedAt,older,'explicit own CA result/status tuples do not borrow the general planning attribution');
  const retained=projection.mergeAcceptedResult(prior,row);
  for(const key of ['scoreCheckedAt','statusCheckedAt','resultSourceCheckedAt','scoreFactObservedAt','statusFactObservedAt','firstConfirmedCompleteAt'])assert.equal(retained[key],older,'original earlier accepted '+key);
  assert.equal(retained.sourceCheckedAt,receipt.checkedAt,'new collection/source receipt remains distinct');projection.validateAcceptedProjection(retained,row);
  assert.deepEqual(projection.mergeAcceptedResult(retained,row),retained,'original observations remain exact on rerun');
  assert.throws(()=>projection.mergeAcceptedResult({...prior,scoreCheckedAt:'2026-10-22'},row),'malformed old clock cannot be persisted');
  assert.throws(()=>projection.mergeAcceptedResult({...prior,scoreFactObservedAt:'2026-10-17T20:00:00Z'},row),'pre-start old result clock cannot be borrowed');
  const files=['feeds/incoming/events.json','data/events.json','data/canonical/afl-nrl-2026.json','data/canonical/official-card-results-2026.json','data/follow-sources/coverage.v1.json','data/major-events.v1.json'];
  const write=(file,value)=>{const f=path.join(root,file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(value,null,2)+'\n');};
  for(const [i,file]of files.entries())write(file,file.includes('official-card-results')?{results:[]} :file.includes('major-events')?{events:[]}:{events:[clone(records[i===0?0:1]),{id:'untouched',status:'scheduled',originalReceipt:'unchanged'}]});
  write('data/canonical/current-card-evidence-2026.json',{resultOverrides:[row]});
  writer.applySelectedResults([row.id],{root});
  for(const file of files.filter(f=>!f.includes('major-events')&&!f.includes('official-card-results'))){const doc=JSON.parse(fs.readFileSync(path.join(root,file)));const record=doc.events.find(f=>f.id!=='untouched');projection.validateAcceptedProjection(record,row);assert.equal(doc.events.find(f=>f.id==='untouched').originalReceipt,'unchanged');}
  const before=files.map(file=>fs.readFileSync(path.join(root,file)));writer.applySelectedResults([row.id],{root});for(const [i,file]of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),before[i],'actual selected writer same-receipt bytes '+file);
  // The real selected writer preflights both surfaces before its first write.
  for(const change of [{startTimeUtc:'2026-10-18T09:00:00Z'},{participantIds:[...receipt.participantIds].reverse()},{score:'Australia win by 31 runs'}]){
   const document=JSON.parse(fs.readFileSync(path.join(root,'data/events.json')));Object.assign(document.events[0],change);write('data/events.json',document);
   const invalidBefore=files.map(file=>fs.readFileSync(path.join(root,file)));
   assert.throws(()=>writer.applySelectedResults([row.id],{root}));
   for(const [i,file]of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),invalidBefore[i],'invalid published identity/final attempts no writes '+file);
   for(const [i,file]of files.entries())fs.writeFileSync(path.join(root,file),before[i]);
  }
  const evidenceBytes=fs.readFileSync(path.join(root,'data/canonical/current-card-evidence-2026.json'));
  const runtime='assets/js/app-shell-runtime.js';fs.mkdirSync(path.join(root,'assets/js'),{recursive:true});fs.writeFileSync(path.join(root,runtime),'unchanged-runtime');
  const priorReports=[process.env.REFRESH_REPORT,process.env.QUICK_RESULTS_REPORT];process.env.REFRESH_REPORT=path.join(root,'diagnostics/canonical.json');process.env.QUICK_RESULTS_REPORT=path.join(root,'diagnostics/quick.json');
  const cwd=process.cwd();process.chdir(root);
  try{
   await assert.rejects(require(path.join(__dirname,'quick-results')).atomicRefresh({},{refreshOperation:async()=>{writer.applySelectedResults([row.id],{root});fs.writeFileSync('data/new-candidate.json','{}');fs.writeFileSync('data/canonical/current-card-evidence-2026.json','{}');fs.writeFileSync(runtime,'changed-runtime');throw Error('forced exact post-result rollback');}}),/forced exact post-result rollback/);
  }finally{process.chdir(cwd);for(const [i,key]of ['REFRESH_REPORT','QUICK_RESULTS_REPORT'].entries())if(priorReports[i]===undefined)delete process.env[key];else process.env[key]=priorReports[i];}
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'diagnostics/quick.json'))).publicationState,'blocked-rolled-back','failure receipt preserved outside candidate');
  for(const [i,file]of files.entries())assert.deepEqual(fs.readFileSync(path.join(root,file)),before[i],'full candidate rollback '+file);assert.deepEqual(fs.readFileSync(path.join(root,'data/canonical/current-card-evidence-2026.json')),evidenceBytes,'evidence ledger rollback');assert(!fs.existsSync(path.join(root,'data/new-candidate.json')));assert.equal(fs.readFileSync(path.join(root,runtime),'utf8'),'unchanged-runtime');
  console.log('Captured official Second Test: strict unsupported-source rejection; exact hash/contest/clocks; both writers/Feed surfaces; conflicts; original observations; spoilers; exact rollback; zero network.');
 }finally{globalThis.fetch=originals.fetch;[http.request,http.get,https.request,https.get,net.Socket.prototype.connect]=saved;fs.rmSync(root,{recursive:true,force:true});}
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=run;
