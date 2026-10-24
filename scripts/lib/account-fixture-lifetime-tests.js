'use strict';
// Actual source timer -> deferred helper -> live owner -> request terminal; synthetic I/O only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),file='scripts/validate-account-sync-recovery-browser.js',baseline=process.env.FIXTURE_LIFETIME_BASELINE;
const source=['558a963a','3504aff6'].includes(baseline)?execFileSync('git',['show',baseline+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
const ownerSource=fs.readFileSync(path.join(root,'config/feed-live-score-loader.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve)),copy=value=>JSON.parse(JSON.stringify(value));
function watch(promise){const state={done:false};Promise.resolve(promise).then(value=>Object.assign(state,{done:true,value}),error=>Object.assign(state,{done:true,error}));return state;}
async function result(state){for(let i=0;i<20&&!state.done;i++)await turn();assert(state.done,'source regression failed to complete within controlled event turns');if(state.error)throw state.error;return state.value;}
function setup(){
 let release,releaseLoader,rejectLoader,fetchCalls=0;const response=new Promise(resolve=>{release=resolve;}),loading=new Promise((resolve,reject)=>{releaseLoader=resolve;rejectLoader=reject;});
 const sourceTimers=new Map(),waiters=new Set();let nextTimer=0;
 const id='event:football:australian-championship:2026:22278871';
 const FixedDate=class extends Date{constructor(...args){super(...(args.length?args:['2026-10-24T00:00:00Z']));}static now(){return 1792800000000;}};
 const b={console,Date:FixedDate,URL,Set,Map,AbortSignal:{timeout:ms=>{assert.equal(ms,5000);return undefined;}},document:{hidden:false,querySelectorAll:()=>[{closest:()=>({dataset:{feedEventId:id}})}]},startupCoordinator:{isHydrating:()=>false},activeTab:'feed',location:{protocol:'http:'},
  serverSyncClient:{sessionSubject:()=> 'A',accountSnapshot:()=>({accountId:'A',generation:0})},serverPersistence:{user:{id:'A'}},serverStateBaseline:{updatedAt:'disposable-base'},
  userPreferences:{theme:'day',fantasyDeadlines:{enabled:false}},eventActions:{},liveFixtureRefresh:null,liveFixtureRefreshQueued:false,liveFixtureRevision:'',liveFixtureLastRequestedAt:0,liveFixtureRequestedIds:new Set(),liveFixtureMountTimer:null,feedScoreUiLoading:null,
  feedCardSlots:new Map([['disposable',{slot:{dataset:{feedEventId:id}},event:{id,key:'football'}}]]),followedScheduleLoads:new Map(),followFeedRefreshInFlight:null,
  clonePreferences:copy,pendingPreferenceIntent:()=>({receiptId:'disposable-unchanged'}),PROFILE_STORAGE:require('../../config/profile-storage'),
  setTimeout:(callback,ms)=>{assert.equal(ms,250);const id=nextTimer++;sourceTimers.set(id,callback);return id;},clearTimeout:()=>{throw Error('Harness must never clear a source timer');},
  loadDeferredScript:()=>loading,fetch:()=>{fetchCalls++;n.onFetch?.();return response;}};
 vm.createContext(b);vm.runInContext(ownerSource,b);
 const queueStart=html.indexOf('function ensureFeedScoreUi(){'),queueEnd=html.indexOf('\nasync function loadFollowedScheduleFixtures(',queueStart);assert(queueStart>0&&queueEnd>queueStart);vm.runInContext(html.slice(queueStart,queueEnd),b);
 const request={},terminals=new Map(),requests=new Map();
 function terminal(){let finish;const entry={promise:new Promise(resolve=>{finish=resolve;}),result:null};entry.finish=kind=>{entry.result={kind};finish(entry.result);};return entry;}
 const entry=terminal();requests.set(request,{path:'/api/fixtures',startedEpoch:2});terminals.set(request,entry);
 const timers=new Map(),n={assert,console,Promise,documentEpoch:2,reads:0,writes:0,tracedRequests:requests,fixtureTerminals:terminals,traceResource(){},
  setTimeout:(callback,ms)=>{assert.equal(ms,8000);const id=timers.size+1;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
  page:{evaluate:async(fn,arg)=>{if(fn.toString().includes('unchanged:'))n.beforeFinalEvaluation?.();b.qaArgument=copy(arg??null);const value=await vm.runInContext('('+fn.toString()+')(qaArgument)',b);if(fn.toString().includes('unchanged:'))n.onFinalEvaluation?.();return value===undefined?undefined:copy(value);},
   waitForFunction:(fn,arg,options)=>{assert.equal(options.timeout,8000);return new Promise((resolve,reject)=>{waiters.add({fn,resolve,reject});notify();});}}};
 function notify(){for(const item of [...waiters]){try{if(vm.runInContext('('+item.fn.toString()+')()',b)){waiters.delete(item);item.resolve();}}catch(error){waiters.delete(item);item.reject(error);}}}
 vm.createContext(n);const from=source.indexOf('async function observeFixtureControl('),to=source.indexOf('function assertFixtureControlPending(',from);assert(from>0&&to>from);vm.runInContext(source.slice(from,to),n);
 const a=source.indexOf('    async function settlePrimaryFixtureBeforeReload(){'),end=source.indexOf('    page.setDefaultTimeout(15000);',a);
 if(a>=0)vm.runInContext(source.slice(a,end),n);
 else{const begin=source.indexOf('async trace => {',source.indexOf('const fixtureOwnerFacts=await page.evaluate(')),stop=source.indexOf('},traceApiStale);',begin);assert(begin>0&&stop>begin);const original=vm.runInContext('('+source.slice(begin,stop+1)+')',n);n.settlePrimaryFixtureBeforeReload=()=>n.page.evaluate(original,false);}
 return {b,n,entry,request,requests,terminals,timers,sourceTimers,terminal,notify,get fetchCalls(){return fetchCalls;},release:()=>release({status:503,ok:false}),releaseLoader,rejectLoader,
  owner:()=>b.NOTHINGSPORTS_FEED_SCORE_UI.refresh(),fireSourceTimer:()=>{const first=sourceTimers.entries().next().value;assert(first,'actual source timer is scheduled');sourceTimers.delete(first[0]);first[1]();notify();}};
}
module.exports=async function fixtureLifetimeTests(){
 let count=0;const run=async(name,test)=>{await test();count++;};
 await run('active-owner-and-terminal',async()=>{
  const s=setup(),active=s.owner(),work=watch(s.n.settlePrimaryFixtureBeforeReload());
  try{await turn();assert.equal(work.done,false,'normal barrier returned while its actual live fixture owner was active');s.release();await active;await turn();assert.equal(work.done,false,'actual owner completion cannot omit request terminal');s.entry.finish('finished');await result(work);assert.equal(s.b.liveFixtureRefresh,null);}
  finally{s.release();s.entry.finish('finished');await active;await turn();}
 });
 await run('actual-scheduled-helper-owner-terminal-chain',async()=>{
  const s=setup();s.requests.clear();s.terminals.clear();s.n.onFetch=()=>{s.requests.set(s.request,{path:'/api/fixtures',startedEpoch:2});s.terminals.set(s.request,s.entry);};
  s.b.queueLiveFixtureSnapshot();assert.equal(s.b.liveFixtureMountTimer,0,'zero is a real scheduled browser handle, not unset');
  const work=watch(s.n.settlePrimaryFixtureBeforeReload());
  try{
   await turn();assert.equal(work.done,false,'already scheduled source work must be drained, not rejected or ignored');assert.equal(s.fetchCalls,0);
   s.fireSourceTimer();await turn();assert.equal(s.b.liveFixtureMountTimer,null);assert.equal(s.b.liveFixtureRefresh,null);assert.equal(work.done,false,'timer NULL with existing helper pending is not quiescent');assert.equal(s.fetchCalls,0);
   s.releaseLoader();await turn();assert(s.b.liveFixtureRefresh);assert.equal(s.fetchCalls,1);assert.equal(work.done,false);
   s.release();await turn();assert.equal(s.b.liveFixtureRefresh,null);assert.equal(work.done,false,'real terminal still pending');
   s.entry.finish('finished');await result(work);assert.equal(s.sourceTimers.size,0);assert.equal(s.timers.size,0);assert.equal(s.fetchCalls,1,'harness starts no additional request');
  }finally{s.releaseLoader();s.release();s.entry.finish('finished');await turn();}
 });
 await run('actual-owner-requeues-source-timer',async()=>{
  const s=setup();s.b.liveFixtureRefreshQueued=true;const active=s.owner(),work=watch(s.n.settlePrimaryFixtureBeforeReload());
  s.release();await active;s.entry.finish('finished');await turn();assert.equal(work.done,false);assert.equal(s.sourceTimers.size,1);
  s.fireSourceTimer();s.releaseLoader();await result(work);assert.equal(s.fetchCalls,1,'already-requested source IDs remain no-op, no harness refresh');
 });
 await run('existing-helper-load-failure',async()=>{
  const s=setup();s.requests.clear();s.terminals.clear();s.b.queueLiveFixtureSnapshot();const work=watch(s.n.settlePrimaryFixtureBeforeReload());
  await turn();s.fireSourceTimer();await turn();assert.equal(work.done,false);s.rejectLoader(Error('disposable helper load failed'));await assert.rejects(result(work),/disposable helper load failed/);assert.equal(s.fetchCalls,0);
 });
 await run('late-source-timer-after-terminal',async()=>{
  const s=setup();s.entry.finish('finished');let queued=false;const late=s.terminal(),request={};
  s.n.beforeFinalEvaluation=()=>{if(!queued){queued=true;s.b.queueLiveFixtureSnapshot();}};
  s.n.onFetch=()=>{s.requests.set(request,{path:'/api/fixtures',startedEpoch:2});s.terminals.set(request,late);};
  const work=watch(s.n.settlePrimaryFixtureBeforeReload());await turn();assert.equal(work.done,false);assert.equal(s.sourceTimers.size,1);
  s.fireSourceTimer();s.releaseLoader();await turn();assert(s.b.liveFixtureRefresh);s.release();await turn();assert.equal(work.done,false);late.finish('finished');await result(work);assert.equal(s.fetchCalls,1);
 });
 await run('late-invalid-timer-is-refused',async()=>{
  const s=setup();s.requests.clear();s.terminals.clear();s.b.queueLiveFixtureSnapshot();const work=watch(s.n.settlePrimaryFixtureBeforeReload());await turn();s.b.liveFixtureMountTimer=undefined;s.notify();await assert.rejects(result(work),/timer.*(typed|invalid)/);
 });
 for(const invalid of [undefined,false,'0',-1,NaN,Infinity,{}])await run('invalid-timer',async()=>{const s=setup();s.b.liveFixtureMountTimer=invalid;s.entry.finish('finished');await assert.rejects(result(watch(s.n.settlePrimaryFixtureBeforeReload())),/timer.*(typed|invalid)/);});
 for(const kind of ['failed','cancelled','changed-choice','late-failed-request'])await run(kind,async()=>{
  const s=setup();s.entry.finish(kind==='failed'||kind==='cancelled'?'failed':'finished');
  if(kind==='changed-choice'){const profile=s.b.PROFILE_STORAGE;s.b.PROFILE_STORAGE={...profile,preferenceBaseMatches:(receipt,current)=>{s.b.userPreferences.theme='night';return profile.preferenceBaseMatches(receipt,current);}};}
  if(kind==='late-failed-request')s.n.onFinalEvaluation=()=>{const request={},entry=s.terminal();entry.finish('failed');s.requests.set(request,{path:'/api/fixtures',startedEpoch:2});s.terminals.set(request,entry);};
  await assert.rejects(result(watch(s.n.settlePrimaryFixtureBeforeReload())),{name:'AssertionError'});
 });
 await run('late-new-request-is-drained',async()=>{
  const s=setup();s.entry.finish('finished');let late;
  s.n.onFinalEvaluation=()=>{if(late)return;late=s.terminal();const request={};s.requests.set(request,{path:'/api/fixtures',startedEpoch:2});s.terminals.set(request,late);};
  const work=watch(s.n.settlePrimaryFixtureBeforeReload());await turn();assert(late);assert.equal(work.done,false);late.finish('finished');await result(work);
 });
 for(const kind of ['owner-pending','terminal-pending','scheduled-pending','helper-pending'])await run(kind,async()=>{
  const s=setup();const active=kind==='owner-pending'?s.owner():null;
  if(kind!=='terminal-pending')s.entry.finish('finished');if(kind==='scheduled-pending')s.b.queueLiveFixtureSnapshot();if(kind==='helper-pending')s.b.feedScoreUiLoading=new Promise(()=>{});
  const work=watch(s.n.settlePrimaryFixtureBeforeReload());await turn();assert.equal(s.timers.size,1);for(const callback of [...s.timers.values()])callback();await assert.rejects(result(work),/within8s/);
  s.release();s.releaseLoader();s.entry.finish('finished');if(s.sourceTimers.size)s.fireSourceTimer();if(active)await active;await turn();
 });
 assert(source.includes('}else{await settlePrimaryFixtureBeforeReload();await page.reload('),'normal path uses completion; original/settled controls retain their own branches');
 console.log('Fixture lifetime: '+count+' actual source-chain controls passed; queued timer/NULL-helper gap/live owner/terminal, typed handles, requeue/late work/failure and single8s bounds; synthetic I/O only.');
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
