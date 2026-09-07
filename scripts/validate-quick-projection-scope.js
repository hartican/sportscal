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
const output=fs.mkdtempSync(path.join(os.tmpdir(),'ns-projection-scope-'));
try{
 fs.cpSync(path.join(__dirname,'../data/code-inspector'),output,{recursive:true});
 const before=new Map(fs.readdirSync(output).filter(name=>name!=='manifest.json'&&name!=='tennis.json').map(name=>[name,fs.readFileSync(path.join(output,name))]));
 const prior=JSON.parse(fs.readFileSync(path.join(output,'manifest.json'),'utf8'));
 const result=require('./build-code-inspector').build({codeSlugs:['tennis'],outputDir:output});
 for(const [name,bytes] of before)assert(fs.readFileSync(path.join(output,name)).equals(bytes),`${name} changed during a tennis-only update`);
 assert.deepEqual(result.codes.filter(code=>code.slug!=='tennis'),prior.codes.filter(code=>code.slug!=='tennis'),'Unchanged code metadata must remain intact');
 assert(JSON.parse(fs.readFileSync(path.join(output,'tennis.json'),'utf8')).fixtures.length>0,'Tennis retains released fixtures');
 console.log(`Scoped generator: ${before.size} unrelated files byte-identical.`);
}finally{fs.rmSync(output,{recursive:true,force:true});}
