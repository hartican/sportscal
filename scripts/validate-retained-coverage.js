'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),{spawnSync}=require('node:child_process');
const owner=require('./update-cards'),builder=require('./build-code-inspector'),capture=path.join(__dirname,'fixtures/australian-championship/2026');
const combined=['--retained-coverage','--codes=football,netball','--capture='+capture,'--local-only','-p'];
const parsed=owner.parseOptions(combined,{});assert.deepEqual(parsed.retainedCoverage,{codeSlugs:['football','netball'],captureFolder:capture});
assert.deepEqual(owner.parseOptions(['--retained-coverage','--codes=netball','--local-only'],{}).retainedCoverage,{codeSlugs:['netball'],captureFolder:null});
const invalid=[combined.filter(x=>x!=='--local-only'),combined.filter(x=>!x.startsWith('--capture=')),[...combined,'--quick'],[...combined,'--australian-championship'],[...combined,'--codes=football'],combined.map(x=>x.startsWith('--codes=')?'--codes=football,football':x),combined.map(x=>x.startsWith('--codes=')?'--codes=football,tennis':x),['--retained-coverage','--codes=netball','--capture='+capture,'--local-only'],['--retained-coverage','--codes=','--local-only']];
for(const args of invalid)assert.throws(()=>owner.parseOptions(args,{}),'Invalid scopes/modes must reject before writes');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-retained-report-'));
try{const file=path.join(temp,'report.json');fs.writeFileSync(file,'untouched');assert.throws(()=>owner.parseOptions(combined,{REFRESH_REPORT:file}),/REFRESH_REPORT/);assert.equal(fs.readFileSync(file,'utf8'),'untouched');}finally{fs.rmSync(temp,{recursive:true,force:true});}
for(const options of [{codeSlugs:['netball'],retainedCodeSlugs:['football']},{codeSlugs:['tennis'],retainedCodeSlugs:['tennis']},{codeSlugs:[],retainedCodeSlugs:[]},{codeSlugs:['netball'],retainedCodeSlugs:['netball'],outputDir:os.tmpdir()},{codeSlugs:['football'],retainedFootballOnly:true,retainedCodeSlugs:['football']}])assert.throws(()=>builder.build(options));
// Execute the actual combined writer under the existing FS interception: all
// non-target writes fail, prior Football rows carry opaque preservation probes.
const result=spawnSync(process.execPath,[path.join(__dirname,'validate-championship-peer-copy.js'),'--combined'],{encoding:'utf8',env:process.env,timeout:30000});assert.equal(result.status,0,result.stderr);assert(result.stdout.includes('Football+Netball'));
console.log('Canonical retained scopes: explicit Football/Netball, strict local/capture/report guards, rejected mixed/unknown scopes and actual five-output peer-preserving writer passed.');
