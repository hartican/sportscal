'use strict';
// In-memory HTTP doubles through the ACTUAL app store and response parser. No network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const tests=[];const test=(name,run)=>tests.push({name,run});
const {measure,readPair}=require('./lib/near-app-adapter-qualification');
const ROOT=path.join(__dirname,'..');
const {createSnapshotStore}=require(ROOT+'/lib/live-fixtures');
const {supabaseServiceRequest}=require(ROOT+'/lib/supabase-server');
const fixture={id:'fixture:qa:one',homeScore:0,awayScore:0,status:'completed',scoreCheckedAt:'2026-10-01T00:00:00Z'};
const bundle={schemaVersion:'current-fixture-bundle.v1',scope:'match-centre',complete:true,rows:[{source_id:'qa-memory-only',fixture}]};
const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test_not_a_real_credential'};
async function invoke({body=JSON.stringify(bundle),health=[{source_id:'qa-memory-only',revision:1,checked_at:'2026-10-01T00:00:00Z'}],status=200,maxBytes=4194304,timer}={}){
 const urls=[];
 const fetchImpl=async(url,options)=>{
  urls.push(url);assert.equal(options.method,'POST');
  return new Response(url.endsWith('nothingsports_read_fixture_source_health')?JSON.stringify(health):body,{status:url.endsWith('nothingsports_read_fixture_source_health')?200:status,headers:{'content-type':'application/json'}});
 };
 try{return{result:await measure({storeFactory:createSnapshotStore,request:(url,options)=>supabaseServiceRequest(url,{...options,fetchImpl}),environment,membershipIds:['fixture:qa:one'],maxBytes,...(timer?{timer}:{})}),urls};}
 catch(error){error.testUrls=urls;throw error;}
}
test('real app parser/store completes exactly health plus bundle and records whole-body phases',async()=>{
 const {result,urls}=await invoke();assert.equal(urls.length,2);assert.equal(result.consumerSources,1);
 const r=result.calls.find(x=>x.kind==='bundle');assert.equal(r.bytes,Buffer.byteLength(JSON.stringify(bundle)));assert.equal(r.bundle.rows,1);assert.match(r.bundle.parsedValueSha256,/^[a-f0-9]{64}$/);
 assert(r.timings.some(x=>x.phase==='parse-ready'&&x.format==='json'));assert(r.timings.some(x=>x.phase==='complete'&&x.outcome==='success'));assert.equal(fixture.homeScore,0);assert.equal(fixture.scoreCheckedAt,'2026-10-01T00:00:00Z');
});
test('HTTP200 with a truncated JSON body cannot pass the actual parser',async()=>{
 await assert.rejects(invoke({body:JSON.stringify(bundle).slice(0,-1)}),error=>{assert.equal(error.testUrls.length,2);assert(error.qualificationReceipt.calls.some(x=>x.timings.some(t=>t.phase==='parse-ready'&&t.format==='text')));return true;});
});
test('a parsed but incomplete bundle is rejected with the failed read receipt',async()=>{
 await assert.rejects(invoke({body:JSON.stringify({...bundle,complete:false})}),error=>{assert.equal(error.testUrls.length,2);assert.equal(error.qualificationReceipt.calls.length,2);return true;});
});
test('full consumer elapsed over4000 fails even when both HTTP responses succeed',async()=>{
 let n=0;await assert.rejects(invoke({timer:()=>n++===0?0:4001}),error=>{assert.equal(error.qualificationReceipt.elapsedMs,4001);assert.equal(error.testUrls.length,2);return true;});
});
test('oversized complete response cannot be truncated into a pass',async()=>{
 await assert.rejects(invoke({maxBytes:8}),error=>{assert.equal(error.testUrls.length,2);assert(error.qualificationReceipt.calls.some(x=>x.timings.some(t=>t.phase==='text-ready'&&t.bytes>8)));return true;});
});
test('a missing RPC stops; legacy fallback cannot issue a third request',async()=>{
 await assert.rejects(invoke({status:404,body:'{}'}),error=>{assert.equal(error.testUrls.length,2);assert(error.qualificationReceipt);return true;});
});
test('empty health cannot hide a nonempty bundle from the actual consumer',async()=>{
 await assert.rejects(invoke({health:[]}),error=>{assert.equal(error.testUrls.length,2);return true;});
});
test('a genuinely empty bundle and health remain valid',async()=>{
 const {result}=await invoke({body:JSON.stringify({...bundle,rows:[]}),health:[]});assert.equal(result.consumerSources,0);assert.equal(result.calls.find(x=>x.kind==='bundle').bundle.rows,0);
});
test('actual pair protocol refuses success after a read crosses expiry',async()=>{
 let clock=0,calls=0;await assert.rejects(readPair({expires:60000,now:()=>clock,read:async()=>{calls++;clock=60001;return{elapsedMs:2};}}));assert.equal(calls,1,'No second read or retry after expiry');
});
test('actual pair protocol refuses a second read without enough remaining admission',async()=>{
 let clock=0,calls=0;await assert.rejects(readPair({expires:60000,now:()=>clock,read:async()=>{calls++;clock=55000;return{elapsedMs:2};}}));assert.equal(calls,1);
});

