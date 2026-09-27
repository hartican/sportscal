'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
const BUCKETS=new Set(['nothingsports-avatar-originals','nothingsports-avatar-thumbnails','nothingsports-avatar-expanded','nothingsports-profile-avatars','nothingsports-chat-transient','nothingsports-saved-game-media']);
function operator({environment=process.env,request=supabaseServiceRequest}={}){
 if(environment.SUPABASE_URL!=='https://mkghopnkhcxtmfrcjdbc.supabase.co')throw Error('Erasure operator is restricted to the verified recovery project.');
 const call=(url,options={})=>request(url,{...options,environment});
 const rpc=(name,id)=>call(`/rest/v1/rpc/${name}`,{method:'POST',body:{target_user_id:id}});
 const inventory=id=>rpc('nothingsports_account_erasure_inventory',id);
 async function rows(table,params){
  const found=[];
  for(let offset=0;offset<20000;offset+=250){
   const batch=await call(`/rest/v1/${table}?${new URLSearchParams({...params,limit:'250',offset:String(offset)})}`);
   if(!Array.isArray(batch))throw Error('Lineage query returned no verified row list.');
   found.push(...batch);if(batch.length<250)return found;
  }
  throw Error('Lineage exceeds bounded inventory; no deletion performed.');
 }
 async function captureLineage({accountId,journal}){
  const prefix=accountId+'/',objects=new Map();
  function add(bucket,objectPath){
   if(!BUCKETS.has(bucket)||typeof objectPath!=='string'||!objectPath.startsWith(prefix))throw Error('Storage lineage is outside reviewed ownership; refusing to infer it.');
   objects.set(bucket+'\0'+objectPath,{bucket,objectPath});
  }
  for(const [table,field] of [['nothingsports_chat_attachments','uploader_id'],['nothingsports_saved_game_media','owner_id']]){
   for(const row of await rows(table,{[field]:`eq.${accountId}`,select:'storage_bucket,object_path',order:'object_path.asc'}))add(row.storage_bucket,row.object_path);
  }
  for(const row of await rows('nothingsports_avatar_assets',{user_id:`eq.${accountId}`,select:'thumbnail_path,expanded_path'})){
   add('nothingsports-avatar-thumbnails',row.thumbnail_path);add('nothingsports-avatar-expanded',row.expanded_path);
  }
  for(const row of await rows('nothingsports_avatar_uploads',{user_id:`eq.${accountId}`,select:'original_path',order:'original_path.asc'}))add('nothingsports-avatar-originals',row.original_path);
  for(const row of await rows('nothingsports_avatar_cleanup',{object_path:`like.${prefix}*`,select:'bucket,object_path',order:'bucket.asc,object_path.asc'}))add(row.bucket,row.object_path);
  const buckets=await call('/storage/v1/bucket');
  if(!Array.isArray(buckets))throw Error('Storage bucket inventory unavailable.');
  let pages=0;
  for(const bucket of buckets.map(b=>b.id).filter(id=>BUCKETS.has(id))){
   const pending=[accountId];
   while(pending.length){
    const folder=pending.pop();
    for(let offset=0;;offset+=250){
     if(++pages>200)throw Error('Storage listing exceeds bounded inventory; no deletion performed.');
     const batch=await call(`/storage/v1/object/list/${bucket}`,{method:'POST',body:{prefix:folder,limit:250,offset,sortBy:{column:'name',order:'asc'}}});
     if(!Array.isArray(batch))throw Error('Storage object listing unavailable.');
     for(const item of batch){
      if(typeof item.name!=='string'||!item.name||item.name.includes('/'))throw Error('Unexpected Storage listing name.');
      const objectPath=folder+'/'+item.name;
      if(item.id)add(bucket,objectPath);else pending.push(objectPath);
     }
     if(batch.length<250)break;
    }
   }
  }
  journal.lineage={capturedAt:new Date().toISOString(),objects:[...objects.values()]};
  return {verified:true,evidence:{objectPaths:objects.size,storagePages:pages}};
 }
 return {inventory,operations:{
  freeze:async({accountId})=>{const startedAt=await rpc('nothingsports_begin_account_erasure',accountId);if(!Number.isFinite(Date.parse(startedAt)))throw Error('Barrier start was not confirmed.');return {verified:true,evidence:{startedAt}};},
  captureLineage,
  drainIssuers:async({accountId})=>{
   const current=await inventory(accountId),pending=['legacy_deployment_shutdown_evidence_required'];
   if(current.indirect?.inflight_notification_sends!==0)pending.push('notification_attempt_reconciliation_required');
   return {verified:false,pending};
  },
 }};
}
module.exports={BUCKETS,operator};
