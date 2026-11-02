"use strict";
const assert=require("node:assert/strict");
const {payloadFingerprint,validateCriticalSize,validateHistoricalCriticalSize606}=require("./lib/feed-performance-size-budget");
const policy=require("./fixtures/startup-size-buffer-policy-20261102.json");
function main(){
  let cases=0;
  const check=(name,run)=>{try{run();cases++;}catch(error){error.message=name+": "+error.message;throw error;}};
  // Synthetic closed receipts test pure policy; production binds real Git and buffers.
  const candidate="1".repeat(40),toolchain={node:"v24.22.1",zlib:"1.3.2.1-motley-285e94b"};
  function metrics(gzipBytes,sourceRef,commit,version="607"){
    const files=["index.html",...Array.from({length:6},(_,n)=>"assets/reference-"+n+".js")];
    const assetHashes=files.map((file,n)=>({file,sha256:String(n+1).repeat(64)}));
    const value={gzipBytes,rawBytes:1689171,requestCount:7,files,assetHashes};
    value.measurementBinding={schemaVersion:"critical-asset-measurement.v1",sourceRef,candidate:commit,
      shellVersion:version,gzipBytes,rawBytes:value.rawBytes,requestCount:7,
      payloadFingerprint:payloadFingerprint(assetHashes),toolchain:{...toolchain}};
    return value;
  }
  const input=(bytes=431735)=>({current:metrics(bytes,"WORKTREE",candidate),
    baseline:metrics(426115,policy.baselineRef,policy.baselineRef,"100"),baselineRef:policy.baselineRef,
    version:"607",candidate,toolchain:{...toolchain},maximumGrowthPercent:1.25});
  check("new Owner authority and unchanged reference",()=>{
    assert.equal(policy.approval.question,"Sentinel_8032b3273f788191adeaa82c90a09c3f");
    assert.equal(policy.approval.answer,"Sentinel_dd18922936108191a0ef119e46337c1b");
    assert.equal(policy.approval.ownerWords,"Of course. And change the rule from limit to buffer that produces a notice but not a halt");
    assert.equal(policy.baselineGzipBytes,426115);assert.equal(policy.bufferPercent,1.25);assert.equal(policy.maximumCriticalRequests,45);
  });
  for(const [bytes,status]of [[431440,"PASS_NORMAL_SIZE_BUDGET"],[431441,"PASS_NORMAL_SIZE_BUDGET"],[431442,"NOTICE_STATIC_SIZE_BUFFER_EXCEEDED"],[431735,"NOTICE_STATIC_SIZE_BUFFER_EXCEEDED"],[500000,"NOTICE_STATIC_SIZE_BUFFER_EXCEEDED"]]){
    check("valid boundary "+bytes,()=>{const value=input(bytes),before=JSON.stringify(value),result=validateCriticalSize(value);
      assert.equal(result.status,status);assert.equal(result.blocking,false);assert.equal(result.normalCeilingBytes,431441);
      assert.equal(JSON.stringify(value),before);assert.equal(Boolean(result.notice),status.startsWith("NOTICE"));});
  }
  check("607 totals produce a visible notice, not a disguised pass",()=>{
    const result=validateCriticalSize(input());assert.equal(result.severity,"notice");assert.equal(result.deltaBytes,5620);assert.equal(result.excessBytes,294);
    for(const text of ["NOTICE","426115","431735","5620","1.25%","431441","294","all other gates"])assert(result.notice.includes(text));
    assert.equal(Object.hasOwn(result,"exceptionId"),false);
  });
  check("historical refusal cannot block the new valid advisory path",()=>{
    const value=input();assert.throws(()=>validateHistoricalCriticalSize606(value),/reviewed size exception refused/);
    assert.equal(validateCriticalSize(value).status,"NOTICE_STATIC_SIZE_BUFFER_EXCEEDED");
  });
  check("manifest ordering preserves payload identity",()=>{const value=input();value.current.assetHashes.reverse();assert.equal(validateCriticalSize(value).status,"NOTICE_STATIC_SIZE_BUFFER_EXCEEDED");});
  const mutations=[
    value=>{delete value.current;},value=>{delete value.current.measurementBinding;},
    value=>{value.current.gzipBytes=NaN;},value=>{value.current.gzipBytes=Infinity;},value=>{value.current.gzipBytes=0;},
    value=>{value.current.gzipBytes=-1;},value=>{value.current.rawBytes=0;},value=>{delete value.current.rawBytes;},
    value=>{value.current.requestCount=0;},value=>{value.current.requestCount=46;},
    value=>{delete value.current.assetHashes;},value=>{value.current.assetHashes.pop();},
    value=>{value.current.assetHashes[0]=value.current.assetHashes[1];},
    value=>{value.current.assetHashes[0].sha256="bad";},value=>{value.current.assetHashes[0].sha256="a".repeat(64);},
    value=>{value.current.assetHashes[0].file="../outside.js";},value=>{value.current.assetHashes[0].file="/absolute.js";},
    value=>{value.current.assetHashes[0].file="assets/wrong.js";},value=>{value.current.files[0]="wrong.html";},
    value=>{value.current.measurementBinding.gzipBytes++;},value=>{value.current.measurementBinding.rawBytes++;},
    value=>{value.current.measurementBinding.requestCount++;},value=>{value.current.measurementBinding.sourceRef="another-candidate";},
    value=>{value.current.measurementBinding.candidate="2".repeat(40);},value=>{value.candidate="3".repeat(40);},
    value=>{delete value.candidate;},value=>{value.version="608";},value=>{delete value.version;},
    value=>{value.toolchain.node="v24.22.2";},value=>{value.toolchain.zlib="different";},value=>{delete value.toolchain;},
    value=>{value.baseline.gzipBytes++;},value=>{value.baselineRef="wrong-baseline";},value=>{value.maximumGrowthPercent=2;},
    value=>{value.baseline.measurementBinding.payloadFingerprint="0".repeat(64);},
  ];
  for(const [index,mutate]of mutations.entries())check("hard refusal "+index,()=>{const value=input();mutate(value);assert.throws(()=>validateCriticalSize(value));});
  check("corruption stays hard below the buffer",()=>{const value=input(431440);value.current.assetHashes=[];assert.throws(()=>validateCriticalSize(value));});
  console.log("Startup advisory buffer: "+cases+" checks passed; valid overages NOTICE, malformed/candidate/manifest/request/policy failures stay hard.");
  return cases;
}
if(require.main===module)main();
module.exports={main};
