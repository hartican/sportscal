#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const v=require('./lib/vercel-project');
async function main(){
  if(process.env.VERCEL_PROJECT_ID!==v.PROJECT||process.env.VERCEL_ORG_ID!==v.TEAM)throw new Error('GitHub secrets do not identify Sportscal');
  fs.mkdirSync('.vercel',{recursive:true});fs.writeFileSync('.vercel/project.json',JSON.stringify({projectId:v.PROJECT,orgId:v.TEAM,projectName:'sportscal'}));
  const p=v.project(),live=p.targets?.production;
  if(live?.readyState!=='READY'||!v.sha(live))throw new Error('No verified current production release');
  const version=await fetch('https://nothingsport.vercel.app/app-version.json',{cache:'no-store'});
  if(!version.ok||!(await version.json()).version)throw new Error('Current production failed health check');
  const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const rollback=v.sha(live)===sha?(live.meta?.rollbackDeploymentId||live.id):live.id;
  fs.appendFileSync(process.env.GITHUB_ENV,`NS_ROLLBACK_ID=${rollback}\n`);
  console.log(JSON.stringify({current:v.summary(live),rollback}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
