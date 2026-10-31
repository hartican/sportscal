'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawnSync}=require('node:child_process');
const fixtures=require('./lib/championship-validation-fixture'),capture=path.join(__dirname,'fixtures/australian-championship/2026');
const combined=['--retained-coverage','--codes=football,netball','--capture='+capture,'--local-only','-p'];
async function main(){
 const pre=fixtures.createOwnedRoute('pre');
 try{
  const {owner,builder}=pre;
  const parsed=owner.parseOptions(combined,{});assert.deepEqual(parsed.retainedCoverage,{codeSlugs:['football','netball'],captureFolder:capture});
  assert.deepEqual(owner.parseOptions(['--retained-coverage','--codes=netball','--local-only'],{}).retainedCoverage,{codeSlugs:['netball'],captureFolder:null});
  const invalid=[combined.filter(x=>x!=='--local-only'),combined.filter(x=>!x.startsWith('--capture=')),[...combined,'--quick'],[...combined,'--australian-championship'],[...combined,'--codes=football'],combined.map(x=>x.startsWith('--codes=')?'--codes=football,football':x),combined.map(x=>x.startsWith('--codes=')?'--codes=football,tennis':x),['--retained-coverage','--codes=netball','--capture='+capture,'--local-only'],['--retained-coverage','--codes=','--local-only']];
  for(const args of invalid)assert.throws(()=>owner.parseOptions(args,{}),'Invalid scopes/modes must reject before writes');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-retained-report-'));
  try{const file=path.join(temp,'report.json');fs.writeFileSync(file,'untouched');assert.throws(()=>owner.parseOptions(combined,{REFRESH_REPORT:file}),/REFRESH_REPORT/);assert.equal(fs.readFileSync(file,'utf8'),'untouched');}finally{fs.rmSync(temp,{recursive:true,force:true});}
  for(const options of [{codeSlugs:['netball'],retainedCodeSlugs:['football']},{codeSlugs:['tennis'],retainedCodeSlugs:['tennis']},{codeSlugs:[],retainedCodeSlugs:[]},{codeSlugs:['netball'],retainedCodeSlugs:['netball'],outputDir:os.tmpdir()},{codeSlugs:['football'],retainedFootballOnly:true,retainedCodeSlugs:['football']}])assert.throws(()=>builder.build(options));
  assert.equal(pre.applies.length,0);assert.equal(pre.steps.length,0);assert.equal(pre.writes.length,0);
  // Complete canonical dispatcher with real captured-data apply and real owned
  // Football/Netball builder. Child IO is recorded, never a sporting source call.
  pre.setArgs(combined);await owner.ownedMain();assert.equal(pre.applies.length,1);assert(pre.writes.length>0);
  assert.deepEqual(pre.steps,[['scripts/refresh-football-directory.js','--check'],['scripts/build-code-inspector.js','--codes=football,netball','--retained-codes=football,netball'],['scripts/build-follow-directories.js','--codes=football,netball'],['scripts/build-follow-directories.js','--codes=football,netball','--check'],['scripts/validate-australian-championship.js'],['scripts/validate-australian-championship-integration.js'],['scripts/validate-diamonds-retained-schedule.js']]);
  const document=JSON.parse(fs.readFileSync(path.join(pre.root,fixtures.FILE)));assert.equal(document.events.length,48);assert.equal(document.events.filter(e=>e.status==='completed').length,8);
  pre.setState('pre');pre.applies.length=0;pre.steps.length=0;pre.writes.length=0;pre.setArgs(['--australian-championship','--capture='+capture,'--local-only']);await owner.ownedMain();assert.equal(pre.applies.length,1);assert(pre.writes.length>0);assert.deepEqual(pre.steps,[['scripts/refresh-football-directory.js','--check'],['scripts/build-code-inspector.js','--codes=football','--retained-football-only'],['scripts/build-follow-directories.js','--codes=football'],['scripts/build-follow-directories.js','--codes=football','--check'],['scripts/validate-australian-championship.js'],['scripts/validate-australian-championship-integration.js']]);
 }finally{pre.close();}
 const adopted=fixtures.createOwnedRoute('adopted');
 try{
  for(const args of [combined,['--retained-coverage','--codes=football','--capture='+capture,'--local-only'],['--australian-championship','--capture='+capture,'--local-only']]){
   const before=adopted.inventory();assert.throws(()=>adopted.owner.parseOptions(args,{}),/legacy-rebuild-with-adopted-finals-held/);adopted.setArgs(args);await assert.rejects(adopted.owner.ownedMain(),/legacy-rebuild-with-adopted-finals-held/);
   assert.deepEqual(adopted.inventory(),before,'Adopted legacy rejection changes no owned file');assert.equal(adopted.applies.length,0);assert.equal(adopted.steps.length,0);assert.equal(adopted.writes.length,0);
  }
  assert.deepEqual(adopted.owner.parseOptions(['--retained-coverage','--codes=netball','--local-only'],{}).retainedCoverage,{codeSlugs:['netball'],captureFolder:null});
  const footballFiles=[fixtures.FILE,fixtures.FILE.replace('.json','.js'),'data/code-inspector/football.json','data/follow-schedule/football.json'],footballBefore=footballFiles.map(f=>fs.readFileSync(path.join(adopted.root,f)));
  adopted.setArgs(['--retained-coverage','--codes=netball','--local-only']);await adopted.owner.ownedMain();assert.equal(adopted.applies.length,0);assert.deepEqual(adopted.steps,[['scripts/build-code-inspector.js','--codes=netball','--retained-codes=netball'],['scripts/build-follow-directories.js','--codes=netball'],['scripts/build-follow-directories.js','--codes=netball','--check'],['scripts/validate-diamonds-retained-schedule.js']]);footballFiles.forEach((f,i)=>assert(fs.readFileSync(path.join(adopted.root,f)).equals(footballBefore[i]),'Independent Netball cannot touch adopted Football'));
  // A direct old factual apply must preserve genuine adopted results and clocks;
  // the public legacy rebuild still refuses before any apply/child/diagnostic IO.
  const canonical=path.join(adopted.root,fixtures.FILE),js=canonical.replace('.json','.js'),before=[fs.readFileSync(canonical),fs.readFileSync(js)];
  fixtures.withClock(()=>require('./lib/australian-championship').apply({root:adopted.root,captureFolder:capture}));assert(fs.readFileSync(canonical).equals(before[0]));assert(fs.readFileSync(js).equals(before[1]));
 }finally{adopted.close();}
 // Original actual writer proof remains: all non-target writes fail and prior
 // Football rows carry opaque preservation probes; both scopes still run it.
 const result=spawnSync(process.execPath,[path.join(__dirname,'validate-championship-peer-copy.js'),'--combined'],{encoding:'utf8',env:process.env,timeout:30000});assert.equal(result.status,0,result.stderr);assert(result.stdout.includes('Football+Netball'));
 console.log('Canonical retained scopes: frozen pre-adoption positive route/full dispatcher, strict original local/capture/report guards, adopted-state parse+complete-canonical prewrite rejection/preservation and actual five-output peer writer passed; zero sporting source calls.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});module.exports={main};
