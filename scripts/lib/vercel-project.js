"use strict";
const {execFileSync}=require('node:child_process');
const PROJECT='prj_NAMl47QVLbPUfsMmap59JIpchOPD';
const TEAM='team_7deI3EHsjeMpMdPiaLSQZBwW';
function api(endpoint,{method='GET',body}={}){
  const args=['api',`${endpoint}${endpoint.includes('?')?'&':'?'}teamId=${TEAM}`,'--method',method,'--raw'];
  if(body)args.push('--input','-');
  if(method==='DELETE')args.push('--dangerously-skip-permissions');
  const result=execFileSync('vercel',args,{input:body?JSON.stringify(body):undefined,encoding:'utf8',maxBuffer:32*1024*1024,timeout:60000,env:{...process.env,XDG_CACHE_HOME:process.env.XDG_CACHE_HOME||'/tmp'},stdio:['pipe','pipe','pipe']});
  return result.trim()?JSON.parse(result):{};
}
function project(){return api(`/v9/projects/${PROJECT}`);}
function deployment(id){if(!/^dpl_[a-zA-Z0-9]+$/.test(id))throw new Error('Invalid deployment ID');return api(`/v13/deployments/${id}`);}
function aliases(id){return api(`/v2/deployments/${id}/aliases`).aliases||[];}
function deployments(){
  const rows=[];let until;
  do{const page=api(`/v6/deployments?projectId=${PROJECT}&limit=100${until?`&until=${until}`:''}`);rows.push(...(page.deployments||[]));const next=page.pagination?.next;if(!next||next===until)break;until=next;}while(true);
  return rows;
}
function sha(d){return d?.meta?.releaseGitSha||d?.meta?.gitCommitSha||'';}
function summary(d){return{id:d.uid||d.id,createdAt:d.createdAt||d.created,url:d.url,state:d.readyState||d.state,target:d.target,sha:sha(d)};}
module.exports={PROJECT,TEAM,api,project,deployment,deployments,aliases,sha,summary};
