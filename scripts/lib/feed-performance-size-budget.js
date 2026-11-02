"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const reviewed606=require("../fixtures/reviewed-feed-size-exception-606.json");

function payloadFingerprint(assets){
  assert(Array.isArray(assets),"critical asset manifest is required");
  const files=new Set();
  const rows=assets.map(asset=>{
    assert(asset&&Object.keys(asset).sort().join(",")==="file,sha256"
      &&typeof asset.file==="string"&&typeof asset.sha256==="string"&&/^[a-f0-9]{64}$/.test(asset.sha256)
      &&!files.has(asset.file),"invalid or duplicate critical asset manifest entry");
    files.add(asset.file);
    return {file:asset.file,sha256:asset.sha256};
  }).sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0);
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

// The record is fixed in source. There is no CLI/environment exemption switch.
// Tests may pass null to exercise the original rule without this one exception.
function validateCriticalSize({current,baseline,baselineRef,version,toolchain,maximumGrowthPercent},reviewed=reviewed606){
  assert(Number.isSafeInteger(current.gzipBytes)&&current.gzipBytes>=0
    &&Number.isSafeInteger(baseline.gzipBytes)&&baseline.gzipBytes>0
    &&Number.isFinite(maximumGrowthPercent)&&maximumGrowthPercent>=0,"invalid compressed-size measurement");
  const growthPercent=(current.gzipBytes/baseline.gzipBytes-1)*100;
  const normalCeilingBytes=Math.floor(baseline.gzipBytes*(1+maximumGrowthPercent/100));
  const result={growthPercent,normalCeilingBytes,excessBytes:Math.max(0,current.gzipBytes-normalCeilingBytes)};
  if(growthPercent<=maximumGrowthPercent)return {...result,status:"PASS_NORMAL_SIZE_BUDGET"};

  const reasons=[];
  if(!reviewed)reasons.push("no reviewed exception");
  else{
    if(baselineRef!==reviewed.baselineRef||baseline.gzipBytes!==reviewed.baselineGzipBytes
      ||maximumGrowthPercent!==reviewed.normalGrowthLimitPercent)reasons.push("baseline or normal limit mismatch");
    if(version!==reviewed.appVersion)reasons.push("app version mismatch");
    if(toolchain?.node!==reviewed.toolchain.node||toolchain?.zlib!==reviewed.toolchain.zlib)reasons.push("Node/zlib toolchain mismatch");
    if(current.requestCount!==reviewed.requestCount||current.assetHashes?.length!==reviewed.requestCount)reasons.push("critical request count mismatch");
    if(current.rawBytes!==reviewed.rawBytes)reasons.push("critical raw byte count mismatch");
    if(current.gzipBytes>reviewed.maximumGzipBytes)reasons.push("reviewed compressed byte ceiling exceeded");
    try{
      if(payloadFingerprint(reviewed.criticalFiles)!==reviewed.payloadFingerprint
        ||payloadFingerprint(current.assetHashes)!==reviewed.payloadFingerprint)reasons.push("critical path/hash manifest mismatch");
    }catch{reasons.push("invalid critical path/hash manifest");}
  }
  assert.equal(reasons.length,0,"critical compressed bytes grew "+growthPercent.toFixed(2)
    +"% (limit "+maximumGrowthPercent+"%); reviewed size exception refused: "+reasons.join("; "));
  return {...result,status:"PASS_WITH_REVIEWED_SIZE_EXCEPTION",exceptionId:reviewed.id};
}

module.exports={payloadFingerprint,validateCriticalSize};
