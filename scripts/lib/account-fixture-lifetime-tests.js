'use strict';
// Actual live-loader owner + actual normal harness completion function, synthetic I/O only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),file='scripts/validate-account-sync-recovery-browser.js';
const source=process.env.FIXTURE_LIFETIME_BASELINE==='558a963a'?execFileSync('git',['show','558a963a:'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
const ownerSource=fs.readFileSync(path.join(root,'config/feed-live-score-loader.js'),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve)),copy=value=>JSON.parse(JSON.stringify(value));
function setup(){
 let release;const response=new Promise(resolve=>{release=resolve;});
 const id='event:football:australian-championship:2026:22278871';
 const b={console,Date,URL,Set,Map,AbortSignal:{timeout:()=>undefined},document:{hidden:false,querySelectorAll:()=>[{closest:()=>({dataset:{feedEventId:id}})}]},startupCoordinator:{isHydrating:()=>false},activeTab:'feed',location:{protocol:'http:'},
  serverSyncClient:{sessionSubject:()=> 'A',accountSnapshot:()=>({accountId:'A',generation:0})},serverPersistence:{user:{id:'A'}},serverStateBaseline:{updatedAt:'disposable-base'},
  userPreferences:{theme:'day',fantasyDeadlines:{enabled:false}},eventActions:{},liveFixtureRefresh:null,liveFixtureRefreshQueued:false,liveFixtureRevision:'',liveFixtureLastRequestedAt:0,liveFixtureRequestedIds:new Set(),liveFixtureMountTimer:null,
  feedCardSlots:new Map([['disposable',{slot:{dataset:{feedEventId:id}},event:{id,key:'football'}}]]),followedScheduleLoads:new Map(),followFeedRefreshInFlight:null,
  clonePreferences:copy,pendingPreferenceIntent:()=>({receiptId:'disposable-unchanged'}),PROFILE_STORAGE:require('../../config/profile-storage'),fetch:()=>response};
 vm.createContext(b);vm.runInContext(ownerSource,b);
 const request={},terminals=new Map(),requests=new Map([[request,{path:'/api/fixtures',startedEpoch:2}]]);let finish;
 const entry={promise:new Promise(resolve=>{finish=resolve;}),result:null};entry.finish=kind=>{entry.result={kind};finish(entry.result);};terminals.set(request,entry);
 const timers=new Map(),n={assert,console,Promise,documentEpoch:2,reads:0,writes:0,tracedRequests:requests,fixtureTerminals:terminals,traceResource(){},
  setTimeout:(callback,ms)=>{assert.equal(ms,8000);const id=timers.size+1;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id),
  page:{evaluate:async(fn,arg)=>{b.qaArgument=copy(arg??null);const result=await vm.runInContext('('+fn.toString()+')(qaArgument)',b);if(fn.toString().includes('unchanged:')&&n.onFinalEvaluation)n.onFinalEvaluation();return result===undefined?undefined:copy(result);}}};
 vm.createContext(n);
 const from=source.indexOf('async function observeFixtureControl('),to=source.indexOf('function assertFixtureControlPending(',from);assert(from>0&&to>from);vm.runInContext(source.slice(from,to),n);
 const a=source.indexOf('    async function settlePrimaryFixtureBeforeReload(){'),end=source.indexOf('    page.setDefaultTimeout(15000);',a);
 if(a>=0)vm.runInContext(source.slice(a,end),n);
 else{
  const begin=source.indexOf('async trace => {',source.indexOf('const fixtureOwnerFacts=await page.evaluate(')),stop=source.indexOf('},traceApiStale);',begin);assert(begin>0&&stop>begin);
  const original=vm.runInContext('('+source.slice(begin,stop+1)+')',n);
  n.settlePrimaryFixtureBeforeReload=()=>n.page.evaluate(original,false);
 }
 return {b,n,entry,requests,terminals,timers,release:()=>release({status:503,ok:false}),owner:()=>b.NOTHINGSPORTS_FEED_SCORE_UI.refresh()};
}
module.exports=async function fixtureLifetimeTests(){
 // Meaningful RED on558a: the normal old barrier returns while the real owner is pending.
 {
  const s=setup(),active=s.owner();let completed=false;
  const work=s.n.settlePrimaryFixtureBeforeReload().then(()=>{completed=true;});
  try{
   await turn();assert.equal(completed,false,'normal pre-reload barrier returned while its actual live fixture owner was active');
   s.release();await active;await turn();assert.equal(completed,false,'owner completion alone cannot omit real request terminal outcome');
   s.entry.finish('finished');await work;assert.equal(s.b.liveFixtureRefresh,null);assert.equal(s.timers.size,0);
  }finally{s.release();s.entry.finish('finished');await active;await work;}
 }
 for(const kind of ['failed','cancelled','scheduled','new-request','changed-choice']){
  const s=setup();s.b.liveFixtureRefresh=null;
  if(kind==='scheduled')s.b.liveFixtureMountTimer=1;
  if(kind==='new-request')s.n.onFinalEvaluation=()=>{const request={};s.requests.set(request,{path:'/api/fixtures',startedEpoch:2});s.terminals.set(request,{result:null});};
  if(kind==='changed-choice'){
   const original=s.b.PROFILE_STORAGE;s.b.PROFILE_STORAGE={...original,preferenceBaseMatches:(receipt,current)=>{s.b.userPreferences.theme='night';return original.preferenceBaseMatches(receipt,current);}};
  }
  s.entry.finish(kind==='failed'||kind==='cancelled'?'failed':'finished');
  await assert.rejects(s.n.settlePrimaryFixtureBeforeReload(),{name:'AssertionError'},kind+' must fail honestly');
 }
 for(const kind of ['owner-pending','terminal-pending']){
  const s=setup(),active=kind==='owner-pending'?s.owner():null;
  if(kind==='owner-pending')s.entry.finish('finished');
  const work=s.n.settlePrimaryFixtureBeforeReload();await turn();assert.equal(s.timers.size,1);
  for(const callback of [...s.timers.values()])callback();
  await assert.rejects(work,/within8s/,kind+' is covered by the combined bound');
  s.release();s.entry.finish('finished');if(active)await active;await turn();
 }
 assert(source.includes('}else{await settlePrimaryFixtureBeforeReload();await page.reload('),'normal path uses completion; causal controls retain original/settled branches');
 console.log('Fixture lifetime: real source-owner and request-terminal waits,558a RED, failed/cancelled/scheduled/new-work/choice guards and both combined-bound sides passed; synthetic I/O only.');
};
if(require.main===module)module.exports().catch(error=>{console.error(error);process.exitCode=1;});
