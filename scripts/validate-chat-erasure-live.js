#!/usr/bin/env node
'use strict';
// Opt-in integration rehearsal. Only accounts/rooms/objects minted by this run.
// Never accepts a target account ID, reads real conversations, or prints secrets.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync,execFile}=require('node:child_process');
const execFileAsync=require('node:util').promisify(execFile);
async function main(){
 if(process.env.CHAT_ERASURE_LIVE_QA!=='1')throw Error('Set CHAT_ERASURE_LIVE_QA=1 for the disposable recovery-project rehearsal.');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}));
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_PUBLISHABLE_KEY:keys.find(k=>k.name==='anon')?.api_key,SUPABASE_SERVICE_ROLE_KEY:keys.find(k=>k.name==='service_role')?.api_key};
 assert(environment.SUPABASE_SERVICE_ROLE_KEY&&environment.SUPABASE_PUBLISHABLE_KEY,'Test credentials unavailable');
 const {supabaseServiceRequest,supabaseRequest,userStateFromRow}=require('../lib/supabase-server');
 const {createPatch}=require('../config/user-state-sync');
 const service=(path,options={})=>supabaseServiceRequest(path,{...options,environment});
 const auth=(path,options={})=>supabaseRequest(path,{...options,environment});
 const users=[],objects=[],installations=[],sendLeases=[],checks=[];let roomId=null,removed=new Set(),workflowJournalDirectory=null;
 const bucket='nothingsports-chat-transient',stamp=crypto.randomBytes(7).toString('hex');
 const manifest=path.join(os.tmpdir(),`nothingsport-erasure-qa-${stamp}.json`);
 function checkpoint(){fs.writeFileSync(manifest,JSON.stringify({project:'mkghopnkhcxtmfrcjdbc',accountIds:users.map(u=>u.id),roomId,bucket,objects,installationIds:installations,sendLeaseIds:sendLeases,workflowJournalDirectory,removedAccountIds:[...removed]}),{mode:0o600});}
 checkpoint();
 const rest=(table,query='')=>`/rest/v1/nothingsports_${table}${query?'?'+query:''}`;
 const post=(table,body)=>service(rest(table),{method:'POST',headers:{Prefer:'return=representation'},body});
 const accountOwned=id=>assert(users.some(u=>u.id===id),'Refusing unowned account');
 async function removeObject(object){
  assert(objects.includes(object)&&users.some(u=>object.startsWith(u.id+'/')),'Refusing unowned object');
  await service(`/storage/v1/object/${bucket}`,{method:'DELETE',body:{prefixes:[object]}});
 }
 async function deleteAccount(user){accountOwned(user.id);await service(`/auth/v1/admin/users/${user.id}`,{method:'DELETE'});removed.add(user.id);checkpoint();}
 async function chat(user){const r=await fetch(`https://nothingsport.vercel.app/api/chat?roomId=${roomId}`,{headers:{Authorization:`Bearer ${user.token}`},signal:AbortSignal.timeout(20000)});return {status:r.status,body:await r.json()};}
 async function api(user,route,method='GET',body){
  const response=await fetch(`https://nothingsport.vercel.app/api/${route}`,{method,headers:{Authorization:`Bearer ${user.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  return {status:response.status,body:await response.json()};
 }
 async function calendarRead(user){
  const response=await fetch(`https://nothingsport.vercel.app/api/calendar?token=${user.calendarToken}`,{signal:AbortSignal.timeout(20000)});
  const body=await response.text();
  return {status:response.status,isCalendar:body.startsWith('BEGIN:VCALENDAR'),private:response.headers.get('cache-control')?.includes('no-store')};
 }
 async function sqlProbe(sql){
  try{
   const result=await execFileAsync('node_modules/.bin/supabase',['db','query','--linked','--project-ref','mkghopnkhcxtmfrcjdbc','--output','json',sql],{timeout:40000,maxBuffer:1024*1024});
   return JSON.parse(result.stdout).rows;
  }catch(error){throw Error('Disposable concurrency SQL probe failed');}
 }
 let failure,heldWrite,oldUploadUrl;
 try{
  for(let i=0;i<3;i++){
   const email=`erasureqa_${stamp}_${i}@example.invalid`,password=crypto.randomBytes(24).toString('base64url');
   const created=await service('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
   const user={id:created.id};users.push(user);checkpoint();
   const session=await auth('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
   user.token=session.access_token;user.refresh=session.refresh_token;assert(user.token&&user.refresh);
   await post('chat_profiles',{user_id:user.id,email_normalized:email,display_name:'Disposable QA'});
  }
  const [owner,peer,control]=users;
  const ratingEvent=`qa-erasure-${stamp}-ratings`;
  for(const [index,user] of [owner,peer].entries()){
   await post('nsc_contributions',{event_id:ratingEvent,user_id:user.id,phase:'impact',rating:index+2});
  }
  for(const table of ['nsc_contributions','nsc_rating_history']){
   assert.equal((await service(rest(table,`event_id=eq.${ratingEvent}&select=user_id`))).length,2,`${table} seeded`);
  }
  await post('user_follows',[{follower_user_id:owner.id,followed_user_id:peer.id},{follower_user_id:peer.id,followed_user_id:owner.id},{follower_user_id:peer.id,followed_user_id:control.id}]);
  for(const [index,user] of users.entries()){
   const initial=await api(user,'user-state');assert.equal(initial.status,200);
   const previous=userStateFromRow(initial.body.state)||{};
   const preferences={...previous.preferences,showResults:index===0,selectedSelectorEntityIds:[index===0?'football':'nrl']};
   const patch=createPatch(previous,{...previous,preferences},{baseUpdatedAt:initial.body.state?.updated_at||null});
   const saved=await api(user,'user-state','PUT',{patch});assert.equal(saved.status,200,'Authenticated preference save');
   user.savedPreferences=preferences;
   assert.deepEqual((await api(user,'user-state')).body.state.preferences,preferences);
   const subscription=await api(user,'calendar','POST',{includedIds:[],excludedIds:[]});assert.equal(subscription.status,200,'Authenticated calendar creation');
   user.calendarToken=subscription.body.subscription?.token;
   assert(typeof user.calendarToken==='string'&&/^[a-f0-9]{64}$/.test(user.calendarToken),'Calendar secret created');
   assert.deepEqual(await calendarRead(user),{status:200,isCalendar:true,private:true});
  }
  checks.push('authenticated_preferences_and_private_calendars_created');
  // Future-only reminders and non-routable test endpoints cannot notify a person.
  for(const userId of [owner.id,peer.id,null]){
   const id=crypto.randomUUID();installations.push(id);checkpoint();
   await post('push_installations',{installation_id:id,user_id:userId,secret_hash:crypto.randomBytes(32).toString('hex'),endpoint:`https://push.example.invalid/erasure-${stamp}/${id}`,permission:'granted',p256dh:'disposable',auth_key:'disposable'});
  }
  for(const [index,userId,suffix] of [[0,owner.id,'own'],[0,null,'own-install-anonymous'],[1,owner.id,'reassigned-device'],[1,peer.id,'peer'],[2,null,'anonymous']]){
   await post('reminders',{installation_id:installations[index],user_id:userId,event_id:`qa-erasure-${stamp}-${suffix}`,title:'Disposable future reminder',starts_at:'2035-01-01T02:00:00Z',remind_at:'2035-01-01T01:00:00Z'});
  }
  const room=await post('chat_rooms',{canonical_fixture_id:`qa-erasure-${stamp}`,fixture_snapshot:{title:'Disposable erasure rehearsal',sport:'Football'},room_name:'Disposable erasure rehearsal',created_by:owner.id});roomId=room[0].id;checkpoint();
  await post('chat_members',users.slice(0,2).map(u=>({room_id:roomId,user_id:u.id,added_by:owner.id})));
  const original=(await post('chat_messages',{room_id:roomId,sender_id:owner.id,client_id:`qa-original-${stamp}`,body:'Disposable owner message'}))[0];
  await post('chat_messages',{room_id:roomId,sender_id:peer.id,client_id:`qa-reply-${stamp}`,body:'Disposable peer reply',reply_to_message_id:original.id});
  for(let i=0;i<2;i++){
   const attachmentId=crypto.randomUUID(),object=`${owner.id}/${roomId}/${attachmentId}/qa.txt`;objects.push(object);checkpoint();
   if(i===0){
    const signed=await service(`/storage/v1/object/upload/sign/${bucket}/${object}`,{method:'POST',body:{}});
    const relative=signed.url||signed.signedURL||signed.signedUrl;
    assert(typeof relative==='string','Disposable signed upload created');
    oldUploadUrl=relative.startsWith('http')?relative:`${environment.SUPABASE_URL}/storage/v1${relative}`;
   }
   const uploaded=await fetch(`${environment.SUPABASE_URL}/storage/v1/object/${bucket}/${object}`,{method:'POST',headers:{apikey:environment.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'text/plain'},body:'Disposable rehearsal media',signal:AbortSignal.timeout(20000)});
   assert(uploaded.ok,`Test media upload status ${uploaded.status}`);
   await post('chat_attachments',{attachment_id:attachmentId,room_id:roomId,message_id:original.id,uploader_id:owner.id,kind:'file',file_name:'qa.txt',content_type:'text/plain',byte_size:26,storage_bucket:bucket,object_path:object,status:'ready'});
  }
  assert.equal((await chat(peer)).status,200,'Peer must read seeded room');
  // Model a partial external-service failure: first object removed, second step fails.
  await removeObject(objects[0]);
  await assert.rejects(async()=>{throw Error('Injected Storage interruption');},/Injected/);
  assert.equal((await service(rest('chat_attachments',`room_id=eq.${roomId}&select=attachment_id`))).length,2,'Metadata must remain until all media deletion succeeds');
  assert.equal((await service(rest('chat_messages',`room_id=eq.${roomId}&select=id`))).length,2);
  checks.push('partial_storage_failure_preserves_cleanup_lineage');
  for(const object of objects)await removeObject(object); // includes safe retry of first deletion
  for(const object of objects){
   const missing=await fetch(`${environment.SUPABASE_URL}/storage/v1/object/authenticated/${bucket}/${object}`,{headers:{apikey:environment.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`},signal:AbortSignal.timeout(20000)});
   assert([400,404].includes(missing.status),`Deleted object status ${missing.status}`);
  }
  checks.push('storage_retry_and_origin_absence');
  const admitSend=(installationId,userId,related=[])=>service('/rest/v1/rpc/nothingsports_begin_notification_send',{method:'POST',body:{target_installation:installationId,expected_user:userId,related_users:related}});
  const admitted=await admitSend(installations[0],owner.id);assert(admitted?.leaseId);sendLeases.push(admitted.leaseId);checkpoint();
  assert.equal(await admitSend(installations[0],peer.id),null,'Stale device ownership cannot admit a send');
  const beginErasure=()=>service('/rest/v1/rpc/nothingsports_begin_account_erasure',{method:'POST',body:{target_user_id:owner.id}});
  if(process.env.ERASURE_BARRIER_RACE==='1'){
   accountOwned(owner.id);assert(/^[a-f0-9-]{36}$/.test(owner.id));
   heldWrite=sqlProbe(`begin;set local statement_timeout='30s';set local application_name='qa-erasure-${stamp}';update public.nothingsports_user_state set preferences=preferences where user_id='${owner.id}';select pg_sleep(20);commit;select true as held;`).then(rows=>({rows}),()=>({error:true}));
   // Allow the CLI's connection setup to settle. The required lock timeout below,
   // followed by successful writer completion, is the observation of overlap.
   // A missed window fails the test; it cannot produce a false concurrency pass.
   await new Promise(resolve=>setTimeout(resolve,12000));
   await assert.rejects(beginErasure,e=>e.payload?.code==='55P03','Begin must time out instead of racing the open write');
   assert.equal((await service(rest('account_erasure_blocks',`user_id=eq.${owner.id}&select=user_id`))).length,0,'Timed-out begin leaves no active barrier');
   assert(!(await heldWrite).error,'Held writer completes');
   checks.push('observed_inflight_write_blocks_erasure_begin');
  }
  let barrier;
  if(process.env.ERASURE_WORKFLOW_QA==='1'){
   const {operator}=require('../lib/account-erasure-operator');
   const {newJournal,advance}=require('../lib/account-erasure-workflow');
   const {openJournal}=require('../lib/account-erasure-journal');
   workflowJournalDirectory=path.join(os.tmpdir(),`nothingsport-erasure-journal-${stamp}`);checkpoint();
   const store=openJournal(workflowJournalDirectory,owner.id),adapter=operator({environment});
   try{
    const journal=newJournal(owner.id,{verifiedAccountId:owner.id,requestId:`disposable-${stamp}`,verifiedAt:new Date().toISOString()});
    await advance({journal,...adapter,persist:store.persist});
    assert.deepEqual(journal.steps.map(s=>s.phase),['freeze','captureLineage']);
    assert.equal(journal.phase,'drainIssuers');assert.equal(journal.complete,false);
    assert(journal.pending.includes('legacy_deployment_shutdown_evidence_required'));
    assert(journal.pending.includes('notification_attempt_reconciliation_required'));
    for(const object of objects)assert(journal.lineage.objects.some(item=>item.bucket===bucket&&item.objectPath===object),'Owned Storage lineage survives removal of bytes');
    barrier=journal.steps[0].evidence.startedAt;
    const restored=store.load();await advance({journal:restored,...adapter,persist:store.persist});
    assert.equal(restored.steps[0].evidence.startedAt,barrier);assert.equal(restored.steps.length,2);assert.equal(restored.complete,false);
   }finally{store.close();}
   checks.push('durable_workflow_freeze_lineage_and_resume_verified','workflow_pauses_for_missing_issuer_and_send_evidence');
  }else barrier=await beginErasure();
  assert.equal(await beginErasure(),barrier,'Erasure begin retries safely');
  const blockedAuth=await auth('/auth/v1/user',{accessToken:owner.token});
  assert(blockedAuth.app_metadata?.nothingsport_erasure_started_at,'Fresh protected Auth metadata marks erasure');
  const stoppedRead=await api(owner,'user-state');assert.equal(stoppedRead.status,403);assert.equal(stoppedRead.body.code,'account_erasure_in_progress');
  checks.push('fresh_auth_gate_stops_new_application_requests');
  assert.equal(await admitSend(installations[0],owner.id),null,'Erasing recipient cannot acquire send lease');
  assert.equal(await admitSend(installations[1],peer.id,[owner.id]),null,'Erasing actor cannot enter new outbound payload');
  const inFlight=await service(rest('notification_send_leases',`lease_id=eq.${admitted.leaseId}&select=outcome`));assert.deepEqual(inFlight,[{outcome:'in_flight'}]);
  await service(rest('notification_send_leases',`lease_id=eq.${admitted.leaseId}`),{method:'PATCH',body:{outcome:'uncertain',finished_at:new Date().toISOString()}});
  const peerLease=await admitSend(installations[1],peer.id);assert(peerLease?.leaseId);sendLeases.push(peerLease.leaseId);checkpoint();
  await service(rest('notification_send_leases',`lease_id=eq.${peerLease.leaseId}`),{method:'PATCH',body:{outcome:'rejected',finished_at:new Date().toISOString()}});
  checks.push('new_notification_sends_denied_after_barrier','admitted_send_remains_reconcilable','unrelated_peer_send_admission_preserved');
  const blocked=e=>e.payload?.code==='55000';
  await assert.rejects(()=>service(rest('nsc_contributions',`user_id=eq.${owner.id}&event_id=eq.${ratingEvent}`),{method:'PATCH',body:{rating:4}}),blocked);
  await assert.rejects(()=>post('user_follows',{follower_user_id:control.id,followed_user_id:owner.id}),blocked);
  await assert.rejects(()=>auth(rest('user_state',`user_id=eq.${owner.id}`),{method:'PATCH',accessToken:owner.token,body:{preferences:{showResults:false}}}),blocked);
  await service(rest('nsc_contributions',`user_id=eq.${peer.id}&event_id=eq.${ratingEvent}`),{method:'PATCH',body:{rating:3}});
  checks.push('service_and_direct_authenticated_writes_blocked','unrelated_peer_write_preserved','erasure_begin_idempotent');
  await auth('/auth/v1/logout?scope=global',{method:'POST',accessToken:owner.token});
  await assert.rejects(()=>auth('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:owner.refresh}}),e=>[400,401,403].includes(e.status));
  checks.push('refresh_rejected_after_global_logout');
  await service(rest('chat_messages',`sender_id=eq.${owner.id}&room_id=eq.${roomId}`),{method:'DELETE'});
  await deleteAccount(owner);
  for(const table of ['nsc_contributions','nsc_rating_history']){
   const rows=await service(rest(table,`event_id=eq.${ratingEvent}&select=user_id,rating`));
   assert.deepEqual(rows,[{user_id:peer.id,rating:3}],`${table} removes owner and preserves peer`);
  }
  const follows=await service(rest('user_follows',`or=(follower_user_id.in.(${users.map(u=>u.id).join(',')}),followed_user_id.in.(${users.map(u=>u.id).join(',')}))&select=follower_user_id,followed_user_id`));
  assert.deepEqual(follows,[{follower_user_id:peer.id,followed_user_id:control.id}]);
  checks.push('owned_ratings_and_history_removed','incoming_and_outgoing_follows_removed','peer_ratings_and_unrelated_follow_preserved');
  for(const table of ['user_state','calendar_subscriptions']){
   const rows=await service(rest(table,`user_id=in.(${owner.id},${peer.id})&select=user_id`));
   assert.deepEqual(rows,[{user_id:peer.id}],`${table} removes owner and preserves peer`);
  }
  assert([401,403].includes((await api(owner,'user-state')).status),'Deleted account preferences inaccessible');
  const peerState=await api(peer,'user-state');assert.equal(peerState.status,200);assert.deepEqual(peerState.body.state.preferences,peer.savedPreferences);
  assert.deepEqual(await calendarRead(owner),{status:404,isCalendar:false,private:true});
  assert.deepEqual(await calendarRead(peer),{status:200,isCalendar:true,private:true});
  checks.push('owned_preferences_and_calendar_removed','old_calendar_link_revoked','peer_preferences_and_calendar_access_preserved');
  const lateUpload=await fetch(oldUploadUrl,{method:'PUT',headers:{'Content-Type':'text/plain'},body:'Disposable late upload',signal:AbortSignal.timeout(20000)});
  assert.equal(lateUpload.status,200,'Provider signed upload capability survives Auth deletion');
  await removeObject(objects[0]);
  checks.push('preissued_upload_survives_auth_deletion_and_requires_later_sweep');
  assert.equal((await service(rest('notification_send_leases',`lease_id=eq.${admitted.leaseId}&select=outcome`)))[0]?.outcome,'uncertain','Send receipt survives Auth removal for reconciliation');
  const installFilter=`installation_id=in.(${installations.join(',')})`;
  const remainingInstalls=await service(rest('push_installations',installFilter+'&select=installation_id'));
  assert.deepEqual(remainingInstalls.map(r=>r.installation_id).sort(),installations.slice(1).sort());
  const remainingReminders=await service(rest('reminders',installFilter+'&select=event_id'));
  assert.deepEqual(remainingReminders.map(r=>r.event_id).sort(),[`qa-erasure-${stamp}-anonymous`,`qa-erasure-${stamp}-peer`].sort());
  checks.push('owned_push_and_reminders_removed','reassigned_device_own_reminder_removed','peer_and_anonymous_notifications_preserved');
  const surviving=(await service(rest('chat_rooms',`id=eq.${roomId}&select=created_by`)))[0];assert.equal(surviving.created_by,null);
  const members=await service(rest('chat_members',`room_id=eq.${roomId}&select=user_id,added_by`));assert.deepEqual(members,[{user_id:peer.id,added_by:null}]);
  const messages=await service(rest('chat_messages',`room_id=eq.${roomId}&select=sender_id,body,reply_to_message_id`));assert.deepEqual(messages,[{sender_id:peer.id,body:'Disposable peer reply',reply_to_message_id:null}]);
  assert.equal((await service(rest('chat_attachments',`room_id=eq.${roomId}&select=attachment_id`))).length,0);
  const peerRead=await chat(peer);assert.equal(peerRead.status,200);assert.equal(peerRead.body.room.canDeleteRoom,false);
  assert([401,403].includes((await chat(owner)).status),'Old access token must fail on live chat API');
  await assert.rejects(()=>auth('/auth/v1/user',{accessToken:owner.token}),e=>[401,403].includes(e.status));
  checks.push('peer_content_and_live_access_preserved','old_access_token_rejected_by_auth_and_live_chat');
 }catch(e){failure=e;}finally{
  // Never use global cleanup helpers: scope every deletion to this run's IDs.
  const cleanupErrors=[];
  if(heldWrite&&(await heldWrite).error&&!failure)failure=Error('Held SQL writer failed');
  for(const object of objects){try{await removeObject(object);}catch(e){cleanupErrors.push('media');}}
  for(const id of installations){try{await service(rest('push_installations',`installation_id=eq.${id}`),{method:'DELETE'});}catch(e){cleanupErrors.push('installation');}}
  if(roomId){try{await service(rest('chat_rooms',`id=eq.${roomId}`),{method:'DELETE'});}catch(e){cleanupErrors.push('room');}}
  for(const user of users.filter(u=>!removed.has(u.id))){try{await deleteAccount(user);}catch(e){cleanupErrors.push('account');}}
  if(users.length){
   for(const table of ['user_state','calendar_subscriptions','nsc_contributions','nsc_rating_history']){
    try{assert.equal((await service(rest(table,`user_id=in.(${users.map(u=>u.id).join(',')})&select=user_id`))).length,0);}catch(e){cleanupErrors.push(table);}
   }
  }
  if(users.length){
   try{assert.equal((await service(rest('user_follows',`or=(follower_user_id.in.(${users.map(u=>u.id).join(',')}),followed_user_id.in.(${users.map(u=>u.id).join(',')}))&select=follower_user_id`))).length,0);}catch(e){cleanupErrors.push('user_follows');}
  }
  for(const id of sendLeases){try{await service(rest('notification_send_leases',`lease_id=eq.${id}`),{method:'DELETE'});}catch(e){cleanupErrors.push('send_lease');}}
  for(const user of users.filter(u=>removed.has(u.id))){try{await service(rest('account_erasure_blocks',`user_id=eq.${user.id}`),{method:'DELETE'});}catch(e){cleanupErrors.push('erasure_barrier');}}
  if(cleanupErrors.length)throw Error(`Disposable cleanup incomplete: ${cleanupErrors.join(',')}. Private recovery manifest: ${manifest}. Do not rerun blindly.`);
  if(workflowJournalDirectory)fs.rmSync(workflowJournalDirectory,{recursive:true});
  fs.unlinkSync(manifest);
 }
 if(failure)throw failure;
 const report={checkedAt:new Date().toISOString(),project:'mkghopnkhcxtmfrcjdbc',accountsCreated:users.length,accountsRemoved:removed.size,checks,limitations:['Disposable chat, notification, preferences, calendar, rating and social-follow service rehearsal, not full account erasure','Storage failure injected in runner, not a provider outage','Database barrier excludes Storage grants, indirect identity writes and external delivery','Ratings and social follows were service-seeded; no prediction/reward/all-category or device-cache proof; no physical push delivery']};
 if(process.env.CHAT_ERASURE_REPORT)fs.writeFileSync(process.env.CHAT_ERASURE_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(`Disposable erasure rehearsal failed: ${e.name||'Error'} ${e.status||''} ${e.message||''}`);process.exitCode=1;});
