'use strict';
const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),impact=require('../lib/impact-feedback');
const now=new Date('2026-10-16T01:00Z'),fixture=require('../data/follow-schedule/tennis.json').fixtures.find(e=>e.id.endsWith('184950'));
const user='11111111-1111-4111-8111-111111111111',account={userId:user,preferences:{version:27,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'follow'}]}},actions:{},updatedAt:now.toISOString()};
const inventory={accounts:[account],fixtures:[{eventId:fixture.id,anyFive:true}]};
const good=impact.packets(inventory,[fixture],now);assert.deepEqual(good.packets[0].eligible_ids,[fixture.id]);
for(const action of [{dismissed:true},{archived:true},{isPurged:true}])assert.equal(impact.packets({...inventory,accounts:[{...account,actions:{[fixture.id]:{canonicalEventId:fixture.id,...action}}}]},[fixture],now).packets[0].eligible_ids.length,0);
assert.equal(impact.packets({...inventory,accounts:[{...account,preferences:{version:27,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'unfollow'}]}}}]},[fixture],now).packets[0].eligible_ids.length,0);
assert.equal(impact.observation({...fixture,status:'scheduled',startTimeUtc:'2020-01-01'},now).completed,false,'Elapsed time never completes a fixture');
for(const change of [{statusCheckedAt:'2099-01-01',statusFactObservedAt:null},{sourceUrl:'bad',statusSourceUrl:null,resultSourceUrl:null,statusSource:null},{statusCheckedAt:null,statusFactObservedAt:null,scoreCheckedAt:null,sourceCheckedAt:null}])assert.equal(impact.observation({...fixture,...change},now),null);
assert.equal(impact.packets(inventory,[],now).packets[0].checked_ids.length,0,'An unavailable response does not suppress unchecked last-good requests');
assert.throws(()=>impact.packets({...inventory,accounts:Array(21).fill(account)},[fixture],now),/inventory/);
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
(async()=>{
 const okay=await trial();assert.equal(okay.sends,2);assert.equal(okay.loads,1);assert(okay.maxActive<=2);assert(okay.finishes.every(r=>r.outcome==='sent'));
 for(const [failure,status]of [[{statusCode:503},'pending'],[{statusCode:429},'pending'],[new Error('ambiguous outcome'),'uncertain'],[{statusCode:410},'failed']]){const test=await trial({failure});assert(test.finishes.every(f=>f.outcome===status));if(failure.statusCode===410)assert.equal(test.calls.filter(c=>c.method==='DELETE').length,2);}
 assert.equal((await trial({admit:false})).sends,0,'Empty/retracted request never contacts a provider');
 const deferred=await trial({remaining:7999});assert.equal(deferred.calls.length,0);assert.equal(deferred.loads,0);assert.equal(deferred.result.deferred,'dispatch_deadline');
 let reads=0;assert.deepEqual(await impact.loadFixtures([fixture.id],{now,loadCatalogue:async()=>({resolve:()=>fixture}),api:{refreshEventSnapshots:async()=>reads++,eventFor:()=>null}}),[fixture]);assert.equal(reads,0,'Reuse existing shared completion rather than another fixture read');
 const digest=impact.payload({kind:'digest',day:'2026-10-16',items:[{title:'A'},{title:'B'}]},'group');assert.equal(digest.url,'/?impactInbox=2026-10-16');assert(!digest.body.includes(user));
 const multiple=Array.from({length:100},(_,i)=>({...fixture,id:fixture.id+'-'+i,eventId:fixture.id+'-'+i,canonicalEventId:fixture.id+'-'+i}));
 const before=performance.now();const full=impact.packets({accounts:Array.from({length:20},(_,i)=>({...account,userId:user.slice(0,-2)+String(i).padStart(2,'0')})),fixtures:multiple.map(e=>({eventId:e.id}))},multiple,now);const elapsed=performance.now()-before;assert.equal(full.packets.length,20);assert(elapsed<3000,'20accounts/100fixtures remain bounded within one database-read budget');
 console.log(JSON.stringify({passed:true,sharedAdmission:true,uncheckedRetention:true,providerOutcomes:true,twoWorkers:true,noExtraCatalogueReads:true,capacity:{accounts:20,fixtures:100,preparationMs:elapsed},realPush:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
