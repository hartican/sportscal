#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {aliases,codesForReviewedFixtures}=require('./lib/reviewed-fixture-projection-codes');
const selected={id:'reviewed-regression-fixture',canonicalEventId:'event:nbl:regression',key:'nba',sportDomainId:'sport:basketball',sourceEventIds:['provider:regression']};
const manifest={codes:['basketball','nbl','tennis'].map(slug=>({slug,chunkPath:'data/code-inspector/'+slug+'.json'}))};
const chunks={
  'data/code-inspector/basketball.json':{fixtures:[{id:selected.id}]},
  'data/code-inspector/nbl.json':{fixtures:[{id:selected.canonicalEventId,sourceEventIds:[selected.id]}]},
  'data/code-inspector/tennis.json':{fixtures:[{id:'unrelated',name:'Same display name',date:'2030-01-01'}]},
};
const readChunk=file=>chunks[file];
assert.deepEqual(codesForReviewedFixtures([selected],[selected.id],manifest,readChunk),['basketball','nbl']);
assert.deepEqual(codesForReviewedFixtures([selected],['provider:regression'],manifest,readChunk),['basketball','nbl'],'an explicit provider alias reaches the same child');
assert.throws(()=>codesForReviewedFixtures([selected],['missing'],manifest,readChunk),/Unknown or ambiguous/);
assert.throws(()=>codesForReviewedFixtures([selected,{...selected,id:'different'}],[selected.canonicalEventId],manifest,readChunk),/Unknown or ambiguous/,'ambiguous aliases fail before projection');

// Rebuilding an entire aggregate also re-evaluates its unselected fixtures.
// Their child copies must share that rebuild, including transitive aliases.
const footballSelected={id:'reviewed-epl',key:'football'};
const overlapManifest={codes:['football','champions-league','ucl-child','tennis'].map(slug=>({slug,chunkPath:'data/code-inspector/'+slug+'.json'}))};
const overlapChunks={
  'data/code-inspector/football.json':{fixtures:[footballSelected,{id:'unselected-ucl'}]},
  'data/code-inspector/champions-league.json':{fixtures:[{id:'unselected-ucl'},{id:'child-ucl',sourceEventIds:['provider:child-ucl']}]},
  'data/code-inspector/ucl-child.json':{fixtures:[{id:'provider:child-ucl'}]},
  'data/code-inspector/tennis.json':{fixtures:[{id:'unrelated',name:'Same display name'}]},
};
const overlapCodes=['football','champions-league','ucl-child'];
assert.deepEqual(codesForReviewedFixtures([footballSelected],[footballSelected.id],overlapManifest,file=>overlapChunks[file]),overlapCodes,'whole-chunk rebuild includes every overlapping child but no unrelated sport');

// Run the real canonical entrypoint with constructed retained records. Dispatch
// is intercepted, so this checks code selection without providers or publication.
const root=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ns-reviewed-child-projection-'));
try{
  const preload=path.join(temporary,'preload.cjs');
  const documents={'data/events.json':{events:[selected]},'data/code-inspector/manifest.json':manifest,...chunks};
  fs.writeFileSync(preload,"const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),read=fs.readFileSync,documents="+JSON.stringify(documents)+",seen=[];fs.readFileSync=function(file,...args){const name=typeof file==='string'?path.relative(process.cwd(),path.resolve(file)):'';if(Object.hasOwn(documents,name))return JSON.stringify(documents[name]);return read.call(this,file,...args);};cp.spawnSync=(command,args)=>{seen.push(args);return {status:0,stdout:'',stderr:''};};globalThis.fetch=()=>{throw Error('No provider reads in projection regression');};process.on('exit',()=>console.log('REVIEWED_CHILD_STEPS '+JSON.stringify(seen)));\n");
  const result=spawnSync(process.execPath,['--require',preload,path.join(root,'scripts/update-cards.js'),'-p','--local-only','--reviewed-fixtures','--ids='+selected.id],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH,LANG:process.env.LANG,FOOTBALL_DATA_RUN_DIR:path.join(temporary,'diagnostics')}});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const trace=result.stdout.match(/REVIEWED_CHILD_STEPS (\[[^\n]+\])/);assert(trace,'canonical dispatch trace required');
  const steps=JSON.parse(trace[1]);
  assert.deepEqual(steps.find(step=>step[0]==='scripts/build-code-inspector.js'),['scripts/build-code-inspector.js','--codes=basketball,nbl']);
  assert.equal(steps.filter(step=>step[0]==='scripts/build-code-inspector.js').length,1,'one existing builder owns both projections');
  assert(!steps.some(step=>/refresh-|redeploy|snapshot-active-follows/.test(step[0])),'scoped repair adds no ingestion, private follows or release');

  const overlapDocuments={'data/events.json':{events:[footballSelected]},'data/code-inspector/manifest.json':overlapManifest,...overlapChunks};
  fs.writeFileSync(preload,fs.readFileSync(preload,'utf8').replace(JSON.stringify(documents),JSON.stringify(overlapDocuments)));
  const overlapResult=spawnSync(process.execPath,['--require',preload,path.join(root,'scripts/update-cards.js'),'-p','--local-only','--reviewed-fixtures','--ids='+footballSelected.id],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH,LANG:process.env.LANG,FOOTBALL_DATA_RUN_DIR:path.join(temporary,'overlap-diagnostics')}});
  assert.equal(overlapResult.status,0,overlapResult.stderr||overlapResult.stdout);
  const overlapSteps=JSON.parse(overlapResult.stdout.match(/REVIEWED_CHILD_STEPS (\[[^\n]+\])/)[1]);
  assert.deepEqual(overlapSteps.find(step=>step[0]==='scripts/build-code-inspector.js'),['scripts/build-code-inspector.js','--codes='+overlapCodes.join(',')],'actual canonical dispatch binds all overlapping projections');
  assert.equal(overlapSteps.filter(step=>step[0]==='scripts/build-code-inspector.js').length,1);
  assert(!overlapSteps.some(step=>/refresh-|redeploy|snapshot-active-follows/.test(step[0])),'overlap closure adds no ingestion, private follows or release');
}finally{fs.rmSync(temporary,{recursive:true,force:true});}

