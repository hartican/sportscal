'use strict';
// Isolated5001 overflow test only. The985 same-statement/performance tests do not use this.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const ORDER=Object.freeze(['A','B','B','A']);
const READERS=Object.freeze({A:'qa_receipt_join.original_reader',B:'public.nothingsports_read_match_centre_fixture_bundle'});
function sqlFor(which){assert(Object.hasOwn(READERS,which));return "select "+READERS[which]+"('{}'::text[])::text body,txid_current_snapshot()::text snapshot,txid_current()::text transaction_id,transaction_timestamp()::text transaction_clock,statement_timestamp()::text statement_clock,pg_backend_pid() backend_pid,current_user role_name,current_setting('transaction_isolation') isolation,current_setting('statement_timeout') statement_timeout,current_setting('lock_timeout') lock_timeout,current_setting('transaction_read_only') read_only";}
async function compareOverflow(db,proof,{phase=()=>{},persist=()=>{},timer=()=>performance.now()}={}){
 Object.assign(proof,{state:'RUNNING',scope:'ISOLATED_OVERFLOW_PER_REQUEST_NOT_985_PERFORMANCE',order:[...ORDER],perStatementMs:5000,perLockMs:1000,samples:[]});
 let baselineText=null,witness=null;
 for(const [index,which]of ORDER.entries()){
  const label='overflow:'+index+':'+which;phase(label);const start=timer();let row;
  try{
   const result=await db.query(sqlFor(which));assert.equal(result.rows.length,1);row=result.rows[0];
   assert.equal(typeof row.body,'string');const parsed=JSON.parse(row.body);
   assert.equal(parsed.schemaVersion,'current-fixture-bundle.v1');assert.equal(parsed.scope,'match-centre');assert.equal(parsed.complete,false);assert.equal(parsed.rows.length,5001);
   assert.equal(row.isolation,'repeatable read');assert.equal(row.statement_timeout,'5s');assert.equal(row.lock_timeout,'1s');assert.equal(row.role_name,'service_role');assert(['on','off'].includes(row.read_only));assert(Number.isSafeInteger(row.backend_pid)&&row.backend_pid>0);
   const current={snapshot:row.snapshot,transaction_id:row.transaction_id,transaction_clock:row.transaction_clock,backend_pid:row.backend_pid,read_only:row.read_only};
   for(const key of ['snapshot','transaction_id','transaction_clock'])assert(typeof current[key]==='string'&&current[key].length>0,'Missing transaction witness '+key);
   assert(typeof row.statement_clock==='string'&&row.statement_clock.length>0);
   if(witness)assert.deepEqual(current,witness,'Overflow snapshot/transaction clock/backend changed');else witness=current;
   if(baselineText!==null)assert.equal(row.body,baselineText,'Full ordered overflow text differs');else baselineText=row.body;
   const hash=crypto.createHash('sha256').update(row.body).digest('hex'),elapsedMs=timer()-start;
   assert(Number.isFinite(elapsedMs)&&elapsedMs>=0&&elapsedMs<=5000,'Overflow whole response/parse/proof exceeded5s');
   proof.witness=witness;proof.samples.push({index,which,phase:label,state:'PASS',elapsedMs,rows:5001,complete:false,bytes:Buffer.byteLength(row.body),sha256:hash,fullOrderedTextEqual:true,statement_clock:row.statement_clock});persist();
  }catch(error){
   proof.state='FAIL';proof.failure={phase:label,index,which,elapsedMs:timer()-start,message:String(error.message).slice(0,240),code:error.code||null};
   if(row)proof.failure.observedMetadata={snapshot:row.snapshot,transaction_id:row.transaction_id,transaction_clock:row.transaction_clock,statement_clock:row.statement_clock,backend_pid:row.backend_pid,role_name:row.role_name,read_only:row.read_only,isolation:row.isolation,statement_timeout:row.statement_timeout,lock_timeout:row.lock_timeout};persist();throw error;
  }
 }
 proof.state='PASS';proof.actualRows=5001;proof.complete=false;proof.fullOrderedTextEqual=true;proof.sameSnapshotTransactionClockAndBackend=true;proof.statementClocksAreActualAndMayDiffer=true;persist();return proof;
}
module.exports={compareOverflow,sqlFor,ORDER};
