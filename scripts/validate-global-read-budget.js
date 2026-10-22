'use strict';
const assert=require('node:assert/strict'),policies=require('../lib/fixture-read-policy');
const {createSnapshotStore,readLiveSnapshots}=require('../lib/live-fixtures'),{supabaseRequest}=require('../lib/supabase-server');
const fixture={id:'fixture:qa:global-budget',key:'tennis',status:'scheduled',date:'2026-10-23',sourceCheckedAt:'2026-10-22T00:00:00.123456Z'},health=[{source_id:'qa-budget',revision:1}],bundle={schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[{source_id:'qa-budget',fixture}]};
const timeout=e=>e.status===504&&e.payload?.code==='supabase_timeout';
async function run(){let checks=0;const warning=console.warn;console.warn=()=>{};
try{
 assert.equal(policies.select({}).deadlineMs,6000);assert.equal(policies.select({scope:'global',interactive:true}).name,'global-total');assert.equal(policies.select({selected:true,interactive:true}).deadlineMs,3000);assert.equal(policies.select({scope:'match-centre',interactive:true}).deadlineMs,5000);assert.equal(policies.select({scope:'match-centre'}).deadlineMs,3000);assert.equal(policies.select({policy:policies.REMINDER}).total,false);assert.throws(()=>createSnapshotStore({policy:'reminder-attempt'}));assert.throws(()=>createSnapshotStore({policy:{deadlineMs:60000}}));checks++;
 let clock=0;const calls=[];
 const store=createSnapshotStore({timer:()=>clock,request:async(p,o)=>{calls.push(o);if(p.endsWith('source_health')){clock=1700;return health;}clock=5999;return[{bundle}];}});
 assert.deepEqual((await store.read())[0].fixtures,[fixture]);assert.deepEqual(calls.map(x=>x.timeoutMs),[6000,4300]);assert.equal(calls[0].signal,calls[1].signal);assert(calls[0].signal.aborted);checks++;
 // Actual transport with controlled header/body completion, including synchronous
 // JSON parsing: no network or shortened production policy is needed.
 for(const stage of ['headers','body'])for(const at of [5999,6000,6001]){
  clock=0;let requests=0;
  const s=createSnapshotStore({timer:()=>clock,request:(p,o)=>supabaseRequest(p,{...o,environment:{SUPABASE_URL:'https://local-only.invalid',SUPABASE_PUBLISHABLE_KEY:'local-only'},fetchImpl:async()=>{requests++;if(stage==='headers'&&!p.endsWith('source_health'))clock=at;return{ok:true,status:200,text:async()=>{if(stage==='body'&&!p.endsWith('source_health'))clock=at;return JSON.stringify(p.endsWith('source_health')?health:[{bundle}]);}};}})});
  if(at<6000)assert.deepEqual((await s.read())[0].fixtures,[fixture]);else await assert.rejects(s.read(),timeout);assert.equal(requests,2);checks++;
 }
 const truncated=createSnapshotStore({request:(p,o)=>supabaseRequest(p,{...o,environment:{SUPABASE_URL:'https://local-only.invalid',SUPABASE_PUBLISHABLE_KEY:'local-only'},fetchImpl:async()=>({ok:true,status:200,text:async()=>p.endsWith('source_health')?JSON.stringify(health):'{'})})});await assert.rejects(truncated.read(),/Invalid global view envelope/);checks++;
 // Late synchronous access during projection must fail even before a timer can fire.
 clock=0;const late={...fixture,get id(){clock=6001;return fixture.id;}};
 const lateStore=createSnapshotStore({timer:()=>clock,request:async p=>p.endsWith('source_health')?health:[{bundle:{...bundle,rows:[{source_id:'qa-budget',fixture:late}]}}]});await assert.rejects(lateStore.read(),timeout);checks++;
 clock=0;const component={schemaVersion:'fixture-clock-components.v1',complete:true,rows:[{source_id:'qa-budget',fixture_id:fixture.id,identity_keys:[fixture.id],base:fixture,base_is_sql_null:false,score:null,score_is_sql_null:true,raw:['2000-01-01T00:00:00Z',null,null,null,null,null],first_completed_at:null}],parsed_clocks:[{value:'2000-01-01T00:00:00Z',get stamp(){clock=6001;return '2000-01-01T00:00:00Z';}}]};
 await assert.rejects(createSnapshotStore({timer:()=>clock,request:async p=>p.endsWith('source_health')?health:[{bundle:component}]}).read(),timeout);checks++;

 clock=0;const hashSources=[{source_id:'qa-budget-hash',get revision(){clock=6001;return 1;},fixtures:[fixture]}];
 await assert.rejects(readLiveSnapshots({store:{read:async()=>hashSources},timer:()=>clock,maxAgeMs:0,now:123}),timeout);checks++;
 // Distinct static policies cannot share an in-flight read or cached ownership.
 const releases=[],options=[],global={read:async o=>{options.push(['global',o]);return new Promise(r=>releases.push(r));}},reminder={policy:policies.REMINDER,read:async o=>{options.push(['reminder',o]);return new Promise(r=>releases.push(r));}};
 const reads=[readLiveSnapshots({store:global,now:124,maxAgeMs:0}),readLiveSnapshots({store:global,now:124,maxAgeMs:0}),readLiveSnapshots({store:reminder,now:124,maxAgeMs:0})];assert.equal(options.length,2);releases.forEach(r=>r(health.map(h=>({...h,fixtures:[fixture]}))));const [fresh]=await Promise.all(reads);
 const stale=await readLiveSnapshots({store:{read:async()=>{throw Error('unavailable');}},now:40000,maxAgeMs:0});assert(stale.stale);assert.equal(stale.readAt,fresh.readAt);assert.deepEqual(stale.sources,fresh.sources);assert.equal(stale.sources[0].fixtures[0].sourceCheckedAt,fixture.sourceCheckedAt);checks++;
 // Preserve the real reminder catalogue's second transient attempt and dispatcher
 // clamp, even when the cumulative fixture attempts pass3s.
 let dispatchClock=0,attempts=0,total=0;const budget=require('../lib/reminder-dispatch-budget').budget({clock:()=>dispatchClock,request:async(p,o)=>{total++;assert.equal(o.timeoutMs,3000);if(p.endsWith('source_health'))return[];assert(p.endsWith('/nothingsports_read_reminder_fixture_bundle'));attempts++;dispatchClock+=3001;if(attempts===1)throw Object.assign(Error('transient'),{status:504});return{schemaVersion:'current-fixture-bundle.v1',scope:'reminders',requiredIds:[],complete:true,rows:[]};}});
 await require('../lib/reminder-fixtures').catalogue({rows:[],now:new Date('2026-10-23T00:00:00Z'),request:budget.request});assert.equal(attempts,2);assert.equal(total,3);assert.equal(dispatchClock,6002);assert.equal(budget.remaining(),20998);dispatchClock=26900;assert.throws(()=>budget.request('/anything'),e=>e.code==='dispatch_deadline');assert.equal(total,3);checks++;
 // Exercise the actual six-second wall timer across both transport phases.
 for(const stage of ['headers','body']){
  let requests=0;const signals=[];const start=performance.now();
  const stalled=createSnapshotStore({request:(p,o)=>supabaseRequest(p,{...o,environment:{SUPABASE_URL:'https://local-only.invalid',SUPABASE_PUBLISHABLE_KEY:'local-only'},fetchImpl:async(_url,opts)=>{requests++;signals.push(opts.signal);if(p.endsWith('source_health'))return{ok:true,status:200,text:async()=>JSON.stringify(health)};if(stage==='headers')return new Promise(()=>{});return{ok:true,status:200,text:()=>new Promise(()=>{})};}})});
  await assert.rejects(stalled.read(),timeout);const elapsed=performance.now()-start;assert(elapsed>=5900&&elapsed<7200,'One actual six-second complete-read deadline');assert.equal(requests,2);assert(signals[1].aborted);assert.equal(signals[0].aborted,false,'Completed health transport removes its abort listener');checks++;
 }
 console.log(JSON.stringify({passed:true,checks,globalTotalMs:6000,interactiveTotalMs:5000,selectedAndReminderAttemptMs:3000,reminderTotalMs:27000,originalTransientRetry:true,actualHeadersAndBodyTimers:true,lateSynchronousWork:true,policyIsolation:true,productionRequests:0}));
}finally{console.warn=warning;}}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
