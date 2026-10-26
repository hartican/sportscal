'use strict';
// Descriptor-pinned local input. Never re-open validated content during replay
// or packaging; namespace/stat stability and hashes cover the captured bytes.
const fs=require('node:fs'),path=require('node:path'),{fail}=require('./public-coverage-schema');
const identity=s=>[s.dev,s.ino,s.mode,s.nlink,s.size,s.mtimeNs,s.ctimeNs].join('|');
function parent(file){
 if(!path.isAbsolute(file)||fs.realpathSync(path.dirname(file))!==path.dirname(file))fail('INPUT_PATH');
 const stat=fs.lstatSync(path.dirname(file),{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink())fail('INPUT_PATH');return {file:path.dirname(file),stat};
}
function open(file,maximum){
 const directory=parent(file);let fd;
 try{
  fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  const stat=fs.fstatSync(fd,{bigint:true});if(!stat.isFile()||stat.nlink!==1n||stat.size>BigInt(maximum))fail('INPUT_PATH');
  const verify=()=>{
   const current=fs.lstatSync(file,{bigint:true}),dir=fs.lstatSync(directory.file,{bigint:true});
   if(identity(fs.fstatSync(fd,{bigint:true}))!==identity(stat)||identity(current)!==identity(stat)||identity(dir)!==identity(directory.stat)||fs.realpathSync(path.dirname(file))!==path.dirname(file))fail('INPUT_CHANGED');
  };
  verify();
  return {file,size:Number(stat.size),verify,close(){fs.closeSync(fd);},read(){
   verify();const data=Buffer.alloc(Number(stat.size));let read=0;
   while(read<data.length){const n=fs.readSync(fd,data,read,data.length-read,read);if(!n)fail('INPUT_CHANGED');read+=n;}
   if(fs.readSync(fd,Buffer.alloc(1),0,1,data.length)!==0)fail('INPUT_CHANGED');verify();return data;
  }};
 }catch(error){if(fd!==undefined)try{fs.closeSync(fd);}catch{}throw error;}
}
function json(bytes){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));}catch{fail('CAPSULE_JSON');}}
module.exports={open,json,parent};
