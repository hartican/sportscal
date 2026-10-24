#!/usr/bin/env node
"use strict";
// Execute the real browser transaction/merge functions against controlled transport.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const state = require("../config/nsc-submission-state");
const html = fs.readFileSync(path.join(__dirname,"../index.html"),"utf8")+'\n'+fs.readFileSync(path.join(__dirname,"../config/venue-panel-ui.js"),'utf8');
function extract(name){
  const start = html.search(new RegExp("(?:async )?function "+name+"\\("));
  assert(start>=0,name);
  const end = html.slice(start+1).search(/\n(?:async )?function /);
  return html.slice(start,end<0?undefined:start+1+end);
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function panel(){
  const root={current:"form",querySelector(){return root.current==="form"?{replaceWith(n){root.current=n.className;}}:null;},querySelectorAll(){return[];}};
  return root;
}
function harness(request,persisted=new Map()){
  const context={Map,Date,console,globalThis:null,NOTHINGSPORTS_NSC_SUBMISSION_STATE:state,
    serverPersistence:{user:{id:"account-a"}},serverSyncClient:{nothingscoreRequest:request,accountSnapshot:()=>({generation:0})},
    nothingscoreSnapshots:new Map([["alias",{eventId:"alias",canonicalEventId:"canonical",phase:"impact",currentUser:{submissions:{}}}]]),
    nothingscoreLoadedAt:new Map(),nothingscoreSubmissionRequests:new Map(),
    nothingscoreSubmissionStore:state.createStore({read:key=>persisted.get(key),write:(key,value)=>persisted.set(key,value)}),
    nothingscoreViewer:{},nothingscoreReadGeneration:0,activeNothingscoreContributionEvent:null,
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
function readHarness(request){
  const context=harness(request);
  Object.assign(context,{
    NOTHINGSCORE:{},nothingscoreLoadErrors:new Map([["alias",1]]),nothingscoreDetailLoading:new Set(),
    nothingscoreBatchInFlight:new Set(),nothingscorePendingIds:new Set(),nothingscoreBatchTimer:null,
    nothingscorePollTimer:null,nothingscorePollFailures:0,scheduleNothingscorePoll(){},
    nothingscoreWatching:new Set(),nothingscoreHeartbeatTimer:null,nscRankingGeneration:0,
    nscDetailEvents:new Map(),nscRankingState:{},nscOpenedFromRankings:false,
    history:{pushState(){}},window:{clearTimeout(){}},refreshNothingscoreDrawer(){},
    recovered:0,nothingscoreReadRecovery:{success(){context.recovered++;},reset(){}},
    getEventStatus:()=>"past",nothingscoreEventId:()=>"alias",setNothingscoreDrawerOpen(){},
  });
  context.document.body={classList:{contains:()=>false}};
  context.document.getElementById=()=>({classList:{contains:()=>true},querySelector:()=>null});
  ["nothingscoreReadRecovered","loadNothingscoreDetail","openNothingscoreContribution","syncNothingscoreSessionState"].forEach(name=>vm.runInContext(extract(name),context));
  return context;
}
function replaceReadSession(context){
  context.serverPersistence.user=null;context.syncNothingscoreSessionState("account-a","");
  context.serverPersistence.user={id:"account-a"};context.syncNothingscoreSessionState("","account-a");
  const current={eventId:"alias",canonicalEventId:"canonical",phase:"impact",peerResults:{count:4,average:4},currentUser:{submissions:{impact:{...receipt,rating:4}}}};
  context.nothingscoreSnapshots.set("alias",current);
  context.nothingscoreLoadErrors.set("alias",2);
  return current;
}
const command={action:"submit",phase:"impact",eventId:"alias",rating:4,tags:["Close"]};
const receipt={...command,submittedAt:"2026-09-05T01:00:00Z",pointsAwarded:3,replayed:false};
const detail=(submission=null)=>({detail:{eventId:"alias",canonicalEventId:"canonical",phase:"impact",currentUser:{submissions:submission?{impact:submission}:{}}}});
async function main(){
  const resultsContext=harness(async()=>detail());
  let resultsOpened=false;
  resultsContext.nothingscoreLoadErrors=new Map([["alias",1]]);
  resultsContext.nothingscoreReadRecovery={success(){}};
  vm.runInContext(extract("nothingscoreReadRecovered"),resultsContext);
  resultsContext.nscDetailEvents=new Map();
  resultsContext.nscRankingState={};
  resultsContext.history={pushState(){}};
  resultsContext.document.body={classList:{contains:()=>false}};
  resultsContext.getEventStatus=()=>"past";
  resultsContext.nothingscoreEventId=()=>"alias";
  resultsContext.setNothingscoreDrawerOpen=()=>{};
  resultsContext.document.getElementById=()=>({classList:{contains:()=>true},querySelector:()=>({setAttribute:name=>{if(name==="open")resultsOpened=true;}})});
  vm.runInContext(extract("openNothingscoreContribution"),resultsContext);
  await resultsContext.openNothingscoreContribution({id:"alias"},{showResults:true});
  assert.equal(resultsOpened,true,"View results must reveal the breakdown without a second tap");
  assert(!resultsContext.nothingscoreLoadErrors.has("alias"),"a valid detail read settles the existing summary failure");
  for(const name of ["loadNothingscoreDetail","openNothingscoreContribution"]){
    for(const failure of [false,true]){
      const late=deferred(),fresh=deferred();let reads=0,newRequest;
      const context=readHarness(()=>reads++===0?late.promise:fresh.promise);
      const request=context[name]({id:"alias"});
      const current=replaceReadSession(context),viewer=context.nothingscoreViewer;
      if(name==="loadNothingscoreDetail"){
        assert(!context.nothingscoreDetailLoading.has("alias"),"account reset releases old detail-read ownership");
        newRequest=context.loadNothingscoreDetail({id:"alias"});
        assert.equal(reads,2,"the new session can start its own same-ID detail read");
      }
      if(failure)late.reject(new Error("old account detail failure"));
      else late.resolve({...detail({...receipt,rating:1}),viewer:{signedIn:true,private:"old generation"}});
      await request;
      assert.equal(context.nothingscoreSnapshots.get("alias"),current,name+" cannot merge a late same-owner response");
      assert.equal(context.nothingscoreViewer,viewer,name+" cannot restore the old viewer");
      assert.equal(context.nothingscoreLoadErrors.get("alias"),2,name+" cannot clear the new summary failure");
      assert.equal(context.recovered,0,name+" cannot settle the new recovery cycle");
      assert.equal(context.activeNothingscoreContributionError||"","",name+" cannot attach an old account error");
      if(name==="loadNothingscoreDetail")assert(context.nothingscoreDetailLoading.has("alias"),"an old completion cannot release a newer same-ID detail read");
      if(newRequest){fresh.resolve({});await newRequest;assert(!context.nothingscoreDetailLoading.has("alias"),"the current-generation detail completion releases its own ownership");}
    }
  }
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
  console.log("PASS actual NSC client: double tap, pending reopen, stale GET, lost response, reload, canonical lock, account switch, late same-owner detail/contribution generation fences and once-only sound.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
