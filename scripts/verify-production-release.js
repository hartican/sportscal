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
  const report={checkedAt:new Date().toISOString(),sha,deployment:v.summary(live),checks,unauthenticated:401};
  if(process.env.NS_DEPLOY_REPORT_DIR){fs.mkdirSync(process.env.NS_DEPLOY_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.NS_DEPLOY_REPORT_DIR,'production-verification.json'),JSON.stringify(report,null,2));}
  console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
