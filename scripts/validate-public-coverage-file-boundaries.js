'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync,execFileSync}=require('node:child_process');
const caps=require('./lib/public-coverage-capsules'),reader=require('./lib/public-coverage-capture');

function fifoReader(file){
 const opened=[],open=fs.openSync;
 global.fetch=()=>{throw Error('No network allocated');};
 fs.openSync=function(...args){const fd=open.apply(this,args);opened.push(fd);return fd;};
 try{assert.throws(()=>reader.read(file),/INPUT_PATH/);}finally{fs.openSync=open;}
 for(const fd of opened)assert.throws(()=>fs.fstatSync(fd),e=>e.code==='EBADF');
}

async function run(){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ns-public-file-boundaries-')));
 const fetchBefore=global.fetch;let network=0,next=0;const results=[];
 global.fetch=async()=>{network++;throw Error('No network allocated');};
 const folder=()=>{const dir=path.join(root,String(next++));fs.mkdirSync(dir);return dir;};
 const check=(name,operation)=>{try{operation();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.message});}};
 try{
  const {value:set}=await require('./lib/public-coverage-producer').produce({format:'v3',clock:()=>new Date('2026-10-23T00:00:00Z'),request:async()=>[]});
  const write=dir=>{for(const item of [...set.capsules,{path:'public-coverage.json',body:set.manifestBody}])fs.writeFileSync(path.join(dir,item.path),item.body);};
  for(const name of ['public-coverage.json',caps.partName(0)]){
   check('FIFO '+name,()=>{
    const dir=folder();write(dir);const target=path.join(dir,name);fs.unlinkSync(target);execFileSync('mkfifo',[target]);
    // A separate bounded child makes the pre-fix blocking open an observable
    // failure without hanging this validator or leaving a waiting process.
    const child=spawnSync(process.execPath,[__filename,'--fifo-reader='+path.join(dir,'public-coverage.json')],{timeout:2000,killSignal:'SIGKILL',encoding:'utf8',maxBuffer:65536});
    assert.ifError(child.error);assert.equal(child.status,0,child.stderr);
   });
   check('hard link '+name,()=>{
    const dir=folder();write(dir);const target=path.join(dir,name),outside=path.join(folder(),'outside.json');fs.renameSync(target,outside);fs.linkSync(outside,target);
    const originalOpen=fs.openSync,originalRead=fs.readSync,opened=new Map();let partReads=0;
    try{
     fs.openSync=function(file,...args){const fd=originalOpen.call(this,file,...args);opened.set(fd,file);return fd;};
     fs.readSync=function(fd,...args){if(path.basename(opened.get(fd)||'').startsWith('public-coverage-page-'))partReads++;return originalRead.call(this,fd,...args);};
     assert.throws(()=>reader.read(path.join(dir,'public-coverage.json')),/INPUT_PATH/);
     assert.equal(partReads,0,'Linked input must refuse before any part body read');
     for(const fd of opened.keys())assert.throws(()=>fs.fstatSync(fd),e=>e.code==='EBADF');
    }finally{fs.openSync=originalOpen;fs.readSync=originalRead;}
   });
  }
  check('first output fstat preserves error, closes and cleans owned output',()=>{
   const dir=folder(),open=fs.openSync,stat=fs.fstatSync,outputs=new Set(),failure=Error('forced first output fstat');let fired=false;
   try{
    fs.openSync=function(file,flags,...args){const fd=open.call(this,file,flags,...args);if((flags&fs.constants.O_CREAT)!==0)outputs.add(fd);return fd;};
    fs.fstatSync=function(fd,...args){if(outputs.has(fd)&&!fired){fired=true;throw failure;}return stat.call(this,fd,...args);};
    assert.throws(()=>caps.materialize(set,dir),e=>e===failure);assert(fired);
    for(const fd of outputs)assert.throws(()=>stat(fd),e=>e.code==='EBADF');
    assert.deepEqual(fs.readdirSync(dir),[]);
   }finally{
    fs.openSync=open;fs.fstatSync=stat;
    // This also cleans the intentionally leaked pre-fix descriptor in RED.
    for(const fd of outputs)try{fs.closeSync(fd);}catch{}
   }
  });
  for(const withReadFailure of [true,false])check(withReadFailure?'primary readback error survives close failure':'close-only refusal still cleans owned outputs',()=>{
   const dir=folder(),open=fs.openSync,read=fs.readSync,close=fs.closeSync,opened=new Map(),failure=Error('forced readback refusal'),cleanup=Error('forced readback close');let reading=false,closed=false;
   try{
    fs.openSync=function(file,flags,...args){const fd=open.call(this,file,flags,...args);opened.set(fd,{file,readonly:(flags&fs.constants.O_WRONLY)===0});return fd;};
    fs.readSync=function(fd,...args){const entry=opened.get(fd);if(entry?.readonly&&path.basename(entry.file)==='public-coverage.json'){reading=true;if(withReadFailure)throw failure;}return read.call(this,fd,...args);};
    fs.closeSync=function(fd){const result=close.call(this,fd),entry=opened.get(fd);if(reading&&!closed&&entry?.readonly&&path.basename(entry.file)==='public-coverage.json'){closed=true;throw cleanup;}return result;};
    assert.throws(()=>caps.materialize(set,dir),e=>e===(withReadFailure?failure:cleanup));assert(closed);
    assert.deepEqual(fs.readdirSync(dir),[]);
    for(const fd of opened.keys())assert.throws(()=>fs.fstatSync(fd),e=>e.code==='EBADF');
   }finally{fs.openSync=open;fs.readSync=read;fs.closeSync=close;}
  });
  assert.equal(network,0);console.log(JSON.stringify({fileBoundaryControls:results,networkRequests:network},null,2));
  assert.equal(results.filter(r=>!r.passed).length,0,'Public saved-file boundary controls must all pass');
  return {checks:results.length,networkRequests:network};
 }finally{global.fetch=fetchBefore;fs.rmSync(root,{recursive:true,force:true});}
}
const fifo=process.argv.find(a=>a.startsWith('--fifo-reader='));
if(require.main===module){if(fifo)fifoReader(fifo.slice(14));else run().catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={run};
