#!/usr/bin/env node
'use strict';
// Corrective source/generated-helper SDK discriminator; historical608 report preserved. No real account,
// browser, provider or production access. Historical shapes below are hypotheses,
// never asserted to be Jack's private saved state or permission to broaden guards.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),clone=x=>JSON.parse(JSON.stringify(x)),read=p=>fs.readFileSync(path.join(root,p));
const inputBytes=read('scripts/fixtures/sync608-reported-hold-20261103.json'),input=JSON.parse(inputBytes);
const phaseArgs=process.argv.slice(2);
assert(phaseArgs.length===0||(phaseArgs.length===1&&phaseArgs[0]==='--priority-source-only'),'unknown diagnostic phase argument');
const sourceOnly=phaseArgs.length===1;
const sourceOnlyPaths=[".github/workflows/installed-upgrade-tests.yml","api/user-state.js","config/account-sync-diagnostic.js","config/competition-classification.js","config/coverage-pauses.js","config/cricket-coverage.js","config/discovery-catalogue.js","config/event-action-identity.js","config/event-taxonomy-compat.js","config/fantasy-deadlines.js","config/fantasy-preferences.js","config/feed-controls.js","config/fixture-identity.js","config/fixture-labels.js","config/follow-feed-policy.js","config/follow-first.js","config/national-team-identities.js","config/odi-display.js","config/preference-intent-reconcile.js","config/preference-system.js","config/preference-taxonomy.js","config/profile-storage.js","config/racing-details.js","config/rating-system.js","config/reviewed-fixture-repairs.js","config/selector-taxonomy.js","config/server-sync.js","config/sport-domain-registry.js","config/sport-hierarchy.js","config/tennis-feed.js","config/tournament-schedule.js","config/user-state-sync.js","index.html","lib/horse-follow-rollout.js","lib/supabase-server.js","package-lock.json","package.json","scripts/lib/local-user-state-api.js","scripts/lib/user-state-optional-view-tests.js","scripts/lib/user-state-selection-writer-tests.js","scripts/validate-sync608-reported-hold.js"];
let sourceOnlyProof=null,sourceOnlyCi=null,sourceOnlyCiStarted=false,sourceOnlyExpectedRed=null;
// Packaging must freeze exact combined afterimage pins before any VM/SDK test.
// Unassigned values fail closed; never substitute the old standalone helper.
const epoch=input.executionBinding?.shellVersion;
function validatePrioritySourceBinding(){
 const binding=input.sourceOnlyBinding;
 assert(binding&&binding.format==='grey-source-only-binding.v1','separate source-only binding required');
 assert.equal(binding.baseCommit,'037a6214c1a573b57298d3ea504de0b89e31d473');
 assert.equal(binding.baseTree,'280373883f9f42d52042e92ae7f51befe4e3e554');
 assert.equal(binding.sourcePlannerSha256,'81795bd8410eec4a85c89cfd0a588ab438f92b8fd9961bd55fc5467d5ce5921a');
 assert.equal(binding.acceptedPlannerSha256,'8c826f82cd65795165c47a7fe418ecfccaa828acbc058d26ea458351880f8b3b');
 assert.deepEqual(input.priorityCases,['new-grey-remote-prompt','raw-taxonomy-null-new-grey-remote-prompt','raw-taxonomy-null-new-grey-prompt-R2','raw-taxonomy-null-new-grey-prompt-ACK-mismatch','new-grey-prompt-local-change','new-grey-prompt-unknown-remote','new-grey-prompt-selection-conflict']);
 assert.equal(binding.sourceArms?.planned,14);assert.equal(binding.sourceArms?.firstFailureStops,true);assert.deepEqual(binding.sourceArms?.modes,['accepted-planner','source']);assert.deepEqual(binding.sourceArms?.patterns,input.priorityCases);
 assert(binding.files&&typeof binding.files==='object'&&!Array.isArray(binding.files));
 assert.deepEqual(Object.keys(binding.files).sort(),sourceOnlyPaths,'exact closed source-only input set');
 for(const [file,digest]of Object.entries({
  'index.html':'168e9febe4ccb809ec554f956137d913d4a9ac0b4908288778c4458d20520e79',
  'config/server-sync.js':'db405f737e238395f677b53ef74692f56f300464b6f2e05daa00a5275a9eeca2',
  'config/preference-intent-reconcile.js':'81795bd8410eec4a85c89cfd0a588ab438f92b8fd9961bd55fc5467d5ce5921a',
  'package-lock.json':'89cf5f60178d8d6abe31bf7e9d308fae7d1f52a7889f1aade19510112b92c572',
  '.github/workflows/installed-upgrade-tests.yml':'e2afebbf49c5f989a2ed58c0874cb7d8b3d35f2e44cd282815281ce73eb87c4d'
 }))assert.equal(binding.files[file]?.sha256,digest,'accepted source-only anchor '+file);
 const realRoot=fs.realpathSync(root),leaves=[];
 for(const file of sourceOnlyPaths){
  const expected=binding.files[file];assert(expected&&typeof expected==='object'&&!Array.isArray(expected));assert.deepEqual(Object.keys(expected).sort(),['bytes','sha256'],'exact source pin fields '+file);assert(Number.isSafeInteger(expected.bytes)&&expected.bytes>0&&typeof expected.sha256==='string'&&/^[a-f0-9]{64}$/.test(expected.sha256),'no missing/NULL source pin '+file);
  const full=fs.realpathSync(path.join(root,file));assert(full.startsWith(realRoot+path.sep),'source must stay inside candidate '+file);assert(fs.statSync(full).isFile());
  const body=fs.readFileSync(full),digest=crypto.createHash('sha256').update(body).digest('hex');
  assert.equal(body.length,expected.bytes,'exact source size '+file);assert.equal(digest,expected.sha256,'exact source bytes '+file);
  leaves.push({path:file,bytes:body.length,sha256:digest});
 }
 assert.equal(binding.runtime?.node,'v24.21.0');assert.equal(binding.runtime?.platform,'linux');assert.equal(binding.runtime?.arch,'x64');
 assert.equal(process.version,binding.runtime.node);assert.equal(process.platform,binding.runtime.platform);assert.equal(process.arch,binding.runtime.arch);
 assert.equal(process.env.GITHUB_ACTIONS,'true','source-only phase is bound to admitted existing CI');assert.equal(process.env.GITHUB_JOB,'fixture-activation');assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
 assert(/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||''),'outer CI tested source identity required');
 const lock=JSON.parse(read('package-lock.json')),locked=lock.packages?.['node_modules/acorn'];
 assert.equal(binding.acorn?.version,'8.18.0');assert.equal(binding.acorn?.integrity,'sha512-lGq+9yr1/GuAWaVYIHRjvvySG5/4VfKIvC8EWxStPdcDh/Ka7FG3twP6v4d5BkravUilhIAsG4Qj83t02LWUPQ==');
 assert.equal(locked?.version,binding.acorn.version);assert.equal(locked?.integrity,binding.acorn.integrity);
 const packageFile=fs.realpathSync(require.resolve('acorn/package.json')),packageRoot=path.dirname(packageFile),entry=fs.realpathSync(require.resolve('acorn'));
 assert.equal(packageRoot,path.join(realRoot,'node_modules','acorn'),'use candidate npm-ci Acorn only, no global/cache alias');assert(entry.startsWith(packageRoot+path.sep));
 const packageBody=fs.readFileSync(packageFile),entryBody=fs.readFileSync(entry);assert.equal(JSON.parse(packageBody).version,binding.acorn.version);
 const fixtureSha256=crypto.createHash('sha256').update(inputBytes).digest('hex');
 assert.equal(crypto.createHash('sha256').update(read('scripts/fixtures/sync608-reported-hold-20261103.json')).digest('hex'),fixtureSha256,'same fixture bytes parsed and admitted');
 return {baseCommit:binding.baseCommit,baseTree:binding.baseTree,sourceLeaves:leaves,fixtureSha256,
  ci:{testedSha:process.env.GITHUB_SHA,job:process.env.GITHUB_JOB,runId:process.env.GITHUB_RUN_ID||null,treeBinding:'Existing PUBLISH exact tested SHA/tree and frozen fixture/validator/source-context receipt; not inferred by this script.'},
  runtime:{node:process.version,platform:process.platform,arch:process.arch,executableSha256:crypto.createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'),limits:'Existing admitted CI platform/timeout; no independent kernel/RSS quota claim.'},
  dependency:{name:'acorn',version:binding.acorn.version,lockIntegrity:binding.acorn.integrity,packageJsonPath:path.relative(realRoot,packageFile),packageJsonSha256:crypto.createHash('sha256').update(packageBody).digest('hex'),entryPath:path.relative(realRoot,entry),entrySha256:crypto.createHash('sha256').update(entryBody).digest('hex'),integrityBasis:'Existing locked npm ci in reviewed workflow, expected lock integrity/version and installed candidate-local identity. No tarball integrity recomputation or cache borrowing claimed.'}};
}
function prioritySourceInputsUnchanged(proof){
 for(const leaf of proof.sourceLeaves){const body=read(leaf.path);assert.equal(body.length,leaf.bytes,'unchanged source size '+leaf.path);assert.equal(crypto.createHash('sha256').update(body).digest('hex'),leaf.sha256,'unchanged source bytes '+leaf.path);}
 assert.equal(crypto.createHash('sha256').update(read('scripts/fixtures/sync608-reported-hold-20261103.json')).digest('hex'),proof.fixtureSha256,'unchanged source-only fixture');
 for(const [file,digest]of [[proof.dependency.packageJsonPath,proof.dependency.packageJsonSha256],[proof.dependency.entryPath,proof.dependency.entrySha256]])assert.equal(crypto.createHash('sha256').update(read(file)).digest('hex'),digest,'unchanged admitted Acorn '+file);
 return true;
}
if(sourceOnly){
 try{
  sourceOnlyProof=validatePrioritySourceBinding();
  sourceOnlyCiStarted=true;
  sourceOnlyCi=validateGreyOnlyCiContract(read('.github/workflows/installed-upgrade-tests.yml').toString(),input.sourceOnlyBinding.ciRegistration);
  assert.deepEqual(sourceOnlyCi,['missing priority step','duplicate priority step','altered priority step','moved priority step'],'four separately completed CI registration controls');
 }catch(error){
  console.error(JSON.stringify({format:'grey-priority-source-result.v1',phase:'priority-source-only',status:'SOURCE_OR_DEPENDENCY_OR_CI_PREFLIGHT_FAILED',plannedSourceArms:14,sourceArmsStarted:0,sourceArmsCompleted:0,ciContractStarted:sourceOnlyCiStarted,ciRegistrationNegativeControlsCompleted:sourceOnlyCi?.length??(sourceOnlyCiStarted?null:0),actualSource:sourceOnlyProof,message:error.message,generatedProof:false,defaultFullProof:false,releaseAcceptance:false}));
  throw error;
 }
}else{
assert(typeof epoch==='string'&&/^[0-9]+$/.test(epoch)&&Number.isSafeInteger(Number(epoch))&&Number(epoch)>609,'forward shell allocation is required before execution');
for(const [file,digest] of Object.entries(input.sourceFiles)){
 assert(typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest),'exact corrective pin required: '+file);
 assert.equal(crypto.createHash('sha256').update(read(file)).digest('hex'),digest,'exact corrective input '+file);
}
}
const fixture=require('./lib/user-state-selection-writer-tests'),profile=require('../config/profile-storage');
const transport=require('../config/server-sync'),systems=require('../config/preference-system'),localApi=require('./lib/local-user-state-api');
const repairedKinds=new Set(['canonical','raw-afl-marker-absent','raw-taxonomy-null','raw-taxonomy-null-same-selection','raw-taxonomy-null-R2',
 'new-grey-remote-prompt','raw-taxonomy-null-new-grey-remote-prompt','raw-taxonomy-null-new-grey-prompt-R2']);
