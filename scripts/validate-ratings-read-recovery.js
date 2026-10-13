#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createReadRecovery}=require('../config/nsc-submission-state');
function clock(){
 let now=1_000_000,id=0;const timers=new Map();
 return {now:()=>now,setTimer(fn,wait){const key=++id;timers.set(key,{at:now+wait,fn});return key;},clearTimer(key){timers.delete(key);},
  advance(ms){const end=now+ms;let runs=0;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;assert(++runs<1000,'timer must not spin');now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;},size:()=>timers.size};
}
function harness(ids=['fixture']){
 const time=clock(),calls=[],pending=new Set();let active=true,mounted=ids;
 const recovery=createReadRecovery({...time,active:()=>active,eligible:()=>mounted,pending:id=>pending.has(id),retry:batch=>{calls.push({at:time.now(),ids:batch});batch.forEach(id=>pending.add(id));}});
 return {time,calls,pending,recovery,active(value){active=value;recovery.sync();},mount(value){mounted=value;recovery.sync();},fail(id='fixture'){pending.delete(id);recovery.failure(id);},succeed(id='fixture'){pending.delete(id);recovery.success(id);}};
}
const cycle=harness();cycle.fail();assert.equal(cycle.time.size(),1,'one shared recovery timer');
for(const [attempt,wait]of [[1,30_000],[2,60_000],[3,120_000]]){
 cycle.time.advance(wait-1);assert.equal(cycle.calls.length,attempt-1);cycle.time.advance(1);assert.equal(cycle.calls.length,attempt);assert.equal(cycle.recovery.state('fixture').attempts,attempt);cycle.fail();
}
assert(cycle.recovery.state('fixture').exhausted);cycle.time.advance(999_999);assert.equal(cycle.calls.length,3,'exhaustion must survive time and redraws');cycle.recovery.sync();assert.equal(cycle.time.size(),0);
assert(cycle.recovery.manual('fixture'));assert.equal(cycle.calls.length,4);assert(!cycle.recovery.manual('fixture'),'manual clicks coalesce with a read already pending');cycle.fail();cycle.time.advance(30_000);assert.equal(cycle.calls.length,5,'manual failure starts a fresh cycle');cycle.succeed();assert.equal(cycle.time.size(),0);assert.equal(cycle.recovery.state('fixture').attempts,0);
const paused=harness();paused.fail();paused.active(false);paused.time.advance(300_000);assert.equal(paused.calls.length,0,'hidden/offline views make no retry read');assert(!paused.recovery.manual('fixture'));paused.active(true);paused.time.advance(0);assert.equal(paused.calls.length,1,'resume makes one due attempt');paused.fail();paused.time.advance(59_999);assert.equal(paused.calls.length,1);paused.time.advance(1);assert.equal(paused.calls.length,2,'resume does not consume every elapsed interval');
const route=harness();route.fail();route.mount([]);route.time.advance(300_000);assert.equal(route.calls.length,0,'unmounted/compact rows do not retry');route.mount(['fixture']);route.time.advance(0);assert.equal(route.calls.length,1);route.recovery.reset();route.pending.clear();route.time.advance(999_999);assert.equal(route.calls.length,1,'account reset cancels prior recovery');
const ids=Array.from({length:121},(_,i)=>'fixture:'+i),batch=harness(ids);batch.active(false);ids.forEach(id=>batch.fail(id));batch.time.advance(300_000);batch.active(true);batch.time.advance(0);assert.equal(batch.calls.length,1);assert.equal(batch.calls[0].ids.length,50,'foreground overdue reads retain the fifty-ID cap');batch.time.advance(29_999);assert.equal(batch.calls.length,1,'no immediate resume drain');batch.time.advance(1);assert.equal(batch.calls.length,2);assert.equal(batch.calls[1].ids.length,50);assert(batch.time.size()<=1);

// Exercise the actual browser loader, registration and poll candidate guards.
const html=fs.readFileSync('index.html','utf8')+'\n'+fs.readFileSync('config/venue-panel-ui.js','utf8');
function source(name){const match=html.match(new RegExp(`(?:async )?function ${name}\\([^\\n]*\\{[\\s\\S]*?\\n\\}`));assert(match,'actual function '+name);return match[0];}
const time=clock(),requests=[],nodes=new Map(),errors=new Map(),snapshots=new Map(),inFlight=new Set(),pending=new Set();
const client={NOTHINGSCORE:{},serverPersistence:{user:{id:'owner'}},nothingscoreReadGeneration:0,nothingscoreSnapshots:snapshots,nothingscoreLoadedAt:new Map(),nothingscoreLoadErrors:errors,nothingscoreBatchInFlight:inFlight,nothingscorePendingIds:pending,nothingscoreBatchTimer:null,nothingscoreViewer:null,
 Date:class extends Date{static now(){return time.now();}},navigator:{onLine:true},document:{visibilityState:'visible',querySelectorAll(selector){return selector.startsWith('.event-card')?[...nodes.values()].map(node=>({getClientRects:()=>[{}],dataset:{eventId:node.dataset.nscEventId},querySelector:()=>node})):[...nodes.values()];}},window:{setTimeout:time.setTimer,clearTimeout:time.clearTimer},console:{warn(){}},nothingscoreQueueRender(){},mergeNothingscoreSnapshot(value){snapshots.set(value.eventId,value);return true;}};
