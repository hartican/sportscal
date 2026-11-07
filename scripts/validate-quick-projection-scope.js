'use strict';
const assert=require('node:assert/strict');
const {projectionSteps}=require('./quick-results');
const files=changes=>projectionSteps(changes).map(step=>step[0]);
assert.deepEqual(projectionSteps([]),[],'No source changes must not rebuild projections');
const tennis=projectionSteps(['US Open schedule/results']);
assert(!files(['US Open schedule/results']).includes('scripts/publish-feed.js'),'Tennis-only changes must not republish unrelated Feed pages');
assert(tennis.some(step=>step.includes('--codes=tennis')),'Tennis-only updates rebuild their Schedule chunk');
assert(files(['Premier League 3']).includes('scripts/publish-feed.js'));
assert(!files(['Premier League 3']).includes('scripts/sync-canonical-fixtures-to-feed.js'));
assert(projectionSteps(['AFL/NRL 2']).some(step=>step.includes('--codes=afl,aflw,nrl')));
assert(projectionSteps([],{rebuild:true}).some(step=>step[0]==='scripts/build-code-inspector.js'&&step.length===1));
assert(files(['US Open schedule/results']).includes('scripts/validate-feed-coverage-resilience.js'),'Every changed source keeps coverage validation');
console.log('Quick refresh scope: no-op, tennis-only, football, AFL/NRL and full rebuild passed.');

// Exercise the real generator with the released catalogue in a disposable
// output directory. Every unrelated Schedule chunk must remain byte-identical.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const outputRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ns-projection-scope-'));
const output=path.join(outputRoot,'code-inspector');
const companions=['data/event-overviews.v1.json','data/chat-fixtures.v1.json'].map(name=>[path.join(__dirname,'..',name),fs.readFileSync(path.join(__dirname,'..',name))]);
try{
 fs.cpSync(path.join(__dirname,'../data/code-inspector'),output,{recursive:true});
 const before=new Map(fs.readdirSync(output).filter(name=>name!=='manifest.json'&&name!=='tennis.json').map(name=>[name,fs.readFileSync(path.join(output,name))]));
 const prior=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));
 const result=require('./build-code-inspector').build({codeSlugs:['tennis'],outputDir:output});
 for(const [name,bytes] of before)assert(fs.readFileSync(path.join(output,name)).equals(bytes),`${name} changed during a tennis-only update`);
 assert.deepEqual(result.codes.filter(code=>code.slug!=='tennis'),prior.codes.filter(code=>code.slug!=='tennis'),'Unchanged code metadata must remain intact');
 assert(JSON.parse(fs.readFileSync(path.join(output,'tennis.json'),'utf8')).fixtures.length>0,'Tennis retains released fixtures');
 for(const [file,bytes] of companions)assert(fs.readFileSync(file).equals(bytes),'Disposable Code build must not rewrite shared '+path.basename(file));
 assert(!fs.existsSync(path.join(outputRoot,'follow-schedule')),'Disposable Code build produces only its requested directory');
 console.log(`Scoped generator: ${before.size} unrelated files byte-identical.`);
}finally{for(const [file,bytes] of companions)fs.writeFileSync(file,bytes);fs.rmSync(outputRoot,{recursive:true,force:true});}

const nbl=projectionSteps(['NBL 2']);
assert(nbl.some(step=>step[0]==='scripts/publish-feed.js'),'NBL results must reach the published feed');
assert(nbl.some(step=>step.includes('--codes=nbl')),'NBL results rebuild only their inspector partition');

