'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
const {stopAccountAuthentication}=require('./account-erasure-auth');
const {inventoryGate}=require('./account-erasure-workflow');
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
   if(!BUCKETS.has(bucket)||typeof objectPath!=='string'||!objectPath.startsWith(prefix)||objectPath.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Storage lineage is outside reviewed ownership; refusing to infer it.');
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
      if(typeof item.name!=='string'||!item.name||item.name.includes('/')||item.name==='.'||item.name==='..')throw Error('Unexpected Storage listing name.');
      const objectPath=folder+'/'+item.name;
      if(item.id)add(bucket,objectPath);else pending.push(objectPath);
     }
     if(batch.length<250)break;
    }
   }
  }
  for(const item of journal.lineage?.objects||[])add(item.bucket,item.objectPath);
  journal.lineage={capturedAt:new Date().toISOString(),objects:[...objects.values()]};
  return {verified:true,evidence:{objectPaths:objects.size,storagePages:pages}};
 }
 async function eraseStorage({accountId,journal,persist}){
  // A first sweep is not final erasure: pre-issued uploads may recreate bytes.
  // The normal workflow reaches this only after its separate issuer gate.
  if(journal?.accountId!==accountId||typeof persist!=='function')throw Error('Exact account and durable journal required for Storage sweep.');
  const frozen=journal.steps?.find(step=>step.phase==='freeze')?.evidence?.startedAt;
  const auth=await call(`/auth/v1/admin/users/${accountId}`);
  if(!frozen||auth?.id!==accountId||Date.parse(auth.app_metadata?.nothingsport_erasure_started_at)!==Date.parse(frozen)||!(Date.parse(auth.banned_until)>Date.now()))throw Error('Verified frozen and Auth-stopped account required for Storage sweep.');
  const before=await inventory(accountId),reasons=inventoryGate(before);
  if(!journal.schemaFingerprint||before.schemaFingerprint!==journal.schemaFingerprint)reasons.push('schema_changed_review_required');
  if(reasons.length)return {verified:false,pending:reasons};
  await captureLineage({accountId,journal});
  if(journal.lineage.objects.length>20000)throw Error('Storage sweep exceeds bounded inventory.');
  await persist(journal); // Preserve every ownership path before any deletion.
  let batches=0;
  for(const bucket of BUCKETS){
   const paths=journal.lineage.objects.filter(item=>item.bucket===bucket).map(item=>item.objectPath);
   for(let offset=0;offset<paths.length;offset+=100){
    await call(`/storage/v1/object/${bucket}`,{method:'DELETE',body:{prefixes:paths.slice(offset,offset+100)}});
    batches++;
   }
  }
  const after=await inventory(accountId),pending=inventoryGate(after);
  if(after.schemaFingerprint!==journal.schemaFingerprint)pending.push('schema_changed_review_required');
  if(after.indirect?.known_storage_paths!==0)pending.push('storage_objects_remaining_or_recreated');
  if(pending.length)return {verified:false,pending};
  return {verified:true,evidence:{kind:'initial_storage_sweep',objectPaths:journal.lineage.objects.length,batches,checkedAt:after.checkedAt,finalErasure:false}};
 }
 return {inventory,operations:{
  freeze:async({accountId})=>{const startedAt=await rpc('nothingsports_begin_account_erasure',accountId);if(!Number.isFinite(Date.parse(startedAt)))throw Error('Barrier start was not confirmed.');return {verified:true,evidence:{startedAt}};},
  captureLineage,
  eraseStorage,
  drainIssuers:async({accountId,journal})=>{
   journal.authStop=await stopAccountAuthentication({accountId,call});
   const current=await inventory(accountId),pending=['legacy_deployment_shutdown_evidence_required'];
   if(current.indirect?.inflight_notification_sends!==0)pending.push('notification_attempt_reconciliation_required');
   return {verified:false,pending};
  },
 }};
}
module.exports={BUCKETS,operator};
