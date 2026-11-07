'use strict';
// Metadata-only regression source. Not run locally or a substitute for app/browser proof.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {POLICY,hash,validateEnvelope,replaceExact,boundedRegularRead}=require('./lib/forward-onboarding-ci');
const sourceReadLedger={used:0,limit:2*1024*1024*1024};
function normaliseForwardWorkflow(text){
 const overlay=JSON.parse(boundedRegularRead(path.join(__dirname,'lib/forward-onboarding-workflow-overlay.json'),16*1024*1024,sourceReadLedger).toString('utf8'));
 assert.equal(overlay.schemaVersion,'forward-onboarding-workflow-overlay.v1');assert.equal(overlay.beforeSha256,'cf0d5a623de10834c530d10de83e825642c249b5b804a36d72582c5fd80f2dbf');
 assert.equal(hash(Buffer.from(text)),overlay.afterSha256,'exact current forward workflow, no normalisation of unreviewed hunks');
 let restored=text;
 for(const edit of [...overlay.edits].reverse()){assert.equal(restored.split(edit.after).length-1,1,'one exact bounded forward overlay');restored=restored.replace(edit.after,()=>edit.before);}
 assert.equal(hash(Buffer.from(restored)),overlay.beforeSha256,'entire accepted workflow including all old negatives/gates/browsers');
 return {restored,edits:overlay.edits.length};
}
const RESERVATION_BYTES=Buffer.from('ewogICJzY2hlbWFWZXJzaW9uIjogInB1Ymxpc2hlci1mb3J3YXJkLXZlcnNpb24tcmVzZXJ2YXRpb24udjEiLAogICJpZCI6ICJOUy1PTkJPQVJESU5HLUZPUldBUkQtNjEyLTIwMjYxMTA3IiwKICAiYWxsb2NhdGlvbiI6ICJPTkJPQVJESU5HLVBPU1Q2MTEtRk9SV0FSRC1SRVBBSVItMjAyNjExMDctMDEiLAogICJzdGF0ZSI6ICJSRVNFUlZFRF9TT1VSQ0VfUEFDS0FHSU5HX09OTFlfTk9UX1JFTEVBU0VfUkVBRFkiLAogICJ2ZXJzaW9uIjogIjYxMiIsCiAgInByZXZpb3VzQWNjZXB0ZWRWZXJzaW9uIjogIjYxMSIsCiAgIm93bmVyIjogIm5zUFVCTElTSCIsCiAgInNvbGVQdWJsaXNoZXIiOiAiMDFhMGQ1YmEtOTQzZC03NGUwLWFmN2YtZGFiNGZiMmJkZGE0IiwKICAiYXV0aG9yaXRhdGl2ZVJlY29yZCI6ICIvVXNlcnMvamFja2hhcnRpY2FuL0RvY3VtZW50cy9BSS9Db2RleC9PTkJPQVJESU5HLVBPU1Q2MTEtRk9SV0FSRC1SRVBBSVItMjAyNjExMDctMDEvRk9SV0FSRC1WRVJTSU9OLVJFU0VSVkFUSU9OLmpzb24iLAogICJhY2NlcHRlZE1haW4iOiAiNGJmZjdhZGE3ZDAzYzNiZmY1MmEyNjJmNThlNjMwZmU0Nzg0OGE3NCIsCiAgImFjY2VwdGVkTWFpblRyZWUiOiAiNWU2ZWZmN2Q0MzA3ZmI5N2U3MjVmNTc0NjlkOWVjYWJjYjc4YzdhMiIsCiAgInNvdXJjZUhlYWQiOiAiN2ExOTQzOTBjNzBkOWFlNTIwMWFjNjRmMjAyY2U4NTQ3MTU1YTJjNiIsCiAgInNvdXJjZVRyZWUiOiAiOTlhN2YwMjQzMDJjODY2MDU2NGU1MzhiZWM1OTFhNGFlNDExM2UxMCIsCiAgInNvdXJjZVBhcmVudCI6ICI0YmZmN2FkYTdkMDNjM2JmZjUyYTI2MmY1OGU2MzBmZTQ3ODQ4YTc0IiwKICAic291cmNlUGF0Y2giOiB7CiAgICAicGF0aCI6ICIvVXNlcnMvamFja2hhcnRpY2FuL0RvY3VtZW50cy9BSS9QZXJwbGV4aXR5L1Nwb3J0c2NhbC90bXAvc2VsZWN0aW9uLW9uYm9hcmRpbmctMjAyNjExMDcucGF0Y2giLAogICAgImJ5dGVzIjogMTQ5MTk4LAogICAgInNoYTI1NiI6ICI4ZGJlMzY0ZDJlZWYyZjdjZTU3MWU3MzMzMDY0NWZiNzliMzQwN2I2ZDZjNjEyN2VmMTZlNjllMmI0NjkzMjQyIgogIH0sCiAgInNvdXJjZVJldmlldyI6IHsKICAgICJwYXRoIjogIi9Vc2Vycy9qYWNraGFydGljYW4vRG9jdW1lbnRzL0FJL0NvZGV4L25zLXJlbGVhc2UtaW50YWtlLTIwMjYxMTA0L09OQk9BUkRJTkctUE9TVDYxMS1maW5pdGUtc291cmNlLXJldmlldy1hbmQtZm9yd2FyZC1oYW5kb2ZmLTIwMjYxMTA3Lmpzb24iLAogICAgImJ5dGVzIjogMTUzOTAsCiAgICAic2hhMjU2IjogIjIzZWU5ZGFmZTgzZGEwMWZiN2Y1NTI1YWIwZGYxMTI2Njc1ZjU1MzUyNTJjYTkxNzAzNTg5MWEzZTFjM2EyZDMiCiAgfSwKICAicHJlZGVjZXNzb3JSZWNlaXB0IjogewogICAgInBhdGgiOiAiL3RtcC9ucy1vbmJvYXJkaW5nLXJlbGVhc2UtZXZpZGVuY2UtMjAyNjExMDcvdjYxMS1maW5hbC1ldmlkZW5jZS5qc29uIiwKICAgICJieXRlcyI6IDcwNywKICAgICJzaGEyNTYiOiAiYmE0ZDA5ODA5MTllMTk5MmU3NTMxZGZjYzMzMGQzYTQzNDQzNDFjZmQ2ODM3OTAwZGU2Mzg4YjM5Y2RiMzdkYyIsCiAgICAid29ya2Zsb3dSdW4iOiA0MjMyMjI3NzA2NSwKICAgICJkZXBsb3ltZW50SWQiOiAiZHBsX0NSYWk3N3Jpb3BKUXJaTnlHYkpaQktrVm1QVkEiLAogICAgInBoeXNpY2FsSVBob25lVmVyaWZpZWQiOiBmYWxzZSwKICAgICJtZWFuaW5nIjogIlJldGFpbmVkIGNvbXBsZXRpb24gZXZpZGVuY2Ugb25seTsgbm90IGEgc3Vic3RpdHV0ZSBmb3IgY3VycmVudCBub3JtYWwgYmFzZWxpbmUgY2FwdHVyZS9hZG1pc3Npb24uIgogIH0sCiAgImtub3duQ2xhaW1zIjogewogICAgImNvb3JkaW5hdG9yUmVwb3J0ZWQiOiAiT25ib2FyZGluZyBpcyB0aGUgb25seSBjdXJyZW50IG51bWVyaWMgZm9yd2FyZCBhbGxvY2F0aW9uIGluIGl0cyBvd25lZCBvdXRjb21lIHJlY29yZDsgU1lOQy9STFdDIGhhdmUgbm8gbnVtZXJpYyByZXNlcnZhdGlvbi4iLAogICAgInB1Ymxpc2hlck93bmVkUmVjb3JkIjogIlByZXZpb3VzIDYxMCByZXNlcnZhdGlvbi9oaXN0b3J5IHJldGFpbmVkIHVuY2hhbmdlZDsgbm8gY29uY3JldGUgY29uZmxpY3RpbmcgNjEyIGNsYWltIGZvdW5kIGluIGJvdW5kZWQgZmlsZW5hbWUgYW5kIG93bmVkLWxlZGdlciByZWNvbmNpbGlhdGlvbi4iLAogICAgImdsb2JhbEFic2VuY2VQcm92ZW4iOiBmYWxzZSwKICAgICJzZWxlY3Rpb24iOiAiNjEyID0gYWN0dWFsIGFjY2VwdGVkIDYxMSArIDEsIGFzc2lnbmVkIHByb3NwZWN0aXZlbHkgYnkgc29sZSBwdWJsaXNoZXIgdW5kZXIgZXhpc3Rpbmcgb25ib2FyZGluZyBhbGxvY2F0aW9uLiIKICB9LAogICJoaXN0b3JpY2FsTGVkZ2VyIjogewogICAgInBhdGgiOiAiL1VzZXJzL2phY2toYXJ0aWNhbi9Eb2N1bWVudHMvQ29kZXgvMjAyNi0xMC0yMy90YXNrL25zLXN5bmMtdXBncmFkZS1taWdyYXRpb24tY29vcmRpbmF0aW9uLTIwMjYxMTA1Lmpzb24iLAogICAgImJ5dGVzIjogMTIyOTk5LAogICAgInNoYTI1NiI6ICJiNWIxM2U3MGY5MDAxZTg0NWZkZmIyMTNmZmU0ZDk3NDhlZGE1NjcwM2I0N2MzMTc5MDNkNjcwZDU4N2U5ZjY4IiwKICAgICJtb2RpZmllZCI6IGZhbHNlCiAgfSwKICAiZnV0dXJlQmluZGluZ3MiOiB7CiAgICAicGFja2FnZWRIZWFkIjogbnVsbCwKICAgICJwYWNrYWdlZFRyZWUiOiBudWxsLAogICAgInRlc3RlZE1lcmdlIjogbnVsbCwKICAgICJjbG91ZEFydGlmYWN0SWQiOiBudWxsLAogICAgImNsb3VkQXJ0aWZhY3RTaGEyNTYiOiBudWxsLAogICAgImJhc2VsaW5lQ2FwdHVyZVJlY2VpcHQiOiBudWxsCiAgfSwKICAicGVybWl0dGVkTmV4dCI6ICJPcmlnaW5hbCBVUERBVEUgcHJlcGFyZXMgc3RyaWN0bHkgYm91bmQgNjEyIGNhbm9uaWNhbCBjbG91ZCBwcm9kdWNlci9hZG1pc3Npb24gc291cmNlIHBhY2tldDsgZXhpc3RpbmcgUkVMRUFTRSByZXZpZXdzOyBuc1BVQkxJU0ggYWxvbmUgbGF0ZXIgaW50ZWdyYXRlcyBleGFjdCByZXZpZXdlZCBjYW5kaWRhdGUgdW5kZXIgb3JkaW5hcnkgcmVsZWFzZSBhdXRob3JpdHkgYW5kIGFsbCBnYXRlcy4iLAogICJub3RHcmFudGVkQnlSZXNlcnZhdGlvbiI6IFsKICAgICJDSSBldmVudCBvciB0ZXN0LXNsb3QgYWxsb2NhdGlvbiIsCiAgICAiUmVhZHkgdHJhbnNpdGlvbiBvciBkaXNwYXRjaCIsCiAgICAiTWVyZ2UsIG1haW4gcHVzaCBvciBkZXBsb3ltZW50IiwKICAgICJMb2NhbCBwcm9kdWN0IGV4ZWN1dGlvbiIsCiAgICAiUHVibGljIHJlcXVlc3QgcmV0cnkgb3IgYmxvY2tlZC1yb3V0ZSBieXBhc3MiLAogICAgIkNoYW5nZXMgdG8gc2lnbnVwLCBkYXRhYmFzZSwgYWNjb3VudHMsIHNjaGVkdWxlcyBvciBzZXR0aW5ncyIsCiAgICAiT2xkNjEwIHdhaXZlciwgbW9kaWZpZWQgYnVkZ2V0cyBvciB3ZWFrZW5lZCBjb250cm9scyIKICBdLAogICJzdG9wQ29uZGl0aW9ucyI6IFsKICAgICJDb25jcmV0ZSBjb21wZXRpbmcgcmVzZXJ2YXRpb24gb3IgYWNjZXB0ZWQgdmVyc2lvbiA+PTYxMjogc3RvcCBhbmQgcmVjb25jaWxlLCBubyBzaWxlbnQgcmVudW1iZXJpbmcuIiwKICAgICJGcmVzaCBtYWluL3NvdXJjZS9yZXZpZXcvcGF0Y2ggZHJpZnQgYmVmb3JlIGFkb3B0aW9uL3N1Ym1pc3Npb246IHN0b3AgYW5kIGJpbmQgZXhhY3QgY2hhbmdlZCBpbnB1dHMuIiwKICAgICJObyBjbG91ZCBnZW5lcmF0aW9uL3F1YWxpZmljYXRpb24gdW50aWwgZXhhY3QgQ0kvYnVpbGRlciBwYWNrZXQgcmV2aWV3ZWQgYW5kIG5vcm1hbCByZWxldmFudCBhZG1pc3Npb24gcmVxdWlyZW1lbnRzIG1ldC4iCiAgXSwKICAiY2xvdWRPbmx5IjogdHJ1ZSwKICAic3BlZWRPdmVycmlkZUFsbG93ZWQiOiBmYWxzZSwKICAicGh5c2ljYWxQaG9uZSI6ICJVTlRFU1RFRDsgZGlzY2xvc3VyZSBvbmx5LCBub3QgbmV3bHkgaW50cm9kdWNlZCBtYW51YWwgYXBwcm92YWwgZ2F0ZS4iLAogICJzb3VyY2VUYXNrU2VwYXJhdGlvbiI6ICJIaXN0b3JpY2FsIHY5IG5vLWRlcGxveW1lbnQgdGFzayByZW1haW5zIGNvbXBsZXRlIGFuZCBzZXBhcmF0ZS4gTm8gbmV3IFNZTkMgcGF0Y2ggaW5jbHVkZWQuIiwKICAiYXRVVEMiOiAiMjAyNi0xMS0wN1QwMTo1NjoyNS4yMDI5NjcrMDA6MDAiLAogICJtYWluT2JzZXJ2ZWRBdFVUQyI6ICIyMDI2LTExLTA3VDAxOjU1OjE3WiIKfQo=','base64');
function sourceControls(text){
 const normal=normaliseForwardWorkflow(text),results=[],boundVersionPlan=boundVersionPlanControls(),boundedReaders=boundedReaderControls();
 assert.equal(RESERVATION_BYTES.length,4142);assert.equal(hash(RESERVATION_BYTES),POLICY.reservationSha256);
 const copy=v=>JSON.parse(JSON.stringify(v)),now=Date.parse('2026-11-07T02:00:00.000Z');
 function sample(phase){
  const H='1'.repeat(40),T='2'.repeat(40),TREE='3'.repeat(40),MAP='4'.repeat(64),S='5'.repeat(64);
  const b={schemaVersion:'sync-current-forward-binding.v1',phase,repository:POLICY.repository,publisherHeadSha:H,expectedPublisherTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:S,expectedAssembledEntryCount:10,expectedBaseRelativePathCount:1,qualifierSha256:'6'.repeat(64),fixtureSha256:'7'.repeat(64),namedAllocationId:'SYNTHETIC_CONTRACT_CONTROL_NO_EXECUTION',reservationReceiptSha256:POLICY.reservationSha256,reservationReceiptBase64:RESERVATION_BYTES.toString('base64'),freshMainAndReservationBindingSha256:null,freshMainAndReservationBindingBase64:null};
  const fresh={schemaVersion:'publisher-fresh-main-reservation-binding.v1',publisherThreadId:POLICY.publisher,repository:POLICY.repository,candidateHeadSha:H,candidateTreeSha:TREE,reviewedFinalMapSha256:MAP,expectedAssembledManifestSha256:S,observedMainSha:POLICY.acceptedMain,mainObservedAt:new Date(now-1000).toISOString(),mainRefEvidenceSha256:'8'.repeat(64),reservationId:POLICY.reservationId,reservationVersion:POLICY.version,reservationReceiptSha256:POLICY.reservationSha256,reservationConflictCheckedAt:new Date(now-1000).toISOString(),knownConflictingReservation:false,globalReservationAvailability:'UNKNOWN; no global availability claim',namedAllocationId:b.namedAllocationId,validUntil:new Date(now+60000).toISOString(),currentActionAuthority:'SYNTHETIC_CONTRACT_CONTROL_NO_EXECUTION'};
  const body={schemaVersion:'ns-release-handover.forward.v1',scope:'Synthetic metadata contract only',commit:H,testsAndResults:'No runtime acceptance',dependencies:'Existing locked lane only',databaseAndConfigChanges:'None',knownRisks:'Unrun source',rollback:'Do not adopt',sourceQualificationBinding:b};
  const event={action:phase==='canonical-producer'?'opened':'ready_for_review',number:1,repository:{full_name:POLICY.repository},pull_request:{number:1,draft:phase==='canonical-producer',head:{sha:H,ref:'codex/source-qualification-forward-contract',repo:{full_name:POLICY.repository}},base:{sha:POLICY.acceptedMain,repo:{full_name:POLICY.repository}},body:null}};
  const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'pull_request',GITHUB_REPOSITORY:POLICY.repository,GITHUB_JOB:'fixture-activation',GITHUB_WORKFLOW_REF:POLICY.repository+'/.github/workflows/installed-upgrade-tests.yml@refs/pull/1/merge',GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1',GITHUB_REF:'refs/pull/1/merge',GITHUB_SHA:T};
  const x={phase,now,event,env,observed:{parents:[POLICY.acceptedMain,H],checkout:T,headTree:TREE,testedTree:TREE,clean:true},body,b,fresh};
  x.write=()=>{const bytes=Buffer.from(JSON.stringify(fresh));b.freshMainAndReservationBindingBase64=bytes.toString('base64');b.freshMainAndReservationBindingSha256=hash(bytes);event.pull_request.body=JSON.stringify(body);};
  x.write();return x;
 }
 for(const phase of ['canonical-producer','qualification']){const x=sample(phase);assert.equal(validateEnvelope(x).releaseAcceptance,false);results.push({name:phase+' exact metadata witness',positive:true});}
 const tests=[
 ['unknown schema',x=>{x.body.schemaVersion='other';}],
 ['old610 schema cannot reuse612',x=>{x.body.schemaVersion='ns-release-handover.v1';}],
 ['wrong version receipt',x=>{x.b.reservationReceiptSha256='a'.repeat(64);}],
 ['fresh main advanced',x=>{x.event.pull_request.base.sha='a'.repeat(40);}],
 ['forward conflict',x=>{x.fresh.knownConflictingReservation=true;}],
 ['false global absence',x=>{x.fresh.globalReservationAvailability='available';}],
 ['wrong publisher',x=>{x.fresh.publisherThreadId='other';}],
 ['wrong allocation join',x=>{x.fresh.namedAllocationId='OTHER';}],
 ['template authority',x=>{x.fresh.currentActionAuthority='SOURCE_TEMPLATE_ONLY_NOT_ALLOCATION';}],
 ['expired action',x=>{x.fresh.validUntil=new Date(now-1).toISOString();}],
 ['future main',x=>{x.fresh.mainObservedAt=new Date(now+1).toISOString();}],
 ['invalid UTC',x=>{x.fresh.validUntil='tomorrow';}],
 ['wrong reservation version',x=>{x.fresh.reservationVersion='611';}],
 ['wrong role',x=>{x.env.GITHUB_JOB='installed-upgrade';}],
 ['wrong Node job context',x=>{x.env.GITHUB_ACTIONS='false';}],
 ['fork head',x=>{x.event.pull_request.head.repo.full_name='fork/repo';}],
 ['fork base',x=>{x.event.pull_request.base.repo.full_name='fork/repo';}],
 ['wrong workflow',x=>{x.env.GITHUB_WORKFLOW_REF=POLICY.repository+'/.github/workflows/other.yml@x';}],
 ['wrong ref',x=>{x.env.GITHUB_REF='refs/heads/main';}],
 ['zero run',x=>{x.env.GITHUB_RUN_ID='0';}],
 ['wrong event',x=>{x.event.action='synchronize';}],
 ['phase mismatch',x=>{x.b.phase='canonical-producer';}],
 ['dirty source',x=>{x.observed.clean=false;}],
 ['wrong head',x=>{x.event.pull_request.head.sha='a'.repeat(40);}],
 ['wrong tree',x=>{x.observed.testedTree='a'.repeat(40);}],
 ['wrong merge parent order',x=>{x.observed.parents.reverse();}],
 ['wrong checkout',x=>{x.observed.checkout='a'.repeat(40);}],
 ['string source count',x=>{x.b.expectedAssembledEntryCount='10';}],
 ['unknown binding field',x=>{x.b.extra=true;}],
 ['unpaired surrogate',x=>{x.body.scope='\ud800';}]
 ];
 for(const [name,change]of tests){const x=sample('qualification');change(x);x.write();assert.throws(()=>validateEnvelope(x),undefined,name);results.push({name,positive:false});}
 for(const [name,change]of [
  ['trailing LF',s=>s+'\n'],['concatenated marker',s=>s+'NS_CI_SOURCE_PHASE=canonical-producer-v1'],['duplicate key',s=>s.replace('"scope":','"scope":"x","scope":')]
 ]){const x=sample('qualification');x.event.pull_request.body=change(x.event.pull_request.body);assert.throws(()=>validateEnvelope(x),undefined,name);results.push({name,positive:false});}
 for(const [name,mutation]of [
 ['Node pin changed',v=>v.replace('node-version: 24.21.0','node-version: 24.22.2')],
 ['full51 command removed',v=>v.replace('node "$script" --full','node "$script"')],
 ['producer timeout raised',v=>v.replace('45s node scripts/build-fantasy-ui.js','46s node scripts/build-fantasy-ui.js')],
 ['restoration removed',v=>v.replace('trap restore_on_exit EXIT','true')],
 ['browser omitted',v=>v.replace('browser: [chromium, webkit]','browser: [chromium]')],
 ['copy browser gate removed',v=>v.replace('node scripts/validate-onboarding-directories-browser.js','true')],
 ['artifact lifetime widened',v=>v.replace('retention-days: 1','retention-days: 2')]
 ]){const changed=mutation(text);assert.notEqual(changed,text,name+' mutation applies');assert.throws(()=>normaliseForwardWorkflow(changed),undefined,name);results.push({name,positive:false});}
 assert.throws(()=>replaceExact('611 611','611','612',1),'no blanket substitutions');
 return {scope:'raw source contract and synthetic metadata only',groups:results.length,results,boundVersionPlan,boundedReaders,restoredOriginalWorkflow:true,appImports:0,sourceBuilderRuns:0,liveRequests:0,releaseAcceptance:false};
}

