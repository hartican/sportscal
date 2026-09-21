#!/usr/bin/env node
'use strict';
// Explicit integration runner. Creates and removes only its own disposable accounts.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),sharp=require('sharp');
const {execFileSync}=require('node:child_process');
async function main(){
 if(process.env.AVATAR_LIVE_QA!=='1')throw new Error('Set AVATAR_LIVE_QA=1 to run against nothingSport-recovery with disposable test accounts.');
 const keys=JSON.parse(execFileSync('node_modules/.bin/supabase',['projects','api-keys','--project-ref','mkghopnkhcxtmfrcjdbc','--reveal','--output','json'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}));
 process.env.SUPABASE_URL='https://mkghopnkhcxtmfrcjdbc.supabase.co';
 process.env.SUPABASE_SECRET_KEY=keys.find(k=>k.type==='secret')?.api_key||'';
 process.env.SUPABASE_SERVICE_ROLE_KEY=keys.find(k=>k.name==='service_role').api_key;
 process.env.SUPABASE_PUBLISHABLE_KEY=keys.find(k=>k.name==='anon').api_key;
 const {supabaseServiceRequest:request}=require('../lib/supabase-server');
 const avatars=require('../lib/profile-avatars'),handler=require('../lib/nothingscore-handler');
 const created=[];let tokenById=new Map();
 async function call(user,command,query={}) {
  if(process.env.AVATAR_QA_URL){
   const response=await fetch(`${process.env.AVATAR_QA_URL}/api/nothingscore?${new URLSearchParams(query)}`,{method:command?'POST':'GET',headers:{...(user?{Authorization:`Bearer ${tokenById.get(user.id)}`} :{}),...(command?{'Content-Type':'application/json'}:{})},...(command?{body:JSON.stringify(command)}:{})});
   return {status:response.status,headers:Object.fromEntries(response.headers),body:response.headers.get('content-type')?.includes('image/')?Buffer.from(await response.arrayBuffer()):await response.json()};
  }
  const result={headers:{}};const response={setHeader:(k,v)=>{result.headers[k.toLowerCase()]=v;},status(n){result.status=n;return this;},json(v){result.body=v;return this;},send(v){result.body=v;return this;}};
  await handler({method:command?'POST':'GET',body:command,query,headers:user?{authorization:`Bearer ${tokenById.get(user.id)}`} :{}},response);return result;
 }
 const post=async(user,command)=>{const r=await call(user,command);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
 try{
  for(let i=0;i<3;i++){
   const handle=`avatarqa_${crypto.randomBytes(5).toString('hex')}`,email=`${handle}@example.invalid`,password=crypto.randomBytes(24).toString('base64url');
   const user=await request('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}});created.push(user);
   await request('/rest/v1/nothingsports_nsc_profiles',{method:'POST',body:{user_id:user.id,handle,display_name:'Avatar QA',visibility:'visible'}});
   const login=await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
   const session=await login.json();assert(session.access_token,'Test authentication failed');tokenById.set(user.id,session.access_token);
  }
  const [owner,viewer,stranger]=created;const png=await sharp({create:{width:800,height:600,channels:3,background:'#ca40ee'}}).png().toBuffer();
  async function upload(bytes=png){const prepared=await post(owner,{action:'profile-avatar-prepare',byteSize:bytes.length});const response=await fetch(prepared.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});assert.equal(response.ok,true,`Signed upload returned ${response.status}: ${await response.text()}`);return prepared;}
  const first=await upload();const finished=await post(owner,{action:'profile-avatar-complete',uploadId:first.uploadId});assert(finished.avatarUrl.includes('/nothingsports-avatar-thumbnails/'));
  const publicThumb=await fetch(finished.avatarUrl);assert(publicThumb.ok);assert.equal((await sharp(Buffer.from(await publicThumb.arrayBuffer())).metadata()).width,128);
  const profile=await require('../lib/nothingscore-server').profileFor(owner.id);const query={avatarExpanded:profile.profile_id};
  const own=await call(owner,null,query);assert.equal(own.status,200,JSON.stringify(own.body));assert.match(own.headers['cache-control'],/private.*no-store/);assert.equal((await sharp(own.body).metadata()).width,512);
  assert.equal((await call(null,null,query)).status,403);assert.equal((await call(stranger,null,query)).status,403);
  await request('/rest/v1/nothingsports_user_follows',{method:'POST',body:{follower_user_id:viewer.id,followed_user_id:owner.id}});
  assert.equal((await call(viewer,null,query)).status,403,'reverse follow is denied');
  await request('/rest/v1/nothingsports_user_follows',{method:'POST',body:{follower_user_id:owner.id,followed_user_id:viewer.id}});
  assert.equal((await call(viewer,null,query)).status,200);
  const access=await post(viewer,{action:'profile-avatar-access',avatarUrls:[finished.avatarUrl]});assert.equal(access.avatars[0].profileId,profile.profile_id);
  await request(`/rest/v1/nothingsports_user_follows?follower_user_id=eq.${owner.id}&followed_user_id=eq.${viewer.id}`,{method:'DELETE'});
  assert.equal((await call(viewer,null,query)).status,403,'access revoked on next request');
  const asset=await avatars.storage(avatars.FULL,`${owner.id}/${first.uploadId}.webp`);assert(asset.ok);
  const leaked=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/public/${avatars.FULL}/${owner.id}/${first.uploadId}.webp`);assert(!leaked.ok,'private full image is not public');
  const invalid=await upload(Buffer.from('invalid image'));
  const failure=await call(owner,{action:'profile-avatar-complete',uploadId:invalid.uploadId});assert.equal(failure.status,415);assert.equal((await require('../lib/nothingscore-server').profileFor(owner.id)).avatar_url,finished.avatarUrl);
  const fullSize=Buffer.alloc(6000000);png.copy(fullSize);const large=await upload(fullSize);await post(owner,{action:'profile-avatar-complete',uploadId:large.uploadId});
  const oversized=await call(owner,{action:'profile-avatar-prepare',byteSize:6000001});assert.equal(oversized.status,413);
  const replay=await fetch(large.uploadUrl,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:png});assert(replay.ok,'signed upload can replay until token expiry');
  const tombstone=await request(`/rest/v1/nothingsports_avatar_cleanup?bucket=eq.${avatars.ORIGINAL}&object_path=eq.${owner.id}/${large.uploadId}&select=*`);assert(tombstone[0]?.retain_until,'replayed originals retain cleanup tracking');
  // Move only this disposable account's tombstone forward to test expiry collection.
  await request(`/rest/v1/nothingsports_avatar_cleanup?bucket=eq.${avatars.ORIGINAL}&object_path=eq.${owner.id}/${large.uploadId}`,{method:'PATCH',body:{not_before:new Date(0).toISOString(),retain_until:new Date(0).toISOString()}});await avatars.cleanup();
  const second=await upload();const third=await upload();await post(owner,{action:'profile-avatar-complete',uploadId:second.uploadId});
  assert.equal((await call(owner,{action:'profile-avatar-complete',uploadId:third.uploadId})).status,409,'concurrent replacement rejected');
  await post(owner,{action:'profile-avatar-complete',uploadId:second.uploadId});
  await post(owner,{action:'profile-visibility',visibility:'hidden'});assert.equal((await call(stranger,null,query)).status,403);assert.equal((await call(owner,null,query)).status,200);
  await post(owner,{action:'profile-visibility',visibility:'deleted'});assert.equal((await call(owner,null,query)).status,403);
  console.log('Live Storage/API: signed upload, compression, public/private bytes, owner-directed access, revocation, invalid-file preservation, concurrent saves, idempotency and deletion passed.');
 }finally{
  for(const user of created)await request(`/auth/v1/admin/users/${user.id}`,{method:'DELETE'});
  await avatars.cleanup();console.log(`Removed ${created.length} disposable QA accounts; cleanup drained.`);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
