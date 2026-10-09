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
// Exercise the actual quick caller and generator, then restore every byte.
const directory=path.join(__dirname,'../data/follow-directory');
const savedDirectory=new Map(fs.readdirSync(directory).map(name=>[name,fs.readFileSync(path.join(directory,name))]));
try{
 const manifestPath=path.join(directory,'manifest.v1.json');
 const manifest=JSON.parse(savedDirectory.get('manifest.v1.json'));
 manifest.sports.find(sport=>sport.key==='rugby-women').recordCount++;
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 const check=()=>require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'build-follow-directories.js'),'--check'],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
 const stale=check();assert.equal(stale.status,1);assert.match(stale.stderr,/manifest\.v1\.json is stale/);
 require('./quick-results').runProjectionSteps([['scripts/build-follow-directories.js','--codes=football']]);
 const current=check();assert.equal(current.status,0,current.stderr);
 for(const [name,bytes] of savedDirectory)assert(fs.readFileSync(path.join(directory,name)).equals(bytes),`${name}: unchanged facts retain their original bytes`);
 console.log('Actual quick caller repairs a stale sibling directory; all unchanged directory bytes survive.');
}finally{
 for(const name of fs.readdirSync(directory))if(!savedDirectory.has(name))fs.unlinkSync(path.join(directory,name));
 for(const [name,bytes] of savedDirectory)fs.writeFileSync(path.join(directory,name),bytes);
}
