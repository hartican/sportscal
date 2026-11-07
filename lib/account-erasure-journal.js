'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function openJournal(directory,accountId){
 if(!path.isAbsolute(directory)||!/^[a-f0-9-]{36}$/i.test(accountId))throw Error('A private absolute directory and account UUID are required.');
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const directoryStat=fs.lstatSync(directory);
 if(!directoryStat.isDirectory()||directoryStat.isSymbolicLink()||(directoryStat.mode&0o077)!==0)throw Error('Erasure journal directory must be private (0700), not a symlink.');
 const file=path.join(directory,`${accountId}.json`),lock=file+'.lock';
 const lockFd=fs.openSync(lock,'wx',0o600);
 fs.writeFileSync(lockFd,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));fs.fsyncSync(lockFd);
 let closed=false;
 return {
  file,
  load(){
   if(!fs.existsSync(file))return null;
   const stat=fs.lstatSync(file);
   if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw Error('Erasure journal must be a private regular file.');
   const journal=JSON.parse(fs.readFileSync(file,'utf8'));
   if(journal.accountId!==accountId)throw Error('Journal account does not match.');
   return journal;
  },
  async persist(journal){
   if(closed||journal.accountId!==accountId)throw Error('Journal closed or account mismatch.');
   const temp=file+'.'+crypto.randomUUID()+'.tmp',fd=fs.openSync(temp,'wx',0o600);
   try{fs.writeFileSync(fd,JSON.stringify(journal,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   fs.renameSync(temp,file);
   const dirFd=fs.openSync(directory,'r');try{fs.fsyncSync(dirFd);}finally{fs.closeSync(dirFd);}
  },
  close(){if(!closed){closed=true;fs.closeSync(lockFd);fs.unlinkSync(lock);}},
 };
}
module.exports={openJournal};
