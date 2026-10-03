'use strict';
const {inventoryGate}=require('../../lib/account-erasure-workflow');
const {supabaseServiceRoleConfig,supabaseServiceRequest}=require('../../lib/supabase-server');
const PROJECT_URL='https://mkghopnkhcxtmfrcjdbc.supabase.co';
const SENTINEL='00000000-0000-4000-8000-000000000009';
function verifyDirectGuards(inventory,now=Date.now()){
 const pending=inventoryGate(inventory),seen=new Set();
 if(typeof inventory.schemaFingerprint!=='string'||!inventory.schemaFingerprint.trim()||inventory.schemaFingerprint.length>128)pending.push('verified_schema_fingerprint_required');
 const checked=Date.parse(inventory.checkedAt);
 if(!Number.isFinite(checked)||checked>now+60000||now-checked>60000)pending.push('fresh_inventory_required');
 if(inventory.accountExists!==false)pending.push('nonexistent_inventory_sentinel_required');
 for(const ref of inventory.references){
  if(!['schema_name','table_name','column_name'].every(key=>typeof ref[key]==='string'&&/^[a-z_][a-z0-9_]*$/i.test(ref[key])))pending.push('unverified_reference_identity');
  const key=[ref.schema_name,ref.table_name,ref.column_name].join('.');
  if(seen.has(key))pending.push('duplicate_reference');seen.add(key);
  if(ref.matching_rows!==0)pending.push('sentinel_state_requires_review');
 }
 if(pending.length)throw Error('Account erasure guard coverage failed: '+[...new Set(pending)].join(', '));
 return {checkedAt:inventory.checkedAt,schemaFingerprint:inventory.schemaFingerprint,referenceCount:inventory.references.length,guardedReferences:inventory.references.length,fullAccountErasureVerified:false};
}
async function readDirectGuards({environment=process.env,request=supabaseServiceRequest,now=Date.now}={}){
 const config=supabaseServiceRoleConfig(environment);
 if(config.url!==PROJECT_URL||!config.configured)throw Error('Account guard check needs existing recovery-project service credentials.');
 // This inventory RPC only reads catalogs/counts. No account is created,
 // frozen, banned or erased. One call per release, no retries or scheduler.
 const inventory=await request('/rest/v1/rpc/nothingsports_account_erasure_inventory',{method:'POST',body:{target_user_id:SENTINEL},environment,timeoutMs:15000});
 return verifyDirectGuards(inventory,now());
}
module.exports={verifyDirectGuards,readDirectGuards,SENTINEL};