const ratingSystem=require('../config/rating-system');
// Exact public accepted-planner bytes, not customer input or a rewritten model.
assert.deepEqual(input.priorityCases,['new-grey-remote-prompt','raw-taxonomy-null-new-grey-remote-prompt','raw-taxonomy-null-new-grey-prompt-R2','raw-taxonomy-null-new-grey-prompt-ACK-mismatch','new-grey-prompt-local-change','new-grey-prompt-unknown-remote','new-grey-prompt-selection-conflict'],'finite seven-case priority allocation');
const acceptedPlanner=Buffer.from(input.acceptedPlannerWitness.sourceText,'utf8');
assert.equal(acceptedPlanner.length,input.acceptedPlannerWitness.bytes);
assert.equal(crypto.createHash('sha256').update(acceptedPlanner).digest('hex'),input.acceptedPlannerWitness.sha256);
assert.equal(input.acceptedPlannerWitness.sha256,'8c826f82cd65795165c47a7fe418ecfccaa828acbc058d26ea458351880f8b3b');
const results=[],failures=[],html=read('index.html').toString(),generated=sourceOnly?null:read('assets/js/account-awareness-runtime.js').toString();
if(!sourceOnly){assert(html.includes('assets/js/app-shell-runtime.js?v='+epoch)&&html.includes('assets/js/account-awareness-runtime.js?v='+epoch),'exact allocated main/helper paths');}
for(const name of ['setDirectoryEntityFollow','buildDirectoryFollowButton','savePreferences','followDiscoverySport'])assert(html.includes('function '+name+'('),'actual shipped inline writer '+name);
function select(c,p,ids){p.selectedSelectorEntityIds=c.normalizeSelectorEntityIds(ids);p.followedSports=c.canonicalSportKeysForSelectorIds(ids);p.taxonomySelection=c.taxonomySelectionForSelectorIds(ids);}
function element(){return {dataset:{},attributes:{},handlers:{},classList:{toggle(){}},closest:()=>null,setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.handlers[k]=v;}};}
function selectionShape(p){return {selectedPresent:Object.hasOwn(p,'selectedSelectorEntityIds'),followedPresent:Object.hasOwn(p,'followedSports'),taxonomyPresent:Object.hasOwn(p,'taxonomySelection'),taxonomyObject:p.taxonomySelection!==null&&typeof p.taxonomySelection==='object'&&!Array.isArray(p.taxonomySelection),aflMigrationPresent:Object.hasOwn(p,'aflFamilyMigration'),aflMigrationNull:p.aflFamilyMigration===null};}
async function run(mode,kind){
 const {c,values,base}=fixture.setup(),api=localApi('A',{calendarHandler(){throw Error('Unexpected calendar route');}}),sdkCalls=[],authStore=new Map(),facts=[],stages=[];let newer=null;
 const grey=(input.priorityCases||[]).includes(kind),acceptedControl=mode==='accepted-planner',r2=kind==='raw-taxonomy-null-R2'||kind==='raw-taxonomy-null-new-grey-prompt-R2';
 if(acceptedControl){
  const prepared=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
  vm.runInContext(acceptedPlanner.toString('utf8'),c);
  assert.notEqual(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE,prepared,'exact accepted M4 planner loaded in a separate fixture context');
 }
 if(mode==='generated'){
  const sourcePlanner=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
  vm.runInContext(generated,c);
  assert.notEqual(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE,sourcePlanner,'actual generated helper replaces source helper; no later source overlay');
 }
 for(const name of ['localPreferenceRecoveryBlocked','invalidateServerStateSyncScope','serverStateSyncScope','reconcileCurrentServerState','syncCurrentServerState','applyServerStatePreservingChanges','acknowledgePreferenceReceipt','advancePreferenceReceiptBase','verifyPreferenceIntentBase','syncDirectoryFollowButton','buildDirectoryFollowButton'])vm.runInContext(fixture.declaration(name),c);
 Object.assign(c,{serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,startupSessionStateBaseline:null,setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_s,current)=>current,clearAcknowledgedFixturePinCommands(){},serverErrorEndsSession:e=>e.code==='invalid_refresh_token',followCollectionsById:()=>({}),NOTHINGSPORTS_CRICKET_COVERAGE:require('../config/cricket-coverage'),NOTHINGSPORTS_ACCOUNT_INDICATOR_APP:{beginDiagnostic:()=>({step:name=>stages.push(name),guard:fact=>facts.push(clone(fact)),fail(){},done(){}})}});
 const actualVerify=c.verifyPreferenceIntentBase;
 c.verifyPreferenceIntentBase=(receipt,state,life,current,observe)=>{
  const before=clone({receipt,state,current}),plan=actualVerify(receipt,state,life,current,observe);
  assert.deepEqual(clone({receipt,state,current}),before,'planner does not rewrite original receipt/base/current/remote');
  if(plan){assert.deepEqual(clone(plan.receipt.originalReceipt),before.receipt);assert.deepEqual(clone(plan.receipt.basePreferences),before.state.preferences,'conditional witness binds exact fresh raw remote');}
  return plan;
 };
 c.document.createElement=element;
 const storage={getItem:k=>authStore.get(k)??null,setItem:(k,v)=>authStore.set(k,String(v)),removeItem:k=>authStore.delete(k)};
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 const token='e30.'+Buffer.from(JSON.stringify({sub:'A'})).toString('base64url')+'.synthetic';
 const client=transport.createClient({storage,persistentStorage:storage,fetchImpl:async(url,opts={})=>{
  const method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):undefined;
  if(url==='/api/auth'){assert.equal(body.action,'password-sign-in');return response({session:{access_token:token,refresh_token:'owned-synthetic-refresh',expires_in:3600}});}
  assert.equal(url,'/api/user-state');assert.equal(opts.headers.Authorization,'Bearer '+token);
  const result=await api.handle({method,url,headers:{},body});sdkCalls.push({method,status:result.status});
  if(method==='PUT'&&result.status===200){
   if(kind==='ACK-mismatch'||kind==='raw-taxonomy-null-ACK-mismatch')select(c,result.body.state.preferences,[]);
   if(kind==='raw-afl-marker-ACK-mismatch')result.body.state.preferences.aflFamilyMigration={status:'pending'};
   if(kind==='raw-taxonomy-null-new-grey-prompt-ACK-mismatch'){
    const next=ratingSystem.startSession(result.body.state.preferences.ratingPromptState,'synthetic-wrong-ACK-session');
    result.body.state.preferences.ratingPromptState=ratingSystem.recordPrompt(next,'fixture:synthetic-wrong-ACK-prompt',{sessionId:'synthetic-wrong-ACK-session'});
   }
   if(r2&&!newer){c.saveFollowSport({selectorId:'sport:football'},false);newer=clone(c.pendingPreferenceIntent('A'));}
  }
  return response(result.body,result.status);
 }});
 try{
  await client.signIn('owned@example.invalid','owned-synthetic',{persist:false});c.serverSyncClient=client;c.serverPersistence={configured:true,state:'signedIn',user:{id:'A'}};
  const raw=clone(base);
  if(grey)raw.preferences.ratingPromptState=ratingSystem.emptyPromptState();
  if(kind.startsWith('raw-afl-marker-'))delete raw.preferences.aflFamilyMigration;
  if(kind==='raw-taxonomy-null-same-selection')select(c,raw.preferences,['sport:football']);
  if(kind.startsWith('raw-taxonomy-null'))raw.preferences.taxonomySelection=null;
  if(kind==='raw-taxonomy-missing')delete raw.preferences.taxonomySelection;
  api.seed(raw);const rawBase=api.state();c.setServerStateBaseline(rawBase);assert.equal(c.applyServerState(rawBase),true);
  if(kind.startsWith('raw-afl-marker-')){assert(!Object.hasOwn(rawBase.preferences,'aflFamilyMigration'));assert.equal(c.userPreferences.aflFamilyMigration,null,'actual discovery normalizer produces null from absent raw marker');}
  if(kind.startsWith('raw-taxonomy-null')){assert.equal(rawBase.preferences.taxonomySelection,null);assert(c.userPreferences.taxonomySelection&&typeof c.userPreferences.taxonomySelection==='object','actual merge derives taxonomy from raw null');}
  const view=clone(c.userPreferences);view.feedCompact=true;
  if(grey)view.followBrowse={sportId:'sport:football',categoryId:'',section:'teams-players',page:1,scheduleScope:null};
  assert(c.savePreferences(view,{viewOnly:true}));
  if(kind!=='raw-taxonomy-null-same-selection')assert.notEqual(c.followDiscoverySport('sport:football'),false,'actual sport writer');
  const button=c.buildDirectoryFollowButton('team:football:socceroos',{sportKey:'football',label:'Socceroos'});assert.equal(button.textContent,'Follow');button.handlers.click();assert.equal(button.textContent,'Following','actual card callback records local follow');
  if(kind==='unknown-outside'||kind==='raw-taxonomy-null-unknown-outside'){
   const next=clone(c.userPreferences);next.future608Choice={enabled:true};assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));
  }
  if(kind==='raw-afl-marker-pending'){const next=clone(c.userPreferences);next.aflFamilyMigration={status:'pending'};assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));}
  if(kind==='new-grey-prompt-local-change'){
   const next=clone(c.userPreferences),started=ratingSystem.startSession(next.ratingPromptState,'synthetic-local-prompt-session');
   next.ratingPromptState=ratingSystem.recordPrompt(started,'fixture:synthetic-local-prompt',{sessionId:'synthetic-local-prompt-session'});
   assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}),'actual recorder preserves genuine local prompt-history change');
  }
  const receipt=clone(c.pendingPreferenceIntent('A'));assert(receipt,'actual writer persisted original-base receipt');
  assert.deepEqual(receipt.basePreferences,rawBase.preferences,'raw accepted base is not pre-normalized to the current app');
  api.mutate(state=>{
   state.preferences.feedCompact=true;state.preferences.preferenceGraph=systems.setEntityFollow(state.preferences.preferenceGraph,'team:football:epl:2','follow');
   if(grey){
    const started=ratingSystem.startSession(state.preferences.ratingPromptState,'synthetic-remote-prompt-session');
    state.preferences.ratingPromptState=ratingSystem.recordPrompt(started,'fixture:synthetic-remote-prompt',{sessionId:'synthetic-remote-prompt-session'});
    state.preferences.followBrowse={sportId:'sport:football',categoryId:'',section:'teams-players',page:2,scheduleScope:null};
    if(kind==='new-grey-prompt-unknown-remote')state.preferences.ratingPromptState.futurePromptChoice={enabled:true};
   }
   if(kind==='selection-conflict'||kind==='raw-taxonomy-null-remote-conflict'||kind==='new-grey-prompt-selection-conflict'){
    select(c,state.preferences,['sport:tennis']);if(kind==='raw-taxonomy-null-remote-conflict')state.preferences.taxonomySelection=null;
   }
  });
  const remote=api.state();c.setServerStateBaseline(remote); // Constructed advanced accepted baseline, never a private account read.
  const differences=c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.preferenceDifferences(receipt,remote.preferences,(a,b)=>profile.preferenceBaseMatches({basePreferences:a},b),c.serverStateBaseline.state.preferences);
  if(['canonical','raw-afl-marker-absent','raw-taxonomy-null','ACK-mismatch'].includes(kind))assert.deepEqual(clone(differences),input.reportedDifferences,'same family-only report from distinct raw forms');
  if(grey&&!['new-grey-prompt-local-change','new-grey-prompt-selection-conflict'].includes(kind))assert.deepEqual(clone(differences),input.reportedGreyDifferences,'new human fixed-family envelope, never private raw values');
  if(kind==='derivation-unavailable')c.taxonomySelectionForSelectorIds=undefined;
  if(kind==='new-grey-prompt-unknown-remote'){
   // Accepted remote unknown fields survive settingsForServer's merge even
   // though the visible local preferences and original receipt lack them.
   assert(!Object.hasOwn(receipt.preferences.ratingPromptState,'futurePromptChoice'));
   assert(!Object.hasOwn(c.userPreferences.ratingPromptState,'futurePromptChoice'));
   const rawBeforeProjection=JSON.stringify({receipt,current:c.userPreferences,baseline:c.serverStateBaseline,remote});
   const projected=c.currentServerStatePayload().preferences.ratingPromptState;
   assert.deepEqual(clone(projected.futurePromptChoice),{enabled:true},'real outgoing projection retains the unknown accepted field');
   assert.deepEqual(clone(projected.futurePromptChoice),clone(remote.preferences.ratingPromptState.futurePromptChoice));
   assert.equal(JSON.stringify({receipt,current:c.userPreferences,baseline:c.serverStateBaseline,remote}),rawBeforeProjection,'observing the real projection does not rewrite its inputs');
  }
  const before={storage:JSON.stringify([...values]),receipt:clone(c.pendingPreferenceIntent('A')),current:clone(c.userPreferences),baseline:clone(c.serverStateBaseline),remote:clone(api.state()),writes:api.metrics.rowWrites};
  console.log(JSON.stringify({mode,kind,stage:'prepared',complete:false,baseShape:selectionShape(receipt.basePreferences),intentShape:selectionShape(receipt.preferences),remoteShape:selectionShape(remote.preferences),differences,receiptOwnerMatches:receipt.ownerId===client.accountSnapshot().accountId,generationMatches:receipt.generation===client.accountSnapshot().generation}));
  let caught;try{await c.syncCurrentServerState();}catch(error){caught=error;}
  const status=sdkCalls.map(x=>x.method+':'+x.status).join(','),held=acceptedControl||!repairedKinds.has(kind),ackMismatch=!acceptedControl&&kind.endsWith('ACK-mismatch');
  console.log(JSON.stringify({mode,kind,stage:'observed',complete:false,errorCode:caught?.code||null,sdkCalls,stages,guardFacts:facts}));
  if(held){
   assert.equal(caught?.code,'preference_base_changed');assert.equal(status,ackMismatch?'GET:200,PUT:200':'GET:200','reported pre-save holds never start a save');
   assert.deepEqual(clone(c.pendingPreferenceIntent('A')),before.receipt);assert.equal(JSON.stringify([...values]),before.storage);assert.deepEqual(clone(c.userPreferences),before.current);assert.deepEqual(clone(c.serverStateBaseline),before.baseline);
   if(!ackMismatch){
    assert.deepEqual(api.state(),before.remote);assert.equal(api.metrics.rowWrites,before.writes);
    if(kind==='new-grey-prompt-unknown-remote'){
     const first=facts.find(f=>['held','exception','retained'].includes(f.decision));
     assert.equal(first?.site,'owned_current','unknown projected field refuses at the first current-intent boundary');
     assert.equal(first.reason,'current_differs_from_receipt');assert.equal(first.side,'current');
     assert.deepEqual(clone(first.currentToReceipt),['ratingPrompt'],'only the constructed unknown prompt family differs');
    }else{
     const side=grey&&!kind.startsWith('raw-taxonomy-null')&&!['new-grey-prompt-local-change','new-grey-prompt-selection-conflict'].includes(kind)?'remote':'intent';
     assert(facts.some(f=>f.site==='plan_scope'&&f.reason==='outside_supported_scope_changed'&&f.side===side),'exact expected pre-save scope refusal, not record/ACK rejection');
    }
   }
  }else{
   if(grey&&caught){
    assert.equal(status,'GET:200','a failed desired merge must retain the no-upload boundary');
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),before.receipt);assert.equal(JSON.stringify([...values]),before.storage);
    assert.deepEqual(clone(c.userPreferences),before.current);assert.deepEqual(clone(c.serverStateBaseline),before.baseline);
    assert.deepEqual(api.state(),before.remote);assert.equal(api.metrics.rowWrites,before.writes);
   }
   if(sourceOnly&&grey&&caught?.code==='preference_base_changed'&&facts.some(f=>f.site==='plan_scope'&&f.reason==='outside_supported_scope_changed'))sourceOnlyExpectedRed={mode,kind,errorCode:caught.code,sdkCalls:clone(sdkCalls),guardFacts:clone(facts),originalReceiptStorageCurrentBaselineAndRemotePreserved:true};
   assert.equal(caught,undefined,'desired qualified merge: observed refusal is retained RED, not a passing phone fix');assert.equal(status,'GET:200,PUT:200');if(r2){
    assert(newer);const pending=c.pendingPreferenceIntent('A');assert.equal(pending.receiptId,newer.receiptId);assert.deepEqual(clone(pending.preferences.selectedSelectorEntityIds),[]);assert.equal(pending.baseUpdatedAt,api.state().updatedAt);
    await c.syncCurrentServerState();assert.equal(sdkCalls.map(x=>x.method+':'+x.status).join(','),'GET:200,PUT:200,GET:200,PUT:200');assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,[]);
   }
   if(kind==='raw-afl-marker-absent')assert(!Object.hasOwn(api.state().preferences,'aflFamilyMigration'),'fresh remote keeps its absent non-decision marker');
   if(kind==='raw-taxonomy-null-same-selection')assert.equal(api.state().preferences.taxonomySelection,null,'unchanged remote keeps raw null translation');
   if(grey){
    assert.deepEqual(api.state().preferences.ratingPromptState,remote.preferences.ratingPromptState,'fresh remote prompt history survives byte-for-value, never uploaded from old local history');
    assert.equal(api.state().preferences.followBrowse.page,2,'remote typed view stays remote');assert.equal(c.userPreferences.followBrowse.page,1,'current device retains its typed view');
   }
   assert.equal(c.pendingPreferenceIntent('A'),null,'only owned matching ACK clears accepted receipt');assert.equal(c.serverPersistence.state,'signedIn');
   for(const id of ['team:football:socceroos','team:football:epl:2'])assert(api.state().preferences.preferenceGraph.entityFollows.some(row=>row.participantId===id&&row.followLevel==='follow'));
  }
  const result={mode,kind,passed:true,held,acceptedPlannerControl:acceptedControl,desiredMergeQualified:grey?!held:null,sdkCalls,guardFacts:facts,differences,receiptPending:!!c.pendingPreferenceIntent('A'),baseShape:selectionShape(receipt.basePreferences),intentShape:selectionShape(receipt.preferences),constructedState:true,realNetwork:false,physicalCauseIdentified:false};results.push(result);console.log(JSON.stringify({complete:true,...result}));
 }finally{client.clearSession();}
}

