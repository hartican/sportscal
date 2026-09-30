'use strict';
const {PHASES,inventoryGate}=require('./account-erasure-workflow');
const MESSAGE_TABLE='nothingsports_chat_messages';
function ownedDataOperations({call,inventory,now=Date.now}){
 function requirePhase(accountId,journal,phase,persist){
  const prior=PHASES.slice(0,PHASES.indexOf(phase));
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(accountId||'')
   ||journal?.accountId!==accountId||journal.phase!==phase||!journal.operationId||!journal.request?.requestId
   ||!Number.isFinite(Date.parse(journal.request.verifiedAt))||typeof persist!=='function'
   ||journal.steps?.length!==prior.length||prior.some((p,i)=>journal.steps[i]?.phase!==p))throw Error('Exact account, verified request and preceding workflow steps required.');
 }
 async function fresh(accountId,journal,{allowLateStorage=false}={}){
  const current=await inventory(accountId),pending=inventoryGate(current);
  if(!journal.schemaFingerprint||current.schemaFingerprint!==journal.schemaFingerprint)pending.push('schema_changed_review_required');
  if(current.indirect.inflight_notification_sends!==0)pending.push('notification_attempt_reconciliation_required');
  if(!allowLateStorage&&current.indirect.known_storage_paths!==0)pending.push('storage_objects_remaining_or_recreated');
  return {current,pending};
 }
 async function frozen(accountId,journal){
  const user=await call(`/auth/v1/admin/users/${accountId}`);
  const started=journal.steps.find(s=>s.phase==='freeze')?.evidence?.startedAt;
  if(!Number.isFinite(Date.parse(started))||Date.parse(started)>now()||user?.id!==accountId
   ||Date.parse(user.app_metadata?.nothingsport_erasure_started_at)!==Date.parse(started)
   ||!(Date.parse(user.banned_until)>now()))throw Error('Verified frozen and Auth-stopped account required.');
 }
 function messages(current){
  const refs=current.references.filter(r=>r.schema_name==='public'&&r.table_name===MESSAGE_TABLE&&r.column_name==='sender_id');
  if(refs.length!==1||refs[0].delete_action!=='r')throw Error('Reviewed chat ownership reference is missing or changed.');
  return refs[0].matching_rows;
 }
 function restrictive(current){return current.references.some(r=>!['c','n'].includes(r.delete_action)&&r.matching_rows>0);}
 return {
  eraseOwnedData:async({accountId,journal,persist})=>{
   requirePhase(accountId,journal,'eraseOwnedData',persist);
   const {current,pending}=await fresh(accountId,journal);
   if(current.accountExists!==true)pending.push('account_missing_before_owned_cleanup');
   const count=messages(current);
   if(count>20000)pending.push('owned_messages_exceed_bounded_cleanup');
   if(current.references.some(r=>!['c','n'].includes(r.delete_action)&&r.matching_rows>0&&!(r.table_name===MESSAGE_TABLE&&r.column_name==='sender_id'&&r.schema_name==='public')))pending.push('unreviewed_restrictive_reference');
   if(pending.length)return {verified:false,pending};
   await frozen(accountId,journal);
   journal.ownedDataIntent={accountId,operationId:journal.operationId,checkedAt:current.checkedAt,authDeletion:false};
   await persist(journal);
   if(count)await call(`/rest/v1/${MESSAGE_TABLE}?${new URLSearchParams({sender_id:`eq.${accountId}`})}`,{method:'DELETE'});
   const after=await fresh(accountId,journal);
   if(messages(after.current)!==0)after.pending.push('owned_messages_remaining');
   if(after.current.accountExists!==true)after.pending.push('unexpected_auth_removal');
   if(after.pending.length)return {verified:false,pending:after.pending};
   return {verified:true,evidence:{checkedAt:after.current.checkedAt,ownedMessagesRemaining:0,authDeletion:false,finalErasure:false}};
  },
  eraseAuth:async({accountId,journal,persist})=>{
   requirePhase(accountId,journal,'eraseAuth',persist);
   const {current,pending}=await fresh(accountId,journal,{allowLateStorage:true});
   if(current.accountExists===true&&current.indirect.known_storage_paths!==0)pending.push('storage_objects_remaining_or_recreated');
   if(messages(current)!==0||restrictive(current))pending.push('restrictive_rows_remaining');
   if(pending.length)return {verified:false,pending};
   const intent=journal.authDeletionIntent;
   if(current.accountExists===false){
    if(intent?.accountId!==accountId||intent?.operationId!==journal.operationId||intent?.schemaFingerprint!==journal.schemaFingerprint)throw Error('Missing durable Auth deletion intent; absence alone cannot prove this operation.');
   }else if(current.accountExists===true){
    await frozen(accountId,journal);
    journal.authDeletionIntent={accountId,operationId:journal.operationId,schemaFingerprint:journal.schemaFingerprint,checkedAt:current.checkedAt};
    await persist(journal);
    await call(`/auth/v1/admin/users/${accountId}`,{method:'DELETE',body:{should_soft_delete:false}});
   }else throw Error('Auth account existence is unverified.');
   // Auth removal cannot revoke an old upload capability. Retain any late
   // objects for the mandatory expiry/final sweep rather than deadlocking here.
   const after=await fresh(accountId,journal,{allowLateStorage:true});
   if(after.current.accountExists!==false)after.pending.push('auth_removal_unverified');
   if(after.current.references.some(r=>r.matching_rows!==0))after.pending.push('direct_account_references_remaining');
   if(after.pending.length)return {verified:false,pending:after.pending};
   return {verified:true,evidence:{checkedAt:after.current.checkedAt,accountExists:false,directReferencesRemaining:0,lateStorageObjects:after.current.indirect.known_storage_paths,finalErasure:false}};
  },
 };
}
module.exports={ownedDataOperations};
