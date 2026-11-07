#!/usr/bin/env node
'use strict';
// Isolated API and database mocks; no provider contact or production writes.
const assert=require('node:assert/strict');
const server=require('../lib/supabase-server');
const mock=(name,exports)=>{const key=require.resolve(name),old=require.cache[key];require.cache[key]={id:key,filename:key,loaded:true,exports};return()=>old?require.cache[key]=old:delete require.cache[key];};
async function impactHandlerBoundary(){
 const impact=require('../lib/impact-feedback'),fixture=require('../data/follow-schedule/tennis.json').fixtures.find(f=>f.id.endsWith('184950'));
 const inventory={accounts:[{userId:'11111111-1111-4111-8111-111111111111',preferences:{version:27},updatedAt:'2026-10-18T08:00:00Z'}],fixtures:[{eventId:fixture.id}]};
 for(const ordinaryDue of [false,true])for(const fail of ['inventory','begin','finish']){
  const ordinary={id:'private-ordinary-reminder',event_id:'private-ordinary-fixture',installation_id:'private-ordinary-device',user_id:inventory.accounts[0].userId,starts_at:'2026-10-18T12:00:00Z',title:'Private ordinary fixture',attempts:0};
  const health=[],logs=[],finishes=[],ordinaryReceipts=[],sentTags=[];let sends=0;
  const request=async(p,o={})=>{
   if(p.includes('notification_dispatch_health')){health.push(o.body);return null;}
   const name=p.split('/').at(-1);
   if(name==='nothingsports_impact_'+fail)throw new server.SupabaseRequestError('private handler failure',{status:504,payload:{code:'supabase_timeout'}});
   if(name==='nothingsports_claim_due_reminders')return ordinaryDue?[ordinary]:[];
   if(p.startsWith('/rest/v1/nothingsports_push_installations?'))return [{installation_id:ordinary.installation_id,user_id:ordinary.user_id,timezone:'Australia/Sydney'}];
   if(name==='nothingsports_begin_fixture_reminder')return true;
   if(p.startsWith('/rest/v1/nothingsports_reminders?')){ordinaryReceipts.push(o.body);return null;}
   if(name==='nothingsports_impact_inventory')return inventory;
   if(name==='nothingsports_impact_claim')return [{batch_id:'private-batch',installation_id:'private-device',claim_token:'private-token'}];
   if(name==='nothingsports_impact_begin')return {kind:'immediate',items:[{eventId:fixture.id,title:'Private fixture'}]};
   if(name==='nothingsports_begin_notification_send')return {leaseId:'private-lease-'+o.body.target_installation,subscription:{endpoint:'https://private.test/'+o.body.target_installation}};
   if(name==='nothingsports_impact_finish')finishes.push(o.body.outcome);
   return null;
  };
  const zero={dispatch:async()=>({sent:0})},restorers=[mock('../lib/supabase-server',{...server,supabaseServiceRequest:request}),mock('../lib/automatic-reminders',{reconcile:async()=>({accounts:0})}),mock('../lib/reminder-schedules',{reconcile:async()=>({checked:0})}),mock('../lib/comms-refresh',{reconcile:async()=>({updated:0})}),mock('../lib/impact-feedback',{...impact,dispatch:opts=>impact.dispatch({...opts,load:async()=>[fixture]})}),mock('web-push',{setVapidDetails(){},sendNotification:async(_subscription,text)=>{sends++;sentTags.push(JSON.parse(text).tag);}}),...['live-rating-alerts','social-reward-alerts','comms-post-alerts','milestone-alerts','year-review-alerts'].map(f=>mock('../lib/'+f,zero))];
  const key=require.resolve('../api/notification-dispatch'),budgetKey=require.resolve('../lib/reminder-dispatch-budget'),oldWarn=console.warn,previous={CRON_SECRET:process.env.CRON_SECRET,VAPID_PUBLIC_KEY:process.env.VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY:process.env.VAPID_PRIVATE_KEY};
  delete require.cache[key];delete require.cache[budgetKey];console.warn=(_label,d)=>logs.push(d);Object.assign(process.env,{CRON_SECRET:'controlled-only',VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test'});
  try{
   const response={setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;}};
   await require(key)({method:'GET',headers:{authorization:'Bearer controlled-only'}},response);
   assert.equal(response.code,503,'Impact '+fail+' must be visible to the scheduler');
   assert.equal(health.at(-1).last_error,'impact_request_dispatch_failed');
   assert.equal(health.at(-1).failed_count,1,'A delivery and its enclosing phase failure are not counted twice');
   assert(!health.some(h=>h.last_success_at));
   const ordinarySent=Number(ordinaryDue),impactSent=Number(fail==='finish');
   assert.equal(response.body.checked,ordinarySent);assert.equal(response.body.claimed,ordinarySent);
   assert.equal(response.body.sent,ordinarySent,'Ordinary success survives a later Impact failure');assert.equal(response.body.failed,0);
   assert.equal(response.body.impactRequests.sent,impactSent);
   assert.equal(sends,ordinarySent+impactSent,'Contact the provider once per completed controlled send');
   assert.equal(new Set(sentTags).size,sends,'No ordinary or Impact send is duplicated');
   assert.equal(sentTags.filter(tag=>tag==='nothingsport-'+ordinary.event_id).length,ordinarySent);
   assert.equal(ordinaryReceipts.length,ordinarySent);
   if(ordinaryDue){assert(Number.isFinite(Date.parse(ordinaryReceipts[0].dispatched_at)));assert.equal(ordinaryReceipts[0].last_error,null);assert.equal(ordinaryReceipts[0].claimed_at,null);}
   assert.equal(health.at(-1).sent_count,ordinarySent+impactSent,'Combine ordinary and guarded Impact success even if the final receipt fails');
   assert(logs.some(d=>d.phase===fail&&d.code==='supabase_timeout'),'Expose the precise sanitized Impact failure phase');
   assert(!/private|11111111|184950|https/.test(JSON.stringify(logs)+JSON.stringify(response.body)));
   if(fail==='begin')assert.deepEqual(finishes,['uncertain']);
  }finally{console.warn=oldWarn;restorers.reverse().forEach(r=>r());delete require.cache[key];delete require.cache[budgetKey];for(const[k,v]of Object.entries(previous))v===undefined?delete process.env[k]:process.env[k]=v;}
 }
}
async function reconciliationTimingBoundary(){
 const {reconciliationRequest}=require('../api/notification-dispatch')._test,{budget}=require('../lib/reminder-dispatch-budget');
 let elapsed=0,calls=0;const diagnostics=[];
 const upstream=new server.SupabaseRequestError('private timeout payload',{status:504,payload:{code:'supabase_timeout'}});
 const bounded=budget({clock:()=>elapsed,request:async(p,o)=>{calls++;assert.equal(o.timeoutMs,3000);elapsed+=p.endsWith('reminder_accounts')?2636:3000;if(!p.endsWith('reminder_accounts'))throw upstream;return [];}});
 const request=reconciliationRequest(bounded,{clock:()=>elapsed,diagnostic:d=>diagnostics.push(d)});
 await request('/rest/v1/rpc/nothingsports_reminder_accounts');
 for(let attempt=0;attempt<2;attempt++)await assert.rejects(request('/rest/v1/rpc/nothingsports_read_reminder_fixture_bundle'),e=>e===upstream);
 assert.deepEqual(diagnostics.map(d=>[d.phase,d.outcome,d.elapsedMs]),[['account_inventory','slow',2636],['fixture_bundle','failed',3000],['fixture_bundle','failed',3000]]);
 assert.equal(calls,3,'Observing two existing attempts adds no requests or retries');
 assert.equal(elapsed,8636);assert.equal(bounded.remaining(),18364);
 assert(!/private|https|payload/.test(JSON.stringify(diagnostics)));
 const fault=Error('private unknown body');fault.code='private_code';let original;
 const broken=reconciliationRequest({request:async()=>{throw fault;},remaining:()=>27000},{diagnostic:d=>{original=d;throw Error('broken logger');}});
 await assert.rejects(broken('/rest/v1/rpc/nothingsports_reconcile_reminder_accounts'),e=>e===fault);
 assert.equal(original.code,'reminder_phase_failed','Unknown upstream codes never become log content');
}
async function main(){
 const now=new Date('2026-10-06T11:30:00Z');
 const refresh=require('../lib/comms-refresh');
 const calls=[];
 const request=async(p,o={})=>{
  calls.push({p,o});
  if(p.endsWith('nothingsports_comms_claim_refresh'))return 'lease';
  if(p.endsWith('nothingsports_comms_sync_batch')){
   assert(o.body.items.length<=100,'Production RPC rejects batches over 100');
   return {updated:o.body.items.length,conflicts:0};
  }
  return [];
 };
 const prepared=await refresh.prepare({now:+now,request});
 assert(prepared.candidates.length>100,'Pinned incident must exceed the database batch cap');
 const result=await refresh.reconcile({now:+now,request});
 const batches=calls.filter(c=>c.p.endsWith('nothingsports_comms_sync_batch'));
 assert.equal(result.updated,prepared.candidates.length);
 assert.equal(new Set(batches.flatMap(c=>c.o.body.items.map(i=>i.id))).size,prepared.candidates.length,'Each candidate is synced once');
 assert(calls.some(c=>c.o.body?.last_error===null),'Successful refresh clears its lease and error');
 const unchangedCalls=[];
 const unchanged=await refresh.reconcile({now:+now,request:async(p,o={})=>{
  unchangedCalls.push({p,o});
  if(p.endsWith('nothingsports_comms_claim_refresh'))return 'lease';
  if(p.includes('nothingsports_marquee_campaigns?'))return prepared.candidates.map(c=>({campaign_id:c.campaignId,event_id:c.eventId,content_hash:c.contentHash,candidate:c,draft_copy:{hook:'Owner edit'},campaign_revision:9}));
  if(p.endsWith('nothingsports_comms_sync_batch'))throw Error('Unchanged content must not be retransmitted');
  return [];
 }});
 assert.equal(unchanged.updated,0);
 assert(!unchangedCalls.some(c=>c.p.endsWith('nothingsports_comms_sync_batch')),'The six-hour refresh avoids sending unchanged campaign payloads');
 let batchNumber=0;
 const conflictCalls=[];
 await assert.rejects(refresh.reconcile({now:+now,request:async(p,o={})=>{
  conflictCalls.push({p,o});
  if(p.endsWith('nothingsports_comms_claim_refresh'))return 'lease';
  if(p.endsWith('nothingsports_comms_sync_batch'))return {updated:0,conflicts:++batchNumber===2?1:0};
  return [];
 }}),/concurrent edits/);
 assert.equal(batchNumber,2,'A concurrent edit stops remaining batches');
 assert(!conflictCalls.some(c=>c.o.body?.source_revision),'Partial refresh cannot mark the new source revision complete');
 assert(conflictCalls.some(c=>c.o.body?.last_error==='content_refresh_failed'&&c.o.body.lease_token===null),'Failed refresh releases its lease for an idempotent retry');
 const fixtures=require('../lib/reminder-fixtures');
 const upstream=new server.SupabaseRequestError('Deadline',{status:504,payload:{code:'supabase_timeout'}});
 const snapshotCalls=new Map();
 const catalogue=await fixtures.catalogue({rows:[],now,request:async (p,o)=>{
  const count=(snapshotCalls.get(p)||0)+1;snapshotCalls.set(p,count);
  if(count===1)throw upstream;
  return p.endsWith('nothingsports_read_reminder_fixture_bundle')?{schemaVersion:'current-fixture-bundle.v1',scope:'reminders',requiredIds:o.body.p_required_ids,complete:true,rows:[]}:[];
 }});
 assert.equal(catalogue.fixtures.length,0);
 assert([...snapshotCalls.values()].every(n=>n===2),'Each transient snapshot read retries only once');
 let attempts=0;
 await assert.rejects(fixtures.catalogue({rows:[],now,request:async()=>{attempts++;throw upstream;}}),e=>e===upstream);
 assert.equal(attempts,4,'Persistent outage stops after two attempts for each of the two reads');
 let rejected=0;
 await assert.rejects(fixtures.catalogue({rows:[],now,request:async()=>{rejected++;throw new server.SupabaseRequestError('Denied',{status:403});}}),e=>e.status===403);
 assert.equal(rejected,2,'Authorization failures are never retried');
 let claims=0;
 const health=[];
 const restorers=[
  mock('../lib/supabase-server',{...server,supabaseServiceRequest:async(p,o={})=>{if(p.includes('notification_dispatch_health'))health.push(o.body);if(p.includes('claim_due_reminders'))claims++;return null;}}),
  mock('../lib/automatic-reminders',{reconcile:async()=>{throw upstream;}}),
  mock('web-push',{setVapidDetails(){},sendNotification(){throw Error('Must not send');}}),
 ];
 const key=require.resolve('../api/notification-dispatch');delete require.cache[key];
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='recovery-test';
 try{
  const response={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;}};
  await require(key)({method:'GET',headers:{authorization:'Bearer recovery-test'}},response);
  assert.equal(response.code,503,'Reconciliation failures must retain their intended 503 through the real publicError');
  assert.equal(response.body.code,'reminder_schedule_reconciliation_failed');
  assert.equal(claims,0,'Unverified reminders cannot be claimed or sent');
  assert(!health.some(h=>h.last_success_at),'A blocked run cannot report success');
  const extra=[
   mock('../lib/automatic-reminders',{reconcile:async()=>({accounts:0,fixtures:0})}),
   mock('../lib/reminder-schedules',{reconcile:async()=>({checked:0,updated:0})}),
   mock('../lib/comms-refresh',{reconcile:async()=>{throw Error('Private upstream details');}}),
   mock('../lib/comms-post-alerts',{dispatch:async()=>({sent:0})}),
   mock('../lib/live-rating-alerts',{dispatch:async()=>({sent:0})}),
   mock('../lib/impact-feedback',{dispatch:async()=>({sent:0})}),
   mock('../lib/social-reward-alerts',{dispatch:async()=>({sent:0})}),
  ];
  const oldKeys={VAPID_PUBLIC_KEY:process.env.VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY:process.env.VAPID_PRIVATE_KEY};
  Object.assign(process.env,{VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test'});
  try{
   health.length=0;delete require.cache[key];
   await require(key)({method:'GET',headers:{authorization:'Bearer recovery-test'}},response);
   assert.equal(response.code,503,'Content refresh failures must be visible to the scheduler');
   assert.equal(health.at(-1).failed_count,1);
   assert.equal(health.at(-1).last_error,'content_refresh_failed');
   assert(!health.some(h=>h.last_success_at));
   assert(!JSON.stringify(response.body).includes('Private upstream details'));
  }finally{extra.reverse().forEach(r=>r());for(const [k,v] of Object.entries(oldKeys))v===undefined?delete process.env[k]:process.env[k]=v;}
 }finally{restorers.reverse().forEach(r=>r());delete require.cache[key];old===undefined?delete process.env.CRON_SECRET:process.env.CRON_SECRET=old;}
 console.log('Dispatcher incident regression passed: oversized campaign inventory, bounded transient recovery, persistent outage and safe fail-closed API status. No real notifications sent.');
}
main().then(impactHandlerBoundary).then(reconciliationTimingBoundary).then(()=>require('node:child_process').execFileSync(process.execPath,['scripts/validate-reminder-fixture-scope.js'],{stdio:'inherit'})).catch(e=>{console.error(e);process.exitCode=1;});
