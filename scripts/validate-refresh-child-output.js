'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
function run({sourceFor=file=>fs.readFileSync(path.join(__dirname,file),'utf8')}={}){
 const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-refresh-output-test-'));
 const oldTmp=process.env.TMPDIR,oldSecret=process.env.REFRESH_TEST_API_KEY;
 process.env.TMPDIR=directory;process.env.REFRESH_TEST_API_KEY='refresh-output-private-secret-123456';
 try{
  const child=path.join(directory,'noisy.js');
  fs.writeFileSync(child,"const fs=require('node:fs');fs.writeSync(2,Buffer.alloc(1200000,65));fs.writeSync(2,'\\nTAIL_MARKER mode='+((fs.fstatSync(2).mode&511).toString(8))+' secret='+process.env.REFRESH_TEST_API_KEY+' https://example.com/final?token=private#secret\\n');process.exit(Number(process.argv[2]));\n");
  const helper=require('./lib/refresh-child'),report=require('./lib/refresh-report');
  const boundary=report.diagnosticTail('prefix '+process.env.REFRESH_TEST_API_KEY+'x'.repeat(1380)+' TAIL_MARKER');
  assert(!boundary.includes(process.env.REFRESH_TEST_API_KEY.slice(-16)),'Redact a secret before the report tail cuts through it');
  assert(boundary.length<=1400&&boundary.endsWith('TAIL_MARKER'));
  const clean=()=>assert(!fs.readdirSync(directory).some(name=>name.startsWith('ns-refresh-stderr-')),'Private stderr spool must be removed after every outcome');
  for(const [file,name,signature] of [['update-cards.js','runStep','function runStep(args) {'],['quick-results.js','run','function run(file,...args){']]){
   // Execute each real wrapper, not a duplicate of its output/status logic.
   const source=sourceFor(file),start=source.indexOf(signature),end=source.indexOf('\n}\n',start)+3;
   assert(start>=0&&end>start);let output=[];
   const context={require:createRequire(path.join(__dirname,file)),spawnSync:require('node:child_process').spawnSync,process:{execPath:process.execPath,env:process.env,stderr:{write:bytes=>output.push(Buffer.from(bytes))}},console:{log(){}}};
   vm.runInNewContext(source.slice(start,end)+';globalThis.wrapper='+name,context);
   const invoke=code=>name==='runStep'?context.wrapper([child,String(code)]):context.wrapper(child,String(code));
   invoke(0);let tail=Buffer.concat(output);assert(tail.length<=helper.STDERR_TAIL_BYTES+160,'Retained stderr stays bounded');assert.match(tail.toString(),/earlier bytes omitted/);assert.match(tail.toString(),/TAIL_MARKER mode=600/);clean();
   output=[];let failure;try{invoke(7);}catch(error){failure=error;}assert(failure,'Noisy failed child remains a failure');assert.equal(failure.refreshFailure.step,child);assert.match(failure.refreshFailure.detail,/TAIL_MARKER/);if(name==='runStep')assert.equal(failure.exitCode,7);clean();
   const diagnostic=path.join(directory,file+'.json');report.failure(failure.message,{file:diagnostic,...failure.refreshFailure});const saved=fs.readFileSync(diagnostic,'utf8');assert(!saved.includes(process.env.REFRESH_TEST_API_KEY));assert(!saved.includes('?token=private')&&!saved.includes('#secret'));assert.match(saved,/TAIL_MARKER/);
  }
  const missing=helper.run(path.join(directory,'missing-executable'),[]);assert.equal(missing.error.code,'ENOENT');assert.notEqual(missing.status,0);clean();
  const timed=helper.run(process.execPath,['-e','setTimeout(()=>{},10000)'],{timeout:100});assert.equal(timed.error.code,'ETIMEDOUT');assert.notEqual(timed.status,0);clean();
  console.log('Refresh child output: real full/quick noisy successes, nonzero failures, bounded/private stderr tails, sanitised diagnostics, spawn errors, timeouts and cleanup passed.');
 }finally{
  if(oldTmp===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=oldTmp;
  if(oldSecret===undefined)delete process.env.REFRESH_TEST_API_KEY;else process.env.REFRESH_TEST_API_KEY=oldSecret;
  fs.rmSync(directory,{recursive:true,force:true});
 }
}
if(require.main===module)run();
module.exports=run;
