#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2]||'index.html','utf8');
const source=html.match(/async function loadNothingscoreBatch\(ids, \{ rerender = true \} = \{\}\)\{[\s\S]*?\n\}/)?.[0];
assert(source,'actual browser batch loader');
let renders=0;
const errors=new Map(),context={NOTHINGSCORE:{},serverPersistence:{user:null},serverSyncClient:{nothingscoreRequest:async()=>({snapshots:[]})},nothingscoreLoadErrors:errors,mergeNothingscoreSnapshot:()=>false,nothingscoreQueueRender:()=>renders++,nothingscoreViewer:null};
vm.createContext(context);vm.runInContext(source,context);
(async()=>{
 await context.loadNothingscoreBatch(['missing']);
 assert(errors.has('missing'),'an omitted fixture must enter cooldown instead of requesting on every render');
 await context.loadNothingscoreBatch(['missing']);
 assert.equal(renders,1,'unchanged unavailable state must not keep rebuilding panels');
 console.log('Empty rating batches enter cooldown and paint unavailable state once.');
})().catch(error=>{console.error(error);process.exitCode=1;});
