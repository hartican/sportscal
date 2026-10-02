#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {budget}=require('../lib/reminder-dispatch-budget');
const mock=(name,exports)=>{const key=require.resolve(name),old=require.cache[key];require.cache[key]={id:key,filename:key,loaded:true,exports};return()=>old?require.cache[key]=old:delete require.cache[key];};
async function main(){
 let time=0,calls=0;const b=budget({clock:()=>time,request:async(_p,o)=>{calls++;return o.timeoutMs;}});assert.equal(await b.request('x'),3000);time=26900;assert.throws(()=>b.request('x'),/deadline/);assert.equal(calls,1,'No database request starts after the usable budget');
 const rows=Array.from({length:10},(_,i)=>({id:'r'+i,installation_id:'i'+i,event_id:'fixture:'+i,title:'Final '+i,starts_at:new Date(Date.now()+600000).toISOString(),remind_at:new Date().toISOString(),attempts:0,timing_precision:i===0?'not-before':'exact'}));
 let active=0,maxActive=0,sent=0,claimLimit=0,begun=new Set(),patches=new Set();
 const delayed=()=>new Promise(r=>setTimeout(r,100));
 const serviceRequest=async(p,o={})=>{await delayed();
  if(p.endsWith('nothingsports_reminder_accounts')||p.endsWith('nothingsports_reminder_schedule_candidates'))return [];
  if(p.endsWith('nothingsports_claim_due_reminders')){claimLimit=o.body.batch_limit;return rows.map(r=>({...r,claimed_at:o.body.claim_at}));}
  if(p.includes('nothingsports_push_installations?installation_id=in.'))return rows.map(r=>({installation_id:r.installation_id,timezone:'Australia/Sydney'}));
  if(p.endsWith('nothingsports_begin_fixture_reminder')){begun.add(o.body.reminder_id);return true;}
  if(p.endsWith('nothingsports_begin_notification_send'))return {leaseId:o.body.target_installation,subscription:{endpoint:'https://push.example/'+o.body.target_installation,keys:{}}};
  if(p.includes('nothingsports_reminders?id=')&&o.method==='PATCH')patches.add(p);
  return null;
 };
 const restorers=[mock('../lib/supabase-server',{supabaseServiceRequest:serviceRequest,supabaseMaintenanceMode:()=>false,publicError:e=>({status:503,body:{error:e.message}})}),mock('web-push',{setVapidDetails(){},async sendNotification(_sub,payload,options){active++;maxActive=Math.max(active,maxActive);assert(options.timeout<=3000);await new Promise(r=>setTimeout(r,3000));if(JSON.parse(payload).title==='Final 0')assert.match(JSON.parse(payload).body,/Not before/);active--;sent++;}}),mock('../lib/live-rating-alerts',{dispatch:async()=>{await new Promise(r=>setTimeout(r,6000));return {sent:0};}}),mock('../lib/comms-refresh',{reconcile:async()=>({skipped:true})}),mock('../lib/comms-post-alerts',{dispatch:async()=>({sent:0})}),mock('../lib/social-reward-alerts',{dispatch:async()=>{await new Promise(r=>setTimeout(r,6000));return {sent:0};}})];
 const keys=['../api/notification-dispatch','../lib/reminder-schedules','../lib/automatic-reminders','../lib/notification-send'].map(require.resolve);keys.forEach(k=>delete require.cache[k]);
 const previous={...process.env};Object.assign(process.env,{CRON_SECRET:'capacity-test',VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test'});
 try{
  const handler=require('../api/notification-dispatch'),start=Date.now();const response={setHeader(){},status(n){this.code=n;return this;},json(value){this.result=value;}};
  await handler({method:'GET',headers:{authorization:'Bearer capacity-test'}},response);
  const elapsed=Date.now()-start;assert.equal(response.code,200,JSON.stringify(response.result));assert.equal(sent,10);assert.equal(claimLimit,10);assert.equal(begun.size,10);assert.equal(patches.size,10);assert(maxActive<=2);assert(elapsed<30000,`Dispatcher exceeded deadline: ${elapsed}ms`);
  console.log(JSON.stringify({claimed:10,sent:10,maxConcurrent:maxActive,providerDelayMs:3000,databaseDelayMs:100,elapsedMs:elapsed,socialDeferred:response.result.socialRewards.deferred||false,realPush:false}));
 }finally{restorers.reverse().forEach(r=>r());keys.forEach(k=>delete require.cache[k]);for(const k of ['CRON_SECRET','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY'])previous[k]===undefined?delete process.env[k]:process.env[k]=previous[k];}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
