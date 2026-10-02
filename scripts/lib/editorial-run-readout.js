'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..');
const stages=['inventory','research','checks','build','complete'];
function existingReport(file){
  let stat;
  try{stat=fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
  assert(!stat.isSymbolicLink()&&stat.isFile(),'Editorial check report must be a regular private file.');
  const descriptor=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{
    assert.equal(fs.fstatSync(descriptor).mode&0o077,0,'Editorial check report must be private (chmod 600).');
    const report=JSON.parse(fs.readFileSync(descriptor,'utf8'));
    assert(Array.isArray(report.operations),'Invalid existing editorial check report.');
    assert(/^[a-f0-9]{64}$/.test(report.sourceRevision)||(report.sourceRevision==null&&!report.operations.length),'Invalid check report source revision.');
    assert(report.runReadouts===undefined||Array.isArray(report.runReadouts),'Invalid editorial run measurements.');
    return report;
  }finally{fs.closeSync(descriptor);}
}
function privateReport(file){
  if(!file)return null;
  assert(path.isAbsolute(file),'Absolute private editorial check report required.');
  const parent=fs.realpathSync(path.dirname(file)),root=fs.realpathSync(ROOT),relative=path.relative(root,parent);
  assert(relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'Editorial check reports must remain outside the checkout.');
  existingReport(file);
  return file;
}
function begin({mode,file=process.env.NS_EDITORIAL_CHECK_REPORT,prepared=Boolean(process.env.NS_EDITORIAL_CONTROL_SNAPSHOT)}={}){
  file=privateReport(file);
  const started=process.hrtime.bigint();
  const data={schemaVersion:'editorial-run-readout.v1',mode,startedAt:new Date().toISOString(),stage:'inventory',status:'running',sourceRevision:null,windowCards:null,selectedCards:null,dueCards:null,changedCards:null,deferredCards:null,successfulChecks:0,preparedUpdates:0,directPersistedUpdates:0,connectorCommitObserved:false,controlMode:prepared?'snapshot-preparation':'direct-service',externalResearchRuntimeMs:null,externalModelTokens:null,cashCostAUD:null};
  const count=items=>new Set(items||[]).size;
  return {
    stage(value){assert(stages.includes(value));data.stage=value;},
    inventory(inventory,cards){
      const report=file&&existingReport(file);
      if(report?.sourceRevision)assert.equal(report.sourceRevision,inventory.sourceRevision,'Check report source revision mismatch.');
      assert(/^[a-f0-9]{64}$/.test(inventory.sourceRevision));data.sourceRevision=inventory.sourceRevision;
      data.windowCards=inventory.cards.length;data.selectedCards=inventory.cards.filter(c=>c.selected).length;data.dueCards=cards.length;
      data.changedCards=0;data.deferredCards=0;
    },
    result(result){data.changedCards=count(result.updatedIds);data.deferredCards=count((result.deferred||[]).map(d=>d.id));},
    checked(deferred){if(!deferred)data.successfulChecks++;if(prepared)data.preparedUpdates++;else data.directPersistedUpdates++;},
    finish(error){
      data.status=error?'failed':'completed';data.finishedAt=new Date().toISOString();data.cliElapsedMs=Math.round(Number(process.hrtime.bigint()-started)/1e6);
      // Unknown inventory counts remain unknown. Raw errors, fixture IDs, votes,
      // private copy and credentials are never added to the aggregate readout.
      if(!file)return data;
      privateReport(file);
      const report=existingReport(file)||{sourceRevision:data.sourceRevision,operations:[]};
      if(data.sourceRevision&&report.sourceRevision)assert.equal(report.sourceRevision,data.sourceRevision,'Check report source revision mismatch.');
      if(!report.sourceRevision)report.sourceRevision=data.sourceRevision;
      report.runReadouts=[...(report.runReadouts||[]),data].slice(-32);
      // Replace atomically: a failed write retains the prepared operations, and
      // a racing/dangling final symlink is never followed for private content.
      const temporary=file+'.'+require('node:crypto').randomUUID()+'.tmp';
      try{fs.writeFileSync(temporary,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});fs.renameSync(temporary,file);}
      finally{fs.rmSync(temporary,{force:true});}
      return data;
    }
  };
}
module.exports={begin};
