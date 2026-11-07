#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
async function main(){
 if(process.env.REMINDER_SCHEDULE_LIVE_QA!=='1')throw Error('Explicit disposable reminder probe required.');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}));
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_SERVICE_ROLE_KEY:keys.find(k=>k.name==='service_role').api_key};
 const {supabaseServiceRequest}=require('../lib/supabase-server');const {decision}=require('../lib/reminder-schedules');
 const request=(p,o={})=>supabaseServiceRequest(p,{...o,environment});
 const device=crypto.randomUUID(),id=crypto.randomUUID(),manifest=path.join(os.tmpdir(),`ns-reminder-schedule-qa-${id}.json`);
 fs.writeFileSync(manifest,JSON.stringify({project:'mkghopnkhcxtmfrcjdbc',installationId:device,reminderId:id}),{mode:0o600});
 const fixture=require('../data/code-inspector/football.json').fixtures.find(f=>f.competitionId==='competition:premier-league-2026-27'&&Date.parse(f.startTimeUtc)>Date.now()+86400000&&f.status==='upcoming');assert(fixture);
 const read=async()=> (await request(`/rest/v1/nothingsports_reminders?id=eq.${id}&select=*`))[0];
 const apply=async(f)=>request('/rest/v1/rpc/nothingsports_reconcile_reminder_schedules',{method:'POST',body:{updates:[decision(await read(),f)]}});
 let failure;
 try{
  await request('/rest/v1/nothingsports_push_installations',{method:'POST',body:{installation_id:device,user_id:null,secret_hash:crypto.randomBytes(32).toString('hex'),endpoint:`https://push.example.invalid/${device}`,permission:'denied',p256dh:'disposable',auth_key:'disposable'}});
  const saved=new Date(Date.parse(fixture.startTimeUtc)+2*86400000);
  await request('/rest/v1/nothingsports_reminders',{method:'POST',body:{id,installation_id:device,user_id:null,event_id:fixture.id,title:'Disposable schedule rehearsal',starts_at:saved.toISOString(),remind_at:new Date(+saved-900000).toISOString(),delivery_mode:'match-15'}});
  assert.equal(await apply(fixture),1);let row=await read();assert.equal(Date.parse(row.starts_at),Date.parse(fixture.startTimeUtc));assert.equal(row.id,id);assert.equal(row.installation_id,device);
  const stale=decision(row,fixture);
  const later={...fixture,startTimeUtc:new Date(Date.parse(fixture.startTimeUtc)+4*3600000).toISOString()};assert.equal(await apply(later),1);
  assert.equal(await request('/rest/v1/rpc/nothingsports_reconcile_reminder_schedules',{method:'POST',body:{updates:[stale]}}),0,'Concurrent change wins');
  assert.equal(await apply({...fixture,status:'postponed'}),1);row=await read();assert.equal(row.schedule_state,'inactive');
  assert.equal(await request('/rest/v1/rpc/nothingsports_reminder_schedule_eligible',{method:'POST',body:{r:row,at_time:new Date().toISOString()}}),false);
  assert.equal(await apply(fixture),1);row=await read();assert.equal(row.schedule_state,'ready');assert.equal(Date.parse(row.remind_at),Date.parse(fixture.startTimeUtc)-900000);
  assert.equal(await request('/rest/v1/rpc/nothingsports_reminder_schedule_eligible',{method:'POST',body:{r:row,at_time:new Date().toISOString()}}),true);
 }catch(e){failure=e;}
 try{await request(`/rest/v1/nothingsports_push_installations?installation_id=eq.${device}`,{method:'DELETE'});assert.equal((await request(`/rest/v1/nothingsports_reminders?id=eq.${id}&select=id`)).length,0);fs.unlinkSync(manifest);}catch{throw Error('Disposable reminder cleanup incomplete; retain private recovery manifest.');}
 if(failure)throw failure;
 const report={checkedAt:new Date().toISOString(),project:'mkghopnkhcxtmfrcjdbc',checks:['published_fixture_replaces_stale_later_time','injected_later_time_preserves_choice','stale_compare_and_set_rejected','postponement_held','confirmed_time_restored','shared_eligibility_verified','disposable_installation_and_reminder_removed'],limitations:['One disposable installation with push permission denied','Injected later/postponed fixture decisions test transitions, not provider truth','No external push or real reminder modified']};
 if(process.env.REMINDER_SCHEDULE_REPORT)fs.writeFileSync(process.env.REMINDER_SCHEDULE_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
