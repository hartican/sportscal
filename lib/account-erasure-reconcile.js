'use strict';
const {requireOperationPhase,inventoryGate}=require('./account-erasure-workflow');
// These UUID/prefix checks remain meaningful after Auth removal. Peer joins
// and email lookups through Auth do not: their disappearance is not evidence.
const ZERO_REQUIRED=['reward_eligibility_arrays','avatar_cleanup_paths','known_storage_paths','uploaded_chat_attachments','saved_media_owner_mismatch','reminders_via_installation','notification_send_attempts','inflight_notification_sends'];
const UNRESOLVED=['accepted_upload_transfers_unverified','external_delivery_and_caches_unverified','historical_and_unlinked_identities_unverified','peer_preservation_unverified'];
function reconciliationOperations({call,inventory}){
 return {reconcile:async({accountId,journal,persist})=>{
  requireOperationPhase(accountId,journal,'reconcile',persist);
  const current=await inventory(accountId),pending=inventoryGate(current);
  if(current.schemaFingerprint!==journal.schemaFingerprint)pending.push('schema_changed_review_required');
  if(current.accountExists!==false)pending.push('auth_removal_unverified');
  if(current.references.some(r=>r.matching_rows!==0))pending.push('direct_account_references_remaining');
  for(const key of ZERO_REQUIRED)if(current.indirect[key]!==0)pending.push(key+'_remaining_or_unverified');
  const blocks=await call(`/rest/v1/nothingsports_account_erasure_blocks?${new URLSearchParams({user_id:`eq.${accountId}`,select:'started_at'})}`);
  const start=journal.steps.find(s=>s.phase==='freeze')?.evidence?.startedAt;
  if(!Array.isArray(blocks)||blocks.length!==1||!Number.isFinite(Date.parse(start))||Date.parse(blocks[0].started_at)!==Date.parse(start))pending.push('committed_erasure_marker_unverified');
  const lineage=journal.emailLineage;
  let emailStatus='unverified';
  if(lineage?.accountId!==accountId||lineage?.operationId!==journal.operationId||!Number.isFinite(Date.parse(lineage?.capturedAt))){
   pending.push('pre_auth_email_lineage_required');
  }else if(lineage.status==='no_verified_current_email'){
   emailStatus='no_verified_current_email'; // Unknown/historical ownership stays open below.
  }else if(lineage.status==='verified_current_email'&&typeof lineage.normalizedEmail==='string'&&lineage.normalizedEmail.trim()&&lineage.normalizedEmail===lineage.normalizedEmail.trim().toLowerCase()){
   // Quoted PostgREST literal protects addresses containing filter punctuation.
   const literal='"'+lineage.normalizedEmail.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
   const matches=await call(`/rest/v1/marquee_subscribers?${new URLSearchParams({email_normalized:'eq.'+literal,select:'email_normalized',limit:'1'})}`);
   if(!Array.isArray(matches)||matches.some(r=>r.email_normalized!==lineage.normalizedEmail))pending.push('current_email_subscription_check_unverified');
   else if(matches.length){emailStatus='matching_subscription_requires_review';pending.push('current_email_subscription_requires_review');}
   else emailStatus='no_current_email_subscription';
  }else pending.push('pre_auth_email_lineage_required');
  // No journal boolean or elapsed timeout may manufacture provider evidence.
  // Future adapters must resolve these categories before enabling completion.
  pending.push(...UNRESOLVED);
  journal.reconciliation={schemaVersion:'erasure-reconciliation.v1',checkedAt:current.checkedAt,
   accountExists:current.accountExists,directReferences:current.references.map(r=>({table:r.table_name,column:r.column_name,remaining:r.matching_rows})),
   indirect:Object.fromEntries(ZERO_REQUIRED.map(key=>[key,current.indirect[key]])),emailStatus,
   pending:[...new Set(pending)],complete:false};
  await persist(journal);
  return {verified:false,allCategoriesVerified:false,pending:journal.reconciliation.pending};
 }};
}
module.exports={reconciliationOperations,ZERO_REQUIRED,UNRESOLVED};
