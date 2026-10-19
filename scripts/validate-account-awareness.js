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
 const noProfile=model.accountView({...facts,profileOwnerId:'account-b'});assert.equal(noProfile.identity,'private@example.test');assert.equal(noProfile.avatarUrl,'');assert(!noProfile.label.includes('long_public'));cases++;
 const named=model.accountView({...facts,profile:{displayName:'Jack Hartican'}});assert.equal(named.label,'Jack Hartican');assert.equal(named.initials,'JH');cases++;
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
 assert.equal(another.avatarUrl,'');assert.equal(another.identity,'other@example.test');cases++;
 assert.throws(()=>model.scopeFor(view,{appSessionId:'',accountEpoch:0}),/app session/);assert.throws(()=>model.actionDecision('change-results',view,{scope}),/Unsupported/);cases+=2;
}
assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|setInterval|setTimeout)\b|document\./,'the pure contract cannot perform requests, persistence, timers or UI mutations');
assert.equal(JSON.stringify(facts),originalFacts,'display/gate calculations cannot mutate input account/profile facts');
console.log(JSON.stringify({passed:true,cases,scope:'Pure server/browser display and dispatch contract only; no UI integration, authentication, persistence, consent, network or real-account proof'}));
