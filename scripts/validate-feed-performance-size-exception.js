#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
// Historical 606 authority/refusal evidence stays strict; it is not the active
// ordinary advisory policy introduced by the Owner on 2 November 2026.
const {payloadFingerprint,validateHistoricalCriticalSize606:validateCriticalSize}=require("./lib/feed-performance-size-budget");
const reviewed=require("./fixtures/reviewed-feed-size-exception-606.json");

function main(){
  let cases=0;
  const check=(name,run)=>{try{run();cases++;}catch(error){error.message=name+": "+error.message;throw error;}};
  const matching=()=>({
    current:{gzipBytes:431733,rawBytes:1689171,requestCount:7,assetHashes:structuredClone(reviewed.criticalFiles)},
    baseline:{gzipBytes:426115},baselineRef:"e70de9a53543b0894ceaf6dbdff60569d47a9c87",
    version:"606",toolchain:{node:"v24.22.1",zlib:"1.3.2.1-motley-285e94b"},maximumGrowthPercent:1.25,
  });
  check("fixed approval identity and bounds",()=>{
    assert.equal(reviewed.id,"reviewed-feed-size-606-2026-11-02");
    assert.equal(reviewed.approval.proposalSha256,"cb0b3df113713ee7ec00ea2755aba9ece46ab47ee9db7f2a98adc4018d8b90ca");
    assert.equal(reviewed.sourceCandidate,"a3a0f031e644c3b0a71d70fbe75f6f4ac081eacf");
    assert.equal(reviewed.originalFailedRun,"41362936666");
    assert.equal(reviewed.normalGrowthLimitPercent,1.25);
    assert.equal(reviewed.maximumGzipBytes,431733);
    assert.equal(reviewed.requestCount,7);
    assert.equal(reviewed.rawBytes,1689171);
    assert.equal(reviewed.baselineGzipBytes,426115);
    assert.equal(reviewed.baselineRef,matching().baselineRef);
    assert.equal(reviewed.appVersion,"606");
    assert.deepEqual(reviewed.toolchain,matching().toolchain);
    assert.equal(reviewed.criticalFiles.length,7);
    assert.equal(reviewed.payloadFingerprint,"7ef97b9cf4973683d703025f3099422b3eb255d1a21a7013cb99a2dff255a91c");
    assert.equal(payloadFingerprint(reviewed.criticalFiles),reviewed.payloadFingerprint);
  });
  check("exact approved payload, explicit exception status and unchanged inputs",()=>{
    const input=matching(),before=JSON.stringify(input),decision=validateCriticalSize(input);
    assert.equal(decision.status,"PASS_WITH_REVIEWED_SIZE_EXCEPTION");
    assert.equal(decision.exceptionId,reviewed.id);
    assert.equal(decision.normalCeilingBytes,431441);
    assert.equal(decision.excessBytes,292);
    assert(decision.growthPercent>1.25);
    assert.equal(JSON.stringify(input),before);
  });
  check("manifest order does not change the exact payload identity",()=>{
    const input=matching();input.current.assetHashes.reverse();
    assert.equal(validateCriticalSize(input).status,"PASS_WITH_REVIEWED_SIZE_EXCEPTION");
  });
  check("approved compressed ceiling is inclusive",()=>{
    const input=matching();input.current.gzipBytes--;
    assert.equal(validateCriticalSize(input).status,"PASS_WITH_REVIEWED_SIZE_EXCEPTION");
  });
  check("no exception means original exact payload stays red",()=>{
    assert.throws(()=>validateCriticalSize(matching(),null),/critical compressed bytes grew 1\.32% \(limit 1\.25%\).*no reviewed exception/);
  });
  for(const [bytes,pass] of [[100000,true],[101249,true],[101250,true],[101251,false]]){
    check("ordinary rule without exception: "+bytes,()=>{
      const input={current:{gzipBytes:bytes},baseline:{gzipBytes:100000},maximumGrowthPercent:1.25};
      if(pass)assert.equal(validateCriticalSize(input,null).status,"PASS_NORMAL_SIZE_BUDGET");
      else assert.throws(()=>validateCriticalSize(input,null),/limit 1\.25%/);
    });
  }
  check("changed payload below the normal limit uses no exception",()=>{
    const input=matching();input.current.gzipBytes=431441;input.current.assetHashes=[];input.version="607";
    assert.equal(validateCriticalSize(input).status,"PASS_NORMAL_SIZE_BUDGET");
  });
  check("one byte above the old ceiling still fails without exception",()=>{
    const input=matching();input.current.gzipBytes=431442;
    assert.throws(()=>validateCriticalSize(input,null),/no reviewed exception/);
  });
  const refuse=(name,change,reason)=>check(name,()=>{
    const input=matching();change(input);
    assert.throws(()=>validateCriticalSize(input),reason);
  });
  for(let index=0;index<reviewed.criticalFiles.length;index++){
    refuse("mutated asset "+reviewed.criticalFiles[index].file,input=>{
      const asset=input.current.assetHashes[index];asset.sha256=(asset.sha256[0]==="0"?"1":"0")+asset.sha256.slice(1);
    },/path\/hash manifest mismatch/);
  }
  refuse("wrong asset path",input=>{input.current.assetHashes[0].file="assets/js/replacement.js";},/path\/hash manifest mismatch/);
  refuse("missing asset",input=>{input.current.assetHashes.pop();},/request count mismatch/);
  refuse("extra asset",input=>{input.current.assetHashes.push({file:"extra.js",sha256:"0".repeat(64)});},/request count mismatch/);
  refuse("extra asset and request together",input=>{input.current.assetHashes.push({file:"extra.js",sha256:"0".repeat(64)});input.current.requestCount++;},/request count mismatch/);
  refuse("duplicate asset",input=>{input.current.assetHashes[0]=input.current.assetHashes[1];},/invalid critical path\/hash manifest/);
  refuse("missing manifest",input=>{delete input.current.assetHashes;},/invalid critical path\/hash manifest/);
  refuse("malformed hash",input=>{input.current.assetHashes[0].sha256="not-a-sha256";},/invalid critical path\/hash manifest/);
  refuse("extra request",input=>{input.current.requestCount=8;},/request count mismatch/);
  refuse("fewer requests cannot inherit an exact exception",input=>{input.current.requestCount=6;},/request count mismatch/);
  refuse("one byte above approved compressed ceiling",input=>{input.current.gzipBytes=431734;},/compressed byte ceiling exceeded/);
  refuse("larger overage",input=>{input.current.gzipBytes=500000;},/compressed byte ceiling exceeded/);
  refuse("changed raw total",input=>{input.current.rawBytes++;},/raw byte count mismatch/);
  refuse("wrong baseline ref",input=>{input.baselineRef="another-baseline";},/baseline or normal limit mismatch/);
  refuse("wrong baseline measurement",input=>{input.baseline.gzipBytes++;},/baseline or normal limit mismatch/);
  refuse("changed normal limit cannot inherit this exception",input=>{input.maximumGrowthPercent=1.26;},/baseline or normal limit mismatch/);
  refuse("wrong app version",input=>{input.version="607";},/app version mismatch/);
  refuse("missing app version",input=>{delete input.version;},/app version mismatch/);
  refuse("wrong Node",input=>{input.toolchain.node="v24.22.2";},/toolchain mismatch/);
  refuse("wrong zlib",input=>{input.toolchain.zlib="another-zlib";},/toolchain mismatch/);
  refuse("missing toolchain",input=>{delete input.toolchain;},/toolchain mismatch/);
  refuse("invalid gzip measurement",input=>{input.current.gzipBytes=NaN;},/invalid compressed-size measurement/);
  console.log("Reviewed 606 size exception: "+cases+" checks passed; exact identity/bounds, ordinary rule and refusal controls.");
  return cases;
}
if(require.main===module)main();
module.exports={main};