// ONE paired ordinary-hydration control, in both actual source/generated modes.
// A retained receipt is never deleted/rebased to create the fresh arm.
async function runPairedOrdinaryHydration(){
 const paired=[];
 const syncNames=['localPreferenceRecoveryBlocked','invalidateServerStateSyncScope','serverStateSyncScope','reconcileCurrentServerState','syncCurrentServerState','applyServerStatePreservingChanges','acknowledgePreferenceReceipt','advancePreferenceReceiptBase','verifyPreferenceIntentBase','bootstrapServerPersistence'];
 function context(mode){
  const f=fixture.setup(),{c}=f;
  if(mode==='generated'){
   const source=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
   vm.runInContext(generated,c);
   assert.notEqual(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE,source,'paired control uses exact generated helper, no source overlay');
  }
  for(const name of syncNames)vm.runInContext(fixture.declaration(name),c);
  f.facts=[];f.stages=[];f.plans=[];
  Object.assign(c,{serverSyncSequence:Promise.resolve(),serverSyncTimer:null,accountIndicatorJourney:null,startupSessionStateBaseline:null,
   setPreferenceRecovery(){},serverAuthoritativeFixturePins:(_state,current)=>current,clearAcknowledgedFixturePinCommands(){},serverErrorEndsSession:e=>e.code==='invalid_refresh_token',
   hydrateUserMetaSeed:async()=>{}, // Outside this profile hydration/receipt proof; no metadata route.
   NOTHINGSPORTS_ACCOUNT_INDICATOR_APP:{beginDiagnostic:()=>({step:name=>f.stages.push(name),guard:fact=>f.facts.push(clone(fact)),fail(){},done(){}})}});
  const verify=c.verifyPreferenceIntentBase;
  c.verifyPreferenceIntentBase=(receipt,state,life,current,observe)=>{
   const raw=JSON.stringify({receipt,state,current}),plan=verify(receipt,state,life,current,observe);
   assert.equal(JSON.stringify({receipt,state,current}),raw,'paired planner retains every original raw input');
   if(plan){assert.deepEqual(clone(plan.receipt.originalReceipt),clone(receipt));assert.deepEqual(clone(plan.receipt.basePreferences),clone(state.preferences));f.plans.push(plan);}
   return plan;
  };
  return f;
 }
 const fixedNow=Date.parse('2026-11-05T00:00:00Z');
 const token='e30.'+Buffer.from(JSON.stringify({sub:'A'})).toString('base64url')+'.synthetic';
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 function client(authValues,onState){
  const store={getItem:key=>authValues.get(key)??null,setItem:(key,value)=>authValues.set(key,String(value)),removeItem:key=>authValues.delete(key)};
  return transport.createClient({storage:store,persistentStorage:store,now:()=>fixedNow,fetchImpl:async(url,options={})=>{
   if(url==='/api/auth'){
    const body=options.body?JSON.parse(options.body):null;
    assert.equal(options.method,'POST');assert.equal(body?.action,'password-sign-in','only synthetic setup sign-in is allowed');
    return response({session:{access_token:token,refresh_token:'paired-owned-synthetic-refresh',expires_in:3600}});
   }
   assert.equal(url,'/api/user-state','unexpected paired route');
   assert.equal(options.headers.Authorization,'Bearer '+token);
   assert(onState,'origin preparation cannot call profile endpoint');
   return onState(options);
  }});
 }
 for(const mode of ['source','generated']){
  const origin=context(mode),oldAuth=new Map(),oldClient=client(oldAuth);
  await oldClient.signIn('paired@example.invalid','owned-synthetic',{persist:true});
  origin.c.serverSyncClient=oldClient;origin.c.serverPersistence={configured:true,state:'signedIn',user:{id:'A'}};
  const raw=clone(origin.base);raw.preferences.taxonomySelection=null;
  origin.c.setServerStateBaseline(raw);origin.c.applyServerState(raw);
  assert(origin.c.followDiscoverySport('sport:football')!==false,'actual writer creates pending historical raw-base intent');
  const originalReceipt=clone(origin.c.pendingPreferenceIntent('A'));
  assert(originalReceipt);assert.equal(originalReceipt.basePreferences.taxonomySelection,null);
  assert(originalReceipt.preferences.taxonomySelection&&typeof originalReceipt.preferences.taxonomySelection==='object');
  assert.equal(originalReceipt.generation,oldClient.accountSnapshot().generation);
  const persisted=[...origin.values],originRaw=JSON.stringify(persisted),authSnapshot=[...oldAuth];
  const remote=clone(raw);remote.updatedAt='2026-11-05T00:01:00Z';
  remote.preferences.preferenceGraph=systems.setEntityFollow(remote.preferences.preferenceGraph,'team:football:epl:2','follow');
  const frozenRemote=JSON.stringify(remote),arms=[];
  for(const arm of ['retained-pending','fresh-no-receipt']){
   const f=context(mode),{c,storage,values}=f,api=localApi('A',{calendarHandler(){throw Error('Unexpected paired calendar route');}}),calls=[];
   if(arm==='retained-pending'){
    // A separate VM/profile lifetime reads a copy of prior durable profile bytes.
    for(const [key,value] of persisted)values.set(key,value);
    c.activeProfileBundle=profile.loadActiveProfile(storage);
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),originalReceipt,'ordinary profile loader retains original pending receipt');
   }else assert.equal(c.pendingPreferenceIntent('A'),null,'fresh arm starts independently without any receipt');
   api.seed(clone(remote));let r2=null;
   const authValues=new Map(authSnapshot);
   const sdk=client(authValues,async options=>{
    const method=options.method||'GET',body=options.body?JSON.parse(options.body):undefined;
    const result=await api.handle({method,url:'/api/user-state',headers:{},body});calls.push({method,status:result.status});
    if(arm==='retained-pending'&&method==='PUT'&&result.status===200&&!r2){
     assert(f.plans.length,'actual sync produced the owned R1 conditional witness');
     const witness=f.plans.at(-1).receipt;
     const unchanged=JSON.stringify([...values]);
     const bad=clone(witness);bad.originalReceipt.generation+=1;
     profile.acknowledgePreferenceIntent(storage,c.activeProfileBundle,bad,result.body.state.preferences,require('../config/user-state-sync'),{generation:sdk.accountSnapshot().generation,updatedAt:result.body.state.updatedAt});
     assert.equal(JSON.stringify([...values]),unchanged,'changed original generation witness cannot clear R1');
     c.saveFollowSport({selectorId:'sport:football'},false);r2=clone(c.pendingPreferenceIntent('A'));
     assert(r2&&r2.receiptId!==originalReceipt.receiptId,'actual in-flight writer records R2, never fakes receipt absence');
     const newerRaw=JSON.stringify([...values]);
     profile.acknowledgePreferenceIntent(storage,c.activeProfileBundle,witness,result.body.state.preferences,require('../config/user-state-sync'),{generation:sdk.accountSnapshot().generation+1,updatedAt:result.body.state.updatedAt});
     assert.equal(JSON.stringify([...values]),newerRaw,'wrong current generation cannot advance R2');
    }
    return response(result.body,result.status);
   });
   c.serverSyncClient=sdk;
   assert.equal(transport.sessionSubject(await sdk.restoreSession()),'A');
   assert.equal(sdk.accountSnapshot().generation,0,'new client restores same account without reusing old in-memory generation');
   if(arm==='retained-pending')assert.notEqual(originalReceipt.generation,sdk.accountSnapshot().generation,'stored receipt generation differs from stable new lifetime');
   c.startupSessionStateBaseline=clone(c.currentServerStatePayload());
   console.log(JSON.stringify({control:'paired-ordinary-hydration',mode,arm,stage:'prepared',pendingReceipt:!!c.pendingPreferenceIntent('A')}));
   const bootstrap=await c.bootstrapServerPersistence({checkStatus:false});
   const bootCalls=clone(calls);
   console.log(JSON.stringify({control:'paired-ordinary-hydration',mode,arm,stage:'hydrated',state:bootstrap.state,sdkCalls:bootCalls,pendingReceipt:!!c.pendingPreferenceIntent('A')}));
   assert.equal(JSON.stringify(remote),frozenRemote,'source remote snapshot unchanged');
   assert(bootCalls.every(call=>call.method==='GET'),'ordinary hydration never sends a profile write here');
   assert.deepEqual(api.state().preferences,remote.preferences,'bootstrap cannot overwrite remote');
   if(arm==='retained-pending'){
    assert.equal(bootstrap.state,'error','ordinary hydration protects incompatible raw-base pending intent');
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),originalReceipt,'hydration cannot discard or rewrite receipt');
    const life=sdk.accountSnapshot(),current=c.currentServerStatePayload().preferences;
    const before=JSON.stringify({storage:[...values],receipt:c.pendingPreferenceIntent('A'),current,remote:api.state()});
    const negative=[];
    assert.equal(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(originalReceipt,api.state(),{...life,generation:life.generation+1},current,fact=>negative.push(fact)),null);
    assert(negative.some(fact=>fact.reason==='generation_scope_rejected'),'actual stale current lifetime remains rejected');
    assert.equal(c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan({...clone(originalReceipt),ownerId:'B'},api.state(),life,current),null,'different receipt owner remains rejected');
    assert.equal(JSON.stringify({storage:[...values],receipt:c.pendingPreferenceIntent('A'),current:c.currentServerStatePayload().preferences,remote:api.state()}),before,'negative scopes preserve exact stored/current/remote snapshots');
    await c.syncCurrentServerState();
    assert(r2);assert.equal(c.pendingPreferenceIntent('A').receiptId,r2.receiptId,'correct owned R1 ACK retains newer R2');
    assert.equal(c.pendingPreferenceIntent('A').generation,sdk.accountSnapshot().generation);
    assert(f.facts.some(fact=>fact.receiptGenerationMatches===false),'actual stored/current generation mismatch was observed');
    await c.syncCurrentServerState();
    assert.equal(c.pendingPreferenceIntent('A'),null,'only subsequent matching R2 ACK clears pending intent');
    assert.equal(c.serverPersistence.state,'signedIn');
    assert.equal(calls.slice(bootCalls.length).map(call=>call.method+':'+call.status).join(','),'GET:200,PUT:200,GET:200,PUT:200');
    assert.deepEqual(api.state().preferences.selectedSelectorEntityIds,[],'newer removal is preserved, not reverted by R1');
   }else{
    assert.equal(bootstrap.state,'signedIn','fresh arm ordinary hydration completes without inventing pending intent');
    assert.equal(c.pendingPreferenceIntent('A'),null);
    assert(calls.every(call=>call.method==='GET'),'fresh no-receipt success is not misreported as a save-response proof');
   }
   assert(api.state().preferences.preferenceGraph.entityFollows.some(row=>row.participantId==='team:football:epl:2'&&row.followLevel==='follow'),'independent remote choice retained');
   assert.equal(JSON.stringify([...origin.values]),originRaw,'original prior-lifetime durable profile untouched by either arm');
   assert.equal(JSON.stringify(remote),frozenRemote);
   arms.push({arm,bootstrapCalls:bootCalls,sdkCalls:clone(calls),pendingReceipt:!!c.pendingPreferenceIntent('A'),state:c.serverPersistence.state,constructedState:true});
   sdk.clearSession(); // RAM-only synthetic auth fixture cleanup, no provider request.
  }
  oldClient.clearSession();
  paired.push({mode,arms});
 }
 return {name:'ordinary-hydration-retained-historical-intent-versus-independent-no-receipt',pairedControls:1,modes:paired,scope:'actual ordinary bootstrap/apply/profile reload and sync/SDK/local API owners; synthetic RAM only; no device/customer/remote acceptance'};
}

