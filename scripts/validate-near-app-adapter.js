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
async function invoke({body=JSON.stringify(bundle),health=[{source_id:'qa-memory-only',revision:1,checked_at:'2026-10-01T00:00:00Z'}],status=200,maxBytes=4194304,timer,nearTransport}={}){
 const urls=[];
 const fetchImpl=async(url,options)=>{
  urls.push(url);assert.equal(options.method,'POST');
  return new Response(url.endsWith('nothingsports_read_fixture_source_health')?JSON.stringify(health):body,{status:url.endsWith('nothingsports_read_fixture_source_health')?200:status,headers:{'content-type':'application/json'}});
 };
 try{return{result:await measure({storeFactory:createSnapshotStore,request:(url,options)=>supabaseServiceRequest(url,{...options,fetchImpl}),environment,nearTransport,membershipIds:['fixture:qa:one'],maxBytes,...(timer?{timer}:{})}),urls};}
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
test('actual verifier CLI admits stat-only rewrites while rejecting real source/index changes without network',()=>{
 const result=require('./validate-near-app-prerequisites').validate();assert(result.checks>=15);assert.equal(result.networkCalls,0);assert.equal(result.serviceRequests,0);
});
test('workflow keeps live read in existing publisher secret step after both guards before deployment',()=>{
 const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/sportscal-production.yml'),'utf8');
 const shared=workflow.slice(workflow.indexOf('      - name: Verify shared fixture publication input'),workflow.indexOf('      - name: Bind project and preserve current production'));
 assert(shared.includes('SUPABASE_URL: ${{ secrets.SUPABASE_URL }}'));assert(shared.includes('SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}'));assert(shared.includes('NS_NEAR_APP_RELEASE_SHA: ${{ inputs.sha }}'));
 assert(shared.indexOf('validate-live-coverage-publication.js --live-read')<shared.indexOf('validate-account-erasure-preflight.js --live-read'));
 assert(shared.indexOf('validate-account-erasure-preflight.js --live-read')<shared.indexOf('verify-near-app-adapter.js --live-read'));
 assert.equal((workflow.match(/verify-near-app-adapter.js --live-read/g)||[]).length,1);assert.equal((workflow.match(/node scripts\/validate-near-app-adapter.js/g)||[]).length,1);assert(!workflow.includes('pull_request:'));
});
test('near key wire restores ordered fields, unsafe names and every value without merging edges',()=>{
 const wire=require('../lib/near-fixture-keys');
 const odd=JSON.parse('{"__proto__":{"kept":true},"constructor":"kept","unknown":null,"empty":"","zero":0,"off":false,"nested":[null,{"é":"🏉"}]}');
 const original={...bundle,extraEnvelope:null,fixtureKeys:"retained-original-metadata",rows:[{source_id:'qa-one',fixture_id:'same',identity_keys:['a','a'],fixture:odd,extraRow:false},{source_id:'qa-two',fixture_id:'same',identity_keys:[],fixture:{...odd,status:'different'}}]};
 const encoded=wire.encode(original),text=JSON.stringify(encoded),restored=wire.decode(encoded,{textBytes:Buffer.byteLength(text)});
 assert.equal(JSON.stringify(restored),JSON.stringify(original));assert.equal(restored.rows.length,2);assert(Object.hasOwn(restored.rows[0].fixture,'__proto__'));assert.equal({}.kept,undefined);
 assert.equal(wire.decode(wire.encode({...bundle,rows:[]}),{textBytes:100}).rows.length,0);
});
test('near key wire rejects malformed dictionaries/indices/versions/capacity before partial success',()=>{
 const wire=require('../lib/near-fixture-keys'),make=()=>wire.encode(bundle);
 const invalid=[b=>{b.schemaVersion='unknown';},b=>{b.metadata.scope='global';},b=>{b.metadata.complete=false;},b=>{b.fixtureKeys.push(b.fixtureKeys[0]);},b=>{b.fixtureKeys.push('unused');},b=>{b.rows[0].fixture[0][0]=-1;},b=>{b.rows[0].fixture[0][0]=0.5;},b=>{b.rows[0].fixture[0].push(b.rows[0].fixture[0][0]);b.rows[0].fixture[1].push(null);},b=>{b.rows[0].fixture[1].pop();},b=>{b.rows[0].source_id='';},b=>{b.rows=Array.from({length:5001},()=>b.rows[0]);}];
 for(const alter of invalid){const value=make();alter(value);assert.throws(()=>wire.decode(value,{textBytes:100000}));}
 for(const textBytes of [undefined,-1,0,1.5,4194305])assert.throws(()=>wire.decode(make(),{textBytes}));
 const largeKey='x'.repeat(2048),fixture=Object.fromEntries([[largeKey,null]]),expanded={...bundle,rows:Array.from({length:2100},()=>({source_id:'qa',fixture}))};
 assert.throws(()=>wire.decode(wire.encode(expanded),{textBytes:100000}),'Weighted expanded key guard bounds allocations');
});
test('actual opt-in near app path preserves whole consumer and original two-resource guards',async()=>{
 const wire=require('../lib/near-fixture-keys'),encoded=wire.encode(bundle);
 const legacy=await invoke(),candidate=await invoke({body:JSON.stringify(encoded),nearTransport:wire.CANDIDATE});
 assert.equal(candidate.result.consumerParsedValueSha256,legacy.result.consumerParsedValueSha256);assert.equal(candidate.urls.length,2);assert.equal(candidate.result.calls.find(x=>x.kind==='bundle').bundle.parsedValueSha256,legacy.result.calls.find(x=>x.kind==='bundle').bundle.parsedValueSha256);
 await assert.rejects(invoke({nearTransport:wire.CANDIDATE}),e=>e.testUrls.length===2,'Opt-in must refuse a legacy server response');
 await assert.rejects(invoke({body:JSON.stringify(encoded),nearTransport:wire.CANDIDATE,maxBytes:8}),e=>e.testUrls.length===2);
 let n=0;await assert.rejects(invoke({body:JSON.stringify(encoded),nearTransport:wire.CANDIDATE,timer:()=>n++===0?0:4001}),e=>e.qualificationReceipt.elapsedMs===4001&&e.testUrls.length===2);
 await assert.rejects(invoke({body:'{}',nearTransport:wire.CANDIDATE,status:404}),e=>e.testUrls.length===2);
 assert.throws(()=>require('../lib/live-fixtures').createSnapshotStore({nearTransport:{}}));
});
test('near cache/inflight ownership is separate for the explicit wire namespace',async()=>{
 const {readLiveSnapshots}=require('../lib/live-fixtures'),wire=require('../lib/near-fixture-keys');let calls=0;
 const make=nearTransport=>createSnapshotStore({nearTransport,request:(url,options)=>{
  return supabaseServiceRequest(url,{...options,environment,fetchImpl:async(_url,request)=>{
   calls++;const health=url.endsWith('nothingsports_read_fixture_source_health');
   if(!health)assert.equal(request.headers['x-ns-near-fixture-keys'],nearTransport===wire.CANDIDATE?'v1':undefined);
   return new Response(JSON.stringify(health?[{source_id:'qa-memory-only',revision:1}]:nearTransport?wire.encode(bundle):bundle),{status:200});
  }});
 }});
 const options={scope:'match-centre',interactive:true,now:1900000000000,preserveIds:['qa:near-key-cache-only']};
 await readLiveSnapshots({...options,store:make()});assert.equal(calls,2);
 await Promise.all([readLiveSnapshots({...options,store:make(wire.CANDIDATE)}),readLiveSnapshots({...options,store:make(wire.CANDIDATE)})]);assert.equal(calls,4,'No cross-version cache hit, but same-version inflight coalesces');
 await readLiveSnapshots({...options,store:make(wire.CANDIDATE)});assert.equal(calls,4);
});

// Selected only by the existing owner's explicit private-vector invocation.
let privateNearCorpusProof=null;
function readPrivateNearCorpus(){
 const file=process.env.NS_NEAR_KEY_CAPTURE_BODY;
 if(!file||!path.isAbsolute(file))throw Error('Private near corpus binding required');
 let fd;
 try{
  const parent=fs.lstatSync(path.dirname(file));
  if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o777)!==0o700)throw Error('Private corpus directory refused');
  fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  const first=fs.fstatSync(fd);
  if(!first.isFile()||(first.mode&0o777)!==0o600||first.size<1||first.size>8388608)throw Error('Private corpus file refused');
  const raw=Buffer.alloc(first.size);let at=0;
  while(at<raw.length){const n=fs.readSync(fd,raw,at,raw.length-at,null);if(n<1)throw Error('Private corpus incomplete');at+=n;}
  if(fs.readSync(fd,Buffer.alloc(1),0,1,null)!==0)throw Error('Private corpus grew');
  const last=fs.fstatSync(fd);
  if(first.dev!==last.dev||first.ino!==last.ino||first.size!==last.size||first.mtimeMs!==last.mtimeMs)throw Error('Private corpus changed');
  const crypto=require('node:crypto'),hash=crypto.createHash('sha256').update(raw).digest('hex');
  if(hash!=='8994e7cb4ab362e35dc875cf1bc0da1ea700e6bdf6b2e8db0da33057ce143eb0'||raw.length!==4778945)throw Error('Private corpus identity differs');
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  if(value.schemaVersion!=='current-fixture-bundle.v1'||value.scope!=='match-centre'||value.complete!==true||value.rows.length!==1650)throw Error('Private corpus shape differs');
  return {raw,value,hash};
 }finally{if(fd!==undefined)fs.closeSync(fd);}
}
if(process.env.NS_NEAR_KEY_PRIVATE_VECTOR==='1')test('private captured corpus preserves the complete actual app-store consumer',async()=>{
 try{
  const crypto=require('node:crypto'),hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
  const captured=readPrivateNearCorpus(),wire=require('../lib/near-fixture-keys');
  const now=Date.parse('2026-11-17T07:37:52.910Z');
  const sources=[...new Set(captured.value.rows.map(row=>row.source_id))];
  if(sources.length!==16)throw Error('Private source count differs');
  // Health is a synthetic, fixed common input. No historical health is claimed.
  const health=sources.map(source_id=>({source_id,revision:1,checked_at:new Date(now).toISOString(),next_due_at:new Date(now).toISOString(),discovery_report:{}}));
  const encoded=wire.encode(captured.value),encodedText=JSON.stringify(encoded),encodedBytes=Buffer.byteLength(encodedText);
  if(encodedBytes>4194304)throw Error('Encoded corpus exceeds original cap');
  const logical=wire.decode(encoded,{textBytes:encodedBytes});
  if(hash(logical)!==hash(captured.value)||JSON.stringify(logical)!==JSON.stringify(captured.value))throw Error('Private complete ordered logical output differs');
  function fakeRequest(text,counts){
   return (url,options)=>supabaseServiceRequest(url,{...options,environment,fetchImpl:async(actual,request)=>{
    if(request.method!=='POST')throw Error('Unexpected method');
    const isHealth=actual.endsWith('/rest/v1/rpc/nothingsports_read_fixture_source_health');
    if(!isHealth&&!actual.endsWith('/rest/v1/rpc/nothingsports_read_match_centre_fixture_bundle'))throw Error('Unexpected private vector route');
    counts.calls++;if(counts.calls>2)throw Error('Private vector extra request');
    return new Response(isHealth?JSON.stringify(health):text,{status:200});
   }});
  }
  // Fixed synthetic membership is ONLY a fake-request input, not a recreation of the captured caller.
  const membershipIds=['qa:private-corpus:one','qa:private-corpus:two'];
  async function storeRead(text,nearTransport){
   const counts={calls:0};
   const value=await createSnapshotStore({request:fakeRequest(text,counts),nearTransport}).read({scope:'match-centre',preserveIds:membershipIds,interactive:true,now});
   if(counts.calls!==2)throw Error('Private store request count differs');return value;
  }
  const baseline=await storeRead(captured.raw.toString('utf8'));
  const candidate=await storeRead(encodedText,wire.CANDIDATE);
  const baselineConsumerHash=hash(baseline),candidateConsumerHash=hash(candidate);
  if(baselineConsumerHash!==candidateConsumerHash)throw Error('Private full consumer output differs');
  let overcapStopped=false;
  try{require('./lib/near-app-adapter-qualification').validateTransport({timings:[
   {phase:'fetch-start'},{phase:'headers'},{phase:'text-start'},{phase:'text-ready',bytes:captured.raw.length},
   {phase:'parse-start'},{phase:'parse-ready',format:'json'},{phase:'complete',status:200,outcome:'success'},
  ]},4194304);}catch{overcapStopped=true;}
  if(!overcapStopped)throw Error('Original byte cap did not reject overcap corpus');
  const counts={calls:0};
  const measured=await measure({storeFactory:options=>{
   const store=createSnapshotStore(options);return {read:selection=>store.read({...selection,now})};
  },request:fakeRequest(encodedText,counts),environment,membershipIds,nearTransport:wire.CANDIDATE});
  if(counts.calls!==2||measured.calls.find(c=>c.kind==='bundle')?.bytes!==encodedBytes||measured.consumerParsedValueSha256!==baselineConsumerHash)throw Error('Private qualifier consumer differs');
  privateNearCorpusProof={state:'PRIVATE_VECTOR_PASSED_OFFLINE_NOT_LIVE',bodySha256:captured.hash,bodyBytes:captured.raw.length,
   encodedTextBytes:encodedBytes,decodedOrderedBundleSha256:hash(logical),baselineConsumerSha256:baselineConsumerHash,
   candidateConsumerSha256:candidateConsumerHash,rows:1650,sources:16,fixedClock:'2026-11-17T07:37:52.910Z',
   syntheticRequestMembership:true,baselineOvercapNotQualificationPass:true,overcapRefusal:true,networkCalls:0,managedQueries:0};
 }catch{throw Error('Private captured corpus vector failed; no private details emitted');}
});

(async()=>{for(const item of tests)await item.run();console.log(JSON.stringify({passed:true,checks:tests.length,scope:'In-memory actual HTTP parser/store plus bounded protocol and publisher-source controls',networkCalls:0,managedQueries:0,privateCorpusProof:privateNearCorpusProof}));})().catch(error=>{console.error(error);process.exitCode=1;});
