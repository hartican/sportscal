#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const internalSources=['data/marquee-candidates.v1.json','data/comms-sources.v1.json','data/editorial-maintenance-sources.v1.json'];
const consumers={comms:internalSources,'notification-dispatch':internalSources.slice(0,2),participation:internalSources.slice(0,1)};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function files(root){
  const found=new Map();
  function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())walk(file);else found.set(path.relative(root,file).split(path.sep).join('/'),hash(fs.readFileSync(file)));}}
  walk(root);return found;
}
function seal({output,sourceRoot,reportPath}){
  output=path.resolve(output);sourceRoot=path.resolve(sourceRoot);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output,'config.json'))).version,3,'Expected Vercel Build Output API v3');
  const inventory=JSON.parse(fs.readFileSync(path.join(sourceRoot,'deployment-files.json'))),source=new Map(inventory.files.map(f=>[f.path,f]));
  const staticRoot=path.join(output,'static'),before=files(staticRoot),functionProof=[];
  // Validate every required copy before removing any static entry. The source
  // files and standalone function bundles remain intact, including symlinks.
  for(const [name,needed] of Object.entries(consumers)){
    const folder=path.join(output,'functions/api',name+'.func'),config=JSON.parse(fs.readFileSync(path.join(folder,'.vc-config.json')));
    assert.equal(config.handler,'api/'+name+'.js');assert.equal(config.runtime,'nodejs24.x');
    for(const file of needed){assert(source.has(file));const digest=hash(fs.readFileSync(path.join(folder,file)));assert.equal(digest,source.get(file).sha256,'Function lost exact server source: '+name+'/'+file);functionProof.push({function:name,file,sha256:digest});}
  }
  for(const file of internalSources){assert.equal(before.get(file),source.get(file)?.sha256,'Wrong built static source '+file);}
  for(const file of before.keys())assert(!file.split('/').some(part=>part.startsWith('.env')),'Environment file cannot be static');
  for(const file of internalSources)fs.unlinkSync(path.join(staticRoot,file));
  const after=files(staticRoot);
  assert.deepEqual([...before.keys()].filter(file=>!after.has(file)).sort(),[...internalSources].sort(),'Only the three raw sources may leave static output');
  for(const [file,digest] of after)assert.equal(digest,before.get(file),'Other built static bytes changed: '+file);
  for(const {function:name,file,sha256} of functionProof)assert.equal(hash(fs.readFileSync(path.join(output,'functions/api',name+'.func',file))),sha256,'Sealing changed a server source');
  const report={schemaVersion:'built-public-boundary.v1',checkedAt:new Date().toISOString(),sha:inventory.revision,removedStaticSources:internalSources,staticFilesBefore:before.size,staticFilesAfter:after.size,allOtherStaticBytesPreserved:true,functionSources:functionProof};
  if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module){try{console.log(JSON.stringify(seal({output:process.argv[2],sourceRoot:process.argv[3],reportPath:process.argv[4]})));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={internalSources,consumers,seal};
