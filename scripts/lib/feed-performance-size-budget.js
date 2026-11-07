"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const reviewed606=require("../fixtures/reviewed-feed-size-exception-606.json");
const bufferPolicy=require("../fixtures/startup-size-buffer-policy-20261102.json");

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
function validateHistoricalCriticalSize606({current,baseline,baselineRef,version,toolchain,maximumGrowthPercent},reviewed=reviewed606){
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

function validateMeasurement(metrics,{sourceRef,candidate,version,toolchain}){
  assert(metrics&&typeof metrics==="object","missing critical-size measurement");
  for(const field of ["gzipBytes","rawBytes","requestCount"]){
    assert(Number.isSafeInteger(metrics[field])&&metrics[field]>0,"invalid critical-size measurement: "+field);
  }
  assert(metrics.requestCount<=bufferPolicy.maximumCriticalRequests,"critical request count exceeds the hard bound");
  assert(Array.isArray(metrics.assetHashes)&&metrics.assetHashes.length===metrics.requestCount,"critical manifest/request count mismatch");
  const fingerprint=payloadFingerprint(metrics.assetHashes);
  for(const asset of metrics.assetHashes){
    assert(asset.file&&!asset.file.startsWith("/")&&!/[\\?#\x00-\x1f]/.test(asset.file)
      &&!asset.file.split("/").some(part=>!part||part==="."||part===".."),"invalid critical asset path");
  }
  assert(Array.isArray(metrics.files)&&metrics.files.length===metrics.requestCount
    &&new Set(metrics.files).size===metrics.requestCount
    &&metrics.files.every(file=>metrics.assetHashes.some(asset=>asset.file===file)),"critical file/manifest mismatch");
  const binding=metrics.measurementBinding;
  assert(binding&&binding.schemaVersion==="critical-asset-measurement.v1","missing or invalid critical measurement binding");
  assert(binding.sourceRef===sourceRef&&binding.candidate===candidate,"critical measurement candidate mismatch");
  if(version!==undefined)assert.equal(binding.shellVersion,version,"critical measurement shell version mismatch");
  assert.deepEqual(binding.toolchain,toolchain,"critical measurement toolchain mismatch");
  for(const field of ["gzipBytes","rawBytes","requestCount"])assert.equal(binding[field],metrics[field],"corrupt critical measurement total: "+field);
  assert.equal(binding.payloadFingerprint,fingerprint,"critical measurement manifest/hash mismatch");
  return fingerprint;
}

function validateCriticalSize({current,baseline,baselineRef,version,toolchain,maximumGrowthPercent,candidate}){
  assert(baselineRef===bufferPolicy.baselineRef&&baseline?.gzipBytes===bufferPolicy.baselineGzipBytes
    &&maximumGrowthPercent===bufferPolicy.bufferPercent,"startup buffer baseline/policy mismatch");
  assert(typeof candidate==="string"&&/^[a-f0-9]{40}$/.test(candidate),"missing or invalid current candidate");
  assert(typeof version==="string"&&/^\d+$/.test(version)&&Number.isSafeInteger(Number(version)),"missing or invalid shell version");
  assert(toolchain&&/^v\d+\.\d+\.\d+$/.test(toolchain.node||"")
    &&typeof toolchain.zlib==="string"&&toolchain.zlib.length>0,"missing or invalid measurement toolchain");
  const fingerprint=validateMeasurement(current,{sourceRef:"WORKTREE",candidate,version,toolchain});
  validateMeasurement(baseline,{sourceRef:baselineRef,candidate:baselineRef,toolchain});
  const growthPercent=(current.gzipBytes/baseline.gzipBytes-1)*100;
  const normalCeilingBytes=Math.floor(baseline.gzipBytes*(1+maximumGrowthPercent/100));
  const excessBytes=Math.max(0,current.gzipBytes-normalCeilingBytes),deltaBytes=current.gzipBytes-baseline.gzipBytes;
  const over=growthPercent>maximumGrowthPercent;
  const notice=over?"NOTICE: startup gzip "+current.gzipBytes+" bytes; baseline "+baseline.gzipBytes
    +"; delta "+(deltaBytes>=0?"+":"")+deltaBytes+"; "+maximumGrowthPercent+"% advisory buffer "
    +normalCeilingBytes+"; excess +"+excessBytes+" bytes. Size alone does not halt release; all other gates remain required.":null;
  return {status:over?"NOTICE_STATIC_SIZE_BUFFER_EXCEEDED":"PASS_NORMAL_SIZE_BUDGET",severity:over?"notice":"pass",
    blocking:false,policyId:bufferPolicy.id,baselineGzipBytes:baseline.gzipBytes,currentGzipBytes:current.gzipBytes,
    deltaBytes,growthPercent,normalCeilingBytes,excessBytes,bufferPercent:maximumGrowthPercent,
    candidate,version,payloadFingerprint:fingerprint,notice};
}

module.exports={payloadFingerprint,validateCriticalSize,validateHistoricalCriticalSize606};
