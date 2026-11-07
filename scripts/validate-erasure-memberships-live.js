#!/usr/bin/env node
'use strict';
// Disposable records only. No outbound email or real campaign activation.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
async function main(){
 if(process.env.ERASURE_MEMBERSHIPS_LIVE_QA!=='1')throw Error('Explicit disposable membership rehearsal opt-in required.');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}));
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_SERVICE_ROLE_KEY:keys.find(k=>k.name==='service_role')?.api_key};assert(environment.SUPABASE_SERVICE_ROLE_KEY);
 const {supabaseServiceRequest}=require('../lib/supabase-server');const call=(url,options={})=>supabaseServiceRequest(url,{...options,environment});
 const users=[],removed=new Set(),stamp=crypto.randomBytes(7).toString('hex'),campaign='qa-erasure-'+stamp;
 const emails=[0,1,2].map(i=>`membershipqa_${stamp}_${i}@example.invalid`);
 const manifest=path.join(os.tmpdir(),`ns-membership-erasure-${stamp}.json`);
 const save=()=>fs.writeFileSync(manifest,JSON.stringify({project:'mkghopnkhcxtmfrcjdbc',users,campaign,emails,removed:[...removed]}),{mode:0o600});save();
 const table=name=>`/rest/v1/nothingsports_${name}`;const mailUrl=email=>table('marquee_subscribers')+'?'+new URLSearchParams({email_normalized:'eq.'+email});let failure;
 try{
  for(let i=0;i<3;i++){const user=await call('/auth/v1/admin/users',{method:'POST',body:{email:emails[i],password:crypto.randomBytes(24).toString('base64url'),email_confirm:i<2}});users.push(user.id);save();}
  const [owner,peer,unverified]=users;
  await call(table('nsc_reward_campaigns'),{method:'POST',body:{id:campaign,label:'Disposable erasure QA',kind:'privilege',active:false,starts_at:new Date().toISOString(),points_per_entry:100,max_entries:1,eligibility:'allowlist',eligible_user_ids:[owner,peer,owner],terms_url:'https://example.invalid/qa'}});
  await call(table('marquee_subscribers'),{method:'POST',body:emails.map((email,i)=>({email_normalized:email,consented_at:new Date().toISOString(),consent_source:'disposable-qa',consent_scope:'marquee_fixture_email',evidence_reference:campaign,suppressed_at:i===1?new Date().toISOString():null,suppression_reason:i===1?'operator':null}))});
  await call('/rest/v1/rpc/nothingsports_begin_account_erasure',{method:'POST',body:{target_user_id:owner}});
  await assert.rejects(()=>call(mailUrl(emails[0]),{method:'PATCH',body:{updated_at:new Date().toISOString()}}),e=>e.payload?.code==='55000');
  await call(`/auth/v1/admin/users/${owner}`,{method:'DELETE'});removed.add(owner);save();
  const campaigns=await call(table('nsc_reward_campaigns')+'?'+new URLSearchParams({id:'eq.'+campaign,select:'eligible_user_ids,active'}));assert.deepEqual(campaigns[0].eligible_user_ids,[peer]);assert.equal(campaigns[0].active,false);
  assert.equal((await call(mailUrl(emails[0])+'&select=subscriber_id')).length,0);
  assert((await call(mailUrl(emails[1])+'&select=suppressed_at'))[0].suppressed_at);
  await assert.rejects(()=>call(table('nsc_reward_campaigns')+'?'+new URLSearchParams({id:'eq.'+campaign}),{method:'PATCH',body:{eligible_user_ids:[peer,owner]}}),e=>String(e.message).includes('reward_account_missing'));
  await call(`/auth/v1/admin/users/${unverified}`,{method:'DELETE'});removed.add(unverified);save();
  assert.equal((await call(mailUrl(emails[2])+'&select=subscriber_id')).length,1);
 }catch(e){failure=e;}finally{
  const errors=[];
  for(const id of users.filter(id=>!removed.has(id))){try{await call(`/auth/v1/admin/users/${id}`,{method:'DELETE'});removed.add(id);save();}catch{errors.push('account');}}
  for(const email of emails){try{await call(mailUrl(email),{method:'DELETE'});assert.equal((await call(mailUrl(email)+'&select=subscriber_id')).length,0);}catch{errors.push('subscriber');}}
  try{const url=table('nsc_reward_campaigns')+'?'+new URLSearchParams({id:'eq.'+campaign});await call(url,{method:'DELETE'});assert.equal((await call(url+'&select=id')).length,0);}catch{errors.push('campaign');}
  for(const id of removed){try{const url=table('account_erasure_blocks')+`?user_id=eq.${id}`;await call(url,{method:'DELETE'});assert.equal((await call(url+'&select=user_id')).length,0);}catch{errors.push('marker');}}
  if(errors.length)throw Error(`Disposable cleanup incomplete (${errors.join(',')}); private manifest ${manifest}. Do not rerun blindly.`);fs.unlinkSync(manifest);
 }
 if(failure)throw failure;
 const report={checkedAt:new Date().toISOString(),accountsCreated:users.length,accountsRemoved:removed.size,checks:['duplicate_reward_ids_removed','peer_eligibility_and_suppression_preserved','verified_email_subscription_removed','frozen_email_write_rejected','deleted_reward_identity_rejected','unverified_email_match_preserved','all_disposable_records_and_markers_removed'],scope:'Current verified email and reward allowlists only; no email sent or campaign activated'};
 if(process.env.ERASURE_MEMBERSHIPS_REPORT)fs.writeFileSync(process.env.ERASURE_MEMBERSHIPS_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
