'use strict';
const {execFileSync}=require('node:child_process');
const v=require('./vercel-project');
const REQUIRED_ALIASES=['nothingsport.vercel.app','nothingsports.vercel.app','sportscal-harticans-projects.vercel.app'];
function ensureProductionAliases(live,{list=v.aliases,assign=(url,domain)=>execFileSync('vercel',['alias','set',url,domain,'--scope',v.TEAM],{encoding:'utf8',timeout:60000,env:{...process.env,XDG_CACHE_HOME:process.env.XDG_CACHE_HOME||'/tmp'},stdio:['ignore','pipe','pipe']})}={}){
  const id=live?.id||live?.uid;
  if(live?.readyState!=='READY'||!/^dpl_[A-Za-z0-9]+$/.test(id||'')||!/^sportscal-[A-Za-z0-9-]+\.vercel\.app$/.test(live?.url||''))throw Error('Cannot bind aliases without a READY Sportscal deployment');
  let linked=list(id);
  const includes=domain=>linked.some(a=>(a.alias||a.domain)===domain);
  for(const domain of REQUIRED_ALIASES)if(!includes(domain))assign(live.url,domain);
  linked=list(id);
  for(const domain of REQUIRED_ALIASES)if(!includes(domain))throw Error('Production alias binding missing: '+domain);
  return REQUIRED_ALIASES.map(domain=>({domain,deploymentId:id}));
}
module.exports={ensureProductionAliases,REQUIRED_ALIASES};
