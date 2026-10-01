#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function ensureGeneratedShellVersion({root=path.resolve(__dirname,'..')}={}){
 const prior=file=>execFileSync('git',['show','HEAD:'+file],{cwd:root,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
 const runtime='assets/js/app-shell-runtime.js';
 if(fs.readFileSync(path.join(root,runtime)).equals(prior(runtime)))return {changed:false,reason:'runtime unchanged'};
 const files=['app-version.json','index.html','service-worker.js'];
 const originals=new Map(files.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]));
 const version=JSON.parse(originals.get(files[0])).version,baseline=JSON.parse(prior(files[0]).toString()).version;
 if(!/^\d+$/.test(version)||!/^\d+$/.test(baseline)||!Number.isSafeInteger(Number(version))||Number(version)<Number(baseline))throw Error('Invalid or backwards generated-shell version');
 const replace=(source,expression,value,expected)=>{
  const matches=source.match(expression)||[];
  if(matches.length!==expected)throw Error('Generated-shell URLs/versions are inconsistent; no files changed');
  return source.replace(expression,value);
 };
 const next=Number(version)>Number(baseline)?version:String(Number(version)+1);
 let html=replace(originals.get('index.html'),new RegExp('name="app-shell-version" content="'+version+'"','g'),'name="app-shell-version" content="'+next+'"',1);
 html=replace(html,new RegExp('assets/js/app-shell-runtime\\.js\\?v='+version+'(?=")','g'),'assets/js/app-shell-runtime.js?v='+next,2);
 let worker=replace(originals.get('service-worker.js'),new RegExp('const CACHE_NAME = "nothingsport-shell-v'+version+'";','g'),'const CACHE_NAME = "nothingsport-shell-v'+next+'";',1);
 worker=replace(worker,new RegExp('const SHELL_VERSION = "'+version+'";','g'),'const SHELL_VERSION = "'+next+'";',1);
 worker=replace(worker,new RegExp('/assets/js/app-shell-runtime\\.js\\?v='+version+'(?=")','g'),'/assets/js/app-shell-runtime.js?v='+next,1);
 if(next===version)return {changed:false,reason:'already versioned',version};
 if(files.some(file=>originals.get(file)!==prior(file).toString()))throw Error('Pending shell edits require a separately versioned release; no files changed');
 const outputs=new Map([['app-version.json',JSON.stringify({...JSON.parse(originals.get(files[0])),version:next})+'\n'],['index.html',html],['service-worker.js',worker]]);
 for(const [file,content] of outputs)fs.writeFileSync(path.join(root,file),content);
 return {changed:true,previousVersion:version,version:next,reason:'generated runtime changed'};
}
if(require.main===module){try{console.log(JSON.stringify(ensureGeneratedShellVersion()));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={ensureGeneratedShellVersion};
