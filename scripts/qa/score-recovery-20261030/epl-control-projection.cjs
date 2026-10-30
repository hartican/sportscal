'use strict';
const fs=require('node:fs'),path=require('node:path'),p=JSON.parse(fs.readFileSync(process.env.NS_SCORE_GUARD_POLICY));
if(p.mode!=='owned-control'||p.sourceProtocol!=='epl'||p.root===p.sourceRoot)throw Error('EPL_OWNED_PROJECTION_ONLY');
const step=path.basename(process.argv[1]);
if(step==='publish-feed.js'){
 if(p.controlCase==='native-escape')require('node:net').connect(443,'outside.invalid');
 if(p.controlCase==='fetch-escape')global.fetch('https://outside.invalid');
 if(p.controlCase==='request-escape')require('node:https').request('https://outside.invalid');
 if(p.controlCase==='projection-get')require('node:https').get(require('./epl-contract.cjs').URLS[0],{headers:require('./epl-contract.cjs').HEADERS},()=>{});
 if(p.controlCase==='interrupted-rollback'){require(p.controlBoundary).dirtyInterruptedRollback();process.exit(1);}
 if(p.controlCase==='hang-child'){process.on('SIGTERM',()=>{});setInterval(()=>{},1000);}
}
if(step==='build-app-shell-runtime.js')for(const[file,index]of p.controlRuntimeOutputs.map((f,i)=>[f,i])){fs.writeFileSync(file,'owned EPL generated '+file+'\n');if(p.controlCase==='partial-runtime-failure'&&index===3)process.exit(1);}
if(step==='validate-current-card-coverage.js'&&p.controlCase==='late-failure')process.exit(1);
