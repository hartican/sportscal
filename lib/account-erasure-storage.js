'use strict';
// Earliest rescan only: token expiry does not prove that a transfer accepted
// before expiry, a provider cache or an external worker has finished.
const SIGNED_UPLOAD_SECONDS=2*60*60;
const MAX_WRITER_SECONDS=60;
const CLOCK_MARGIN_SECONDS=60;
function storageCheckpoint(startedAt,now=new Date(),{issuersStoppedAt=null}={}){
 const start=Date.parse(startedAt),time=new Date(now).getTime();
 if(!Number.isFinite(start)||!Number.isFinite(time)||start>time)throw Error('A valid committed erasure start time is required.');
 if(!issuersStoppedAt)return {stage:'issuance_stop_required',earliestRescanAt:null,remainingSeconds:null,complete:false,pending:['all_issuers_and_legacy_deployments_stopped','storage_origin_sweep','inflight_transfer_reconciliation','remaining_account_categories']};
 const stopped=Date.parse(issuersStoppedAt);
 if(!Number.isFinite(stopped)||stopped<start||stopped>time)throw Error('Verified issuer stop time must follow erasure start and not be in the future.');
 const rescanAt=stopped+1000*(SIGNED_UPLOAD_SECONDS+CLOCK_MARGIN_SECONDS);
 return {
  stage:time<rescanAt?'waiting_for_upload_expiry':'storage_rescan_required',
  earliestRescanAt:new Date(rescanAt).toISOString(),
  remainingSeconds:Math.max(0,Math.ceil((rescanAt-time)/1000)),
  complete:false,
  pending:['storage_origin_sweep','inflight_transfer_reconciliation','remaining_account_categories'],
 };
}
module.exports={SIGNED_UPLOAD_SECONDS,MAX_WRITER_SECONDS,CLOCK_MARGIN_SECONDS,storageCheckpoint};