const european=projectionSteps(['European Football source check']);
assert(european.some(step=>step[0]==='scripts/build-code-inspector.js'&&step.includes('--codes=football,champions-league')),'daily European refresh updates both projections');
assert(european.some(step=>step[0]==='scripts/build-follow-directories.js'&&step.includes('--codes=football')));
assert(european.some(step=>step[0]==='scripts/validate-european-football-standings.js'));
assert(!european.some(step=>step[0]==='scripts/publish-feed.js'),'European-only data refresh does not republish unrelated core Feed');
const eplTable=projectionSteps(['EPL standings source check']);
assert(eplTable.some(step=>step[0]==='scripts/build-code-inspector.js'&&step.includes('--codes=football')),'EPL table observations rebuild their actual displayed partition');
assert(eplTable.some(step=>step[0]==='scripts/build-canonical-context-bundle.js'),'original table observations reach offline canonical contexts');
assert(eplTable.some(step=>step[0]==='scripts/build-app-shell-runtime.js'),'table observations reach packed Feed ranks');
assert(eplTable.some(step=>step[0]==='scripts/validate-premier-league-context.js'),'daily table observations retain the complete-table gate');
assert(!eplTable.some(step=>step[0]==='scripts/publish-feed.js'||step[0]==='scripts/sync-canonical-fixtures-to-feed.js'),'table-only observations do not republish unrelated fixture/editorial facts');

for(const change of ['Current card evidence','Official results 1']){
 const step=projectionSteps([change]).find(step=>step[0]==='scripts/build-code-inspector.js');
 const codes=step[1].slice('--codes='.length).split(',');
 assert(codes.includes('rugby-union')&&codes.includes('cricket'),'reviewed international results must update Schedule as well as Feed');
}

assert(tennis.some(step=>step[0]==='scripts/apply-editorial-narratives.js'&&step.includes('--major-events-only')),'quick tennis hydration must restore reviewed child editorial before Schedule publication');
assert(tennis.findIndex(step=>step[0]==='scripts/apply-editorial-narratives.js')<tennis.findIndex(step=>step[0]==='scripts/build-code-inspector.js'));
const fullSteps=require('./update-cards').buildSteps({localOnly:true});
const lastInspector=fullSteps.map(step=>step[0]).lastIndexOf('scripts/build-code-inspector.js');
assert(fullSteps.slice(lastInspector+1).some(step=>step[0]==='scripts/build-follow-directories.js'&&step.includes('--check')),'Full refresh checks directory/search after the final fixture projection');