// FWD-R1: real bound Git objects, not a fabricated worker or cache assumption.
function boundVersionPlanControls(){
 const cp=require('node:child_process'),{planVersioning}=require('./lib/forward-onboarding-ci');
 const fixture=JSON.parse(boundedRegularRead(path.join(__dirname,'fixtures/onboarding-forward-version-plan-20261107.json'),16384,sourceReadLedger).toString('utf8'));
 assert.equal(fixture.schemaVersion,'onboarding-forward-version-plan.v1');assert.equal(fixture.productHead,POLICY.productHead);
 const inputs={};
 for(const [name,d]of Object.entries(fixture.inputs)){
  assert(typeof d.path==='string'&&!d.path.includes(':')&&!d.path.includes('..'));assert(Number.isSafeInteger(d.bytes)&&d.bytes>=0&&d.bytes+1<=4*1024*1024);
  assert(d.bytes+1<=sourceReadLedger.limit-sourceReadLedger.used,'bound expected child stdout and overrun inside existing metadata cap');
  const bytes=cp.execFileSync('git',['show',POLICY.productHead+':'+d.path],{cwd:path.resolve(__dirname,'..'),timeout:5000,maxBuffer:d.bytes+1,stdio:['ignore','pipe','pipe']});
  sourceReadLedger.used+=bytes.length;assert.equal(bytes.length,d.bytes);assert.equal(hash(bytes),d.sha256,'exact reviewed source object '+d.path);inputs[name]=bytes;
 }
 const planned=planVersioning(inputs);assert.deepEqual([...planned.keys()],['index.html','service-worker.js','app-version.json']);
 for(const [p,d]of Object.entries(fixture.expected)){const bytes=planned.get(p);assert(bytes);assert.equal(bytes.length,d.bytes);assert.equal(hash(bytes),d.sha256,'entire expected output '+p);}
 for(const [name,d]of Object.entries(fixture.inputs))assert.equal(hash(inputs[name]),d.sha256,'pure plan preserves input '+name);
 const worker=inputs.worker.toString('utf8'),next=planned.get('service-worker.js').toString('utf8');
 assert.equal(worker.split('/config/local-preference-recovery.js').length-1,0,'actual611 has no cached local recovery module');
 assert.equal(next.split('"/config/local-preference-recovery.js?v=612"').length-1,1,'one explicit612 addition');
 assert.equal(next.split('"/config/preference-reset-ui.js?v=612"').length-1,1,'existing reset module advances once');
 const originalPredicate=worker.match(/^const REQUIRED_SHELL = .*;$/m)?.[0];assert(originalPredicate);assert(next.includes(originalPredicate),'required install/cache policy unchanged');
 assert(next.includes('"/assets/js/app-update.js?v=533"'),'unrelated module query preserved');
 const cases=[
 ['worker byte drift',v=>{v.worker=Buffer.concat([v.worker,Buffer.from('\n')]);}],
 ['pre-existing recovery cache member is not accepted611',v=>{v.worker=Buffer.from(v.worker.toString().replace('const APP_SHELL = [','const APP_SHELL = [\n  "/config/local-preference-recovery.js?v=611",'));}],
 ['index drift',v=>{v.index=Buffer.concat([v.index,Buffer.from(' ')]);}],
 ['app-version format/version drift',v=>{v.appVersion=Buffer.from('{"version":"610"}\n');}],
 ['missing recovery asset',v=>{delete v.recoveryAsset;}],
 ['recovery asset byte drift',v=>{v.recoveryAsset=Buffer.concat([v.recoveryAsset,Buffer.from(' ')]);}]
 ];
 for(const [name,change]of cases){const sample={...inputs};change(sample);assert.throws(()=>planVersioning(sample),undefined,name);}
 return {scope:'bound product611 raw inputs through real pure version plan',groups:cases.length+1,negativeNames:cases.map(x=>x[0]),sourceObjectReads:Object.keys(inputs).length,expectedOutputs:Object.keys(fixture.expected),cacheAssetBytes:4120,appRuntimeImports:0,providerRequests:0,releaseAcceptance:false};
}
// FWD-R2: closed descriptor simulation, fixed small buffers, no actual race or2GiB claim.
function boundedReaderControls(){
 const results=[];
 function setup({reported=3,data='abc',maximum=64,limit=128,used=0,short=Infinity,throwRead=false,finalDrift=false,beforeDrift=false,parentLink=false,symlink=false}={}){
  const state={data:Buffer.isBuffer(data)?data:Buffer.from(data),opened:0,closed:0,requested:[],actual:0,fstats:0};
  const stat=()=>({dev:1,ino:2,mode:0o100644,uid:1000,gid:1000,size:reported,mtimeMs:1,ctimeMs:1,isFile:()=>!symlink,isSymbolicLink:()=>symlink});
  const io={constants:{O_RDONLY:0,O_NOFOLLOW:1},realpathSync:p=>parentLink?'/different-parent':p,lstatSync:()=>stat(),openSync:()=>{state.opened++;return 7;},fstatSync:()=>{state.fstats++;const st=stat();if((beforeDrift&&state.fstats===1)||(finalDrift&&state.fstats===2))st.ino++;return st;},closeSync:fd=>{assert.equal(fd,7);state.closed++;},readFileSync:()=>{throw Error('unbounded read is forbidden');},readSync:(fd,dest,offset,length,position)=>{
   assert.equal(fd,7);assert(length>0&&length<=65536);state.requested.push(length);if(throwRead)throw Error('injected read failure');
   const count=Math.min(length,short,Math.max(0,state.data.length-position));if(count)state.data.copy(dest,offset,position,position+count);state.actual+=count;return count;
  }};
  const ledger={used,limit},run=()=>boundedRegularRead('/virtual/input',maximum,ledger,io);return {state,ledger,run,used};
 }
 function positive(name,options,expected){const x=setup(options),bytes=x.run();assert.equal(bytes.toString(),expected);assert.equal(x.ledger.used-x.used,x.state.actual);assert.equal(x.state.opened,1);assert.equal(x.state.closed,1);results.push({name,positive:true,actualBytes:x.state.actual});}
 function negative(name,options,guard,{opened=1,actual}={}){const x=setup(options);assert.throws(x.run,guard,name);assert.equal(x.state.opened,opened);assert.equal(x.state.closed,opened,'all opened descriptors close even on rejection');assert.equal(x.ledger.used-x.used,x.state.actual,'actual consumed bytes stay charged');if(actual!==undefined)assert.equal(x.state.actual,actual);assert(x.ledger.used<=x.ledger.limit);results.push({name,positive:false,actualBytes:x.state.actual});}
 positive('stable ordinary input',{reported:3,data:'abc'},'abc');
 positive('empty input with reserved EOF probe',{reported:0,data:''},'');
 positive('short reads do not retry from the start',{reported:6,data:'abcdef',short:2},'abcdef');
 positive('exact reservation fits without raising cumulative cap',{reported:2,data:'ab',maximum:3,limit:3},'ab');
 const chunks=setup({reported:65540,data:Buffer.alloc(65540,97),maximum:65542,limit:65542});assert.equal(chunks.run().length,65540);assert.deepEqual(chunks.state.requested,[65536,4,1]);assert.equal(chunks.ledger.used,65540);assert.equal(chunks.state.closed,1);results.push({name:'fixed64KiB chunks plus one-byte EOF probe',positive:true,actualBytes:65540});
 negative('concurrent growth consumes only reserved probe',{reported:2,data:Buffer.alloc(65540,97),maximum:3,limit:3},/file grew/,{actual:3});
 negative('concurrent shrink fails without another full read',{reported:3,data:'a'},/file shrank/,{actual:1});
 negative('probe cannot exceed remaining cumulative allowance',{reported:2,data:'ab',limit:2},/reserve content and overrun probe/,{opened:0,actual:0});
 negative('exact per-file cap has no probe headroom',{reported:3,data:'abc',maximum:3},/one-byte overrun probe/,{opened:0,actual:0});
 negative('oversize refused before open/allocation',{reported:65,data:'',maximum:64},/one-byte overrun probe/,{opened:0,actual:0});
 negative('input symlink refused before open',{symlink:true},/regular no-follow/,{opened:0,actual:0});
 negative('linked parent refused before open',{parentLink:true},/no symlinked parent/,{opened:0,actual:0});
 negative('descriptor identity mismatch closes before read',{beforeDrift:true},/stable descriptor before/,{actual:0});
 negative('late descriptor drift still closes',{finalDrift:true},/stable descriptor after/,{actual:3});
 negative('read exception always closes',{throwRead:true},/injected read failure/,{actual:0});
 negative('no raised cumulative cap',{limit:2*1024*1024*1024+1},/unchanged cumulative maximum/,{opened:0,actual:0});
 negative('no raised per-file cap',{maximum:256*1024*1024+1},/unchanged per-file maximum/,{opened:0,actual:0});
 return {scope:'shared new-forward bounded reader in closed IO mocks only',groups:results.length,results,unchangedFileMaximum:256*1024*1024,unchangedReadMaximum:2*1024*1024*1024,probeInsideExistingLimits:true,actualFilesystemRaceProven:false,appImports:0,providerRequests:0,releaseAcceptance:false};
}

if(require.main===module)console.log(JSON.stringify(sourceControls(boundedRegularRead(path.resolve('.github/workflows/installed-upgrade-tests.yml'),256*1024*1024,sourceReadLedger).toString('utf8'))));
module.exports={normaliseForwardWorkflow,sourceControls,boundVersionPlanControls,boundedReaderControls};
