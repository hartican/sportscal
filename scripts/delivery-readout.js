#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(execFile),REPO='hartican/sportscal',WORKFLOW='sportscal-production.yml';
const sourceReadout=require('./lib/canonical-source-readout');
const FAILED=new Set(['failure','timed_out','action_required','startup_failure']);
const seconds=(a,b)=>{const x=Date.parse(a),y=Date.parse(b);return Number.isFinite(x)&&Number.isFinite(y)&&y>=x?(y-x)/1000:null;};
function stats(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return {count:a.length,median:a.length?(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2:null,p90:a.length?a[Math.ceil(a.length*.9)-1]:null};}
function summarize(runs,jobs,{now,from,limit,sample}){
 if(!Array.isArray(runs)||new Set(runs.map(r=>r.databaseId)).size!==runs.length||runs.some(r=>!Number.isSafeInteger(r.databaseId)||!Number.isFinite(Date.parse(r.createdAt))))throw Error('Invalid or duplicated workflow run inventory');
 const inWindow=runs.filter(r=>Date.parse(r.createdAt)>=Date.parse(from)&&Date.parse(r.createdAt)<=Date.parse(now)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
 const observed=inWindow.slice(0,limit),counts={},bySha=new Map(),failures=[];
 for(const r of observed){counts[r.status==='completed'?r.conclusion||'unknown':r.status]=(counts[r.status==='completed'?r.conclusion||'unknown':r.status]||0)+1;
  const sha=/^Deploy ([a-f0-9]{40})(?: |$)/.exec(r.displayTitle||'')?.[1];
  if(sha){const group=bySha.get(sha)||[];group.push(r.databaseId);bySha.set(sha,group);}
  if(FAILED.has(r.conclusion))failures.push({id:r.databaseId,url:r.url,conclusion:r.conclusion});
 }
 const successfulJobs=[],steps=new Map(),jobEvidence=[];
 for(const row of jobs){
  const run=observed.find(r=>r.databaseId===row.runId);if(!run)throw Error('Job evidence does not belong to the observed window');
  if(row.error||!Array.isArray(row.jobs)){jobEvidence.push({runId:row.runId,error:row.error||'unavailable'});continue;}
  const matching=row.jobs.filter(j=>j.name==='deploy');
  if(matching.length!==1){jobEvidence.push({runId:row.runId,error:'expected_one_deploy_job'});continue;}
  const job=matching[0],duration=job.status==='completed'?seconds(job.started_at,job.completed_at):null;
  jobEvidence.push({runId:run.databaseId,url:run.url,conclusion:job.conclusion,seconds:duration,failedSteps:(job.steps||[]).filter(s=>FAILED.has(s.conclusion)).map(s=>s.name)});
  if(run.conclusion!=='success'||job.conclusion!=='success'||duration===null)continue;
  successfulJobs.push(duration);
  for(const step of job.steps||[]){if(step.conclusion!=='success')continue;const duration=seconds(step.started_at,step.completed_at);if(duration===null)continue;const values=steps.get(step.name)||[];values.push(duration);steps.set(step.name,values);}
 }
 return {schemaVersion:'delivery-readout.v1',repository:REPO,workflow:WORKFLOW,generatedAt:now,window:{from,through:now,complete:inWindow.length<=limit,limit},
  observedRuns:observed.length,counts,failures,
  runEvidence:observed.map(r=>({id:r.databaseId,url:r.url,createdAt:r.createdAt,status:r.status,conclusion:r.conclusion,attempt:Number.isInteger(r.attempt)?r.attempt:null,requestedSha:/^Deploy ([a-f0-9]{40})(?: |$)/.exec(r.displayTitle||'')?.[1]||null})),
  additionalAttemptsLowerBound:observed.reduce((n,r)=>n+(Number.isInteger(r.attempt)&&r.attempt>1?r.attempt-1:0),0),
  unknownRequestedShaCounts:observed.filter(r=>!/^Deploy [a-f0-9]{40}(?: |$)/.test(r.displayTitle||'')).length,
  unknownAttemptCounts:observed.filter(r=>!Number.isInteger(r.attempt)||r.attempt<1).length,
  repeatedRequestedShas:[...bySha].filter(([,ids])=>ids.length>1).map(([sha,runIds])=>({sha,runIds})),
  successfulJobSeconds:{...stats(successfulJobs),sampleRequested:sample,selection:'most recent successful runs; failure jobs reported separately'},
  successfulStepSeconds:[...steps].map(([name,values])=>({name,...stats(values)})).sort((a,b)=>b.median-a.median),jobEvidence,
  costs:{tokens:null,cash:null,reworkHours:null,reason:'Workflow metadata cannot establish model usage, invoices or engineering rework.'},
  limitations:['Success is workflow status, not independent production/device/quality certification.','Repeated requested SHAs can be intentional environment rebuilds; they are not automatically wasted work.','Job durations cover the sampled latest attempts only; earlier attempt time and unsampled runs are not billing totals.','Step medians are separate observations and must not be added as a measured run duration.'],
 };
}
async function gh(args){const {stdout}=await exec('gh',args,{maxBuffer:8*1024*1024,timeout:30000});return JSON.parse(stdout);}
async function collect({now=new Date(),days=7,limit=100,sample=10,read=gh}={}){
 if(!Number.isInteger(days)||days<1||days>31||!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(sample)||sample<1||sample>20)throw Error('Bounds: days 1–31, run limit 1–200, job sample 1–20');
 const from=new Date(now.getTime()-days*86400000).toISOString();
 const runs=await read(['run','list','--repo',REPO,'--workflow',WORKFLOW,'--created',`>=${from}`,'--limit',String(limit+1),'--json','databaseId,displayTitle,status,conclusion,createdAt,attempt,url']);
 if(!Array.isArray(runs))throw Error('Workflow list is unavailable');
 const selected=runs.filter(r=>Date.parse(r.createdAt)>=Date.parse(from)&&Date.parse(r.createdAt)<=now.getTime()).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,limit);
 // At most sample successful jobs plus sample failures; four requests at a time.
 const chosen=[...selected.filter(r=>r.conclusion==='success').slice(0,sample),...selected.filter(r=>FAILED.has(r.conclusion)).slice(0,sample)];
 const jobs=[];
 for(let offset=0;offset<chosen.length;offset+=4){await Promise.all(chosen.slice(offset,offset+4).map(async run=>{
  try{const result=await read(['api',`repos/${REPO}/actions/runs/${run.databaseId}/jobs?filter=latest&per_page=100`]);jobs.push({runId:run.databaseId,...(result?.total_count>100?{error:'job_list_truncated'}:{jobs:result?.jobs})});}
  catch{jobs.push({runId:run.databaseId,error:'job_request_failed'});}
 }));}
 const report=summarize(runs,jobs,{now:now.toISOString(),from,limit,sample});
 report.failureJobsSampleComplete=selected.filter(r=>FAILED.has(r.conclusion)).length<=sample;
 return report;
}
function markdown(r){
 const fmt=x=>x===null?'unknown':String(x),safe=s=>String(s).replace(/[\r\n|]/g,' ');
 return `# Delivery readout\n\nWindow: ${r.window.from} to ${r.window.through}. ${r.window.complete?'Complete run inventory within the configured bound.':'TRUNCATED inventory; totals are lower bounds.'}\n\nObserved workflow runs: ${r.observedRuns}. Outcomes: ${Object.entries(r.counts).map(([k,v])=>`${k} ${v}`).join(', ')||'none'}. Additional attempts recorded: ${r.additionalAttemptsLowerBound}; unknown attempt counts: ${r.unknownAttemptCounts}.\n\nLatest successful deploy jobs: ${r.successfulJobSeconds.count}; median ${fmt(r.successfulJobSeconds.median)} seconds, p90 ${fmt(r.successfulJobSeconds.p90)} seconds. This is a sample, not total billable runtime.\n\n## Slowest successful steps\n\n| Step | Samples | Median seconds | p90 seconds |\n|---|---:|---:|---:|\n${r.successfulStepSeconds.slice(0,6).map(s=>`| ${safe(s.name)} | ${s.count} | ${s.median} | ${s.p90} |`).join('\n')}\n\n## Exceptions\n\n${r.jobEvidence.filter(j=>j.error||FAILED.has(j.conclusion)).map(j=>`- Run ${j.runId}: ${safe(j.error||j.conclusion)}${j.failedSteps?.length?' — '+j.failedSteps.map(safe).join(', '):''}.`).join('\n')||'No sampled job exception.'}\n\nFailure job sampling complete: ${r.failureJobsSampleComplete}. Repeated requested SHAs: ${r.repeatedRequestedShas.length}; unrecognised request titles: ${r.unknownRequestedShaCounts}. Intentional rebuilds are possible. Token cost, cash cost and rework hours remain unknown.\n\n${r.limitations.map(s=>'- '+s).join('\n')}\n`;
}
async function main(){
 const args=process.argv.slice(2),options={};let output;
 while(args.length){const key=args.shift(),value=args.shift();if(key==='--output-dir'&&value)output=path.resolve(value);else if(['--days','--limit','--sample'].includes(key)&&value)options[key.slice(2)]=Number(value);else throw Error('Usage: delivery-readout.js [--days 7] [--limit 100] [--sample 10] [--output-dir PATH]');}
 const [report,sources]=await Promise.all([collect(options),sourceReadout.collect()]);
 report.canonicalSources=sources;
 if(output){fs.mkdirSync(output,{recursive:true});const stem=path.join(output,'delivery-readout-'+report.generatedAt.slice(0,10));fs.writeFileSync(stem+'.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync(stem+'.md',markdown(report)+ '\n'+sourceReadout.markdown(sources));}
 console.log(JSON.stringify({window:report.window,observedRuns:report.observedRuns,counts:report.counts,successfulJobSeconds:report.successfulJobSeconds,unavailableJobEvidence:report.jobEvidence.filter(j=>j.error).length,canonicalSources:{state:sources.state,runId:sources.run?.databaseId,error:sources.error,quick:sources.reports?.quick.state,sourceFailures:sources.reports?.quick.failureCount,hydrationGaps:sources.reports?.hydration.partialCount},costs:report.costs}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={stats,seconds,summarize,collect,markdown};
