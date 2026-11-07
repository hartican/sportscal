'use strict';
const crypto=require('node:crypto');
const {supabaseServiceRequest:request,supabaseServiceRoleConfig}=require('./supabase-server');
const server=require('./nothingscore-server');
const {MAX_BYTES}=require('./profile-avatar-image');
const ASSETS='nothingsports_avatar_assets',UPLOADS='nothingsports_avatar_uploads',CLEANUP='nothingsports_avatar_cleanup';
const ORIGINAL='nothingsports-avatar-originals',THUMB='nothingsports-avatar-thumbnails',FULL='nothingsports-avatar-expanded';
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value||'');
const error=(message,status=400,code='profile_avatar_failed')=>Object.assign(new Error(message),{status,code});
const path=(table,params)=>server.rowsPath(table,params);
const rows=async(table,params)=>(await request(path(table,params)))||[];
const storagePath=(bucket,name)=>`/storage/v1/object/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`;
function storageHeaders(config=supabaseServiceRoleConfig()) {
 if(!config.configured) throw error('Picture storage is not configured.',503);
 return {apikey:config.serviceRoleKey,...(!config.opaqueSecret?{Authorization:`Bearer ${config.serviceRoleKey}`}:{})};
}
async function storage(bucket,name,options={}) {
 const config=supabaseServiceRoleConfig();
 const response=await fetch(config.url+storagePath(bucket,name),{...options,headers:{...storageHeaders(config),...options.headers},signal:AbortSignal.timeout(20000)});
 if(!response.ok) {
  const payload=await response.json().catch(()=>({}));
  console.error('profile_avatar_storage',{status:response.status,code:payload.code||payload.error||'storage_failed'});
  throw error(response.status===404?'The uploaded picture is unavailable. Choose the file again.':'Picture storage is temporarily unavailable. Please retry.',502,'profile_avatar_storage_failed');
 }
 return response;
}
async function assetFor(userId){return (await rows(ASSETS,{user_id:`eq.${userId}`,select:'*',limit:'1'}))[0]||null;}
async function eligibleProfile(userId) {
 const profile=await server.profileFor(userId);
 if(!profile || profile.visibility==='deleted') throw error('Save a public profile before adding a picture.',409);
 if((await server.personaFor(userId)).moderation_flag) throw error('This profile is unavailable.',403);
 return profile;
}
async function prepare(body,user) {
 await eligibleProfile(user.id);
 const byteSize=Number(body.byteSize);
 if(!Number.isInteger(byteSize)||byteSize<1||byteSize>MAX_BYTES)throw error('Choose a picture up to 6 MB.',413,'profile_avatar_too_large');
 const recent=await rows(UPLOADS,{user_id:`eq.${user.id}`,created_at:`gte.${new Date(Date.now()-3600000).toISOString()}`,select:'upload_id',limit:'20'});
 if(recent.length>=20)throw error('Too many picture uploads. Please try again in an hour.',429);
 const uploadId=crypto.randomUUID(),originalPath=`${user.id}/${uploadId}`,name=`${originalPath}.webp`,base=await assetFor(user.id);
 // Queue before creating any objects; even a crashed request cannot leak permanent originals.
 await request(path(CLEANUP),{method:'POST',body:[{bucket:ORIGINAL,object_path:originalPath},{bucket:THUMB,object_path:name},{bucket:FULL,object_path:name}].map(row=>({...row,not_before:new Date(Date.now()+86400000).toISOString(),retain_until:row.bucket===ORIGINAL?new Date(Date.now()+86400000).toISOString():null}))});
 await request(path(UPLOADS),{method:'POST',body:{upload_id:uploadId,user_id:user.id,base_version:base?.version||null,byte_size:byteSize,original_path:originalPath}});
 const signed=await request(`/storage/v1/object/upload/sign/${ORIGINAL}/${originalPath}`,{method:'POST',body:{}});
 const relative=signed.url||signed.signedURL||signed.signedUrl;
 if(!relative)throw error('An upload could not be prepared. Please retry.',502);
 return {uploadId,uploadUrl:relative.startsWith('http')?relative:`${supabaseServiceRoleConfig().url}/storage/v1${relative}`,maxBytes:MAX_BYTES};
}
async function complete(body,user) {
 await eligibleProfile(user.id);
 if(!uuid(body.uploadId))throw error('Choose the picture again.');
 const params={upload_id:`eq.${body.uploadId}`,user_id:`eq.${user.id}`};
 const upload=(await rows(UPLOADS,{...params,select:'*',limit:'1'}))[0];
 if(!upload||Date.parse(upload.created_at)<Date.now()-23*3600000)throw error('This upload expired. Choose the picture again.',409);
 if(upload.status==='complete') {
  const asset=await assetFor(user.id);
  if(asset?.version!==body.uploadId)throw error('Your picture changed in another session. Choose the file again.',409);
  return {avatarUrl:thumbnailUrl(asset.thumbnail_path)};
 }
 const claimed=await request(path(UPLOADS,{...params,status:'eq.pending'}),{method:'PATCH',headers:{Prefer:'return=representation'},body:{status:'processing',claimed_at:new Date().toISOString()}});
 if(!claimed?.length)throw error('This picture is already processing, or the upload failed. Choose the file again to retry.',409);
 try {
  const download=await storage(ORIGINAL,upload.original_path);
  const bytes=Buffer.from(await download.arrayBuffer());
  if(bytes.length!==upload.byte_size||bytes.length>MAX_BYTES)throw error('The uploaded file size does not match. Choose the picture again.',413,'profile_avatar_too_large');
  const {thumbnail,expanded}=await require('./profile-avatar-image').processImage(bytes);
  const name=`${user.id}/${upload.upload_id}.webp`;
  await storage(THUMB,name,{method:'POST',headers:{'Content-Type':'image/webp','Cache-Control':'max-age=31536000','x-upsert':'false'},body:thumbnail});
  await storage(FULL,name,{method:'POST',headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','x-upsert':'false'},body:expanded});
  const avatarUrl=thumbnailUrl(name);
  try { await request('/rest/v1/rpc/nothingsports_publish_avatar',{method:'POST',body:{actor:user.id,upload:upload.upload_id,thumb_bytes:thumbnail.length,full_bytes:expanded.length,public_url:avatarUrl}}); }
  catch(cause) {
   // A timed-out transaction may have committed. Never delete its active derivatives.
   if((await assetFor(user.id))?.version!==upload.upload_id)throw cause;
  }
  await cleanup({limit:8}).catch(()=>{});
  return {avatarUrl};
 } catch(cause) {
  await request(path(UPLOADS,{...params,status:'eq.processing'}),{method:'PATCH',body:{status:'failed'}}).catch(()=>{});
  await request(path(CLEANUP,{object_path:`in.(${upload.original_path},${upload.original_path}.webp)`}),{method:'PATCH',body:{not_before:new Date().toISOString()}}).catch(()=>{});
  await cleanup({limit:8}).catch(()=>{});
  if(/avatar_changed_retry/.test(cause.message||''))throw error('Your picture changed in another session. Retry with this file.',409,'avatar_changed_retry');
  throw cause;
 }
}
function thumbnailUrl(name){return `${supabaseServiceRoleConfig().url}/storage/v1/object/public/${THUMB}/${name}`;}
async function allowed(profile,user) {
 if(!user||user.is_anonymous||!profile||profile.visibility==='deleted')return false;
 if((await server.personaFor(profile.user_id)).moderation_flag)return false;
 if(profile.user_id===user.id)return true;
 if(profile.visibility!=='visible'||(await server.personaFor(user.id)).moderation_flag)return false;
 return (await rows('nothingsports_user_follows',{follower_user_id:`eq.${profile.user_id}`,followed_user_id:`eq.${user.id}`,select:'follower_user_id',limit:'1'})).length>0;
}
async function access(body,user) {
 // Versioned URLs identify thumbnails already visible to the caller; never accept arbitrary fetch URLs.
 const urls=[...new Set(Array.isArray(body.avatarUrls)?body.avatarUrls:[])].filter(v=>typeof v==='string'&&v.startsWith(thumbnailUrl(''))&&v.length<400).slice(0,50);
 if(!user||!urls.length)return {avatars:[]};
 const profiles=await rows(server.TABLES.profiles,{avatar_url:`in.(${urls.map(v=>`"${v.replace(/["\\]/g,'')}"`).join(',')})`,select:'user_id,profile_id,visibility,avatar_url'});
 if(!profiles.length)return {avatars:[]};
 const ids=[...new Set([...profiles.map(p=>p.user_id),user.id])];
 const [personas,follows]=await Promise.all([
  rows(server.TABLES.personas,{user_id:`in.(${ids.join(',')})`,select:'user_id,moderation_flag'}),
  rows('nothingsports_user_follows',{followed_user_id:`eq.${user.id}`,follower_user_id:`in.(${ids.join(',')})`,select:'follower_user_id'})
 ]);
 const moderated=new Set(personas.filter(p=>p.moderation_flag).map(p=>p.user_id)),owners=new Set(follows.map(f=>f.follower_user_id));
 return {avatars:profiles.filter(p=>p.visibility!=='deleted'&&!moderated.has(p.user_id)&&(p.user_id===user.id||(p.visibility==='visible'&&!moderated.has(user.id)&&owners.has(p.user_id)))).map(p=>({avatarUrl:p.avatar_url,profileId:p.profile_id}))};
}
async function expanded(profileId,user) {
 if(!uuid(profileId))throw error('Picture unavailable.',404);
 const profile=(await rows(server.TABLES.profiles,{profile_id:`eq.${profileId}`,select:'user_id,visibility',limit:'1'}))[0];
 if(!await allowed(profile,user))throw error('This picture is only available to people its owner follows.',403,'profile_avatar_forbidden');
 const asset=await assetFor(profile.user_id);
 if(!asset)throw error('Picture unavailable.',404);
 const response=await storage(FULL,asset.expanded_path);
 return Buffer.from(await response.arrayBuffer());
}
async function cleanup({limit=50}={}) {
 const due=await rows(CLEANUP,{not_before:`lte.${new Date().toISOString()}`,order:'not_before.asc',limit:String(limit),select:'*'});
 let removed=0;
 for(const row of due) {
  try {
   await request(`/storage/v1/object/${row.bucket}`,{method:'DELETE',body:{prefixes:[row.object_path]}});
   const target=path(CLEANUP,{bucket:`eq.${row.bucket}`,object_path:`eq.${row.object_path}`});
   if(row.retain_until&&Date.parse(row.retain_until)>Date.now())await request(target,{method:'PATCH',body:{not_before:row.retain_until}});
   else await request(target,{method:'DELETE'});
   removed++;
  }catch(cause){
   await request(path(CLEANUP,{bucket:`eq.${row.bucket}`,object_path:`eq.${row.object_path}`}),{method:'PATCH',body:{attempts:row.attempts+1,not_before:new Date(Date.now()+3600000).toISOString()}});
  }
 }
 await request(path(UPLOADS,{created_at:`lt.${new Date(Date.now()-86400000).toISOString()}`}),{method:'DELETE'});
 return {checked:due.length,removed};
}
async function remove(userId) {
 await request(path(ASSETS,{user_id:`eq.${userId}`}),{method:'DELETE'});
 await request(path(server.TABLES.profiles,{user_id:`eq.${userId}`}),{method:'PATCH',body:{avatar_url:null}});
 await cleanup({limit:8}).catch(()=>{});
}
module.exports={prepare,complete,access,expanded,allowed,cleanup,remove,storageHeaders,storage,thumbnailUrl,ASSETS,UPLOADS,CLEANUP,ORIGINAL,THUMB,FULL};
