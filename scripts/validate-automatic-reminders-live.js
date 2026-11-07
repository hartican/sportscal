#!/usr/bin/env node
'use strict';
// Disposable Auth/accounts only. Invalid push endpoints and future fixtures;
// this probe never calls a push provider or the production dispatcher.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
async function main(){
 if(process.env.AUTOMATIC_REMINDER_LIVE_QA!=='1')throw Error('Explicit disposable account probe required');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}));
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_PUBLISHABLE_KEY:keys.find(k=>k.name==='anon').api_key,SUPABASE_SERVICE_ROLE_KEY:keys.find(k=>k.name==='service_role').api_key};
 const previous=Object.fromEntries(Object.keys(environment).map(k=>[k,process.env[k]]));Object.assign(process.env,environment);
 const server=require('../lib/supabase-server'),automatic=require('../lib/automatic-reminders'),fixtures=require('../lib/reminder-fixtures'),sync=require('../config/user-state-sync');
 const request=(p,o={})=>server.supabaseServiceRequest(p,{...o,environment});
 const users=[],devices=[],stamp=crypto.randomUUID(),journal=path.join(os.tmpdir(),'ns-auto-reminder-qa-'+stamp+'.json');
 const save=()=>fs.writeFileSync(journal,JSON.stringify({project:'mkghopnkhcxtmfrcjdbc',users:users.map(u=>u.id),devices}),{mode:0o600});save();
 const catalogue=fixtures.index(fixtures.published()),fixture=catalogue.resolve('evt_84');assert(fixture&&Date.parse(fixture.startTimeUtc)>Date.now()+86400000,'A future reviewed official knockout fixture is required');
 const invoke=async(handler,user,body,method='POST')=>{const response={setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;}};await handler({method,body,headers:{authorization:'Bearer '+user.token}},response);return response;};
 const readState=async u=>(await request('/rest/v1/nothingsports_user_state?user_id=eq.'+u.id+'&select=*'))[0];
 const readIntent=async u=>(await request('/rest/v1/nothingsports_reminder_intents?user_id=eq.'+u.id+'&fixture_id=eq.'+encodeURIComponent(fixture.actionKey)+'&select=*'))[0];
 const deliveries=async u=>request('/rest/v1/nothingsports_reminders?user_id=eq.'+u.id+'&select=*');
 let failure;const checks=[];
 try{
  for(let n=0;n<2;n++){
   const email='auto-reminder-qa-'+stamp+'-'+n+'@example.invalid',password=crypto.randomBytes(24).toString('base64url');
   const created=await request('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});const user={id:created.id};users.push(user);save();
   user.token=(await server.supabaseRequest('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},environment})).access_token;
   await request('/rest/v1/nothingsports_user_state',{method:'POST',body:{user_id:user.id,preferences:{version:24,onboardingComplete:true,preferenceGraph:{entityFollows:[{participantId:'team:nrl:331',followLevel:'follow'}]},followFirst:{notifications:{enabled:true,sportingRemindersEnabled:true}}}}});
   const device=crypto.randomUUID(),secret=crypto.randomBytes(32).toString('base64url');devices.push(device);save();user.device=device;user.secret=secret;
   await request('/rest/v1/nothingsports_push_installations',{method:'POST',body:{installation_id:device,user_id:user.id,secret_hash:crypto.createHash('sha256').update(secret).digest('hex'),endpoint:'https://push.example.invalid/'+device,p256dh:'disposable',auth_key:'disposable',permission:'denied'}});
   await automatic.reconcile({request,catalogue,targetUser:user.id});assert.equal((await readIntent(user)).enabled,true);assert.equal((await deliveries(user)).length,0);
  }
  checks.push('app_closed_account_intent_created_without_permission','permission_denial_prevents_delivery');
  const [owner,peer]=users;await request('/rest/v1/nothingsports_push_installations?installation_id=eq.'+owner.device,{method:'PATCH',body:{permission:'granted'}});
  await automatic.reconcile({request,catalogue,targetUser:owner.id});let rows=await deliveries(owner);assert.equal(rows.length,1);assert.equal(rows[0].reminder_origin,'automatic');assert.equal(Date.parse(rows[0].starts_at),Date.parse(fixture.startTimeUtc));assert.equal((await deliveries(peer)).length,0);
  const hidden=await server.supabaseRequest('/rest/v1/nothingsports_user_state?user_id=eq.'+owner.id+'&select=user_id',{accessToken:peer.token,environment});assert.equal(hidden.length,0);checks.push('automatic_installation_materialization','account_isolation');
  const notifications=require('../api/notifications');let result=await invoke(notifications,owner,{action:'cancel',eventId:fixture.id});assert.equal(result.code,200,JSON.stringify(result.body));
  await automatic.reconcile({request,catalogue,targetUser:owner.id});assert.equal((await readIntent(owner)).choice,'off');assert.equal((await readIntent(owner)).enabled,false);checks.push('authenticated_fixture_off_persists');
  const saved=await readState(owner),base=server.userStateFromRow(saved),changed=JSON.parse(JSON.stringify(base));changed.eventUserState[fixture.actionKey]={...changed.eventUserState[fixture.actionKey],reminderChoice:'on',reminderRequested:true,reminderChangedAt:new Date(Date.now()-60000).toISOString()};
  result=await invoke(require('../api/user-state'),owner,{patch:sync.createPatch(base,changed,{baseUpdatedAt:saved.updated_at})},'PUT');assert.equal(result.code,200,JSON.stringify(result.body));assert.equal(result.body.state.event_user_state[fixture.actionKey].reminderChoice,'off');checks.push('offline_state_patch_cannot_restore_older_on');
  result=await invoke(notifications,owner,{action:'remind',installationId:owner.device,secret:owner.secret,eventId:fixture.id,title:'Untrusted title',startsAt:'2035-01-01T00:00Z'});assert.equal(result.code,200,JSON.stringify(result.body));assert.equal(Date.parse(result.body.startsAt),Date.parse(fixture.startTimeUtc));checks.push('authenticated_api_ignores_submitted_timing_and_title');
  await request('/rest/v1/nothingsports_push_installations?installation_id=eq.'+owner.device,{method:'PATCH',body:{sporting_reminders_enabled:false}});rows=await deliveries(owner);assert.equal(await request('/rest/v1/rpc/nothingsports_reminder_schedule_eligible',{method:'POST',body:{r:rows[0],at_time:new Date().toISOString()}}),false);checks.push('installation_sporting_opt_out');
  await request('/rest/v1/nothingsports_account_erasure_blocks',{method:'POST',body:{user_id:owner.id}});assert.equal((await automatic.reconcile({request,catalogue,targetUser:owner.id})).accounts,0);await assert.rejects(()=>automatic.choose({userId:owner.id,fixture,enabled:true,request}));checks.push('erasure_blocks_intent_and_reconciliation');
 }catch(e){failure=e;}
 try{for(const u of users){await request('/auth/v1/admin/users/'+u.id,{method:'DELETE'});assert.equal((await request('/rest/v1/nothingsports_reminder_intents?user_id=eq.'+u.id+'&select=fixture_id')).length,0);assert.equal((await deliveries(u)).length,0);await request('/rest/v1/nothingsports_account_erasure_blocks?user_id=eq.'+u.id,{method:'DELETE'});}fs.unlinkSync(journal);checks.push('disposable_auth_cascade_and_cleanup');}catch(e){throw Error('Disposable cleanup incomplete; retain private recovery journal: '+journal);}
 finally{for(const [k,v] of Object.entries(previous))v===undefined?delete process.env[k]:process.env[k]=v;}
 if(failure)throw failure;
 const report={checkedAt:new Date().toISOString(),project:'mkghopnkhcxtmfrcjdbc',checks,limitations:['Disposable accounts and invalid push endpoints only','No push provider or production dispatcher called','Future published NRL fixture tests persistence; it does not prove tennis coverage or phone delivery']};
 if(process.env.AUTOMATIC_REMINDER_REPORT)fs.writeFileSync(process.env.AUTOMATIC_REMINDER_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