// A Football-only build must not leave another changed directory out of step.
// Use a disposable source/data copy: a legitimate newer derived build clock is
// not a sporting observation, and this regression must not rewrite the checkout.
const fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ns-quick-directory-repair-'));
try{
 const sourceRoot=path.resolve(__dirname,'..');
 for(const folder of ['scripts','config','lib','api','data','feeds'])fs.cpSync(path.join(sourceRoot,folder),path.join(fixtureRoot,folder),{recursive:true});
 const denyNetwork=path.join(fixtureRoot,'no-test-network.cjs');
 fs.writeFileSync(denyNetwork,"global.fetch=()=>{throw Error('UNEXPECTED_TEST_NETWORK')};for(const name of ['http','https','net','tls','dns']){const m=require('node:'+name);for(const key of ['get','request','connect','createConnection','lookup','resolve','resolve4','resolve6'])if(m[key])m[key]=()=>{throw Error('UNEXPECTED_TEST_NETWORK')};}\n");
 const environment={PATH:process.env.PATH,LANG:'C',TZ:'Australia/Sydney',NODE_OPTIONS:'--require='+denyNetwork,NODE_PATH:process.env.NODE_PATH||path.join(sourceRoot,'node_modules')};
 const invoke=args=>require('node:child_process').spawnSync(process.execPath,args,{cwd:fixtureRoot,env:environment,encoding:'utf8'});
 const builder=path.join(fixtureRoot,'scripts/build-follow-directories.js');
 const directory=path.join(fixtureRoot,'data/follow-directory');
 const importedDirectory=new Map(fs.readdirSync(directory).map(name=>[name,fs.readFileSync(path.join(directory,name))]));
 const manifestPath=path.join(directory,'manifest.v1.json');
 const importedManifest=JSON.parse(importedDirectory.get('manifest.v1.json'));
 // Existing output correctly retains an older generatedAt on clock-only
 // changes. Construct a coherent disposable manifest baseline with the real
 // builder, before deliberately corrupting its non-clock sporting metadata.
 for(const name of ['manifest.v1.json','manifest.v1.js'])fs.unlinkSync(path.join(directory,name));
 const prepared=invoke([builder]);assert.equal(prepared.status,0,prepared.stderr);
 const coherentManifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 assert(Number.isFinite(Date.parse(coherentManifest.generatedAt))&&Date.parse(coherentManifest.generatedAt)>=Date.parse(importedManifest.generatedAt),'Derived manifest build clock must be valid and non-regressing');
 assert.deepEqual(coherentManifest,{...importedManifest,generatedAt:coherentManifest.generatedAt},'Only the explicit derived-build clock may advance while preparing the fixture');
 const oldClockField='"generatedAt":'+JSON.stringify(importedManifest.generatedAt),newClockField='"generatedAt":'+JSON.stringify(coherentManifest.generatedAt);
 for(const name of ['manifest.v1.json','manifest.v1.js'])assert.equal(fs.readFileSync(path.join(directory,name),'utf8'),importedDirectory.get(name).toString().replace(oldClockField,newClockField),name+': every byte outside the explicit manifest header clock stays exact');
 for(const [name,bytes]of importedDirectory)if(!['manifest.v1.json','manifest.v1.js'].includes(name))assert(fs.readFileSync(path.join(directory,name)).equals(bytes),`${name}: fixture preparation must retain every non-manifest byte`);
 assert.equal(fs.readFileSync(path.join(directory,'manifest.v1.js'),'utf8'),`globalThis.NOTHINGSPORTS_FOLLOW_DIRECTORY_MANIFEST = ${JSON.stringify(coherentManifest)};\n`,'Script and JSON baseline contain exactly the same complete manifest');
 const requireImportedFiles=()=>assert.deepEqual(fs.readdirSync(directory).sort(),[...importedDirectory.keys()].sort(),'Fixture preparation cannot admit or drop directory files');
 requireImportedFiles();
 const unexpected=path.join(directory,'__unreviewed-test-output.v1.json');assert(!fs.existsSync(unexpected));
 try{fs.writeFileSync(unexpected,'{}\n');assert.throws(requireImportedFiles,/Fixture preparation cannot admit or drop directory files/);}
 finally{fs.unlinkSync(unexpected);}
 requireImportedFiles();
 const savedDirectory=new Map(fs.readdirSync(directory).map(name=>[name,fs.readFileSync(path.join(directory,name))]));
 const manifest=JSON.parse(savedDirectory.get('manifest.v1.json'));
 manifest.sports.find(sport=>sport.key==='rugby-women').recordCount++;
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 const check=()=>invoke([builder,'--check']);
 const stale=check();assert.equal(stale.status,1);assert.match(stale.stderr,/manifest\.v1\.json is stale/);
 const repair=invoke(['-e',"require('./scripts/quick-results').runProjectionSteps([['scripts/build-follow-directories.js','--codes=football']])"]);assert.equal(repair.status,0,repair.stderr);
 const current=check();assert.equal(current.status,0,current.stderr);
 for(const [name,bytes] of savedDirectory)assert(fs.readFileSync(path.join(directory,name)).equals(bytes),`${name}: unchanged facts retain their original bytes`);
 assert.deepEqual(fs.readdirSync(directory).sort(),[...savedDirectory.keys()].sort(),'Repair cannot admit or remove directory files');
 for(const [name,bytes]of importedDirectory)assert(fs.readFileSync(path.join(sourceRoot,'data/follow-directory',name)).equals(bytes),'Disposable repair must not rewrite '+name+' in the source checkout');
 console.log('Actual quick caller repairs a stale sibling directory; all unchanged directory bytes survive.');
}finally{
 fs.rmSync(fixtureRoot,{recursive:true,force:true});
}
