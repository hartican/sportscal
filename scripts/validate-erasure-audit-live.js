#!/usr/bin/env node
'use strict';
// Disposable-only: no target argument, account lookup or real audit content.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
async function main(){
 if(process.env.ERASURE_AUDIT_LIVE_QA!=='1')throw Error('Explicit disposable audit rehearsal opt-in required.');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}));
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_SERVICE_ROLE_KEY:keys.find(k=>k.name==='service_role')?.api_key};assert(environment.SUPABASE_SERVICE_ROLE_KEY);
 const {supabaseServiceRequest}=require('../lib/supabase-server');const call=(url,options={})=>supabaseServiceRequest(url,{...options,environment});
 const users=[],removed=new Set(),ids=Array.from({length:3},()=>crypto.randomUUID()),stamp=crypto.randomBytes(7).toString('hex');
 const manifest=path.join(os.tmpdir(),`ns-audit-erasure-${stamp}.json`);
 const save=()=>fs.writeFileSync(manifest,JSON.stringify({project:'mkghopnkhcxtmfrcjdbc',users,auditIds:ids,removed:[...removed]}),{mode:0o600});save();
 const endpoint='/rest/v1/nothingsports_nsc_admin_audit';const filter=`audit_id=in.(${ids.join(',')})`;
 let failure;
 try{
  for(let i=0;i<2;i++){const user=await call('/auth/v1/admin/users',{method:'POST',body:{email:`auditqa_${stamp}_${i}@example.invalid`,password:crypto.randomBytes(24).toString('base64url'),email_confirm:true}});users.push(user.id);save();}
  const [owner,peer]=users;
  await call(endpoint,{method:'POST',body:ids.map((id,i)=>({audit_id:id,actor_user_id:i===0?peer:owner,target_user_id:i===1?peer:owner,action:'dismiss',before_state:{status:'open',resolution:i===1?'peer control':'disposable subject note'},after_state:{status:'dismissed',resolution:i===1?'peer control':'disposable subject note'}}))});
  await call('/rest/v1/rpc/nothingsports_begin_account_erasure',{method:'POST',body:{target_user_id:owner}});
  await call(`/auth/v1/admin/users/${owner}`,{method:'DELETE'});removed.add(owner);save();
  const rows=await call(`${endpoint}?${filter}&select=audit_id,actor_user_id,target_user_id,action,before_state,after_state,created_at`);assert.equal(rows.length,3);
  for(const r of rows){assert.equal(r.action,'dismiss');assert(r.created_at);if(r.audit_id===ids[1]){assert.equal(r.target_user_id,peer);assert.equal(r.actor_user_id,null);assert.equal(r.before_state.resolution,'peer control');}else{assert.equal(r.target_user_id,null);assert.deepEqual(r.before_state,{});assert.deepEqual(r.after_state,{});}}
  assert.equal(rows.find(r=>r.audit_id===ids[0]).actor_user_id,peer);
 }catch(e){failure=e;}finally{
  const errors=[];
  for(const id of users.filter(id=>!removed.has(id))){try{await call(`/auth/v1/admin/users/${id}`,{method:'DELETE'});removed.add(id);save();}catch{errors.push('account');}}
  try{
   assert(ids.every(id=>/^[a-f0-9-]{36}$/.test(id)));
   execFileSync('node_modules/.bin/supabase',['db','query','--linked','--project-ref','mkghopnkhcxtmfrcjdbc','--output','json',`begin;set local statement_timeout='5s';delete from public.nothingsports_nsc_admin_audit where audit_id in (${ids.map(id=>`'${id}'::uuid`).join(',')});commit;`],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
   assert.equal((await call(`${endpoint}?${filter}&select=audit_id`)).length,0);
  }catch{errors.push('audit');}
  if(errors.length)throw Error(`Disposable cleanup incomplete (${errors.join(',')}); private manifest ${manifest}. Do not rerun blindly.`);
  for(const id of users.filter(id=>removed.has(id))){try{await call(`/rest/v1/nothingsports_account_erasure_blocks?user_id=eq.${id}`,{method:'DELETE'});assert.equal((await call(`/rest/v1/nothingsports_account_erasure_blocks?user_id=eq.${id}&select=user_id`)).length,0);}catch{errors.push('erasure_marker');}}
  if(errors.length)throw Error(`Disposable cleanup incomplete (${errors.join(',')}); private manifest ${manifest}. Do not rerun blindly.`);
  fs.unlinkSync(manifest);
 }
 if(failure)throw failure;
 const report={checkedAt:new Date().toISOString(),project:'mkghopnkhcxtmfrcjdbc',accountsCreated:users.length,accountsRemoved:removed.size,auditRowsRemoved:ids.length,checks:['frozen_subject_snapshots_redacted','audit_action_and_timestamp_preserved','self_attribution_redacted','peer_subject_snapshot_and_actor_preserved','disposable_cleanup_verified'],scope:'Audit snapshots only, not full account erasure'};
 if(process.env.ERASURE_AUDIT_REPORT)fs.writeFileSync(process.env.ERASURE_AUDIT_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
