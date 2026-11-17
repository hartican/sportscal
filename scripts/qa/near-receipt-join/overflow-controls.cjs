'use strict';
// Pure fake-result protocol controls. No process, DB, SQL execution, network or CI.
const assert=require('node:assert/strict'),{compareOverflow,sqlFor}=require('./overflow-proof.cjs');
const text=JSON.stringify({schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:false,rows:Array.from({length:5001},(_,i)=>({fixture_id:'synthetic:'+i,homeScore:0,opaque:null}))});
const base={body:text,snapshot:'1:20:',transaction_id:'19',transaction_clock:'2026-10-30 10:00:00+00',statement_clock:'2026-10-30 10:00:00+00',backend_pid:123,role_name:'service_role',isolation:'repeatable read',statement_timeout:'5s',lock_timeout:'1s',read_only:'off'};
async function fixture({patch=()=>({}),elapsed=10,failAt=-1}={}){
 let calls=0,now=0;const phases=[],proof={};
 const db={query:async sql=>{const index=calls++;assert.equal(sql,sqlFor(['A','B','B','A'][index]));assert.equal((sql.match(/original_reader\(/g)||[]).length+(sql.match(/nothingsports_read_match_centre_fixture_bundle\(/g)||[]).length,1);now+=elapsed;if(index===failAt)throw Object.assign(Error('statement timeout'),{code:'57014'});return {rows:[{...base,statement_clock:'statement:'+index,...patch(index)}]};}};
 let error;try{await compareOverflow(db,proof,{phase:p=>phases.push(p),timer:()=>now});}catch(e){error=e;}
 return {calls,proof,error,phases};
}
async function main(){
 const good=await fixture();assert(!good.error);assert.equal(good.calls,4);assert.deepEqual(good.proof.samples.map(s=>s.which),['A','B','B','A']);assert.equal(good.proof.state,'PASS');assert.equal(good.proof.actualRows,5001);assert.equal(good.proof.samples.every(s=>s.bytes===Buffer.byteLength(text)),true);
 let refused=0;
 for(const patch of [i=>i===1?{snapshot:'changed'}:{},i=>i===1?{transaction_clock:'changed'}:{},i=>i===1?{transaction_id:'changed'}:{},i=>i===1?{backend_pid:124}:{},i=>i===1?{read_only:'on'}:{},i=>i===1?{body:text.replace('synthetic:4999','changed:4999')}:{},()=>({snapshot:null}),()=>({statement_clock:''}),()=>({isolation:'read committed'}),()=>({statement_timeout:'6s'}),()=>({lock_timeout:'2s'}),()=>({role_name:'anon'}),()=>({body:JSON.stringify({schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:false,rows:[]})}),()=>({body:text.replace('"complete":false','"complete":true')})]){
  const r=await fixture({patch});assert(r.error);assert.equal(r.proof.state,'FAIL');assert(r.calls<=2);assert.equal(r.proof.failure.phase,r.phases.at(-1));refused++;
 }
 const slow=await fixture({elapsed:5001});assert(slow.error);assert.equal(slow.calls,1);refused++;
 for(const failAt of [0,1,2,3]){const timed=await fixture({failAt});assert.equal(timed.error.code,'57014');assert.equal(timed.calls,failAt+1);assert.equal(timed.proof.samples.length,failAt);assert.equal(timed.proof.failure.index,failAt);refused++;}
 assert.throws(()=>sqlFor('constructor'));refused++;
 const edge=await fixture({elapsed:5000});assert(!edge.error);assert.equal(edge.proof.samples.length,4);
 return {state:'PURE_ISOLATED_OVERFLOW_CONTROLS_ONLY',positive:2,refusals:refused,fixedABBA4SingleReaderStatements:true,full5001TextNoTrimming:true,snapshotTransactionClockAndBackendChecked:true,actualStatementClocksMayDiffer:true,stopOnFirstFailureAndPartialTimingsRetained:true,nativeSQLDockerProcessNetworkCIOrPush:0};
}
if(require.main===module)main().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={main};
