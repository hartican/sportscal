'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const STDERR_TAIL_BYTES=64*1024;

// Synchronous refresh owners cannot drain a child pipe while it runs. Spool
// stderr privately, then retain a bounded diagnostic tail instead of allowing
// spawnSync's pipe buffer to kill an otherwise successful source/validator.
function run(command,args,options={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ns-refresh-stderr-'));
 let fd;
 try{
  fd=fs.openSync(path.join(directory,'stderr'),'w+',0o600);
  const result=spawnSync(command,args,{...options,stdio:['inherit','inherit',fd]});
  const size=fs.fstatSync(fd).size,start=Math.max(0,size-STDERR_TAIL_BYTES);
  const tail=Buffer.alloc(Math.min(size,STDERR_TAIL_BYTES));
  let read=0;
  while(read<tail.length){const count=fs.readSync(fd,tail,read,tail.length-read,start+read);if(!count)break;read+=count;}
  const notice=start?Buffer.from(`[refresh stderr: ${start} earlier bytes omitted; final ${read} bytes follow]\n`):Buffer.alloc(0);
  result.stderr=Buffer.concat([notice,tail.subarray(0,read)]);
  return result;
 }finally{
  try{if(fd!==undefined)fs.closeSync(fd);}finally{fs.rmSync(directory,{recursive:true,force:true});}
 }
}
module.exports={run,STDERR_TAIL_BYTES};