// Source fragment for the EXISTING SYNC validator only, not a new repo file.
// Original SYNC owns the exact insertion/callsite in --priority-source-only.
// Invoke after strict source/locked-dependency preflight and BEFORE fixture imports/arms.
// Pass sourceOnlyBinding.ciRegistration, not the entire source-only binding.
// No fixture digest literal is embedded in this workflow or function.
// Do not invoke from or alter the default full-proof entry point.
function validateGreyOnlyCiContract(workflowText,binding){
 const assert=require('node:assert/strict'),crypto=require('node:crypto');
 const originalSha256='969fa62b36eb121517db14c5c686d39da2de8700164135a678d9e67d9612858d';
 const sourceCommit='037a6214c1a573b57298d3ea504de0b89e31d473';
 const afterSha256='e2afebbf49c5f989a2ed58c0874cb7d8b3d35f2e44cd282815281ce73eb87c4d';
 assert(binding&&typeof binding==='object'&&!Array.isArray(binding)&&[Object.prototype,null].includes(Object.getPrototypeOf(binding)),'Populated CI registration binding required');
 assert.deepEqual(Object.keys(binding).sort(),['baseWorkflowSha256','sourceCommit','workflowPath','workflowSha256'].sort(),'Exact CI binding fields required');
 assert.equal(binding.sourceCommit,sourceCommit,'CI source baseline is exact M4');
 assert.equal(binding.workflowPath,'.github/workflows/installed-upgrade-tests.yml','CI workflow path is fixed');
 assert.equal(binding.baseWorkflowSha256,originalSha256,'CI preimage is exact M4');
 assert.equal(binding.workflowSha256,afterSha256,'CI afterimage is the separately reviewed grey-only workflow');
 assert.equal(typeof workflowText,'string','Bound workflow text required');
 assert.equal(crypto.createHash('sha256').update(workflowText).digest('hex'),binding.workflowSha256,'Actual workflow bytes match populated fixture binding');
 const paths="      - scripts/validate-sync608-reported-hold.js\n      - scripts/fixtures/sync608-reported-hold-20261103.json\n";
 const existingPath='      - scripts/validate-account-sign-in-action-trace.js\n';
 const npm="      - name: Install existing locked dependencies\n        run: npm ci\n";
 const step="      - name: Observe priority SYNC source-only controls\n        run: timeout --signal=TERM --kill-after=5s 120s node scripts/validate-sync608-reported-hold.js --priority-source-only\n";
 const oldLimits="Three remaining source/mock activation checks.",newLimits="Three existing source/mock activation checks plus one bounded priority SYNC source-only diagnostic.";
 const oldFirst='      - name: Verify actual exported Feed activation\n';
 function validate(text){
  assert.equal(typeof text,'string','Workflow text must be source-bound');
  assert.equal(text.split(step).length-1,1,'Exactly one literal bounded priority diagnostic step');
  assert.equal(text.split(paths).length-1,1,'Exactly one narrow validator/fixture trigger block');
  assert(text.includes(existingPath+paths),'Priority paths retain their exact reviewed location');
  assert(text.includes(npm+step+oldFirst),'Priority diagnostic follows locked npm and precedes the original first activation check');
  assert.equal(text.split(newLimits).length-1,1,'Identity log describes the three existing checks plus this diagnostic');
  const normalized=text.replace(step,'').replace(paths,'').replace(newLimits,oldLimits);
  assert.equal(crypto.createHash('sha256').update(normalized).digest('hex'),originalSha256,'Every original M4 job, guard, check, runtime and dependency step remains byte-identical');
 }
 validate(workflowText);
 const controls=[
  ['missing priority step',text=>text.replace(step,'')],
  ['duplicate priority step',text=>text.replace(step,step+step)],
  ['altered priority step',text=>text.replace(step,step.replace('--priority-source-only','--priority-source-only --skip'))],
  ['moved priority step',text=>text.replace(npm+step,step+npm)]
 ];
 for(const [name,mutate]of controls){
  const changed=mutate(workflowText);
  assert.notEqual(changed,workflowText,name+' mutation must apply');
  assert.throws(()=>validate(changed),undefined,name+' must refuse');
 }
 return controls.map(([name])=>name);
}

