'use strict';
// Deliberately one-off: the existing publisher supplies fresh acceptance and
// database/Storage adapters. No scheduler, content export or recovery archive.
const BUCKETS=Object.freeze(['nothingsports-chat-transient','nothingsports-saved-game-media']);
const TABLES=Object.freeze(['nothingsports_chat_notification_deliveries','nothingsports_chat_reactions','nothingsports_chat_invitations','nothingsports_saved_game_media','nothingsports_chat_attachments','nothingsports_chat_messages','nothingsports_chat_members','nothingsports_chat_rooms','nothingsports_chat_profiles','nothingsports_chat_anonymous_session_limits','nothingsports_chat_anonymous_signup_tickets','nothingsports_nsc_reward_entitlements','nothingsports_nsc_reward_campaigns','nothingsports_nsc_foresight_settlements','nothingsports_nsc_prediction_revisions','nothingsports_consensus_receipts','nothingsports_consensus_votes','nothingsports_predictions','nothingsports_follow_reward_history','nothingsports_copy_person_rewards','nothingsports_pick_rewards','nothingsports_nsc_likes','nothingsports_nsc_points','nothingsports_score_archive']);
const PROJECT='mkghopnkhcxtmfrcjdbc';
const CHECKS=Object.freeze(['ratings','watching','follows','copyConcurrency','friendAlerts','classics','accountSync','browser','performance','spoilers','offline','installedPwa','production','database','legacyIssuersStopped','inflightUploadsReconciled']);
function acceptance(receipt,{sha,now=Date.now()}={}){
 if(receipt?.schemaVersion!=='systrategy-acceptance.v1'||receipt.databaseProjectId!==PROJECT||!/^[a-f0-9]{40}$/.test(sha||'')||receipt.sha!==sha||receipt.productionSha!==sha||receipt.deploymentState!=='READY'||!receipt.deploymentId||!receipt.aliasVerified)throw Error('Exact READY production snapshot and alias acceptance required.');
 const verified=Date.parse(receipt.verifiedAt),stopped=Date.parse(receipt.issuersStoppedAt);
 if(!Number.isFinite(verified)||verified>now||now-verified>3600000||!Number.isFinite(stopped)||stopped>verified||now-stopped<(2*60*60+60)*1000)throw Error('Fresh acceptance and expired upload capabilities required.');
 if(CHECKS.some(check=>receipt.checks?.[check]!=='PASS'))throw Error('Every retained-flow, release and upload-reconciliation check must pass before purge.');
 return true;
}
function purgeSQL(){
 // Empty compatibility tables keep the reviewed account-erasure inventory and
 // immutable historical migrations valid. Their writers remain revoked.
 const names=TABLES.map(name=>"'"+name+"'").join(',');
 return `begin;
set local lock_timeout='5s';set local statement_timeout='30s';
do $$ declare t text;n bigint;begin
 if exists(select 1 from storage.objects where bucket_id in ('nothingsports-chat-transient','nothingsports-saved-game-media')) then raise exception 'retired_storage_objects_remain';end if;
 foreach t in array array[${names}] loop
 if to_regclass('public.'||t) is not null then execute format('delete from public.%I',t);end if;
 end loop;
 delete from public.nothingsports_inbox where kind in ('chat','invitation','added','points');
 update public.nothingsports_inbox set points=0 where points<>0;
 update public.nothingsports_social_notifications set points=0 where points<>0;
 update public.nothingsports_nsc_contributions set maximum_points=null where maximum_points is not null;
 update public.nothingsports_user_state set preferences=public.nothingsports_retire_feedback(preferences),updated_at=clock_timestamp() where preferences is distinct from public.nothingsports_retire_feedback(preferences);
 foreach t in array array[${names}] loop
 if to_regclass('public.'||t) is not null then execute format('select count(*) from public.%I',t) into n;if n<>0 then raise exception 'retired_rows_remain';end if;end if;
 end loop;
end $$;
commit;`;
}
async function purge({receipt,sha,verifyProduction,request,executeSQL,now=()=>Date.now()}){
 acceptance(receipt,{sha,now:now()});
 if(typeof verifyProduction!=='function'||typeof request!=='function'||typeof executeSQL!=='function')throw Error('Production, Storage and privileged SQL adapters required.');
 const live=await verifyProduction();if(live?.sha!==sha||live.deploymentId!==receipt.deploymentId||live.ready!==true||live.aliasVerified!==true)throw Error('Production changed after acceptance.');
 const buckets=await request('/storage/v1/bucket');if(!Array.isArray(buckets))throw Error('Verified Storage bucket inventory required.');
 const present=BUCKETS.filter(bucket=>buckets.some(row=>row.id===bucket));
 let removed=0;
 for(const bucket of present){
  const folders=[''];let pages=0;
  while(folders.length){
   const prefix=folders.pop();
   // Always re-read page zero after deleting objects, so offsets cannot skip.
   while(true){
    if(++pages>200)throw Error('Retired Storage inventory exceeds bounded purge.');
    const rows=await request('/storage/v1/object/list/'+bucket,{method:'POST',body:{prefix,limit:100,offset:0,sortBy:{column:'name',order:'asc'}}});
    if(!Array.isArray(rows))throw Error('Unverified retired Storage listing.');
    const files=[];for(const row of rows){if(typeof row.name!=='string'||!row.name||row.name.includes('/')||['.','..'].includes(row.name))throw Error('Unreviewed Storage name.');const name=prefix?prefix+'/'+row.name:row.name;if(row.id)files.push(name);else if(!folders.includes(name))folders.push(name);}
    if(files.length){await request('/storage/v1/object/'+bucket,{method:'DELETE',body:{prefixes:files}});removed+=files.length;}
    if(rows.length<100||!files.length)break;
   }
  }
 }
 // Final Storage check comes before deleting any relational ownership metadata.
 for(const bucket of present){const rows=await request('/storage/v1/object/list/'+bucket,{method:'POST',body:{prefix:'',limit:1,offset:0}});if(!Array.isArray(rows)||rows.length)throw Error('Retired Storage sweep is not empty.');}
 acceptance(receipt,{sha,now:now()});
 const final=await verifyProduction();if(final?.sha!==sha||final.deploymentId!==receipt.deploymentId||final.ready!==true||final.aliasVerified!==true)throw Error('Production changed during purge.');
 await executeSQL(purgeSQL());
 return {schemaVersion:'systrategy-purge.v1',sha,removedObjects:removed,retiredTables:TABLES.length,completedAt:new Date(now()).toISOString()};
}
module.exports={PROJECT,BUCKETS,TABLES,CHECKS,acceptance,purgeSQL,purge};
