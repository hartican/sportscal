#!/usr/bin/env node
'use strict';
// A publication step of the existing canonical owner, with no provider request.
const fs=require('node:fs'),path=require('node:path'),{project}=require('./lib/nations-finals-review');
function publish({root=path.resolve(__dirname,'..'),review,now=new Date()}={}){
  const file=path.join(root,'data/major-events.v1.json'),before=fs.readFileSync(file,'utf8');
  const result=project(JSON.parse(before),{review,now}),next=JSON.stringify(result.document,null,2)+'\n',changed=next!==before;
  if(changed)fs.writeFileSync(file,next);return {changed,used:result.used,diagnostics:result.diagnostics,sourceRequests:0};
}
if(require.main===module)try{console.log(JSON.stringify(publish()));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={publish};
