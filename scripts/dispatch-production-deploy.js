#!/usr/bin/env node
'use strict';
const {execFileSync}=require('node:child_process'),crypto=require('node:crypto');
const REPO='hartican/sportscal',WORKFLOW='sportscal-production.yml';
function github(args,{timeout=45000}={}){return execFileSync('gh',[...args,'--repo',REPO],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout});}
const transient=error=>!(/HTTP 40[13]/.test(String(error.stderr||'')+' '+error.message))&&/HTTP 5\d\d|ECONNRESET|ETIMEDOUT|EAI_AGAIN|connection (?:reset|refused)|TLS handshake timeout|network.*(?:timeout|unreachable)|timed out/i.test(String(error.stderr||'')+' '+error.message);
async function dispatchAndTrack({sha,id=crypto.randomUUID(),gh=github,clock=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),log=console.log,rebuild=process.env.NS_FORCE_REDEPLOY==='1',selectedFeedProofSha=process.env.NS_SELECTED_FEED_PROOF_SHA||''}={}){
 if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Expected full release SHA');
 if(selectedFeedProofSha&&selectedFeedProofSha!==sha)throw Error('Selected Feed proof allocation must match the exact release SHA');
 const started=clock(),deadline=started+3600000;
 require('./lib/refresh-report').update({stage:'deployment',deployment:{sha,requestId:id}});
 const read=async (args,limit=deadline)=>{
  for(let attempt=0;;attempt++)try{if(clock()>=limit)throw Error('Deployment tracking timed out; inspect Actions before retrying.');const value=await gh(args,{timeout:Math.min(45000,limit-clock())});return typeof value==='string'?JSON.parse(value):value;}
  catch(error){if(!transient(error)||attempt===3)throw error;const delay=[2000,5000,10000][attempt];if(clock()+delay>=limit)throw Error('Deployment tracking timed out; inspect Actions before retrying.');await wait(delay);}
 };
 // A transport error on a mutation is an unknown outcome, never a retry cue.
 try{await gh(['workflow','run',WORKFLOW,'--ref','main','-f',`sha=${sha}`,'-f',`request_id=${id}`,'-f',`rebuild=${rebuild}`,...(selectedFeedProofSha?['-f',`selected_feed_proof_sha=${selectedFeedProofSha}`]:[])]);}
 catch(error){if(transient(error))throw Error(`Deployment dispatch outcome uncertain (${id}); inspect Actions before retrying.`);throw error;}
 log(`Queued serialized production deployment ${sha} (${id})`);
 let run;
 while(clock()<started+180000){
  const runs=await read(['run','list','--workflow',WORKFLOW,'--limit','50','--json','databaseId,displayTitle'],started+180000);
  const matches=runs.filter(candidate=>candidate.displayTitle===`Deploy ${sha} ${id}`);
  if(matches.length>1)throw Error(`Ambiguous deployment request ${id}; inspect Actions before retrying.`);
  if(matches.length){run=matches[0];break;}
  await wait(Math.min(15000,started+180000-clock()));
 }
 if(!run)throw Error(`Deployment run lookup timed out (${id}); inspect Actions before retrying.`);
 const url=`https://github.com/${REPO}/actions/runs/${run.databaseId}`;log(`Tracking deployment: ${url}`);
 require('./lib/refresh-report').update({deployment:{sha,requestId:id,runId:run.databaseId,url}});
 while(clock()<deadline){
  const state=await read(['run','view',String(run.databaseId),'--json','databaseId,status,conclusion,url,jobs']);
  if(state.status==='completed'){
   if(state.conclusion==='success'){log(`Production deployment succeeded: ${url}`);return state;}
   const jobs=(state.jobs||[]).filter(job=>['failure','cancelled','timed_out','action_required'].includes(job.conclusion));
   const details=jobs.map(job=>{const steps=(job.steps||[]).filter(step=>['failure','cancelled','timed_out'].includes(step.conclusion));return steps.length?steps.map(step=>`${job.name}: ${step.name} ${job.url||url}#step:${step.number}`).join('; '):`${job.name}: ${job.conclusion} ${job.url||url}`;}).join('; ');
   throw Error(`Production deployment ${state.conclusion}: ${details||url}`);
  }
  await wait(Math.min(15000,deadline-clock()));
 }
 throw Error(`Deployment tracking timed out: ${url}; inspect Actions before retrying.`);
}
async function main(){
 const sha=process.argv[2];if(!/^[a-f0-9]{40}$/.test(sha||''))throw Error('Expected full release SHA');
 try{execFileSync('git',['cat-file','-e',`${sha}^{commit}`],{stdio:'ignore'});}catch{throw Error('Release SHA is not a commit in this checkout; no deployment requested.');}
 return dispatchAndTrack({sha});
}
if(require.main===module)main().catch(error=>{require('./lib/refresh-report').update({stage:'deployment',blockingError:error.message});console.error(error.message);process.exitCode=1;});
module.exports={dispatchAndTrack};
