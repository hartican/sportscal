#!/usr/bin/env node
'use strict';
const v=require('./lib/vercel-project');
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
function choose(rows,sha,live,force=false){
  if(force)return {action:'create'};
  if(v.sha(live)===sha&&live.readyState==='READY')return {action:'live',deployment:live};
  const same=rows.filter(d=>v.sha(d)===sha&&d.target==='production');
  const pending=same.find(d=>['BUILDING','QUEUED','INITIALIZING'].includes(d.readyState||d.state));
  if(pending)return {action:'wait',deployment:pending};
  const ready=same.find(d=>(d.readyState||d.state)==='READY');
  return ready?{action:'reuse',deployment:ready}:{action:'create'};
}
async function main(){
  const sha=process.argv[2];if(!/^[a-f0-9]{40}$/.test(sha||''))throw new Error('Expected a full SHA');
  if(process.env.NS_FORCE_REDEPLOY==='1')console.error('Explicit rebuild override: same-SHA deduplication bypassed.');
  for(let attempt=0;attempt<120;attempt++){
    const p=v.project();const decision=choose(v.deployments(),sha,p.targets?.production,process.env.NS_FORCE_REDEPLOY==='1');
    if(decision.action==='create'){console.log('create');return;}
    if(decision.action==='wait'){await new Promise(r=>setTimeout(r,10000));continue;}
    const d=decision.deployment;
    // Verify immutable release files before reusing or promoting an existing deployment.
    const url=`https://${d.url}`;
    for(const file of ['index.html','service-worker.js','data/feed-meta.json','data/events.json','app-version.json']){
      const expected=execFileSync('git',['show',`${sha}:${file}`],{maxBuffer:32*1024*1024});
      const actual=execFileSync('vercel',['curl',`/${file}`,'--deployment',url,'--scope','harticans-projects'],{maxBuffer:32*1024*1024,timeout:60000,env:{...process.env,XDG_CACHE_HOME:'/tmp'},stdio:['ignore','pipe','pipe']});
      const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
      if(hash(expected)!==hash(actual))throw new Error(`Reusable deployment does not match ${sha}: ${file}`);
    }
    if(decision.action==='reuse')execFileSync('vercel',['promote',url,'--yes','--scope','harticans-projects'],{stdio:['ignore',2,2],env:{...process.env,XDG_CACHE_HOME:'/tmp'}});
    if(v.sha(v.project().targets?.production)!==sha)throw new Error('Production SHA did not match requested release');
    console.log('reused');return;
  }
  throw new Error('Equivalent deployment is still building; no duplicate created.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={choose};
