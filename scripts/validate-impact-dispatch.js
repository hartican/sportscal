'use strict';
const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),impact=require('../lib/impact-feedback');
const now=new Date('2026-10-16T01:00Z'),fixture=require('../data/follow-schedule/tennis.json').fixtures.find(e=>e.id.endsWith('184950'));
const user='11111111-1111-4111-8111-111111111111',account={userId:user,preferences:{version:27,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'follow'}]}},actions:{},updatedAt:now.toISOString()};
const inventory={accounts:[account],fixtures:[{eventId:fixture.id,anyFive:true}]};
const good=impact.packets(inventory,[fixture],now);assert.deepEqual(good.packets[0].eligible_ids,[fixture.id]);
for(const action of [{dismissed:true},{archived:true},{isPurged:true}])assert.equal(impact.packets({...inventory,accounts:[{...account,actions:{[fixture.id]:{canonicalEventId:fixture.id,...action}}}]},[fixture],now).packets[0].eligible_ids.length,0);
assert.equal(impact.packets({...inventory,accounts:[{...account,archivedEvents:[{canonicalEventId:fixture.id}]}]},[fixture],now).packets[0].eligible_ids.length,0,'Legacy archive lists cannot create requests');
assert.equal(impact.packets({...inventory,accounts:[{...account,preferences:{version:27,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'unfollow'}]}}}]},[fixture],now).packets[0].eligible_ids.length,0);
assert.equal(impact.observation({...fixture,status:'scheduled',startTimeUtc:'2020-01-01'},now).completed,false,'Elapsed time never completes a fixture');
for(const change of [{statusCheckedAt:'2099-01-01',statusFactObservedAt:null},{sourceUrl:'bad',statusSourceUrl:null,resultSourceUrl:null,statusSource:null},{statusCheckedAt:null,statusFactObservedAt:null,scoreCheckedAt:null,sourceCheckedAt:null}])assert.equal(impact.observation({...fixture,...change},now),null);
assert.equal(impact.packets(inventory,[],now).packets[0].checked_ids.length,0,'An unavailable response does not suppress unchecked last-good requests');
assert.throws(()=>impact.packets({...inventory,accounts:Array(21).fill(account)},[fixture],now),/inventory/);
assert.throws(()=>impact.packets({...inventory,fixtures:Array(101).fill(inventory.fixtures[0])},[],now),/inventory/,'Retain the original100-ID upper safety fence');
assert.throws(()=>impact.packets(inventory,[fixture,fixture],now),/Duplicate/);
async function trial({failure=null,admit=true,remaining=27000}={}){
 const calls=[],finishes=[];let loads=0,sends=0,active=0,maxActive=0;
 const claims=['phone','browser'].map(installation_id=>({batch_id:'batch',installation_id,user_id:user,claim_token:'token'}));
 const batch={kind:'immediate',day:'2026-10-16',userId:user,items:[{eventId:fixture.id,title:fixture.name}]};
 const request=async(path,o={})=>{calls.push({path,...o});const name=path.split('/').at(-1);
  if(name==='nothingsports_impact_inventory')return inventory;
  if(name==='nothingsports_impact_reconcile')return null;
  if(name==='nothingsports_impact_claim')return claims;
  if(name==='nothingsports_impact_begin')return admit?batch:null;
  if(name==='nothingsports_impact_finish'){finishes.push(o.body);return null;}
  if(name==='nothingsports_begin_notification_send')return {leaseId:'lease',subscription:{endpoint:'https://push.test'}};
  if(path.includes('nothingsports_notification_send_leases')||path.includes('nothingsports_push_installations'))return null;
  throw Error('Unexpected Impact request '+path);
 };
 const result=await impact.dispatch({now,request,budget:{remaining:()=>remaining},load:async ids=>{loads++;assert.deepEqual(ids,[fixture.id]);return [fixture];},send:async(_subscription,text)=>{active++;maxActive=Math.max(maxActive,active);try{sends++;const data=JSON.parse(text);assert.equal(data.url,'/?impactRequest='+encodeURIComponent(fixture.id));assert(!/24.22|winner|triggering|voter/i.test(data.body));await new Promise(resolve=>setTimeout(resolve,2));if(failure)throw failure;}finally{active--;}}});
 return {result,calls,finishes,loads,sends,maxActive};
}
async function reserveTrial(limitMs,inventoryMs=0){
 let elapsed=0,begun=0,providerCalls=0,finished=0;const requestTimeouts=[];
 const request=async(path,options={})=>{
  requestTimeouts.push(options.timeoutMs);const name=path.split('/').at(-1);
  const spend=ms=>{assert(ms<=options.timeoutMs,'A simulated fulfilled read stays inside its actual bounded request');elapsed+=ms;};
  if(name==='nothingsports_impact_inventory'){spend(inventoryMs);return inventory;}
  if(name==='nothingsports_impact_reconcile')return null;
  if(name==='nothingsports_impact_claim'){spend(3000);return [{batch_id:'batch',installation_id:'phone',user_id:user,claim_token:'token'}];}
  if(name==='nothingsports_impact_begin'){spend(2999);begun++;return {kind:'immediate',day:'2026-10-16',items:[{eventId:fixture.id,title:fixture.name}]};}
  if(name==='nothingsports_begin_notification_send'){spend(2999);return {leaseId:'lease',subscription:{endpoint:'https://push.test'}};}
  if(path.includes('nothingsports_notification_send_leases')){spend(2999);return null;}
  if(name==='nothingsports_impact_finish'){spend(2999);finished++;return null;}
  throw Error('Unexpected reserve request '+path);
 };
 const budget=require('../lib/reminder-dispatch-budget').budget({request,clock:()=>elapsed,limitMs});
 const result=await impact.dispatch({now,request:budget.request,budget,load:async()=>[fixture],send:budget.send(async(_subscription,_payload,options)=>{assert.equal(options.timeout,3000);elapsed+=2999;providerCalls++;})});
 assert(requestTimeouts.every(ms=>ms<=3000),'The original three-second request cap stays in effect');
 return {result,begun,providerCalls,finished,elapsed,remaining:budget.remaining()};
}
async function selectedLoaderBoundary(){
 const nsc=require('../lib/nothingscore-server');let sequence=0;
 const trial=async(count,{omit=0,fail=false}={})=>{
  const prefix='event:impact-selected-'+sequence+++':',ids=Array.from({length:count},(_,i)=>prefix+i),calls=[],control={fail};
  const event=id=>({id,eventId:id,canonicalEventId:id,key:'tennis',name:'Local capacity match '+id,date:'2026-10-16',sourceUrl:'https://example.test/controlled-fixtures',homeParticipantId:id+':home',awayParticipantId:id+':away',participantIds:[id+':home',id+':away'],startTimeUtc:'2026-10-16T00:00:00Z',statusCheckedAt:'2026-10-16T00:45:00Z',sourceCheckedAt:'2026-10-16T00:45:00Z'});
  for(const id of ids)nsc.eventMap().set(id,{...event(id),status:'upcoming'});
  const request=async(path,options)=>{
   calls.push({path,ids:options.body?.p_fixture_ids,timeoutMs:options.timeoutMs});
   if(path.endsWith('nothingsports_read_fixture_source_health'))return[{source_id:prefix,checked_at:now.toISOString(),revision:1}];
   if(path.endsWith('nothingsports_read_current_fixtures')){
    if(control.fail)throw Object.assign(Error('Controlled unavailable input'),{status:503});
    return options.body.p_fixture_ids.slice(0,Math.max(0,count-omit)).map(id=>({source_id:prefix,fixture_id:id,fixture:{...event(id),status:'completed',completedAt:'2026-10-16T00:50:00Z',statusCheckedAt:now.toISOString(),scoreCheckedAt:now.toISOString(),sourceCheckedAt:now.toISOString()}}));
   }
   throw Error('Unexpected selected-loader request '+path);
  };
  return {ids,calls,control,load:()=>impact.loadFixtures(ids,{api:nsc,request,now})};
 };
 for(const count of [61,100]){const t=await trial(count);await assert.rejects(t.load,/60-ID/,'Overflow must defer before the shared store can silently truncate');assert.equal(t.calls.length,0);}
 const full=await trial(60),loaded=await full.load();assert.equal(loaded.length,60);assert(loaded.every(e=>e.status==='completed'));assert.equal(full.calls.length,2,'One existing parallel health/selected pair, never another source pass');assert(full.calls.every(r=>r.timeoutMs===3000));assert.equal(full.calls.find(r=>r.ids).ids.length,60);assert(loaded.every(e=>e.statusCheckedAt===now.toISOString()),'Original checked dates survive the actual overlay');
 const partial=await trial(8,{omit:1});assert.equal((await partial.load()).length,7,'An absent selected row remains unchecked rather than returning its old fallback');assert.equal(nsc.eventFor(partial.ids[7]).status,'upcoming','Unchecked display data is preserved');
 const failed=await trial(1,{fail:true});assert.equal((await failed.load()).length,0,'Failed selected input cannot qualify old fallback data');assert.equal(nsc.eventFor(failed.ids[0]).status,'upcoming');
 const stale=await trial(1);assert.equal((await stale.load()).length,1);stale.control.fail=true;
 const originalNow=Date.now;try{Date.now=()=>originalNow()+31000;assert.equal((await stale.load()).length,0,'A stale retained snapshot is display data, not a fresh Impact check');}finally{Date.now=originalNow;}
 assert.equal(nsc.eventFor(stale.ids[0]).status,'completed','Retain last-good display data without qualifying it from a failed request');
}
async function failureBoundary(){
 const {SupabaseRequestError}=require('../lib/supabase-server');
 for(const fail of ['inventory','load_fixtures','prepare','reconcile','claim','begin','notification_admission','provider','provider_receipt','finish']){
  let elapsed=0,sends=0;const diagnostics=[],finishes=[],claims=[{batch_id:'private-batch',installation_id:'private-phone',user_id:user,claim_token:'private-token'}];
  const failure=()=>{elapsed+=3000;throw new SupabaseRequestError('private upstream body',{status:504,payload:{code:'supabase_timeout',message:'private upstream body'}});};
  const request=async(path,o={})=>{
   const phase=path.includes('notification_send_leases')?'provider_receipt':path.endsWith('begin_notification_send')?'notification_admission':path.split('nothingsports_impact_')[1];
   if(phase==='finish')finishes.push(o.body.outcome);
   if(phase===fail)return failure();
   if(phase==='inventory')return inventory;
   if(phase==='claim')return claims;
   if(phase==='begin')return {kind:'immediate',items:[{eventId:fixture.id,title:'Private sporting fixture'}]};
   if(phase==='notification_admission')return {leaseId:'private-lease',subscription:{endpoint:'https://private.test'}};
   return null;
  };
  const result=await impact.dispatch({now,request,clock:()=>elapsed,budget:{remaining:()=>27000-elapsed},diagnostic:d=>diagnostics.push(d),load:async()=>{if(fail==='load_fixtures')return failure();return fail==='prepare'?[fixture,fixture]:[fixture];},send:async()=>{sends++;if(fail==='provider')throw Error('private uncertain provider');}});
  assert.equal(result.error,'impact_request_dispatch_failed',fail+' is visible rather than a generic rejection or silent success');
  assert.equal(result.checked,['inventory','load_fixtures','prepare','reconcile','claim'].includes(fail)?0:1);
  assert.equal(result.sent,fail==='finish'?1:0,'A completed guarded send survives a final Impact receipt failure');
  assert.equal(sends,['provider','provider_receipt','finish'].includes(fail)?1:0);
  assert.equal(result.failed,result.checked?1:0,'Count each failed claim once, separately from phase failures');
  assert(diagnostics.some(d=>d.phase===fail&&d.outcome==='failed'),fail+' has a precise phase');
  assert(diagnostics.every(d=>Number.isFinite(d.elapsedMs)&&Number.isFinite(d.remainingMs)));
  assert(!/private|11111111|184950|https|claim_token/.test(JSON.stringify(diagnostics)),'Only fixed phases/codes and numeric timings may leave the boundary');
  if(['begin','provider','provider_receipt','finish'].includes(fail))assert.deepEqual(finishes,[fail==='finish'?'sent':'uncertain'],'Uncertain delivery is never released for blind retry');
  if(fail==='notification_admission')assert.deepEqual(finishes,['pending'],'Proven no-contact admission failure can retain existing retry');
 }
 const result=await impact.dispatch({now,diagnostic:()=>{throw Error('logger failure');},request:async()=>{throw Error('private failure');},load:async()=>[fixture]});
 assert.equal(result.error,'impact_request_dispatch_failed','A broken diagnostic sink cannot change failure handling');
 const deferred=await impact.dispatch({now,request:async()=>{throw Object.assign(Error('No request started'),{code:'dispatch_deadline'});}});
 assert.equal(deferred.deferred,'dispatch_deadline');assert.equal(deferred.error,undefined,'Budget exhaustion before any claim retains ordinary deferral');
}
async function partialWorkerBoundary(){
 const claims=['receipt-fails','peer-succeeds'].map(installation_id=>({batch_id:'batch',installation_id,user_id:user,claim_token:'token'}));
 for(const providerFails of [false,true]){
  let elapsed=0,sends=0;const finishes=[],diagnostics=[];
  const request=async(path,o={})=>{
   const name=path.split('/').at(-1);
   if(name==='nothingsports_impact_inventory')return inventory;
   if(name==='nothingsports_impact_claim')return claims;
   if(name==='nothingsports_impact_begin')return {kind:'immediate',items:[{eventId:fixture.id,title:fixture.name}]};
   if(name==='nothingsports_begin_notification_send')return {leaseId:o.body.target_installation,subscription:{endpoint:o.body.target_installation}};
   if(name==='nothingsports_impact_finish'){finishes.push(o.body);if(o.body.installation==='receipt-fails')throw Error('private receipt error');}
   return null;
  };
  const result=await impact.dispatch({now,request,load:async()=>[fixture],clock:()=>elapsed,diagnostic:d=>diagnostics.push(d),send:async subscription=>{sends++;await Promise.resolve();if(providerFails&&subscription.endpoint==='receipt-fails')throw Error('unknown provider outcome');}});
  assert.equal(sends,2,'A failing peer cannot stop the other claimed delivery');
  assert.equal(result.sent,providerFails?1:2);assert.equal(result.failed,1,'Provider plus receipt failure on one claim counts once');assert.equal(result.checked,2);
  assert.equal(result.error,'impact_request_dispatch_failed');
  assert.equal(finishes.find(f=>f.installation==='receipt-fails').outcome,providerFails?'uncertain':'sent');
  assert.equal(finishes.find(f=>f.installation==='peer-succeeds').outcome,'sent');
  assert(diagnostics.some(d=>d.phase==='finish'));
 }
 let elapsed=0,receipts=0;
 const diagnostics=[];
 const result=await impact.dispatch({now,clock:()=>elapsed,budget:{remaining:()=>27000-elapsed},diagnostic:d=>diagnostics.push(d),load:async()=>[fixture],request:async(path)=>{
  if(path.endsWith('impact_inventory'))return inventory;
  if(path.endsWith('impact_claim'))return [claims[0]];
  if(path.endsWith('impact_begin'))return {kind:'immediate',items:[{eventId:fixture.id,title:fixture.name}]};
  if(path.endsWith('begin_notification_send'))return {leaseId:'lease',subscription:{endpoint:'synthetic'}};
  if(path.includes('notification_send_leases')){elapsed=26900;return null;}
  if(path.endsWith('impact_finish'))receipts++;
  return null;
 },send:async()=>{}});
 assert.equal(result.sent,1);assert.equal(result.failed,1);assert.equal(receipts,0,'No final RPC starts after usable budget exhaustion');
 assert(diagnostics.some(d=>d.phase==='finish'&&d.code==='dispatch_deadline'),'An unrecorded final receipt cannot masquerade as successful completion');
}
(async()=>{
 await failureBoundary();
 await partialWorkerBoundary();
 await selectedLoaderBoundary();
 const okay=await trial();assert.equal(okay.sends,2);assert.equal(okay.loads,1);assert(okay.maxActive<=2);assert(okay.finishes.every(r=>r.outcome==='sent'));
 for(const [failure,status]of [[{statusCode:503},'pending'],[{statusCode:429},'pending'],[new Error('ambiguous outcome'),'uncertain'],[{statusCode:410},'failed']]){const test=await trial({failure});assert(test.finishes.every(f=>f.outcome===status));if(failure.statusCode===410)assert.equal(test.calls.filter(c=>c.method==='DELETE').length,2);}
 assert.equal((await trial({admit:false})).sends,0,'Empty/retracted request never contacts a provider');
 const deferred=await trial({remaining:7999});assert.equal(deferred.calls.length,0);assert.equal(deferred.loads,0);assert.equal(deferred.result.deferred,'dispatch_deadline');
 const short=await reserveTrial(12000,2999);assert.equal(short.result.deferred,'dispatch_deadline','Insufficient time defers before a provider-start receipt can be created');assert.equal(short.begun,0);assert.equal(short.providerCalls,0);
 const reserved=await reserveTrial(18250);assert.equal(reserved.begun,1);assert.equal(reserved.providerCalls,1);assert.equal(reserved.finished,1);assert.equal(reserved.result.sent,1);assert(reserved.remaining>=250,'A claim plus all five bounded send steps retain final-recording headroom');
 let reads=0;assert.deepEqual(await impact.loadFixtures([fixture.id],{now,loadCatalogue:async()=>({resolve:()=>fixture}),api:{refreshEventSnapshots:async()=>reads++,eventFor:()=>null}}),[fixture]);assert.equal(reads,0,'Reuse existing shared completion rather than another fixture read');
 const digest=impact.payload({kind:'digest',day:'2026-10-16',items:[{title:'A'},{title:'B'}]},'group');assert.equal(digest.url,'/?impactInbox=2026-10-16');assert(!digest.body.includes(user));
 const multiple=Array.from({length:100},(_,i)=>({...fixture,id:fixture.id+'-'+i,eventId:fixture.id+'-'+i,canonicalEventId:fixture.id+'-'+i}));
 const before=performance.now();const full=impact.packets({accounts:Array.from({length:20},(_,i)=>({...account,userId:user.slice(0,-2)+String(i).padStart(2,'0')})),fixtures:multiple.map(e=>({eventId:e.id}))},multiple,now);const elapsed=performance.now()-before;assert.equal(full.packets.length,20);assert(elapsed<3000,'20accounts/100fixtures remain bounded within one database-read budget');
 console.log(JSON.stringify({passed:true,sharedAdmission:true,uncheckedRetention:true,providerOutcomes:true,twoWorkers:true,noExtraCatalogueReads:true,selectedLoader:{perTickLimit:60,inputSafetyFence:100,overflowBeforeReads:true,partialAndStaleStayUnchecked:true,parallelReads:2},budget:{shortDefersBeforeStart:short.begun===0&&short.providerCalls===0,completeReservedSend:reserved.result.sent===1&&reserved.finished===1,finalHeadroomMs:reserved.remaining,requestLimitMs:3000,ownerLimitMs:27000},capacity:{accounts:20,fixtures:100,preparationMs:elapsed},realPush:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
