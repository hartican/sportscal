'use strict';
// Actual sport writer, normalizer, persisted receipt and planner; no SDK client or transport.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),acorn=require('acorn');
const {actualContext}=require('./user-state-optional-view-tests');
const profile=require('../../config/profile-storage'),systems=require('../../config/preference-system');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function mergePreferences('));
const ast=acorn.parse(script,{ecmaVersion:'latest'}),clone=value=>JSON.parse(JSON.stringify(value));
function declaration(name){const nodes=ast.body.filter(n=>n.type==='FunctionDeclaration'?n.id.name===name:n.type==='VariableDeclaration'&&n.declarations.some(d=>d.id.name===name));assert.equal(nodes.length,1,name);return script.slice(nodes[0].start,nodes[0].end);}
function setup(){
 const {c,values,storage}=actualContext('config/preference-intent-reconcile.js');
 Object.assign(c,{SELECTOR_TAXONOMY:require('../../config/selector-taxonomy'),PREFERENCE_TAXONOMY:require('../../config/preference-taxonomy'),SPORT_META:require('../../config/sport-domain-registry').metaByKey(),SPORTS_LIBRARY:{},
  discoverySportIsFollowed:()=>false,requestFeedRebuildAfterFollowChange:async()=>{},recordPreferenceChange(){},productSportForPreferenceIdentifier:()=> 'football',discoveryNodeById:()=>({label:'Fixture sport'}),discoveryTuneInteractionCount:0,activeTab:'follow',leagueCoveragePromptDismissed:new Set(),sportHubKeyForFilter:()=>null,renderTabCounts(){}});
 const names=['LEGACY_SELECTOR_ID_ALIASES','BASE_SPORT_SELECTOR_OVERRIDES','BASE_SPORT_SELECTOR_ENTITIES','allSelectorEntities','selectorEntityById','selectorEntityCanonicalSportKeys',
  'migrateLegacySelectorEntityIds','normalizeSelectorEntityIds','canonicalSportKeysForSelectorIds','effectiveSelectorEntitiesForIds','taxonomySelectionForSelectorIds','selectorEntityIsEffectivelySelected','selectedPreferenceDomainIds',
  'followDiscoverySport','upgradeDiscoverySportToFroth','saveFollowSport','setDirectoryEntityFollow','setServerStateBaseline'];
 vm.runInContext(names.map(declaration).join('\n'),c);
 vm.runInContext(fs.readFileSync(path.join(root,'config/account-sync-diagnostic.js'),'utf8'),c);
 c.userPreferences=c.mergePreferences({version:27,onboardingComplete:true,theme:'day',feedCompact:false,selectedSelectorEntityIds:[],followedSports:[],pilotMeasurement:{enabled:false},
  followFirst:{notifications:{enabled:false,userChoice:false}},preferenceGraph:systems.createPreferenceGraph({profileId:'disposable-selection',domainIds:[]})});
 const base=c.currentServerStatePayload();base.updatedAt='2026-10-31T00:00:00.000Z';c.setServerStateBaseline(base);assert.equal(c.applyServerState(base),true);
 return {c,values,storage,base};
}
function runCase(){
 const {c,values,storage,base}=setup();c.followDiscoverySport('sport:football');
 const receipt=c.pendingPreferenceIntent('A');assert(receipt,'actual writer recorded receipt');
 const remote=clone(base);remote.updatedAt='2026-10-31T00:01:00.000Z';
 remote.preferences.preferenceGraph=systems.setEntityFollow(remote.preferences.preferenceGraph,'team:football:epl:2','follow');
 assert(profile.preferenceBaseMatches(receipt,base.preferences));assert(!profile.preferenceBaseMatches(receipt,remote.preferences));
 c.activeProfileBundle=profile.loadActiveProfile(storage);assert.deepEqual(clone(c.pendingPreferenceIntent('A')),clone(receipt),'actual persisted restart keeps receipt');
 const before=JSON.stringify([...values]),beforeReceipt=clone(receipt),beforeCurrent=clone(c.userPreferences),beforeRemote=clone(remote),facts=[];
 const plan=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(receipt,remote,{accountId:'A',generation:0,hasSession:true},c.userPreferences,f=>facts.push(f));
 const differences=c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.preferenceDifferences(receipt,remote.preferences,(a,b)=>profile.preferenceBaseMatches({basePreferences:a},b),base.preferences);
 const firstHold=facts.find(f=>f.decision==='held');
 assert.equal(JSON.stringify([...values]),before);assert.deepEqual(clone(c.pendingPreferenceIntent('A')),beforeReceipt);assert.deepEqual(clone(c.userPreferences),beforeCurrent);assert.deepEqual(remote,beforeRemote);
 console.log(JSON.stringify({fixture:'actual-sport-follow-independent-remote-entity',plannerProduced:!!plan,firstHold,differences,receiptAndCurrentAndRemotePreserved:true,sdkClientCalls:0,networkCalls:0,physicalCauseIdentified:false}));
 assert(plan,'actual deliberate sport Follow must reconcile its exact linked selection with independent remote entity Follow');
 return plan;
}

const patches=require('../../config/user-state-sync');
const selectionFields=['selectedSelectorEntityIds','followedSports','taxonomySelection'];
function select(c,target,ids){target.selectedSelectorEntityIds=c.normalizeSelectorEntityIds(ids);target.followedSports=c.canonicalSportKeysForSelectorIds(ids);target.taxonomySelection=c.taxonomySelectionForSelectorIds(ids);}
function prepared({baseSelected=[],writer='follow',phone=false}={}){
 const f=setup(),{c}=f;
 if(baseSelected.length){select(c,c.userPreferences,baseSelected);f.base=c.currentServerStatePayload();f.base.updatedAt='2026-10-31T00:00:00.000Z';c.setServerStateBaseline(f.base);c.applyServerState(f.base);}
 if(phone){const next=clone(c.userPreferences);next.feedCompact=true;assert(c.savePreferences(next,{viewOnly:true}));}
 if(writer==='follow')c.followDiscoverySport('sport:football');
 if(writer==='upgrade')c.upgradeDiscoverySportToFroth('sport:football');
 if(writer==='remove')c.saveFollowSport({selectorId:'sport:football'},false);
 if(writer==='domain'){
  const next=clone(c.userPreferences);next.preferenceGraph=systems.quickAddDomain(next.preferenceGraph,'sport:football','template:casual');assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));
 }
 if(phone)c.setDirectoryEntityFollow('team:football:epl:2','follow');
 f.receipt=c.pendingPreferenceIntent('A');assert(f.receipt);
 f.remote=clone(f.base);f.remote.updatedAt='2026-10-31T00:01:00.000Z';
 f.remote.preferences.preferenceGraph=systems.setEntityFollow(f.remote.preferences.preferenceGraph,'team:football:epl:2','follow');
 if(phone){f.remote.preferences.feedCompact=true;c.applyServerState({...f.remote,preferences:f.receipt.preferences});c.setServerStateBaseline(f.remote);}
 c.activeProfileBundle=profile.loadActiveProfile(f.storage);assert.deepEqual(clone(c.pendingPreferenceIntent('A')),clone(f.receipt));
 return f;
}
function observe(f,alter){
 const {c,values,receipt,remote}=f;alter?.(f);
 const before={storage:JSON.stringify([...values]),receipt:clone(c.pendingPreferenceIntent('A')),current:clone(c.userPreferences),remote:clone(remote),baseline:clone(c.serverStateBaseline)};
 const facts=[];let error,plan;
 try{plan=c.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE.ownedPlan(receipt,remote,{accountId:'A',generation:0,hasSession:true},c.userPreferences,fact=>facts.push(fact));}catch(next){error=next;}
 assert.equal(JSON.stringify([...values]),before.storage);assert.deepEqual(clone(c.pendingPreferenceIntent('A')),before.receipt);assert.deepEqual(clone(c.userPreferences),before.current);assert.deepEqual(remote,before.remote);assert.deepEqual(clone(c.serverStateBaseline),before.baseline);
 return {plan,error,facts};
}
function runSuite(){
 const results=[],test=(name,body)=>{body();results.push(name);};
 test('actual-follow-disjoint',()=>{const f=prepared(),{plan}=observe(f);assert(plan);for(const key of selectionFields)assert.deepEqual(clone(plan.receipt.preferences[key]),clone(f.receipt.preferences[key]));assert(plan.receipt.preferences.preferenceGraph.entityFollows.some(e=>e.participantId==='team:football:epl:2'));});
 test('actual-upgrade-disjoint',()=>{const f=prepared({writer:'upgrade'}),{plan}=observe(f);assert(plan);assert(plan.receipt.preferences.preferenceGraph.domainPreferences.some(d=>d.sportDomainId==='sport:football'&&d.templateId==='template:froth'));});
 test('actual-removal-explicit-empty',()=>{const f=prepared({baseSelected:['sport:football'],writer:'remove'}),{plan}=observe(f);assert(plan);assert.deepEqual(clone(plan.receipt.preferences.selectedSelectorEntityIds),[]);assert(plan.receipt.preferences.preferenceGraph.entityFollows.length>0);});
 test('phone-shaped-real-writers-accepted-base-false',()=>{
  const f=prepared({phone:true}),{plan}=observe(f);assert(plan);
  const d=f.c.NOTHINGSPORTS_SYNC_DIAGNOSTIC.preferenceDifferences(f.receipt,f.remote.preferences,(a,b)=>profile.preferenceBaseMatches({basePreferences:a},b),f.c.serverStateBaseline.state.preferences);
  assert.deepEqual(clone(d),{baseToRemote:['localView','entities'],localEdits:['selection','localView','entities','domains'],localToRemote:['selection','domains'],receiptBaseMatchesAccepted:false});
  assert(plan.receipt.preferences.feedCompact,'remote view retained');assert.equal(plan.receipt.baseUpdatedAt,f.remote.updatedAt,'fresh conditional witness');
 });
 test('remote-selection-only-kept',()=>{const f=prepared({baseSelected:['sport:football'],writer:'domain'});select(f.c,f.remote.preferences,['sport:tennis']);const {plan}=observe(f);assert(plan);for(const key of selectionFields)assert.deepEqual(clone(plan.receipt.preferences[key]),clone(f.remote.preferences[key]));});
 test('agreed-selection-no-selection-write',()=>{const f=prepared();for(const key of selectionFields)f.remote.preferences[key]=clone(f.receipt.preferences[key]);const {plan}=observe(f);assert(plan);const p=plan.patch(patches.createPatch(f.base,f.c.currentServerStatePayload(),{baseUpdatedAt:f.base.updatedAt}));assert(p.changes.filter(x=>x.path[0]==='preferences').every(x=>x.path[1]==='preferenceGraph'));});
 test('differing-concurrent-selection-held-no-union',()=>{const f=prepared();select(f.c,f.remote.preferences,['sport:tennis']);assert(!observe(f).plan);});
 test('empty-selection-cannot-erase-new-remote-selection',()=>{const f=prepared({baseSelected:['sport:football'],writer:'remove'});select(f.c,f.remote.preferences,['sport:football','sport:tennis']);assert(!observe(f).plan);});
 for(const [name,alter]of [
  ['unknown-root',f=>{f.receipt.preferences.futureChoice=true;f.c.userPreferences.futureChoice=true;}],
  ['migration-marker',f=>{f.receipt.preferences.aflFamilyMigration=true;f.c.userPreferences.aflFamilyMigration=true;}],
  ['unknown-selector',f=>{f.receipt.preferences.selectedSelectorEntityIds.push('sport:future-private');f.c.userPreferences=clone(f.receipt.preferences);}],
  ['duplicate-selector',f=>{f.receipt.preferences.selectedSelectorEntityIds.push('sport:football');f.c.userPreferences=clone(f.receipt.preferences);}],
  ['derived-sports-mismatch',f=>{f.receipt.preferences.followedSports=[];f.c.userPreferences=clone(f.receipt.preferences);}],
  ['taxonomy-extra-field',f=>{f.receipt.preferences.taxonomySelection.futureChoice=true;f.c.userPreferences=clone(f.receipt.preferences);}],
  ['taxonomy-null',f=>{f.receipt.preferences.taxonomySelection=null;f.c.userPreferences=clone(f.receipt.preferences);}],
  ['base-selector-absence',f=>{delete f.receipt.basePreferences.selectedSelectorEntityIds;}],
  ['remote-selector-absence',f=>{delete f.remote.preferences.selectedSelectorEntityIds;}],
  ['remote-derived-mismatch',f=>{f.remote.preferences.followedSports=['tennis'];}],
  ['unknown-domain-field',f=>{f.receipt.preferences.preferenceGraph.domainPreferences[0].futureChoice=true;f.c.userPreferences=clone(f.receipt.preferences);}],
  ['missing-derivation',f=>{f.c.normalizeSelectorEntityIds=undefined;}],
  ['null-taxonomy-derivation',f=>{f.c.taxonomySelectionForSelectorIds=()=>null;}],
  ['domain-conflict',f=>{f.remote.preferences.preferenceGraph.domainPreferences=[systems.expandTemplate('remote','sport:football','template:froth')];}],
 ])test(name+'-held',()=>{const f=prepared();alter(f);assert(!observe(f).plan);});
 test('ordinary-current-choice-not-in-receipt-held',()=>{const f=prepared();select(f.c,f.c.userPreferences,['sport:tennis']);const o=observe(f);assert.equal(o.error?.code,'preference_base_changed');assert(o.facts.some(x=>x.reason==='current_differs_from_receipt'));});
 test('owner-change-no-plan',()=>{const f=prepared();f.c.serverSyncClient.sessionSubject=()=> 'B';assert(!observe(f).plan);});
 test('generation-change-no-plan',()=>{const f=prepared();f.c.serverSyncClient.accountSnapshot=()=>({hasSession:true,accountId:'A',generation:1});assert(!observe(f).plan);});
 test('fresh-second-plan-concurrent-selection-held',()=>{const f=prepared();assert(observe(f).plan);select(f.c,f.remote.preferences,['sport:tennis']);f.remote.updatedAt='2026-10-31T00:02:00.000Z';assert(!observe(f).plan);});
 for(const key of selectionFields)test('ACK-mismatching-'+key+'-retains-receipt',()=>{const f=prepared(),{plan}=observe(f);assert(plan);const ack=clone(plan.receipt.preferences);ack[key]=key==='taxonomySelection'?null:[];assert(!profile.preferenceIntentMatches(plan.receipt,ack,patches));const before=JSON.stringify([...f.values]);profile.acknowledgePreferenceIntent(f.storage,f.c.activeProfileBundle,plan.receipt,ack,patches,{generation:0,updatedAt:f.remote.updatedAt});assert.equal(JSON.stringify([...f.values]),before);});
 test('exact-owned-ACK-clears-only-matching-receipt',()=>{const f=prepared(),{plan}=observe(f);assert(profile.preferenceIntentMatches(plan.receipt,plan.receipt.preferences,patches));const bundle=profile.acknowledgePreferenceIntent(f.storage,f.c.activeProfileBundle,plan.receipt,plan.receipt.preferences,patches,{generation:0,updatedAt:f.remote.updatedAt});assert.equal(profile.readPreferenceIntent(f.storage,bundle,'A'),null);});
 test('ACK-witness-does-not-alias-input',()=>{const f=prepared(),{plan}=observe(f),ack=clone(plan.receipt.preferences);f.receipt.preferences.selectedSelectorEntityIds.length=0;assert(profile.preferenceIntentMatches(plan.receipt,ack,patches));select(f.c,ack,[]);assert(!profile.preferenceIntentMatches(plan.receipt,ack,patches));});
 test('newer-recorded-selection-carried-after-owned-ACK',()=>{const f=prepared(),{plan}=observe(f);f.c.saveFollowSport({selectorId:'sport:football'},false);const newer=f.c.pendingPreferenceIntent('A');assert.notEqual(newer.receiptId,f.receipt.receiptId);const bundle=profile.acknowledgePreferenceIntent(f.storage,f.c.activeProfileBundle,plan.receipt,plan.receipt.preferences,patches,{generation:0,updatedAt:f.remote.updatedAt});const retained=profile.readPreferenceIntent(f.storage,bundle,'A');assert.equal(retained.receiptId,newer.receiptId);assert.deepEqual(clone(retained.preferences.selectedSelectorEntityIds),[]);assert.equal(retained.baseUpdatedAt,f.remote.updatedAt);assert(retained.preferences.preferenceGraph.entityFollows.some(e=>e.participantId==='team:football:epl:2'));});
 return {cases:results.length,passed:results,scope:'Actual source writer/derivation/normalizer/record/reload/planner and local ACK bookkeeping only; constructed state; no SDK client/transport/native/device/CAS-runtime acceptance',sdkClientCalls:0,networkCalls:0,physicalCauseIdentified:false};
}
module.exports={setup,runCase,runSuite,declaration,prepared,observe};
if(require.main===module){runCase();console.log(JSON.stringify(runSuite()));}