async function runPrioritySourceOnly(){
 const planned=14,attempted=[];
 console.log(JSON.stringify({format:'grey-priority-source-result.v1',phase:'priority-source-only',status:'ADMITTED_SOURCE_ONLY',plannedSourceArms:planned,sourceArmsStarted:0,sourceArmsCompleted:0,ciRegistrationNegativeControlsCompleted:sourceOnlyCi.length,ciRegistrationNegativeNames:sourceOnlyCi,actualSource:sourceOnlyProof,generatedProof:false,defaultFullProof:false,releaseAcceptance:false}));
 for(const mode of ['accepted-planner','source'])for(const kind of input.priorityCases){
  sourceOnlyExpectedRed=null;attempted.push({mode,kind});
  try{await run(mode,kind);}
  catch(error){
   let identityError=null;try{prioritySourceInputsUnchanged(sourceOnlyProof);}catch(changed){identityError=changed.message;}
   const expected=sourceOnlyExpectedRed?.mode===mode&&sourceOnlyExpectedRed?.kind===kind&&error.code==='ERR_ASSERTION'&&error.message.includes('desired qualified merge: observed refusal is retained RED');
   console.error(JSON.stringify({format:'grey-priority-source-result.v1',phase:'priority-source-only',status:identityError?'SOURCE_INPUTS_CHANGED':expected?'SOURCE_ONLY_PRODUCT_RED':'SOURCE_ONLY_CONTROL_OR_SETUP_FAILURE',plannedSourceArms:planned,sourceArmsStarted:attempted.length,sourceArmsCompleted:results.length,attemptedArms:attempted,completedArms:results,firstFailure:{mode,kind,message:error.message,observed:sourceOnlyExpectedRed},inputsUnchanged:identityError===null,identityError,ciRegistrationNegativeControlsCompleted:sourceOnlyCi.length,ciRegistrationNegativeNames:sourceOnlyCi,actualSource:sourceOnlyProof,generatedProof:false,defaultFullProof:false,physicalCauseIdentified:false,releaseAcceptance:false}));
   throw error; // First failure ends this source phase. No later arm or retry.
  }
 }
 prioritySourceInputsUnchanged(sourceOnlyProof);assert.equal(results.length,planned);
 console.log(JSON.stringify({format:'grey-priority-source-result.v1',phase:'priority-source-only',status:'SOURCE_ONLY_CONTRACT_PASS',plannedSourceArms:planned,sourceArmsStarted:attempted.length,sourceArmsCompleted:results.length,completedArms:results,inputsUnchanged:true,ciRegistrationNegativeControlsCompleted:sourceOnlyCi.length,ciRegistrationNegativeNames:sourceOnlyCi,actualSource:sourceOnlyProof,generatedProof:false,defaultFullProof:false,physicalCauseIdentified:false,releaseAcceptance:false}));
}

