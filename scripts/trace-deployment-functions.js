#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const vercel=path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'vercel');
const {nodeFileTrace}=require(require.resolve('@vercel/nft',{paths:[vercel]}));
const {globSync}=require(require.resolve('glob',{paths:[vercel]}));
async function main(){
  const root=path.resolve(process.argv[2]||'.'),output=process.argv[3];
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const report={root,createdAt:new Date().toISOString(),functions:[]};
  for(const file of fs.readdirSync(path.join(root,'api')).filter(f=>f.endsWith('.js'))){
    const entry=`api/${file}`;
    const trace=await nodeFileTrace([path.join(root,entry)],{base:root,processCwd:root});
    const files=new Set(trace.fileList);
    const includes=config.functions?.[entry]?.includeFiles;
    if(includes)for(const file of globSync(includes,{cwd:root,nodir:true}))files.add(file);
    const inventory=[...files].sort().map(file=>({path:file,bytes:fs.statSync(path.join(root,file)).size}));
    report.functions.push({entry,bytes:inventory.reduce((n,f)=>n+f.bytes,0),files:inventory,warnings:[...trace.warnings].map(e=>e.message)});
  }
  if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.functions.map(({entry,bytes,files,warnings})=>({entry,bytes,files:files.length,warnings:warnings.length})),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
