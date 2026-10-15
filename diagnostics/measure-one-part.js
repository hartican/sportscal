
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
assert.equal(new URL(process.env.SUPABASE_URL).hostname,'mkghopnkhcxtmfrcjdbc.supabase.co');
const scope=JSON.parse(fs.readFileSync('diagnostics/public-fixture-transport-scope.json'));
const proof={checkedAt:new Date().toISOString(),readOnly:true,providerCalls:0,diagnosticOnly:true,notReleaseAcceptance:true,diagnosticDeadlineMs:8000,productionDeadlineMs:3000,scopeUnchanged:true};
(async()=>{const t=performance.now();try{
 const response=await fetch(process.env.SUPABASE_URL+'/rest/v1/rpc/nothingsports_read_fixture_bundle_part',{method:'POST',headers:{apikey:process.env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+process.env.SUPABASE_SECRET_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_scope:'participants',p_part:0,...scope}),signal:AbortSignal.timeout(8000)});
 proof.headersMs=Math.round(performance.now()-t);proof.status=response.status;
 proof.timingHeaders=Object.fromEntries(['content-encoding','content-length','server-timing','x-kong-upstream-latency','x-kong-proxy-latency','x-sb-edge-region'].map(k=>[k,response.headers.get(k)]));
 const text=await response.text();proof.bodyMs=Math.round(performance.now()-t);proof.decodedBytes=Buffer.byteLength(text);
 if(response.ok){const data=JSON.parse(text);proof.complete=data.complete;proof.rows=data.rows?.length;proof.totalRows=data.rowCount;}
 }catch(e){proof.elapsedMs=Math.round(performance.now()-t);proof.failure=e.name;}
 fs.writeFileSync('one-part-timing.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));})();
