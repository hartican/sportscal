'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {readBundleParts}=require('../lib/fixture-bundle-parts');
const {supabaseServiceRequest}=require('../lib/supabase-server');
async function run({scope,environment=process.env,output,cycles=2}={}){
 assert.equal(new URL(environment.SUPABASE_URL).hostname,'mkghopnkhcxtmfrcjdbc.supabase.co','Unexpected project');
 const names=['p_sport_keys','p_known_sport_keys','p_participant_ids','p_required_ids'];
 assert.deepEqual(Object.keys(scope).sort(),names.slice().sort(),'Only public canonical scope fields');
 for(const name of names)assert(Array.isArray(scope[name])&&scope[name].every(value=>typeof value==='string'&&/^[-a-z0-9_:]{1,200}$/i.test(value)),'Invalid public scope');
 const proof={checkedAt:new Date().toISOString(),readOnly:true,providerCalls:0,deadlinePerRequestMs:3000,requestLimitPerBundle:2,scopeCounts:Object.fromEntries(names.map(name=>[name,scope[name].length])),checks:[],passed:false};
 const save=()=>{if(output)fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');};
 try{
  for(let cycle=0;cycle<cycles;cycle++)for(const kind of ['participants','global']){
   const receipt={cycle,scope:kind,parts:[]},started=performance.now();proof.checks.push(receipt);
   const request=async(name,body)=>{
    const began=performance.now(),part={part:body.p_part};receipt.parts.push(part);
    try{
     const value=await supabaseServiceRequest('/rest/v1/rpc/'+name,{method:'POST',body,environment,timeoutMs:3000,fetchImpl:async(...args)=>{const response=await fetch(...args);part.headersMs=Math.round(performance.now()-began);return response;}});
     part.elapsedMs=Math.round(performance.now()-began);assert(part.elapsedMs<3000,'Request exceeded its transport allowance');return value;
    }finally{part.elapsedMs??=Math.round(performance.now()-began);}
   };
   const result=await readBundleParts(request,{scope:kind,...(kind==='participants'?{sportKeys:scope.p_sport_keys,knownSportKeys:scope.p_known_sport_keys,participantIds:scope.p_participant_ids,requiredIds:scope.p_required_ids}:{})});
   assert.equal(receipt.parts.length,2);assert(result.rows.length>0,'Unexpected empty complete scope');
   Object.assign(receipt,{elapsedMs:Math.round(performance.now()-started),complete:result.complete,rows:result.rows.length});save();
   console.log(JSON.stringify(receipt));
  }
  proof.passed=true;save();return proof;
 }catch(error){
  proof.failure={status:Number.isInteger(error?.status)?error.status:null,code:/^(?:[0-9A-Z]{5}|PGRST\d{3}|supabase_timeout)$/.test(error?.payload?.code||'')?error.payload.code:'transport_validation_failed'};save();
  throw Error('Complete fixture transport did not pass; see the sanitised receipt.');
 }
}
if(require.main===module){
 const args=process.argv.slice(2),file=args.find(value=>value.startsWith('--scope-file='))?.slice(13),output=args.find(value=>value.startsWith('--output='))?.slice(9);
 if(!args.includes('--live-read')||!file)throw Error('Explicit --live-read and a public --scope-file are required');
 run({scope:JSON.parse(fs.readFileSync(file,'utf8')),output}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={run};