test('live publication binding rejects PR/branch/wrong snapshot or workflow before any request',()=>{
 const head='a'.repeat(40),environment={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'hartican/sportscal',GITHUB_WORKFLOW:'Sportscal production',GITHUB_JOB:'deploy',GITHUB_RUN_ID:'123',GITHUB_SHA:head,NS_NEAR_APP_RELEASE_SHA:head};
 const {validatePublication}=require('./lib/near-app-adapter-qualification');assert.equal(validatePublication(environment,head),head);
 for(const change of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REF:'refs/heads/codex/draft'},{GITHUB_SHA:'b'.repeat(40)},{NS_NEAR_APP_RELEASE_SHA:'b'.repeat(40)},{GITHUB_JOB:'test'},{GITHUB_WORKFLOW:'installed upgrade'},{GITHUB_REPOSITORY:'fork/sportscal'},{GITHUB_ACTIONS:'false'}])assert.throws(()=>validatePublication({...environment,...change},head));
});
test('default verifier is inert without reading environment or catalogue',async()=>{
 const messages=[],environment=new Proxy({},{get(){throw Error('Environment touched');}});
 await require('./verify-near-app-adapter').main({argv:[],environment,log:text=>messages.push(JSON.parse(text))});assert.deepEqual(messages,[{state:'INERT_NO_LIVE_READ',serviceCalls:0,releaseAcceptance:false}]);
});
test('absolute outer deadline cancels a hung read without a third call or expired success',async()=>{
 const {qualify}=require('./lib/near-app-adapter-qualification');let fire,signal,reads=0,cleared=0;
 const result=qualify({read:s=>{signal=s;reads++;return new Promise(()=>{});},schedule:fn=>{fire=fn;return 7;},cancel:id=>{assert.equal(id,7);cleared++;}});
 assert.equal(reads,1);fire();await assert.rejects(result,error=>error.gateCode==='allocation_expired');assert.equal(signal.aborted,true);assert.equal(reads,1);assert.equal(cleared,1);
});
test('failure code never copies arbitrary SQL, identifiers, responses or credentials',()=>{
 const {failureCode}=require('./lib/near-app-adapter-qualification');const secret='PRIVATE_FIXTURE_OR_KEY';assert.equal(failureCode({message:secret,code:secret,payload:{code:secret}}),'adapter_failure');assert.equal(failureCode({payload:{code:'supabase_timeout'}}),'supabase_timeout');
});
test('a repeated verifier cannot overwrite its earlier exclusively claimed receipt',()=>{
 const os=require('node:os'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'near-gate-claim-'));
 try{const {claimReceipt}=require('./verify-near-app-adapter'),file=claimReceipt(dir,{state:'ORIGINAL_EVIDENCE'}),original=fs.readFileSync(file);assert.throws(()=>claimReceipt(dir,{state:'REPEATED'}),error=>error.code==='EEXIST');assert(fs.readFileSync(file).equals(original));}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('workflow keeps live read in existing publisher secret step after both guards before deployment',()=>{
 const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/sportscal-production.yml'),'utf8');
 const shared=workflow.slice(workflow.indexOf('      - name: Verify shared fixture publication input'),workflow.indexOf('      - name: Bind project and preserve current production'));
 assert(shared.includes('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}'));assert(shared.includes('SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}'));assert(shared.includes('NS_NEAR_APP_RELEASE_SHA: ${{ inputs.sha }}'));
 assert(shared.indexOf('validate-live-coverage-publication.js --live-read')<shared.indexOf('validate-account-erasure-preflight.js --live-read'));
 assert(shared.indexOf('validate-account-erasure-preflight.js --live-read')<shared.indexOf('verify-near-app-adapter.js --live-read'));
 assert.equal((workflow.match(/verify-near-app-adapter.js --live-read/g)||[]).length,1);assert.equal((workflow.match(/node scripts\/validate-near-app-adapter.js/g)||[]).length,1);assert(!workflow.includes('pull_request:'));
});
(async()=>{for(const item of tests)await item.run();console.log(JSON.stringify({passed:true,checks:tests.length,scope:'In-memory actual HTTP parser/store plus bounded protocol and publisher-source controls',networkCalls:0,managedQueries:0}));})().catch(error=>{console.error(error);process.exitCode=1;});
