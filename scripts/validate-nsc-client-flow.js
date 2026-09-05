#!/usr/bin/env node
"use strict";
// Execute the real browser transaction/merge functions against controlled transport.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const state = require("../config/nsc-submission-state");
const html = fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
function extract(name){
  const start = html.search(new RegExp("(?:async )?function "+name+"\\("));
  assert(start>=0,name);
  const end = html.slice(start+1).search(/\n(?:async )?function /);
  return html.slice(start,start+1+end);
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function panel(){
  const root={current:"form",querySelector(){return root.current==="form"?{replaceWith(n){root.current=n.className;}}:null;},querySelectorAll(){return[];}};
  return root;
}
function harness(request,persisted=new Map()){
  const context={Map,Date,console,globalThis:null,NOTHINGSPORTS_NSC_SUBMISSION_STATE:state,
    serverPersistence:{user:{id:"account-a"}},serverSyncClient:{nothingscoreRequest:request},
    nothingscoreSnapshots:new Map([["alias",{eventId:"alias",canonicalEventId:"canonical",phase:"impact",currentUser:{submissions:{}}}]]),
    nothingscoreLoadedAt:new Map(),nothingscoreSubmissionRequests:new Map(),
    nothingscoreSubmissionStore:state.createStore({read:key=>persisted.get(key),write:(key,value)=>persisted.set(key,value)}),
    nothingscoreViewer:{},activeNothingscoreContributionEvent:null,
    document:{createElement(){return{className:"",setAttribute(){},replaceWith(){}};}},
    sounds:0,renders:0,
    nothingscoreQueueRender(){context.renders++;},nothingscoreStatus(){},
    buildNothingscoreReceipt(){return{className:"receipt"};},buildNothingscorePending(){return{className:"confirming"};},
    nothingscorePhaseCopy(){return{name:"Impact"};},playNothingscoreImpactSound(){context.sounds++;},
    renderNothingscoreDrawer(){context.renders++;},
  };
  context.globalThis=context;
  vm.createContext(context);
  ["nothingscoreSubmissionKey","mergeNothingscoreSnapshot","reconcileNothingscoreSubmission","submitNothingscoreAction"].forEach(name=>vm.runInContext(extract(name),context));
  return context;
}
const command={action:"submit",phase:"impact",eventId:"alias",rating:4,tags:["Close"]};
const receipt={...command,submittedAt:"2026-09-05T01:00:00Z",pointsAwarded:3,replayed:false};
const detail=(submission=null)=>({detail:{eventId:"alias",canonicalEventId:"canonical",phase:"impact",currentUser:{submissions:submission?{impact:submission}:{}}}});
async function main(){
  const client = require("../config/server-sync").createClient({
    requestTimeoutMs:5,storage:null,persistentStorage:null,
    fetchImpl:(_url,options) => new Promise((_resolve,reject) => options.signal.addEventListener("abort",() => reject(new Error("aborted")))),
  });
  await assert.rejects(client.nothingscoreRequest({eventId:"test-timeout"}),error => error.code === "request_timeout");
  const gate=deferred();let posts=0;
  const context=harness(async(_query,body)=>body?(posts++,gate.promise):detail());
  const firstPanel=panel(),first=context.submitNothingscoreAction(command,firstPanel);
  assert.equal(firstPanel.current,"nsc-submission-receipt is-confirming","form must disappear before the POST settles");
  const second=context.submitNothingscoreAction(command,panel());
  context.mergeNothingscoreSnapshot(detail().detail);
  const reopened=context.submitNothingscoreAction(command,panel());
  assert.equal(posts,1,"double tap and reopen while pending must share one POST");
  gate.resolve(receipt);await Promise.all([first,second,reopened]);
  await context.submitNothingscoreAction(command,panel());
  context.mergeNothingscoreSnapshot(detail().detail);
  assert.equal(posts,1);assert.equal(context.sounds,1);
  assert.equal(context.nothingscoreSnapshots.get("alias").currentUser.submissions.impact.rating,4,"late empty GET cannot erase confirmation");
  assert.equal(context.nothingscoreSubmissionStore.get("account-a|canonical|impact").receipt.rating,4);

  let lostPosts=0;
  const lost=harness(async(_query,body)=>{if(body){lostPosts++;throw new Error("response lost");}return detail(receipt);});
  await lost.submitNothingscoreAction(command,panel());
  await lost.submitNothingscoreAction(command,panel());
  assert.equal(lostPosts,1);assert.equal(lost.sounds,0,"reconciled receipt must not replay reward sound");

  let uncertainPosts=0;
  const persisted=new Map();
  const uncertain=harness(async(_query,body)=>{if(body)uncertainPosts++;throw new Error("offline");},persisted);
  await uncertain.submitNothingscoreAction(command,panel());
  await uncertain.submitNothingscoreAction(command,panel());
  assert.equal(uncertainPosts,1,"unknown outcome requires a GET confirmation, never a blind retry");
  assert.equal(uncertain.nothingscoreSubmissionStore.get("account-a|canonical|impact").draft.rating,4);
  let reloadPosts=0;
  const reloaded=harness(async(_query,body)=>{if(body)reloadPosts++;return detail(receipt);},persisted);
  await reloaded.submitNothingscoreAction(command,panel());
  assert.equal(reloadPosts,0,"reload must reconcile the persisted uncertain transaction");

  const switchingGate=deferred();let accountGets=0;
  const switching=harness(async(_query,body)=>body?switchingGate.promise:(accountGets++,detail({...receipt,rating:1})));
  const switchingRequest=switching.submitNothingscoreAction(command,panel());
  switching.serverPersistence.user={id:"account-b"};switching.nothingscoreSnapshots.clear();
  switchingGate.reject(new Error("lost after account switch"));await switchingRequest;
  assert.equal(accountGets,0,"old account failure must not reconcile against the new account");
  assert.equal(switching.nothingscoreSnapshots.size,0);
  assert.equal(Boolean(switching.nothingscoreSubmissionStore.get("account-a|canonical|impact").receipt),false);
  console.log("PASS actual NSC client: double tap, pending reopen, stale GET, lost response, reload, canonical lock, account switch and once-only sound.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
