#!/usr/bin/env node
"use strict";
const fs=require('node:fs');
const path=require('node:path');
const v=require('./lib/vercel-project');
const HOUR=3600000;
function candidates(rows,{now,liveId,rollbackId}){
  return rows.map(v.summary).map(d=>{
    const age=now-Number(d.createdAt),limit=(d.target==='production'?72:24)*HOUR;
    const reason=d.id===liveId?'live':d.id===rollbackId?'rollback':!['READY','ERROR','CANCELED'].includes(d.state)?'active-or-unknown':!Number.isFinite(age)||age<limit?'within-retention':null;
    return {...d,reason};
  });
}
async function main(){
  const apply=process.argv.includes('--apply');
  const outputIndex=process.argv.indexOf('--report');
  const output=outputIndex>=0?process.argv[outputIndex+1]:`/tmp/sportscal-cleanup-${Date.now()}.json`;
  if(!output)throw new Error('--report requires a path');
  const current=v.project(),live=current.targets?.production;
  if(current.id!==v.PROJECT||!live?.id||live.readyState!=='READY')throw new Error('Verified READY production target required');
  const rows=v.deployments();
  // A release records its previously verified live target. Bootstrap only via an explicit verified ID.
  const rollbackId=process.env.NS_ROLLBACK_ID||live.meta?.rollbackDeploymentId;
  if(!rollbackId)throw new Error('No verified rollback recorded. Set NS_ROLLBACK_ID after checking the previous production release.');
  const rollback=v.deployment(rollbackId);
  if(rollback.projectId!==v.PROJECT||rollback.readyState!=='READY'||rollback.target!=='production'||!v.sha(rollback))throw new Error('Rollback must be a READY production deployment with a recorded commit');
  const report={schemaVersion:'hobby-cleanup.v1',createdAt:new Date().toISOString(),projectId:v.PROJECT,apply,live:v.summary(live),rollback:v.summary(rollback),policy:{productionHours:72,otherHours:24},deployments:candidates(rows,{now:Date.now(),liveId:live.id,rollbackId}),deleted:[],excluded:[]};
  const save=()=>{fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');};
  // Save the complete inventory before changing external state.
  for(const d of report.deployments){
    d.aliases=v.aliases(d.id).map(a=>a.alias);
    if(d.aliases.length&&!d.reason)d.reason='aliased';
    if(report.deployments.indexOf(d)%10===0)console.log(`Inventoried ${report.deployments.indexOf(d)+1}/${report.deployments.length}`);
  }
  save();
  const eligible=report.deployments.filter(d=>!d.reason);
  if(apply){
    for(let start=0;start<eligible.length;start+=10){
      for(const candidate of eligible.slice(start,start+10)){
        const target=v.project().targets?.production;
        if(target?.id!==live.id)throw new Error('Production changed during cleanup; saved inventory is invalid.');
        const fresh=v.deployment(candidate.id);
        if(fresh.projectId!==v.PROJECT)throw new Error('Deployment belongs to a different project');
        if(v.aliases(candidate.id).length||!['READY','ERROR','CANCELED'].includes(fresh.readyState)){
          report.excluded.push({id:candidate.id,reason:'changed-since-inventory'});save();continue;
        }
        v.api(`/v13/deployments/${candidate.id}`,{method:'DELETE'});
        report.deleted.push(candidate.id);save();
      }
      if(v.project().targets?.production?.id!==live.id)throw new Error('Production alias changed after deletion batch');
      console.log(`Deleted ${report.deleted.length}/${eligible.length}; production unchanged`);
    }
  }
  report.finishedAt=new Date().toISOString();save();
  console.log(JSON.stringify({report:output,eligible:eligible.length,deleted:report.deleted.length,protected:report.deployments.length-eligible.length,live:live.id,rollback:rollbackId}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={candidates};