// Use the unchanged strict capsule validator on the actual retained NBL finals.
const api=require('./lib/accepted-result-projection'),{normalizeFixture}=require('./build-code-inspector');
const evidence=require('../data/canonical/current-card-evidence-2026.json'),feed=require('../data/events.json');
const rows=evidence.resultOverrides.filter(row=>api.isAcceptedResult(row)&&row.id.startsWith('evt_nbl_2026_27_'));
assert.equal(rows.length,2,'both retained NBL result capsules must be covered');
const accepted=evidence.resultOverrides.filter(api.isAcceptedResult);
assert.equal(accepted.length,17,'every retained accepted result must be covered');
for(const row of accepted){
  const tokens=new Set(row.acceptedResultProjection.aliases);
  const records=feed.events.filter(event=>aliases(event).some(id=>tokens.has(id)));
  assert.equal(records.length,1,'an accepted result has one exact published fixture');
  const projected=normalizeFixture(records[0],records[0].sportDomainId);
  api.validateAcceptedProjection(projected,row);
  for(const key of ['scoreFactObservedAt','statusFactObservedAt','fixtureObservationSchema']){
    if(!Object.hasOwn(row,key))continue;
    assert.equal(projected[key],row[key],'result projection preserves literal '+key);
    const missing={...projected};delete missing[key];
    assert.throws(()=>api.validateAcceptedProjection(missing,row),'a dropped observation field must fail strict validation: '+key);
  }
}
for(const row of rows){
  const record=feed.events.find(event=>event.id===row.id);assert(record,'retained NBL public fixture required');
  const projected=normalizeFixture(record,'sport:nbl');
  api.validateAcceptedProjection(projected,row);
  assert.equal(projected.statusSourceName,row.statusSourceName);
  assert.equal(projected.statusSourceType,row.statusSourceType);
  assert.throws(()=>api.validateAcceptedProjection({...projected,statusSourceName:'Unrelated publisher'},row),'missing source names cannot be hidden behind unchanged receipts');
  assert.throws(()=>api.validateAcceptedProjection({...projected,statusSourceType:'reputable'},row),'source classes must not drift');
}
const versionRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ns-result-feed-version-'));
try{
  fs.mkdirSync(path.join(versionRoot,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(versionRoot,'data/canonical'),{recursive:true});
  fs.copyFileSync(path.join(__dirname,'sync-official-card-results.js'),path.join(versionRoot,'scripts/sync-official-card-results.js'));
  for(const [target,name]of [[path.join(root,'lib'),'lib'],[path.join(root,'config'),'config'],[path.join(__dirname,'lib'),'scripts/lib']])fs.symlinkSync(target,path.join(versionRoot,name),'dir');
  const retained=structuredClone(feed.events.find(event=>event.id===rows[0].id));
  for(const key of api.fields)delete retained[key];
  retained.status='scheduled';
  const fixture={version:'regression-previous-feed',publishedAt:'2026-01-01T00:00:00.000Z',events:[retained]},input=path.join(versionRoot,'events.json');
  fs.writeFileSync(input,JSON.stringify(fixture,null,2)+'\n');
  fs.writeFileSync(path.join(versionRoot,'data/canonical/official-card-results-2026.json'),JSON.stringify({feedVersion:'regression-result-batch-v2',checkedAt:rows[0].sourceCheckedAt,results:[rows[0]]}));
  const run=()=>{const result=spawnSync(process.execPath,[path.join(versionRoot,'scripts/sync-official-card-results.js'),input,input],{cwd:versionRoot,encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);};
  run();
  const published=JSON.parse(fs.readFileSync(input));
  assert.equal(published.version,'regression-result-batch-v2','an actual result batch advances the public Feed revision');
  assert.notEqual(published.version,fixture.version,'clients must observe the changed result revision');
  assert.equal(published.publishedAt,fixture.publishedAt,'result observations cannot backdate the assembled Feed');
  api.validateAcceptedProjection(published.events[0],rows[0]);
  const before=fs.readFileSync(input);run();
  assert(fs.readFileSync(input).equals(before),'an unchanged official-result replay retains exact bytes and revision');
}finally{fs.rmSync(versionRoot,{recursive:true,force:true});}
console.log('Reviewed fixture child projections: exact aliases, ambiguous rejection, canonical NBL dispatch, all 17 strict result/observation tuples and actual Feed revision/idempotence passed.');
