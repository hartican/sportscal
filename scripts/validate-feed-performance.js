#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const {execFileSync} = require("node:child_process");
const ROOT = path.resolve(__dirname,"..");
const BASELINE = "78e8eaed2342f551665e4237c3f0cb203d2ff08e";
function localScriptPaths(html){
  return Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g),m=>m[1])
    .filter(source=>!/^https?:/i.test(source)).map(source=>source.split(/[?#]/,1)[0]);
}
function readAtRef(ref,file){
  try { return execFileSync("git",["show",ref+":"+file],{cwd:ROOT,maxBuffer:10*1024*1024,stdio:["ignore","pipe","ignore"]}); }
  catch { return null; }
}
function criticalAssetMetrics({ref=null}={}){
  const read=file=>ref?readAtRef(ref,file):fs.readFileSync(path.join(ROOT,file));
  const html=read("index.html").toString("utf8");
  const scripts=localScriptPaths(html);
  // Both identity registries were already requested immediately on the old shell.
  // Count them in the baseline; the runtime now carries them in the same request.
  if(!scripts.includes("assets/js/app-shell-runtime.js")){
    ["config/national-team-identities.js","config/card-identities.js"].forEach(file=>{
      if(html.includes(file)) scripts.push(file);
    });
  }
  const styles=Array.from(html.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"/g),m=>m[1])
    .filter(source=>!/^https?:/i.test(source)).map(source=>source.split(/[?#]/,1)[0].replace(/^\//,""));
  const files=[...new Set(["index.html",...scripts,...styles])].map(file=>({file,buffer:read(file)})).filter(item=>item.buffer);
  return {requestCount:files.length,rawBytes:files.reduce((n,x)=>n+x.buffer.length,0),
    gzipBytes:files.reduce((n,x)=>n+zlib.gzipSync(x.buffer).length,0),files:files.map(x=>x.file)};
}
function median(values){
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function sourceFingerprint(){
  // Runtime measurements explicitly bypass SW. Bind the executed/rendered UI
  // bytes; the separate startup-budget/lifecycle suites validate the worker.
  const files=["index.html","assets/js/app-shell-runtime.js","assets/styles/nothingsport-foundation.css","config/athlete-profile-ui.js"];
  const hash=crypto.createHash("sha256");
  files.forEach(file=>hash.update(file).update(fs.readFileSync(path.join(ROOT,file))));
  return hash.digest("hex");
}
function validateRuntimeAudit(file){
  const audit=JSON.parse(fs.readFileSync(file,"utf8"));
  assert.equal(audit.schemaVersion,"ui-performance-audit.v1");
  assert.equal(audit.sourceFingerprint,sourceFingerprint(),"browser evidence must match the current tested UI bytes");
  for(const run of audit.runs){
    assert(run.samples.length>=3,run.name+" needs at least three fresh samples");
    assert(run.samples.every(s=>Number.isFinite(s.feedReadyMs)&&Number.isFinite(s.startupCompleteMs)));
    assert(run.samples.every(s=>s.horizontalOverflow===false),run.name+" must not overflow");
    assert(run.samples.every(s=>s.cumulativeLayoutShift<=0.1),run.name+" must meet the CLS budget");
    console.log(run.name+": feed "+median(run.samples.map(s=>s.feedReadyMs)).toFixed(0)+"ms; branded completion "+median(run.samples.map(s=>s.startupCompleteMs)).toFixed(0)+"ms.");
  }
}
function main(){
  assert.equal(fs.readFileSync(path.join(ROOT,"assets/js/app-shell-runtime.js"),"utf8"),require("./build-app-shell-runtime").build(),"runtime must match its source modules");
  const current=criticalAssetMetrics(),baseline=criticalAssetMetrics({ref:BASELINE});
  const growth=(current.gzipBytes/baseline.gzipBytes-1)*100;
  assert(growth<=0.5,"critical compressed bytes grew "+growth.toFixed(2)+"% (limit 0.5%)");
  assert(current.requestCount<=45,"critical asset requests must remain bounded");
  const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,"data/feed/manifest.json"),"utf8"));
  assert.equal(manifest.schemaVersion,"public-feed.v2");
  assert.equal(manifest.pageSize,20);
  assert(fs.statSync(path.join(ROOT,manifest.pages[0].path)).size<=250*1024);
  assert(html.includes("const INITIAL_CARD_IMAGE_BUDGET = 4"));
  assert(html.includes("loadDeferredStartupContext"));
  assert(html.includes("cumulativeLayoutShift")&&html.includes("feedLongTaskMaxMs"));
  assert(html.includes("cachedFeedReadyMs")&&html.includes("personalisedFeedReadyMs")&&html.includes("startupCompleteMs"));
  assert(html.includes("FUNNEL_DURATION_MS || 1000"),"retain the deliberate branded flight duration");
  const firstLoad=html.match(/async function refreshFeedOnFirstLoad\(\)\{([\s\S]*?)\n\}/)?.[1]||"";
  assert(firstLoad.includes("Promise.allSettled")&&firstLoad.includes("return initialFeed"));
  assert(!firstLoad.includes("nationalTeamIdentityReady")&&!firstLoad.includes("cardIdentitiesReady"));
  console.log("Current static budget: "+baseline.requestCount+" → "+current.requestCount+" critical requests; gzip "+growth.toFixed(2)+"%.");
  const runtimeIndex=process.argv.indexOf("--runtime-audit");
  if(runtimeIndex>=0) validateRuntimeAudit(path.resolve(process.argv[runtimeIndex+1]));
  else console.log("Browser timings are not inferred from archived reports. Pass --runtime-audit for exact-source measured evidence.");
}
if(require.main===module) main();
module.exports={criticalAssetMetrics,localScriptPaths,median,sourceFingerprint,validateRuntimeAudit};
