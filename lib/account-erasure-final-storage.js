'use strict';
const {requireOperationPhase,inventoryGate}=require('./account-erasure-workflow');
const {storageCheckpoint}=require('./account-erasure-storage');
function finalStorageOperations({call,inventory,captureLineage,sweepPaths,now=()=>new Date()}){
 function checkpoint(accountId,journal){
  const stop=journal.steps.find(s=>s.phase==='drainIssuers')?.evidence;
  const start=journal.steps.find(s=>s.phase==='freeze')?.evidence?.startedAt;
  // Only the issuer adapter may establish this scoped proof. Its current
  // implementation remains blocked; elapsed time never creates this evidence.
  if(stop?.kind!=='verified_issuer_shutdown'||stop.accountId!==accountId||stop.operationId!==journal.operationId
   ||stop.allIssuersStopped!==true||stop.legacyDeploymentsVerified!==true||stop.inflightWritersDrained!==true||!stop.evidenceRef){
   return {stage:'issuance_stop_required',pending:['verified_issuer_shutdown_required']};
  }
  return storageCheckpoint(start,now(),{issuersStoppedAt:stop.issuersStoppedAt});
 }
 async function fresh(accountId,journal){
  const current=await inventory(accountId),pending=inventoryGate(current);
  if(!journal.schemaFingerprint||current.schemaFingerprint!==journal.schemaFingerprint)pending.push('schema_changed_review_required');
  if(current.accountExists!==false)pending.push('auth_removal_unverified');
  if(current.references.some(r=>r.matching_rows!==0))pending.push('direct_account_references_remaining');
  if(current.indirect.inflight_notification_sends!==0)pending.push('notification_attempt_reconciliation_required');
  const blocks=await call(`/rest/v1/nothingsports_account_erasure_blocks?${new URLSearchParams({user_id:`eq.${accountId}`,select:'started_at'})}`);
  const started=journal.steps.find(s=>s.phase==='freeze')?.evidence?.startedAt;
  if(!Array.isArray(blocks)||blocks.length!==1||!Number.isFinite(Date.parse(started))||Date.parse(blocks[0].started_at)!==Date.parse(started))pending.push('committed_erasure_marker_unverified');
  return {current,pending};
 }
 return {
  waitUploadExpiry:async({accountId,journal,persist})=>{
   requireOperationPhase(accountId,journal,'waitUploadExpiry',persist);
   const checked=await fresh(accountId,journal);
   if(checked.pending.length)return {verified:false,pending:checked.pending};
   const state=checkpoint(accountId,journal);journal.uploadExpiry=state;await persist(journal);
   if(state.stage!=='storage_rescan_required')return {verified:false,pending:[state.stage==='issuance_stop_required'?'verified_issuer_shutdown_required':'signed_upload_expiry_pending']};
   return {verified:true,evidence:{earliestRescanAt:state.earliestRescanAt,checkedAt:checked.current.checkedAt,finalErasure:false}};
  },
  finalStorageSweep:async({accountId,journal,persist})=>{
   requireOperationPhase(accountId,journal,'finalStorageSweep',persist);
   const state=checkpoint(accountId,journal);
   if(state.stage!=='storage_rescan_required')return {verified:false,pending:['verified_upload_expiry_required']};
   const checked=await fresh(accountId,journal);
   if(checked.pending.length)return {verified:false,pending:checked.pending};
   // Re-list after Auth deletion: old signed uploads may have recreated objects
   // absent from the initial sweep. Retain the original lineage for retry.
   await captureLineage({accountId,journal});
   if(!Array.isArray(journal.lineage?.objects)||journal.lineage.objects.length>20000)throw Error('Final Storage sweep exceeds bounded lineage.');
   journal.finalStorageIntent={accountId,operationId:journal.operationId,earliestRescanAt:state.earliestRescanAt,checkedAt:checked.current.checkedAt};
   await persist(journal);
   const batches=await sweepPaths(journal);
   const after=await fresh(accountId,journal);
   if(after.current.indirect.known_storage_paths!==0)after.pending.push('storage_objects_remaining_or_recreated');
   if(after.pending.length)return {verified:false,pending:after.pending};
   return {verified:true,evidence:{kind:'post_expiry_origin_sweep',checkedAt:after.current.checkedAt,objectPaths:journal.lineage.objects.length,batches,remainingOriginObjects:0,requiresTransferReconciliation:true,finalErasure:false}};
  },
 };
}
module.exports={finalStorageOperations};
