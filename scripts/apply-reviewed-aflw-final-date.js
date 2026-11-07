#!/usr/bin/env node
'use strict';
// Publication step of update-cards; no provider request or independent updater.
const fs=require('node:fs'),path=require('node:path'),{project}=require('./lib/aflw-final-date');
function publish(root=path.resolve(__dirname,'..'),now=new Date()){
 const file=path.join(root,'data/canonical/afl-nrl-2026.json'),before=fs.readFileSync(file,'utf8'),result=project(JSON.parse(before),now),next=JSON.stringify(result.bundle,null,2)+'\n';
 const changed=next!==before;if(changed)fs.writeFileSync(file,next);return {changed,used:result.used,diagnostics:result.diagnostics,sourceRequests:0};
}
if(require.main===module)console.log(JSON.stringify(publish()));
module.exports={publish};
