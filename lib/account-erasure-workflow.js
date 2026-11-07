'use strict';
const crypto=require('node:crypto');
const PHASES=['freeze','captureLineage','drainIssuers','eraseStorage','eraseOwnedData','eraseAuth','waitUploadExpiry','finalStorageSweep','reconcile'];
const INDIRECT=['reward_eligibility_arrays','email_subscriptions','avatar_cleanup_paths','known_storage_paths','uploaded_chat_attachments','other_people_replies','other_people_memberships_in_owned_rooms','saved_media_owner_mismatch','reminders_via_installation','notification_send_attempts','inflight_notification_sends'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 function requireOperationPhase(accountId,journal,phase,persist){
  if(!PHASES.includes(phase))throw Error('Unknown erasure phase.');
  const prior=PHASES.slice(0,PHASES.indexOf(phase));
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(accountId||'')
   ||journal?.accountId!==accountId||journal.phase!==phase||!journal.operationId||!journal.request?.requestId
   ||!Number.isFinite(Date.parse(journal.request.verifiedAt))||typeof persist!=='function'
   ||journal.steps?.length!==prior.length||prior.some((p,i)=>journal.steps[i]?.phase!==p))throw Error('Exact account, verified request and preceding workflow steps required.');
 }
function newJournal(accountId,request){
 if(!UUID.test(accountId)||request?.verifiedAccountId!==accountId||!request?.requestId||!Number.isFinite(Date.parse(request.verifiedAt)))throw Error('A verified request for the exact account is required.');
 return {schemaVersion:'erasure-workflow.v1',operationId:crypto.randomUUID(),accountId,request:{requestId:request.requestId,verifiedAt:request.verifiedAt},phase:'preflight',complete:false,steps:[],pending:[]};
}
function inventoryGate(inventory){
 if(inventory?.schemaVersion!=='erasure-inventory.v1'||!inventory.schemaFingerprint||!Array.isArray(inventory.references)||!inventory.references.length)throw Error('Fresh inventory is incomplete.');
 const reasons=[];
 if(inventory.unsupportedReferences!==0)reasons.push('unsupported_account_references');
 if(inventory.unknownStorageObjects!==0)reasons.push('unknown_storage_ownership');
 if(inventory.references.some(r=>r.guarded!==true||!Number.isSafeInteger(r.matching_rows)||r.matching_rows<0))reasons.push('unguarded_or_unverified_reference');
 if(INDIRECT.some(key=>!(key==='email_subscriptions'&&inventory.accountExists===false&&inventory.indirect?.[key]===null)&&(!Number.isSafeInteger(inventory.indirect?.[key])||inventory.indirect[key]<0)))reasons.push('unverified_indirect_check');
 if(inventory.indirect?.saved_media_owner_mismatch!==0)reasons.push('shared_media_ownership_mismatch');
 return reasons;
}
async function advance({journal,inventory,operations,persist,now=()=>new Date().toISOString()}){
 if(journal?.schemaVersion!=='erasure-workflow.v1'||!UUID.test(journal.accountId)||!Array.isArray(journal.steps)||journal.steps.some((step,index)=>step.phase!==PHASES[index]))throw Error('Invalid erasure journal; refusing to infer progress.');
 if(journal.complete){if(journal.phase!=='complete'||journal.steps.length!==PHASES.length)throw Error('Incomplete journal cannot claim completion.');return journal;}
 const fresh=await inventory(journal.accountId),reasons=inventoryGate(fresh);
 if(journal.schemaFingerprint&&journal.schemaFingerprint!==fresh.schemaFingerprint)reasons.push('schema_changed_review_required');
 if(!journal.steps.some(s=>s.phase==='eraseAuth')&&!(journal.phase==='eraseAuth'&&journal.steps.length===PHASES.indexOf('eraseAuth'))&&fresh.accountExists!==true)reasons.push('account_missing_before_auth_step');
 if(reasons.length){journal.pending=reasons;await persist(journal);return journal;}
 journal.schemaFingerprint=fresh.schemaFingerprint;
 journal.lastInventoryAt=fresh.checkedAt;
 await persist(journal);
 for(const phase of PHASES.slice(journal.steps.length)){
  journal.phase=phase;journal.pending=[];await persist(journal);
  const operation=operations[phase];
  if(typeof operation!=='function'){journal.pending=[`${phase}_not_connected`];await persist(journal);return journal;}
  // The stable operation ID and saved phase precede the effect. Adapters must
  // reconcile uncertain outcomes/idempotently retry after a lost acknowledgement.
  const result=await operation({accountId:journal.accountId,operationId:journal.operationId,journal,persist});
  if(result?.verified!==true){journal.pending=Array.isArray(result?.pending)&&result.pending.length?result.pending:[`${phase}_unverified`];await persist(journal);return journal;}
  if(phase==='reconcile'&&(result.allCategoriesVerified!==true||!Array.isArray(result.remaining)||result.remaining.length)){journal.pending=['final_reconciliation_incomplete'];await persist(journal);return journal;}
  journal.steps.push({phase,verifiedAt:now(),evidence:result.evidence||null});await persist(journal);
 }
 journal.complete=true;journal.phase='complete';journal.pending=[];await persist(journal);return journal;
}
module.exports={requireOperationPhase,PHASES,INDIRECT,newJournal,inventoryGate,advance};
