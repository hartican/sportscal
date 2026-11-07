'use strict';
// Source-seam qualification over the real recorder, queue and disposable API.
// Constructed historical rows and adversarial receipts never identify a phone key.
const assert=require('node:assert/strict');
const {runCase}=require('./user-state-events-scope-tests');
const profile=require('../../config/profile-storage');
const clone=value=>JSON.parse(JSON.stringify(value));
const defaultTennis={enthusiasm:'froth',gender:'both',eventType:'both',round:'all'};
function fixture(label,options={}){
 let newer=null;
 return {
  acceptRemote:options.acceptRemote!==false,
  skipEvent:Boolean(options.skipEvent),
  allowGraphTimestamp:Boolean(options.expectedTennis),
  seed(seed){delete seed.preferences.tennis;options.seed?.(seed);},
  intent(next){options.intent?.(next);},
  afterWrite({c,storage,base}){
   if(!options.rawIntent)return;
   // Explicit adversarial durable fixture: ordinary save normalizes partial values.
   const preferences=clone(c.userPreferences);options.rawIntent(preferences);
   c.activeProfileBundle=profile.recordPreferenceIntent(storage,c.activeProfileBundle,{ownerId:'A',generation:0,
    baseUpdatedAt:base.updatedAt,basePreferences:base.preferences,preferences,sections:{preferences}});
   c.userPreferences=preferences;
  },
  remote(remote,context){
   const defaults=clone(context.c.mergePreferences({}).tennis);
   assert.deepEqual(defaults,defaultTennis,'fixed accommodation must match actual existing normalizer');
   remote.preferences.tennis=defaults;options.remote?.(remote,context);
  },
  patch(patch){
   if(options.expectedTennis)console.log(JSON.stringify({kind:label,preferencePaths:patch.changes.filter(change=>change.path[0]==='preferences').map(change=>change.path.join('.'))}));
   assert(patch.changes.every(change=>change.path[0]!=='preferences'||(change.path.length>1&&change.path[1]!=='tennis')),
    'never write tennis or replace its preferences parent');
  },
  ack(state,{c,receipt}){
   options.ack?.(state);
   if(options.r2&&!newer){
    const next=clone(c.userPreferences);next.tennis={...next.tennis,round:'final'};
    assert(c.savePreferences(next,{deliberate:true,deferFollowEffects:true}));
    newer=clone(c.pendingPreferenceIntent('A'));assert.notEqual(newer.receiptId,receipt.receiptId);
   }
  },
  beforeSync(context){options.beforeSync?.(context);},
  async check({c,api,values,calls,receipt,remote,diagnostic,caught,beforeStored,beforeCurrent,beforeBaseline,beforeRemote}){
   if(options.r2){
    assert.equal(caught,undefined);assert.equal(calls.writes,1);
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),newer,'old ACK cannot rebase uncertain newer tennis choice');
    assert.equal(c.userPreferences.tennis.round,'final');
    const retained={stored:JSON.stringify([...values]),current:clone(c.currentServerStatePayload()),baseline:clone(c.serverStateBaseline),remote:api.state()};
    let retry;try{await c.syncCurrentServerState();}catch(error){retry=error;}
    assert.equal(retry?.code,'preference_base_changed');assert.equal(calls.writes,1);
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),newer);
    assert.equal(JSON.stringify([...values]),retained.stored);assert.deepEqual(clone(c.currentServerStatePayload()),retained.current);
    assert.deepEqual(clone(c.serverStateBaseline),retained.baseline);assert.deepEqual(api.state(),retained.remote);
   }else if(options.held){
    assert.equal(caught?.code,'preference_base_changed',label);
    assert.equal(calls.writes,options.ack?1:options.cas?1:0,label);
    assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt,label);
    assert.equal(JSON.stringify([...values]),beforeStored,label);assert.deepEqual(clone(c.currentServerStatePayload()),beforeCurrent,label);
    assert.deepEqual(clone(c.serverStateBaseline),beforeBaseline,label);
    if(!options.ack&&!options.cas)assert.deepEqual(api.state(),beforeRemote,label);
    assert.equal(diagnostic.completed,false);assert.equal(diagnostic.pendingReceipt,true);
    if(!options.ack)assert.equal(diagnostic.stateSaveCallsStarted,options.cas?1:0,'CAS counts its original attempted save, never an additional save');
    if(label==='R2-returned-absence'){assert.equal(diagnostic.preferenceGuard.site,'plan_scope');assert.equal(diagnostic.preferenceGuard.side,'remote');}
   }else{
    assert.equal(caught,undefined,label);assert.equal(diagnostic.completed,true);assert.equal(c.pendingPreferenceIntent('A'),null);
    assert.deepEqual(api.state().preferences.tennis,options.expectedTennis||defaultTennis);
    if(options.expectedTennis)assert.equal(calls.writes,1,'only existing recorded independent fields may be saved');
    assert.deepEqual(api.state().preferences.followFirst,remote.preferences.followFirst,'no event consent invented');
    assert.deepEqual(api.state().preferences.preferenceGraph.entityFollows,beforeRemote.preferences.preferenceGraph.entityFollows,'no entity consent invented');
    assert.equal(api.state().preferences.preferenceGraph.domainPreferences.length,1,'only pre-existing domain');
    assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].sportDomainId,'sport:football');
    assert.equal(api.state().preferences.preferenceGraph.domainPreferences[0].templateId,options.kind==='R2-domain'?'template:froth':'template:casual');
    assert.equal(c.userPreferences.feedCompact,false,'local view remains on this device');
    if(label==='accepted-false')assert.equal(diagnostic.preferenceDifferences.receiptBaseMatchesAccepted,false);
    if(label==='accepted-true')assert.equal(diagnostic.preferenceDifferences.receiptBaseMatchesAccepted,true);
   }
   console.log(JSON.stringify({kind:'tennis-default-'+label,passed:true,sourceQualified:true,generatedCandidateQualified:false,
    privatePhoneKeyIdentified:false,loads:calls.reads,saves:calls.writes,guard:diagnostic.preferenceGuard,receiptBaseMatchesAccepted:diagnostic.preferenceDifferences?.receiptBaseMatchesAccepted}));
   return {kind:label,passed:true};
  },
 };
}
// The invalid/missing fixtures below are explicit constructed guard controls,
// separate from positive tests driven only by the actual normalizer/writers.
module.exports=async function tennisDefaultTests(){
 // New ordinary writers retain their original accepted base while R1 is
 // pending. Advancing it before R2 correctly refuses recording at the writer.
 const cases=[
  ['accepted-false',{}],['accepted-true',{acceptRemote:false}],['composed-events-scope',{kind:'actual-events-all'}],['R2-domain',{kind:'R2-domain',acceptRemote:false}],
  ['base-null',{held:true,seed:s=>{s.preferences.tennis=null;}}],
  ['base-nondefault',{held:true,seed:s=>{s.preferences.tennis={...defaultTennis,round:'final'};},intent:p=>{p.tennis=clone(defaultTennis);}}],
  ['intent-absent',{held:true,rawIntent:p=>{delete p.tennis;}}],
  ['remote-absent',{held:true,remote:s=>{delete s.preferences.tennis;}}],
  ['intent-extra',{held:true,intent:p=>{p.tennis.extra=true;}}],
  ['remote-extra',{held:true,remote:s=>{s.preferences.tennis.extra=true;}}],
  ['intent-partial',{held:true,rawIntent:p=>{delete p.tennis.round;}}],
  ['remote-null',{held:true,remote:s=>{s.preferences.tennis=null;}}],
  ['intent-nondefault',{held:true,intent:p=>{p.tennis.round='final';}}],
  ['remote-nondefault',{held:true,remote:s=>{s.preferences.tennis.round='final';}}],
  ['both-nondefault',{held:true,intent:p=>{p.tennis.round='final';},remote:s=>{s.preferences.tennis.round='final';}}],
  ['opaque-root',{held:true,kind:'constructed-opaque-root'}],
  ['container-absence',{held:true,kind:'constructed-parent-absence'}],
  ['domain-conflict',{held:true,kind:'domain-conflict'}],
  ['owner-read',{kind:'owner-read'}],['generation-read',{kind:'generation-read'}],
  ['ACK-tennis-change',{held:true,ack:s=>{s.preferences.tennis.round='final';}}],
  ['ACK-tennis-missing',{held:true,ack:s=>{delete s.preferences.tennis;}}],
  ['ACK-event',{held:true,ack:s=>{const states=s.preferences.followFirst.eventEditionDecisions.states;const key=Object.keys(states)[0];assert(key);states[key]='excluded';}}],
  ['ACK-scope',{kind:'actual-events-all',held:true,ack:s=>{s.preferences.eventsScope='followed';}}],
  ['R2-tennis',{r2:true,acceptRemote:false}],
  ['R2-returned-absence',{held:true,acceptRemote:false,rawIntent:p=>{delete p.tennis;},remote:(s,{receipt})=>{
   // All actually recorded changes already agree; semantic delta omits this
   // return to absent base, so only the absent-base compatible-intent fence holds.
   s.preferences=clone(receipt.preferences);s.preferences.tennis=clone(defaultTennis);
  }}],
  ['current-tennis',{held:true,beforeSync:({c,receipt})=>{
   const next=clone(c.userPreferences);next.tennis.round='final';assert(c.savePreferences(next,{deferFollowEffects:true}));
   assert.deepEqual(clone(c.pendingPreferenceIntent('A')),receipt,'ordinary current edit leaves pending receipt intact');
  }}],
  ['base-owned-remote-only',{acceptRemote:false,skipEvent:true,seed:s=>{s.preferences.tennis=clone(defaultTennis);},
   remote:(s,{receipt})=>{s.preferences=clone(receipt.preferences);s.preferences.tennis.round='final';},expectedTennis:{...defaultTennis,round:'final'}}],
  ['cas-tennis',{held:true,cas:true,beforeSync:({api})=>api.raceOnce(()=>api.mutate(s=>{s.preferences.tennis.round='final';}))}],
 ];
 const results=[];
 for(const [label,options]of cases)results.push(await runCase(options.kind||'actual-events-unchanged',fixture(label,options)));
 console.log('Tennis default: '+results.length+' finite source writer/receipt/API cases passed; historical default is not private-phone attribution.');
 return results;
};
