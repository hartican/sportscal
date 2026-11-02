#!/usr/bin/env node
'use strict';
// Offline actual quick owner. Only source adapters and unrelated child gates
// are replaced; MLB generation, narrative application and Feed publisher are real.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),cp=require('node:child_process');
const root=process.env.NS_MLB_SOURCE_ROOT||path.resolve(__dirname,'..');
const evidence=process.env.NS_MLB_TEST_EVIDENCE||fs.mkdtempSync(path.join(os.tmpdir(),'ns-mlb-quick-'));
const sandbox=path.join(evidence,'sandbox'),read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const source=file=>path.join(root,file),write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
fs.mkdirSync(sandbox,{recursive:true});
const relative=['feeds/incoming/events.json','data/events.json','data/editorial-knowledge.v1.json'];
const inputRoot=process.env.NS_MLB_BASELINE_ROOT||root;
const originals=relative.map(file=>read(path.join(inputRoot,file)));
const frozen=read(source('scripts/fixtures/mlb-quick-editorial-849800-f045.json'));
assert.equal(frozen.source.commit,'f045371efacbad82c39893b1e0a6e48bc992228c');
assert.equal(frozen.source.blob,'63447420d624653b1600fa52633f9f939e3c2960');
assert.equal(frozen.source.sha256,'023fb6c838ab9b2e91c4489524dae2e8c3da5a35ec55151545bfad946580ee38');
const now=new Date(frozen.testReference),target=structuredClone(frozen.fixture);
assert.equal(now.toISOString(),'2026-10-31T23:22:29.803Z','Genuine retained focused-test clock only; never the current catalogue audit clock');
const aliases=new Set([target.id,target.eventId,target.canonicalEventId]);
const matchesTarget=event=>[event.id,event.eventId,event.canonicalEventId].some(id=>aliases.has(id));
function fixtureBaseline(document){
 const index=document.events.findIndex(matchesTarget),events=document.events.filter(event=>!matchesTarget(event));
 events.splice(index<0?events.length:index,0,structuredClone(target));
 return {...document,events};
}
function missingKnowledge(document){
 const value=structuredClone(document);
 value.eventProjections=value.eventProjections.filter(p=>p.targetType!=='feed-event'||!p.targetIds.some(id=>aliases.has(id)));
 return value;
}
const baseline=fixtureBaseline(originals[1]),knowledge=missingKnowledge(originals[2]);
const inputTarget=originals[1].events.find(matchesTarget);
const populatedInput=Boolean(inputTarget?.editorialNarrative?.hook&&inputTarget?.editorialPreview?.status==='journalistic');
if(process.env.NS_MLB_REQUIRE_ADOPTED_BASELINE==='1')assert(populatedInput,'Durability run must start from legitimately adopted visible copy');
assert.deepEqual(fixtureBaseline(originals[1]),fixtureBaseline(baseline),'Absent and already-populated source cards produce the same frozen test-owned reproduction');
assert.equal(target.status,'upcoming');assert.equal(target.scheduleStatus,'conditional');assert.equal(target.startTimeUtc,null);
assert(!target.editorialNarrative,'Reproduction requires the missing narrative');
const {createRequire}=Module,resolver=createRequire(source('scripts/build-app-shell-runtime.js'));
const terserEntry=fs.realpathSync(resolver.resolve('terser'));
assert.equal(terserEntry,fs.realpathSync(process.env.NS_MLB_TERSER_ENTRY||require.resolve('terser')),'Exact caller must bind the approved dependency root');
const declared=read(source('package.json')),terser=read(path.join(path.dirname(terserEntry),'../package.json'));
assert.equal(terser.version,declared.devDependencies?.terser||declared.dependencies?.terser,'Automatic checks retain the exact committed Terser pin');
for(const name of ['scripts','config','lib'])fs.symlinkSync(source(name),path.join(sandbox,name),'dir');
fs.mkdirSync(path.join(sandbox,'data'),{recursive:true});
for(const entry of fs.readdirSync(source('data'),{withFileTypes:true})){
 if(['events.json','events.js','feed-meta.json','editorial-knowledge.v1.json','canonical'].includes(entry.name))continue;
 fs.symlinkSync(source('data/'+entry.name),path.join(sandbox,'data',entry.name),entry.isDirectory()?'dir':'file');
}
fs.mkdirSync(path.join(sandbox,'data/canonical'),{recursive:true});
for(const entry of fs.readdirSync(source('data/canonical'),{withFileTypes:true})){
 if(entry.name==='official-card-results-2026.json')continue;
 fs.symlinkSync(source('data/canonical/'+entry.name),path.join(sandbox,'data/canonical',entry.name),entry.isDirectory()?'dir':'file');
}
const official=read(source('data/canonical/official-card-results-2026.json'));
write(path.join(sandbox,'data/canonical/official-card-results-2026.json'),{...official,feedVersion:baseline.version});
write(path.join(sandbox,'data/feed-meta.json'),read(source('data/feed-meta.json')));
const reset=(events=baseline.events,k=knowledge)=>{
 for(const file of relative.slice(0,2))write(path.join(sandbox,file),{...baseline,events:structuredClone(events)});
 write(path.join(sandbox,relative[2]),structuredClone(k));
};
reset();
const quick=require(source('scripts/quick-results')),mlb=require(source('lib/mlb-postseason')),child=require(source('scripts/lib/refresh-child'));
const writer=require(source('scripts/update-sport-editorial-depth')),api=require(source('scripts/lib/editorial-narrative'));
const quality=require(source('scripts/lib/editorial-preview-quality')),story=require(source('scripts/lib/storyline-card-rules'));
const locks=require(source('config/editorial-locks')),depth=require(source('scripts/lib/editorial-research-depth')).researchDepthFor;
const old={cwd:process.cwd(),refresh:mlb.refresh,run:child.run,load:Module._load,repairMissing:writer.repairMissing};
const trace=[],controls=[],observed=()=>read(path.join(sandbox,'data/events.json'));
const facts=event=>Object.fromEntries(Object.entries(event).filter(([key])=>!['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','storyline','lastReviewedAt'].includes(key)));
const snapshots=()=>relative.map(file=>fs.readFileSync(path.join(sandbox,file),'utf8'));
let publishers=0;
mlb.refresh=async()=>({changed:false,checkedAt:target.sourceCheckedAt,fixtureCount:1});
child.run=(executable,args,options)=>{
 trace.push(args);
 if(args[0]==='scripts/publish-feed.js'){
  const before=observed().events.find(e=>e.id===target.id);
  assert.equal(before.editorialPreview.status,'journalistic','Generation/application precede actual publication');
  assert(api.projectionForTarget(read(path.join(sandbox,relative[2])),'feed-event',before),'Knowledge exists before publication');
  publishers++;
  return cp.spawnSync(executable,args,{...options,cwd:sandbox,encoding:'buffer',timeout:8000});
 }
 return {status:0,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)};
};
(async()=>{
 try{
  process.chdir(sandbox);
  assert.equal(depth(target),2);assert.equal(require(source('config/promoted-replay')).recommendation(target),null);
  await quick.refresh({source:'mlb',now});
  let card=observed().events.find(e=>e.id===target.id);
  assert.equal(card.editorialPreview?.status,'journalistic','quick MLB must generate and apply missing approved World Series copy even when ingestion is unchanged');
  controls.push('RED-capable actual source=mlb unchanged-ingestion repair');
  assert.equal(publishers,1,'Repaired copy reaches the actual retained publisher');
  assert.deepEqual(facts(card),facts(target));
  assert.match(card.selectedSentence,/if needed/);assert.match(card.fullSpiel,/best-of-seven/);assert.match(card.fullSpiel,/first team to 4 wins takes the World Series title/);
  assert.deepEqual(quality.editorialPreviewIssues(card,4,now),[]);
  assert.equal(story.RESULT_LEAK.test(card.selectedSentence+'\n'+card.fullSpiel),false);
  assert.deepEqual(story.spoilerContractIssues(card),[]);
  for(const file of relative.slice(0,2)){
   const after=read(path.join(sandbox,file));
   assert.deepEqual(after.events.filter(e=>e.id!==target.id),baseline.events.filter(e=>e.id!==target.id),'Unrelated cards, scores, source clocks and protected NRL preview stay exact');
  }
  controls.push('real knowledge -> both surfaces -> real publisher; exact facts/clocks and unrelated cards; Results OFF');
  const first=snapshots();await quick.refresh({source:'mlb',now:new Date(+now+60000)});
  assert.deepEqual(snapshots(),first);assert.equal(publishers,1,'No timestamp-only publish on second run');
  controls.push('byte-stable rerun without repeat publication');

  // Every mutation below is synthetic and exists only inside this test sandbox.
  const small=(event,k=knowledge)=>reset([event],k);
  const repairedKnowledge=read(path.join(sandbox,relative[2]));
  const repairedCard=structuredClone(card);
  const repair=()=>writer.repairMlbMissing({reference:now,root:sandbox});
  for(const patch of [
   {canonicalEventId:'fixture:mlb:unknown'},{sourceName:'Unreviewed'},{sourceType:'trusted'},
   {sourceUrl:'https://example.invalid/game'},{season:2027},{roundLabel:'Unreviewed final Game 7'},
   {participantsConfirmed:false},{participants:[]},{homeParticipantId:'team:mlb:999'},
   {status:'completed'},{isFinals:true}
  ]){
   const event={...structuredClone(target),...patch};small(event);
   const before=snapshots();repair();assert.deepEqual(snapshots(),before,'Rejected input cannot acquire copy: '+JSON.stringify(patch));
  }
  controls.push('unknown/wrong identities/sources, unconfirmed participants, completed and meaningful depth5 rejected');
  for(const status of ['cancelled','postponed','suspended']){
   const event={...structuredClone(target),status};small(event);repair();
   const current=observed().events[0];assert.match(current.selectedSentence,new RegExp('is '+status));
   assert.deepEqual(facts(current),facts(event));assert.deepEqual(story.spoilerContractIssues(current),[]);
  }
  controls.push('cancelled/postponed/suspended status and facts retained');
  const locked={...structuredClone(target),sourceEventIds:[...target.sourceEventIds,'event:f1:2026:singapore:race']};
  assert(locks.activeFor(locked),'Synthetic alias exercises actual explicit lock resolution');
  small(locked);const lockedBefore=snapshots();repair();assert.deepEqual(snapshots(),lockedBefore);
  controls.push('actual explicit lock aliases block repair; no private hold authority inferred');
  small(repairedCard,repairedKnowledge);const retainedBefore=snapshots();repair();assert.deepEqual(snapshots(),retainedBefore);
  controls.push('existing sourced projection and researched copy retained');
  const deeper=structuredClone(repairedKnowledge),projection=api.projectionForTarget(deeper,'feed-event',target);
  projection.id='projection:mlb:independent-deeper';projection.formCopy='Existing independently researched form remains unchanged.';projection.closingCopy='Existing independently researched championship history remains unchanged.';
  // Existing deeper work is retained, never regenerated or downgraded. The
  // source document remains a separately validated release-gate obligation.
  small({...repairedCard,editorialNarrative:{...repairedCard.editorialNarrative,formCopy:projection.formCopy,closingCopy:projection.closingCopy}},deeper);
  const deeperBefore=snapshots();repair();assert.deepEqual(snapshots(),deeperBefore);
  controls.push('complete four-section copy is not replaced by format context');
  small(target,repairedKnowledge);repair();assert.equal(observed().events[0].editorialPreview.status,'journalistic');
  assert.deepEqual(read(path.join(sandbox,relative[2])),repairedKnowledge,'Existing projection applied without regeneration');
  controls.push('existing projection supplies missing visible metadata');
  small({...target,sourceCheckedAt:'2026-13-40T00:00:00Z'});
  const invalidBefore=snapshots(),invalid=repair();assert.equal(invalid.changed,false);assert.match(invalid.deferred[0].reason,/dated source observation/);assert.deepEqual(snapshots(),invalidBefore);
  controls.push('invalid observation deferred before writes without blocking independent cards');

  // Exercise the real general offline quick route, with unrelated adapters
  // inert. No sporting source or non-MLB writer runs in this focused rehearsal.
  reset();
  const mocks=new Map([
   ['./lib/football-directory-maintenance',{refreshDue:async()=>({changed:false,deferred:[]})}],
   ['./refresh-tournament-hydration',{refresh:async()=>({changed:[]})}],
   ['./lib/f1-source-provenance',{applyRetained:()=>[]}],
   ['./lib/skiing-calendar-review',{applyRetained:()=>[]}],
   ['./lib/reviewed-calendar-notes',{applyRetained:()=>[]}],
   ['./apply-reviewed-nations-finals',{publish:()=>({changed:false})}],
   ['./refresh-fixture-highlights',{refresh:async()=>({})}],
   ['./lib/reconcile-fixture-results',{reconcileFiles:()=>({changed:[]})}],
   ['./lib/refresh-report',{update:()=>{}}]
  ]);
  const officialApi=require(source('scripts/sync-official-card-results')),applyOfficial=officialApi.applyOfficialResults;
  officialApi.applyOfficialResults=events=>({events,count:0});
  writer.repairMissing=()=>({changed:false,repaired:[]});
  Module._load=function(request,parent,isMain){return parent?.filename===source('scripts/quick-results.js')&&mocks.has(request)?mocks.get(request):old.load.apply(this,arguments);};
  try{await quick.refresh({offline:true,now});}finally{Module._load=old.load;officialApi.applyOfficialResults=applyOfficial;writer.repairMissing=old.repairMissing;}
  assert.equal(observed().events.find(e=>e.id===target.id).editorialPreview.status,'journalistic');
  controls.push('actual general offline quick route repairs missing MLB copy');
  // Re-stage the frozen absence after a real successful owner publication,
  // not after a hand-assembled journalistic marker. Re-run that same owner.
  const adopted=observed(),adoptedKnowledge=read(path.join(sandbox,relative[2]));
  assert.equal(adopted.events.find(matchesTarget).editorialPreview.status,'journalistic');
  const replay=fixtureBaseline(adopted);
  reset(replay.events,missingKnowledge(adoptedKnowledge));
  await quick.refresh({source:'mlb',now});
  const replayed=observed().events.find(matchesTarget);
  assert.equal(replayed.editorialPreview.status,'journalistic');
  assert.deepEqual(facts(replayed),facts(target));
  assert.deepEqual(observed().events.filter(event=>!matchesTarget(event)),adopted.events.filter(event=>!matchesTarget(event)));
  controls.push('durable absent reproduction after legitimate actual-owner adoption, using exact frozen facts');
  write(path.join(evidence,'focused-result.json'),{status:'PASS',controls,publishers,trace,sandbox,populatedInput,testReference:frozen.testReference,fixtureSource:frozen.source,privateHoldProof:'Not exercised: private authority remains an upstream mandatory release gate.',unrelatedChildGates:'Not executed in this focused test; recorded inert. Full release gates remain required.'});
  console.log('MLB quick editorial focused controls passed: '+controls.length);
 }finally{
  process.chdir(old.cwd);mlb.refresh=old.refresh;child.run=old.run;Module._load=old.load;writer.repairMissing=old.repairMissing;
  write(path.join(evidence,'focused-trace.json'),{trace,controls,publishers,cleanup:'cwd and all injected adapters/child dispatcher restored; isolated frozen-clock test fixtures retained as evidence; no current catalogue audit rerun'});
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
