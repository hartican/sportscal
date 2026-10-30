'use strict';
const fs=require('node:fs'),path=require('node:path');
const p=JSON.parse(fs.readFileSync(process.env.NS_SCORE_GUARD_POLICY,'utf8'));
if(p.mode!=='owned-control'||!p.controlBoundary||p.root===p.sourceRoot)throw Error('CONTROL_PROFILE_REQUIRED');
const step=path.basename(process.argv[1]),outputs=p.controlRuntimeOutputs;
if(p.controlCase==='interrupted-rollback'&&step==='publish-feed.js'){require(p.controlBoundary).dirtyInterruptedRollback();process.exit(1);}
if(p.controlCase==='hang-child'&&step==='publish-feed.js'){process.on('SIGTERM',()=>{});setInterval(()=>{},1000);}
else if(p.controlCase==='outside-write'&&step==='publish-feed.js')fs.writeFileSync(p.controlOutside,'forbidden');
else if(p.controlCase==='native-network'&&step==='publish-feed.js')require('node:net').connect(443,'outside.invalid');
else{
 if(p.controlCase==='late-capture-corruption'&&step==='build-follow-directories.js'&&process.argv.includes('--check'))require(p.controlBoundary).corruptCapture();
 if(step==='publish-feed.js')fs.writeFileSync('data/events.js','controlled derived Feed\n');
 if(step==='build-app-shell-runtime.js')for(const [i,file]of outputs.entries()){
  fs.writeFileSync(file,'controlled generated '+file+'\n');
  if(p.controlCase==='partial-runtime-failure'&&i===3)process.exit(1);
 }
 if(p.controlCase==='late-failure'&&step==='validate-current-card-coverage.js')process.exit(1);
 if(['readback-denied-failure','report-denied-failure'].includes(p.controlCase)&&step==='validate-current-card-coverage.js')process.exit(1);
}