(async()=>{
 if(sourceOnly){await runPrioritySourceOnly();return;}
 // One finite priority discriminator: exact accepted planner, proposed source, exact generated helper.
 // Known conservative holds are baseline observations; desired merges stay RED until proved.
 for(const mode of ['accepted-planner','source','generated'])for(const kind of input.priorityCases){
  try{await run(mode,kind);}catch(error){failures.push({mode,kind,message:error.message,stack:error.stack});console.error(JSON.stringify({mode,kind,status:'FAIL',message:error.message,stack:error.stack}));}
 }
 for(const mode of ['source','generated'])for(const kind of input.cases){
  try{await run(mode,kind);}catch(error){failures.push({mode,kind,message:error.message,stack:error.stack});console.error(JSON.stringify({mode,kind,status:'FAIL',message:error.message,stack:error.stack}));}
 }
 let pairedControl;try{pairedControl=await runPairedOrdinaryHydration();}catch(error){failures.push({control:'paired-ordinary-hydration',message:error.message,stack:error.stack});console.error(JSON.stringify({control:'paired-ordinary-hydration',status:'FAIL',message:error.message,stack:error.stack}));}
 console.log(JSON.stringify({format:'sync608-reported-hold-discriminator.v1',historicalSource:input.sourceCommit,acceptedBase:input.acceptedBaseCommit,cases:results.length,originalCasesCompleted:results.filter(row=>input.cases.includes(row.kind)).length,priorityArmsCompleted:results.filter(row=>input.priorityCases.includes(row.kind)).length,pairedControl,failures,generatedHelperSha256:input.sourceFiles['assets/js/account-awareness-runtime.js'],scope:'actual shipped inline UI writer/normalizer/raw accepted base/receipt plus source and generated helper and actual SDK with owned local API/database doubles; no private account, browser, phone, live-data or release acceptance'}));
 assert.equal(failures.length,0,'discriminator failed: '+failures.map(row=>row.mode+'/'+row.kind+': '+row.message).join('; '));
})().catch(error=>{console.error(error);process.exitCode=1;});
