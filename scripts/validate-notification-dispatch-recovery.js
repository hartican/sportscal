#!/usr/bin/env node
'use strict';
// Isolated API and database mocks; no provider contact or production writes.
const assert=require('node:assert/strict');
const server=require('../lib/supabase-server');
const mock=(name,exports)=>{const key=require.resolve(name),old=require.cache[key];require.cache[key]={id:key,filename:key,loaded:true,exports};return()=>old?require.cache[key]=old:delete require.cache[key];};
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
 const catalogue=await fixtures.catalogue({rows:[],now,request:async p=>{
  const count=(snapshotCalls.get(p)||0)+1;snapshotCalls.set(p,count);
  if(count===1)throw upstream;
  return p.endsWith('nothingsports_read_current_fixture_bundle')?{schemaVersion:'current-fixture-bundle.v1',complete:true,rows:[]}:[];
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
main().catch(e=>{console.error(e);process.exitCode=1;});
