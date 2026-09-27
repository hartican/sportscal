#!/usr/bin/env node
'use strict';
// Explicit disposable-account probe. Never accepts an existing account ID.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
async function main(){
 if(process.env.ERASURE_AUTH_STOP_LIVE_QA!=='1')throw Error('Set ERASURE_AUTH_STOP_LIVE_QA=1 for the disposable Auth stop probe.');
 const legacy=process.env.ERASURE_LEGACY_ORIGIN;
 if(!legacy||!/^https:\/\/sportscal-[a-z0-9]+-harticans-projects\.vercel\.app$/.test(legacy))throw Error('An inspected legacy Sportscal deployment origin is required.');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}));
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_PUBLISHABLE_KEY:keys.find(k=>k.name==='anon')?.api_key,SUPABASE_SERVICE_ROLE_KEY:keys.find(k=>k.name==='service_role')?.api_key};
 const {supabaseServiceRequest,supabaseRequest}=require('../lib/supabase-server');
 const service=(p,o={})=>supabaseServiceRequest(p,{...o,environment});
 const auth=(p,o={})=>supabaseRequest(p,{...o,environment});
 const stamp=crypto.randomBytes(7).toString('hex'),users=[],removed=[],checks=[];
 const manifest=path.join(os.tmpdir(),`nothingsport-auth-stop-qa-${stamp}.json`);
 const save=()=>fs.writeFileSync(manifest,JSON.stringify({project:'mkghopnkhcxtmfrcjdbc',accountIds:users.map(u=>u.id),removed}),{mode:0o600});save();
 async function read(origin,user){
  const r=await fetch(origin+'/api/user-state',{redirect:'manual',headers:{Authorization:`Bearer ${user.token}`},signal:AbortSignal.timeout(20000)});
  const body=await r.json().catch(()=>({}));return {status:r.status,hasState:Object.hasOwn(body,'state')};
 }
 let failure;
 try{
  for(let i=0;i<2;i++){
   const email=`authstopqa_${stamp}_${i}@example.invalid`,password=crypto.randomBytes(24).toString('base64url');
   const created=await service('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});
   const user={id:created.id,email,password};users.push(user);save();
   const session=await auth('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
   user.token=session.access_token;user.refresh=session.refresh_token;assert(user.token&&user.refresh);
   assert.equal((await auth('/auth/v1/user',{accessToken:user.token})).id,user.id);
   assert.deepEqual(await read('https://nothingsport.vercel.app',user),{status:200,hasState:true},'Current route must authenticate before the probe');
  }
  const legacyProtected=(await read(legacy,users[0])).status===302;
  assert(legacyProtected,'Expected inspected legacy deployment to require Vercel authentication');
  checks.push('current_route_and_auth_accept_both_accounts_before_ban','sampled_legacy_origin_requires_vercel_authentication');
  const [owner,peer]=users;
  const banned=await service(`/auth/v1/admin/users/${owner.id}`,{method:'PUT',body:{ban_duration:'876000h'}});
  assert(Date.parse(banned.banned_until)>Date.now()+86400000,'Admin confirmed ban');
  const denied=e=>[401,403].includes(e.status)||(e.status===400&&e.payload?.error_code==='user_banned');
  await assert.rejects(()=>auth('/auth/v1/user',{accessToken:owner.token}),denied,'Already-issued token must fail fresh Auth lookup');
  await assert.rejects(()=>auth('/auth/v1/token?grant_type=password',{method:'POST',body:{email:owner.email,password:owner.password}}),denied,'New sign-in must fail');
  await assert.rejects(()=>auth('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:owner.refresh}}),e=>[400,401,403].includes(e.status),'Refresh must fail');
  assert([401,403].includes((await read('https://nothingsport.vercel.app',owner)).status),'Application must reject banned account');
  assert.equal((await auth('/auth/v1/user',{accessToken:peer.token})).id,peer.id);
  assert.deepEqual(await read('https://nothingsport.vercel.app',peer),{status:200,hasState:true});
  checks.push('preissued_token_rejected_by_hosted_auth','new_signin_and_refresh_rejected','current_route_rejects_banned_account','peer_auth_and_current_access_preserved');
 }catch(e){failure=e;}
 const cleanup=[];
 for(const user of users){try{await service(`/auth/v1/admin/users/${user.id}`,{method:'DELETE'});removed.push(user.id);save();}catch{cleanup.push('test_account_cleanup_failed');}}
 if(!cleanup.length)fs.unlinkSync(manifest);
 if(failure||cleanup.length)throw Error(`Auth stop probe incomplete: ${failure?.message||''}; cleanup failures=${cleanup.length}.`);
 const report={checkedAt:new Date().toISOString(),legacyOrigin:legacy,accountsCreated:users.length,accountsRemoved:removed.length,checks,limitations:['One protected legacy origin sampled; no authenticated legacy application execution or upload issuance proof','Does not invalidate stateless Storage capabilities or prove direct RLS read revocation','No real account changed']};
 if(process.env.ERASURE_AUTH_STOP_REPORT)fs.writeFileSync(process.env.ERASURE_AUTH_STOP_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
