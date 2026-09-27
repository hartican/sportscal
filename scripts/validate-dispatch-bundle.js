#!/usr/bin/env node
'use strict';
// Verify the function's traced files, not merely the source upload inventory.
const assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const vercel=path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'vercel');
const {nodeFileTrace}=require(require.resolve('@vercel/nft',{paths:[vercel]}));
const {globSync}=require(require.resolve('glob',{paths:[vercel]}));
(async()=>{
 const entry='api/notification-dispatch.js';
 const trace=await nodeFileTrace([entry],{base:process.cwd()});
 const files=new Set(trace.fileList);
 const include=require('../vercel.json').functions[entry]?.includeFiles;
 if(include)for(const file of globSync(include,{nodir:true}))files.add(file);
 const codes=require('../data/code-inspector/manifest.json').codes;
 for(const code of codes)assert(files.has(code.chunkPath),`Dispatcher bundle missing ${code.chunkPath}`);
 const event=require('../lib/nothingscore-server').eventFor('fixture:cricket:espn:1525658');
 assert(event,'Queued catalogue-only fixture must resolve');
 console.log(`Dispatcher bundle includes all ${codes.length} competition chunks; catalogue-only fixture resolves.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
