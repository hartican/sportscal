#!/usr/bin/env node
'use strict';
// Opt-in integration rehearsal. Only accounts/rooms/objects minted by this run.
// Never accepts a target account ID, reads real conversations, or prints secrets.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
async function main(){
 if(process.env.CHAT_ERASURE_LIVE_QA!=='1')throw Error('Set CHAT_ERASURE_LIVE_QA=1 for the disposable recovery-project rehearsal.');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}));
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_PUBLISHABLE_KEY:keys.find(k=>k.name==='anon')?.api_key,SUPABASE_SERVICE_ROLE_KEY:keys.find(k=>k.name==='service_role')?.api_key};
 assert(environment.SUPABASE_SERVICE_ROLE_KEY&&environment.SUPABASE_PUBLISHABLE_KEY,'Test credentials unavailable');
 const {supabaseServiceRequest,supabaseRequest}=require('../lib/supabase-server');
 const service=(path,options={})=>supabaseServiceRequest(path,{...options,environment});
 const auth=(path,options={})=>supabaseRequest(path,{...options,environment});
 const users=[],objects=[],checks=[];let roomId=null,removed=new Set();
 const bucket='nothingsports-chat-transient',stamp=crypto.randomBytes(7).toString('hex');
 const manifest=path.join(os.tmpdir(),`nothingsport-erasure-qa-${stamp}.json`);
 function checkpoint(){fs.writeFileSync(manifest,JSON.stringify({project:'mkghopnkhcxtmfrcjdbc',accountIds:users.map(u=>u.id),roomId,bucket,objects,removedAccountIds:[...removed]}),{mode:0o600});}
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
 let failure;
 try{
  for(let i=0;i<2;i++){
   const email=`erasureqa_${stamp}_${i}@example.invalid`,password=crypto.randomBytes(24).toString('base64url');
   const created=await service('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
   const user={id:created.id};users.push(user);checkpoint();
   const session=await auth('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
   user.token=session.access_token;user.refresh=session.refresh_token;assert(user.token&&user.refresh);
   await post('chat_profiles',{user_id:user.id,email_normalized:email,display_name:'Disposable QA'});
  }
  const [owner,peer]=users;
  const room=await post('chat_rooms',{canonical_fixture_id:`qa-erasure-${stamp}`,fixture_snapshot:{title:'Disposable erasure rehearsal',sport:'Football'},room_name:'Disposable erasure rehearsal',created_by:owner.id});roomId=room[0].id;checkpoint();
  await post('chat_members',users.map(u=>({room_id:roomId,user_id:u.id,added_by:owner.id})));
  const original=(await post('chat_messages',{room_id:roomId,sender_id:owner.id,client_id:`qa-original-${stamp}`,body:'Disposable owner message'}))[0];
  await post('chat_messages',{room_id:roomId,sender_id:peer.id,client_id:`qa-reply-${stamp}`,body:'Disposable peer reply',reply_to_message_id:original.id});
  for(let i=0;i<2;i++){
   const attachmentId=crypto.randomUUID(),object=`${owner.id}/${roomId}/${attachmentId}/qa.txt`;objects.push(object);checkpoint();
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
  await auth('/auth/v1/logout?scope=global',{method:'POST',accessToken:owner.token});
  await assert.rejects(()=>auth('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:owner.refresh}}),e=>[400,401,403].includes(e.status));
  checks.push('refresh_rejected_after_global_logout');
  await service(rest('chat_messages',`sender_id=eq.${owner.id}&room_id=eq.${roomId}`),{method:'DELETE'});
  await deleteAccount(owner);
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
  for(const object of objects){try{await removeObject(object);}catch(e){cleanupErrors.push('media');}}
  if(roomId){try{await service(rest('chat_rooms',`id=eq.${roomId}`),{method:'DELETE'});}catch(e){cleanupErrors.push('room');}}
  for(const user of users.filter(u=>!removed.has(u.id))){try{await deleteAccount(user);}catch(e){cleanupErrors.push('account');}}
  if(cleanupErrors.length)throw Error(`Disposable cleanup incomplete: ${cleanupErrors.join(',')}. Private recovery manifest: ${manifest}. Do not rerun blindly.`);
  fs.unlinkSync(manifest);
 }
 if(failure)throw failure;
 const report={checkedAt:new Date().toISOString(),project:'mkghopnkhcxtmfrcjdbc',accountsCreated:users.length,accountsRemoved:removed.size,checks,limitations:['Chat-only seeded service rehearsal, not full account erasure','Storage failure injected in runner, not a provider outage','No ratings/reminders/calendar/device or cached-copy erasure proof']};
 if(process.env.CHAT_ERASURE_REPORT)fs.writeFileSync(process.env.CHAT_ERASURE_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(`Disposable erasure rehearsal failed: ${e.name||'Error'} ${e.status||''} ${e.message||''}`);process.exitCode=1;});
