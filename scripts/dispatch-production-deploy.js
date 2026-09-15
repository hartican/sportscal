#!/usr/bin/env node
'use strict';
const {execFileSync}=require('node:child_process');
const crypto=require('node:crypto');
const sha=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(sha||''))throw new Error('Expected full release SHA');
const id=crypto.randomUUID();
const repo='hartican/sportscal',workflow='sportscal-production.yml';
function gh(args){return execFileSync('gh',[...args,'--repo',repo],{encoding:'utf8',stdio:['ignore','pipe','inherit']});}
async function main(){
  gh(['workflow','run',workflow,'--ref','main','-f',`sha=${sha}`,'-f',`request_id=${id}`,'-f',`rebuild=${process.env.NS_FORCE_REDEPLOY==='1'}`]);
  console.log(`Queued serialized production deployment ${sha} (${id})`);
  for(let attempt=0;attempt<36;attempt++){
    const runs=JSON.parse(gh(['run','list','--workflow',workflow,'--limit','50','--json','databaseId,displayTitle']));
    const run=runs.find(r=>r.displayTitle.includes(id));
    if(run){execFileSync('gh',['run','watch',String(run.databaseId),'--repo',repo,'--exit-status','--interval','10'],{stdio:'inherit'});return;}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error('Deployment was dispatched but run lookup timed out; inspect Actions before retrying.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
