#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../config/account-awareness');
const source=fs.readFileSync(path.join(__dirname,'../config/account-awareness.js'),'utf8');
const browser={globalThis:{}};vm.runInNewContext(source,browser);
const now=Date.parse('2026-10-19T01:00:00Z');
const facts={state:'signedIn',user:{id:'account-a',email:'private@example.test'},sessionOwnerId:'account-a',sessionExpiresAt:now+3600000,profile:{handle:'long_public_handle',displayName:'Jack Hartican',avatarUrl:'https://example.test/avatar-a'},profileOwnerId:'account-a',now};
const originalFacts=JSON.stringify(facts);
let cases=0;
for(const model of [api,browser.globalThis.NOTHINGSPORTS_ACCOUNT_AWARENESS]){
 const view=model.accountView(facts);assert.equal(view.status,'signedIn');assert.equal(view.label,'@long_public_…');assert.equal(view.identity,'@long_public_handle');assert.equal(view.initials,'JH');assert.equal(view.avatarUrl,facts.profile.avatarUrl);assert.match(view.ariaLabel,/@long_public_handle/);cases++;
 const local=model.accountView({...facts,state:'signedOut'});assert.equal(local.label,'Not signed in');assert.equal(local.identity,'');assert.equal(local.avatarUrl,'');assert.equal(local.accountId,'');cases++;
 const anonymous=model.accountView({...facts,user:{...facts.user,isAnonymous:true}});assert.equal(anonymous.status,'signedOut');assert.equal(anonymous.identity,'');cases++;
 const noProfile=model.accountView({...facts,profileOwnerId:'account-b'});assert.equal(noProfile.identity,'Account');assert.equal(noProfile.avatarUrl,'');assert(!noProfile.label.includes('long_public'));cases++;
 const named=model.accountView({...facts,profile:{displayName:'Jack Hartican'}});assert.equal(named.label,'Account');assert.equal(named.initials,'JH');cases++;
 const appName=model.accountView({...facts,user:{...facts.user,displayName:'Jordan Carter'},profile:{handle:'different_handle',displayName:'Avery Lane'}});assert.equal(appName.initials,'AL');cases++;
 assert(!JSON.stringify(noProfile).includes(facts.user.email),'header never falls back to email');
 const missingName=model.accountView({...facts,user:{...facts.user,displayName:'Jordan Carter'},profile:{handle:'name_unavailable'}});assert.equal(missingName.initials,'','missing app name uses a neutral icon, never auth/handle initials');cases++;
 const checking=model.accountView({...facts,state:'checking'});assert.equal(checking.label,'Checking account…');assert.equal(checking.identity,'');assert.equal(checking.avatarUrl,'');cases++;
 const switched=model.accountView({...facts,user:{...facts.user,displayName:'Old Account'},sessionOwnerId:'account-b'});assert.equal(switched.status,'reconnect');assert.equal(switched.label,'Check sign-in');assert.equal(switched.identity,'');assert.equal(switched.avatarUrl,'');assert.equal(switched.initials,'');cases++;
 const offline=model.accountView({...facts,online:false});assert.equal(offline.status,'offline');assert.match(offline.label,/^Offline · @/);assert.match(offline.ariaLabel,/Signed in as/);cases++;
 const error=model.accountView({...facts,state:'error'});assert.equal(error.status,'signedIn','a sync error is not a logout');cases++;
 const expired=model.accountView({...facts,sessionExpiresAt:now,online:false});assert.equal(expired.status,'reconnect');assert.match(expired.label,/^Reconnect · /);assert(!expired.ariaLabel.includes('Signed in as'));cases++;
 const scope=model.scopeFor(view,{appSessionId:'app-one',accountEpoch:1}),guestScope=model.scopeFor(local,{appSessionId:'app-one',accountEpoch:2});
 const acknowledgement=model.acknowledgeGuest(local,guestScope);assert(acknowledgement);assert.equal(model.acknowledgeGuest(view,scope),null);cases++;
 for(const action of ['follow','unfollow','save','unsave']){
  assert.equal(model.actionDecision(action,local,{scope:guestScope}),'prompt-guest');
  assert.equal(model.actionDecision(action,local,{scope:guestScope,guestAcknowledgement:acknowledgement}),'continue-local');
  assert.equal(model.actionDecision(action,view,{scope}),'continue-account');
  assert.equal(model.actionDecision(action,offline,{scope}),'continue-account');cases+=4;
 }
 for(const action of ['rate','reminder-on']){
  assert.equal(model.actionDecision(action,local,{scope:guestScope,guestAcknowledgement:acknowledgement}),'prompt-sign-in');
  assert.equal(model.actionDecision(action,view,{scope}),'continue-account');cases+=2;
 }
 for(const v of [local,checking,expired,view]){
  const s=model.scopeFor(v,{appSessionId:'app-one',accountEpoch:3});
  assert.equal(model.actionDecision('reminder-off',v,{scope:s}),'continue-off');cases++;
 }
 for(const v of [checking,expired,switched]){
  const s=model.scopeFor(v,{appSessionId:'app-one',accountEpoch:3});
  assert.equal(model.actionDecision('follow',v,{scope:s}),'resolve-account');cases++;
 }
 for(const replacement of [{appSessionId:'app-two',accountEpoch:2},{appSessionId:'app-one',accountEpoch:3}]){
  const s=model.scopeFor(local,replacement);assert.equal(model.actionDecision('follow',local,{scope:s,guestAcknowledgement:acknowledgement}),'prompt-guest');cases++;
 }
 const another=model.accountView({...facts,user:{id:'account-b',email:'other@example.test'},sessionOwnerId:'account-b'}),next=model.scopeFor(another,{appSessionId:'app-one',accountEpoch:4});
 for(const action of ['follow','rate','reminder-off']){assert.equal(model.actionDecision(action,another,{scope:next,intentScope:scope}),'cancel-stale');cases++;}
 assert.equal(another.avatarUrl,'');assert.equal(another.identity,'Account');cases++;
 assert.throws(()=>model.scopeFor(view,{appSessionId:'',accountEpoch:0}),/app session/);assert.throws(()=>model.actionDecision('change-results',view,{scope}),/Unsupported/);cases+=2;
}
assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|setInterval|setTimeout)\b|document\./,'the pure contract cannot perform requests, persistence, timers or UI mutations');
assert.equal(JSON.stringify(facts),originalFacts,'display/gate calculations cannot mutate input account/profile facts');
// Exercise the actual app acceptance callback and optional adapter mount order.
// Auth metadata deliberately differs from the existing public app profile.
const diagnosticSource=fs.readFileSync(path.join(__dirname,'../config/account-sync-diagnostic.js'),'utf8');
const appSource=fs.readFileSync(path.join(__dirname,'../assets/js/account-indicator-app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const acceptSource=html.slice(html.indexOf('function acceptNothingscoreViewer('),html.indexOf('function createChatState('));
const resetSource=html.slice(html.indexOf('function syncNothingscoreSessionState('),html.indexOf('async function refreshNothingscoreViewer('));
for(const helperFirst of [true,false]){
 let read;
 const life={accountId:'account-a',hasSession:true,generation:3,expiresAt:Date.now()+3600000};
 const host={contains:()=>false,replaceChildren:()=>{},classList:{contains:()=>false}};
 const context={console,Date,serverSyncClient:{accountSnapshot:()=>life},serverPersistence:{state:'signedIn',user:{id:'account-a',displayName:'Jordan Carter',email:'auth@example.invalid'}},accountIndicatorGeneration:3,nothingscoreViewer:{signedIn:false,profile:null},navigator:{onLine:true},accountIndicatorController:null,accountIndicatorJourney:null,document:{activeElement:null,getElementById:()=>host},NOTHINGSPORTS_ACCOUNT_AWARENESS_UI:{create:options=>{read=options.readSnapshot;return{render:()=>{}};}},renderAccountIndicator:()=>{}};
 context.nothingscoreViewerScope=null;context.globalThis=context;context.addEventListener=()=>{};context.document.addEventListener=()=>{};context.settingsSection='main';
 Object.assign(context,{NOTHINGSCORE:{},nothingscoreReadGeneration:0,nothingscoreReadRecovery:{reset:()=>{}},nscRankingGeneration:0,nothingscorePollTimer:null,nothingscoreBatchTimer:null,nothingscoreHeartbeatTimer:null,scheduleNothingscorePoll:()=>{},nothingscoreQueueRender:()=>{},window:{clearTimeout:()=>{}}});
 for(const key of ['nothingscoreBatchInFlight','nothingscoreDetailLoading','nothingscoreSnapshots','nothingscoreLoadedAt','nothingscoreLoadErrors','nothingscorePendingIds','nothingscoreWatching'])context[key]=new Map();
 vm.createContext(context);vm.runInContext(diagnosticSource,context);vm.runInContext(acceptSource+resetSource,context);
 const viewer={signedIn:true,profile:{displayName:'Casey Vale',handle:'casey',avatarUrl:'https://example.invalid/profile-thumbnail.webp'}};
 if(helperFirst)vm.runInContext(appSource,context);
 context.acceptNothingscoreViewer(viewer,'account-a',3);
 if(!helperFirst)vm.runInContext(appSource,context);
 context.NOTHINGSPORTS_ACCOUNT_INDICATOR_APP.mount();const snapshot=read(),actual=api.accountView(snapshot.facts);
 console.log(JSON.stringify({profileHydrationOrder:helperFirst?'helper-before-profile':'profile-before-helper',actual:{initials:actual.initials,avatarUrl:actual.avatarUrl},expected:{initials:'CV',avatarUrl:viewer.profile.avatarUrl}}));
 assert.equal(actual.avatarUrl,viewer.profile.avatarUrl,'current accepted app picture must survive optional helper mount order');assert.equal(actual.initials,'CV','initials use current app display name');cases+=2;
 const current=()=>api.accountView(read().facts);
 life.accountId='account-b';life.generation=4;context.accountIndicatorGeneration=4;context.serverPersistence.user={id:'account-b',displayName:'Jordan Carter'};
 context.syncNothingscoreSessionState('account-a','account-b');assert.equal(context.nothingscoreViewerScope,null);assert.equal(current().avatarUrl,'');assert.equal(current().initials,'');cases++;
 const other={signedIn:true,profile:{displayName:'Blair Stone',avatarUrl:'https://example.invalid/profile-b.webp'}};context.acceptNothingscoreViewer(other,'account-b',4);assert.equal(current().initials,'BS');assert.equal(current().avatarUrl,other.profile.avatarUrl);cases++;
 context.acceptNothingscoreViewer(viewer,'account-a',3);assert.equal(current().initials,'BS');cases++;
 life.accountId='account-a';life.generation=5;context.accountIndicatorGeneration=5;context.serverPersistence.user={id:'account-a'};context.syncNothingscoreSessionState('account-b','account-a');assert.equal(context.nothingscoreViewerScope,null);
 context.acceptNothingscoreViewer(viewer,'account-a',5);context.acceptNothingscoreViewer({profile:{displayName:'Prior Lifetime',avatarUrl:'https://example.invalid/old.webp'}},'account-a',3);assert.equal(current().initials,'CV');assert.equal(current().avatarUrl,viewer.profile.avatarUrl);cases++;
 context.serverPersistence.state='checking';assert.equal(current().initials,'');assert.equal(current().avatarUrl,'');context.serverPersistence.state='signedIn';cases++;
 context.syncNothingscoreSessionState('account-a',null);assert.equal(context.nothingscoreViewerScope,null);assert.equal(context.nothingscoreViewer.profile,null);cases++;
}
async function viewerRequestLifetimes(){
 const refreshSource=html.slice(html.indexOf('async function refreshNothingscoreViewer('),html.indexOf('let nscReturnPosition'));
 const life={accountId:'account-a',generation:3,hasSession:true};const reads=[];let renders=0;
 const context={console,Date,serverPersistence:{user:{id:'account-a'}},serverSyncClient:{accountSnapshot:()=>life,nothingscoreRequest:options=>{assert.equal(options.viewer,true);return new Promise((resolve,reject)=>reads.push({resolve,reject}));}},nothingscoreViewer:{signedIn:false,profile:null},nothingscoreViewerScope:null,publicProfileSettingsLoading:null,settingsSection:'account',document:{getElementById:()=>({classList:{contains:()=>true}})},renderSettingsScreen:()=>renders++};
 context.globalThis=context;vm.createContext(context);vm.runInContext(acceptSource+refreshSource,context);
 const viewer=handle=>({viewer:{signedIn:true,profile:{handle,displayName:'Current Person'}}});
 const first=context.refreshNothingscoreViewer(),joined=context.refreshNothingscoreViewer();assert.equal(reads.length,1,'concurrent current-scope calls share one read');
 life.accountId='account-b';life.generation=4;context.serverPersistence.user={id:'account-b'};
 const second=context.refreshNothingscoreViewer(),secondRequest=context.publicProfileSettingsLoading;
 reads[0].resolve(viewer('old_a'));await first;await joined;assert.equal(context.nothingscoreViewerScope,null);assert.equal(context.publicProfileSettingsLoading,secondRequest);assert.equal(renders,0,'stale finally cannot repaint current Account');
 reads[1].resolve(viewer('current_b'));await second;assert.equal(context.nothingscoreViewer.profile.handle,'current_b');assert.equal(renders,1);
 const priorB=context.refreshNothingscoreViewer();life.accountId='account-a';life.generation=5;context.serverPersistence.user={id:'account-a'};
 const aReturn=context.refreshNothingscoreViewer();reads[3].resolve(viewer('current_a'));await aReturn;reads[2].reject(Error('old owner failure'));await priorB;
 assert.equal(context.nothingscoreViewer.profile.handle,'current_a');assert.equal(context.publicProfileSettingsLoading.error,'');assert.equal(renders,2);
 const priorEpoch=context.refreshNothingscoreViewer();life.generation=6;const currentEpoch=context.refreshNothingscoreViewer();reads[5].resolve(viewer('new_epoch'));await currentEpoch;reads[4].resolve(viewer('old_epoch'));await priorEpoch;
 assert.equal(context.nothingscoreViewer.profile.handle,'new_epoch');assert.equal(context.nothingscoreViewerScope.generation,6);assert.equal(renders,3);
 const unavailable=context.refreshNothingscoreViewer();reads[6].resolve({viewer:{signedIn:true,profileUnavailable:true,profile:null}});await assert.rejects(unavailable,/temporarily unavailable/);
 assert.equal(context.nothingscoreViewer.profile.handle,'new_epoch','transient failure preserves accepted current profile');assert.match(context.publicProfileSettingsLoading.error,/could not be loaded/);assert.equal(reads.length,7);assert.equal(renders,4);
 life.hasSession=false;await context.refreshNothingscoreViewer();assert.equal(reads.length,7,'no viewer request after session removal');cases+=12;
}
viewerRequestLifetimes().then(()=>require('./validate-account-sync-diagnostic')()).then(()=>console.log(JSON.stringify({passed:true,cases,scope:'Pure model plus actual app acceptance and async request lifetimes in an isolated VM; no real account or storage proof'}))).catch(error=>{console.error(error);process.exitCode=1;});