client.serverSyncClient={async nothingscoreRequest({ids}){requests.push(ids);return {snapshots:ids.map(eventId=>({eventId,phase:'pulse',peerResults:{count:0}}))};}};
vm.createContext(client);vm.runInContext(['nothingscoreEventId','visibleNothingscoreReadIds','syncNothingscoreReadRecovery','nothingscoreReadRecoveryState','retryNothingscoreRatings','nothingscoreReadFailed','nothingscoreReadRecovered','loadNothingscoreBatch','flushNothingscoreBatch','registerNothingscoreEvent','visiblePulseNothingscoreIds'].map(source).join('\n'),client);
client.nothingscoreReadRecovery=createReadRecovery({...time,active:()=>client.document.visibilityState!=='hidden'&&client.navigator.onLine!==false,eligible:()=>client.visibleNothingscoreReadIds(),pending:id=>inFlight.has(id)||pending.has(id),retry:ids=>{ids.forEach(id=>pending.add(id));void client.flushNothingscoreBatch();}});
nodes.set('fixture',{dataset:{nscEventId:'fixture'},getClientRects:()=>[{}],closest:()=>null});
async function stalePollCannotChangeCurrentAccount(fails){
 const timers=new Map(),cleared=[],inFlight=new Set();let nextTimer=0,settle,syncs=0;
 const poll={nothingscoreReadGeneration:1,nothingscorePollFailures:0,nothingscorePollTimer:null,nothingscoreBatchInFlight:inFlight,
  navigator:{onLine:true},document:{visibilityState:'visible'},visiblePulseNothingscoreIds:()=>['shared-fixture'],
  window:{setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){cleared.push(id);timers.delete(id);}},
  loadNothingscoreBatch:()=>new Promise((resolve,reject)=>{settle=fails?reject:resolve;}),syncNothingscoreReadRecovery(){syncs++;}};
 vm.createContext(poll);vm.runInContext(source('scheduleNothingscorePoll'),poll);
 poll.scheduleNothingscorePoll();const oldCallback=timers.get(poll.nothingscorePollTimer),late=oldCallback();
 poll.nothingscoreReadGeneration++;poll.nothingscorePollFailures=2;poll.scheduleNothingscorePoll();
 const currentTimer=poll.nothingscorePollTimer,clearCount=cleared.length,timerCount=nextTimer;
 settle(fails?Error('old account poll failure'):undefined);await late;
 assert.equal(poll.nothingscorePollFailures,2,`stale ${fails?'failed':'successful'} poll cannot change the current account's failure count`);
 assert.equal(poll.nothingscorePollTimer,currentTimer,'stale completion must preserve the current account timer');
 assert.equal(cleared.length,clearCount,'stale completion cannot clear current timers');
 assert.equal(nextTimer,timerCount,'stale completion cannot schedule a replacement poll');
 assert(inFlight.has('shared-fixture'),'stale completion cannot release a current account in-flight ID');
 assert.equal(syncs,0,'stale completion cannot sync current account recovery');
}
(async()=>{
 client.nothingscoreReadFailed('fixture');time.advance(300_000);await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,1);assert(!errors.has('fixture'),'successful timed read clears the error');
 client.nothingscoreReadFailed('fixture');const count=requests.length;for(let i=0;i<10;i++)client.registerNothingscoreEvent({id:'fixture'});time.advance(0);assert.equal(requests.length,count,'redraw does not bypass a failed-read budget');assert.equal(client.visiblePulseNothingscoreIds().length,0,'pulse polling excludes failed IDs');
 const saved={eventId:'fixture',phase:'pulse',peerResults:{count:4,average:4},currentUser:{submissions:{pulse:{rating:4}}}};snapshots.set('fixture',saved);
 client.serverSyncClient.nothingscoreRequest=async()=>{throw Error('controlled read failure');};await assert.rejects(client.loadNothingscoreBatch(['fixture']));assert.equal(snapshots.get('fixture'),saved,'failure retains last-good vote and totals');
 client.document.visibilityState='hidden';client.syncNothingscoreReadRecovery();time.advance(300_000);assert.equal(requests.length,count);client.navigator.onLine=false;client.document.visibilityState='visible';client.syncNothingscoreReadRecovery();time.advance(300_000);assert.equal(requests.length,count);
 let resolve;client.serverSyncClient.nothingscoreRequest=()=>new Promise(r=>{resolve=r;});const late=client.loadNothingscoreBatch(['private']);client.nothingscoreReadGeneration+=2;resolve({snapshots:[{eventId:'private',phase:'heat',currentUser:{submissions:{heat:{rating:5}}}}]});await late;assert(!snapshots.has('private'),'a same-owner sign-out/sign-in generation cannot accept an old private response');
 let reject;client.serverSyncClient.nothingscoreRequest=()=>new Promise((_,r)=>{reject=r;});const oldFailure=client.loadNothingscoreBatch(['old-owner']);client.nothingscoreReadGeneration++;reject(Error('old account failure'));await assert.rejects(oldFailure);assert(!errors.has('old-owner'),'old failures cannot schedule recovery for a new account');
 await stalePollCannotChangeCurrentAccount(false);await stalePollCannotChangeCurrentAccount(true);
 console.log('Ratings reads: bounded 30/60/120 recovery, manual coalescing, foreground batches, route/offline cancellation, last-good privacy and account-generation fences pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
