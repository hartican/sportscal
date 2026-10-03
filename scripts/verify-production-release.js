#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const v=require('./lib/vercel-project');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function main(){
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const live=v.project().targets?.production;
  if(live?.readyState!=='READY'||v.sha(live)!==sha)throw new Error('Production READY/SHA mismatch');
  const checks=[];
  for(const file of ['index.html','service-worker.js','data/feed-meta.json','data/events.json','app-version.json']){
    const response=await fetch(`https://nothingsport.vercel.app/${file==='index.html'?'':file}?verify=${sha}-${Date.now()}`);
    if(!response.ok)throw new Error(`Production ${file}: ${response.status}`);
    const digest=hash(Buffer.from(await response.arrayBuffer()));
    if(digest!==hash(fs.readFileSync(file)))throw new Error(`Production bytes mismatch: ${file}`);
    checks.push({file,sha256:digest});
  }
  const unauthenticated=await fetch('https://nothingsport.vercel.app/api/feed');
  if(unauthenticated.status!==401)throw new Error(`Unauthenticated feed must reject: ${unauthenticated.status}`);
  const internalSources=[];
  for(const file of ['marquee-candidates.v1.json','comms-sources.v1.json','editorial-maintenance-sources.v1.json']){
    const response=await fetch(`https://nothingsport.vercel.app/data/${file}?verify=${sha}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(response.status!==404||!response.headers.get('cache-control')?.includes('no-store'))throw new Error(`Owner source must be closed: ${file} (${response.status})`);
    const body=await response.json();if(body.code!=='internal_artifact_unavailable'||Object.keys(body).some(key=>!['error','code'].includes(key)))throw new Error(`Owner source rejection disclosed unexpected content: ${file}`);
    const encoded='%'+file.charCodeAt(0).toString(16)+file.slice(1);
    const encodedResponse=await fetch(`https://nothingsport.vercel.app/data/${encoded}?verify=${sha}`,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(encodedResponse.status!==404)throw new Error(`Encoded owner source must be absent: ${file} (${encodedResponse.status})`);
    await encodedResponse.body?.cancel();
    internalSources.push({file,status:response.status,code:body.code,cacheControl:response.headers.get('cache-control'),encodedStatus:encodedResponse.status});
  }
  const report={checkedAt:new Date().toISOString(),sha,deployment:v.summary(live),checks,unauthenticated:401,internalSources};
  if(process.env.NS_DEPLOY_REPORT_DIR){fs.mkdirSync(process.env.NS_DEPLOY_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.NS_DEPLOY_REPORT_DIR,'production-verification.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
