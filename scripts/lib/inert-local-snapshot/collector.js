'use strict';
// Explicit invocation only. Adapters are supplied; no live window/storage globals.
const p=require('./policy'),{validateSnapshot}=require('./validator');
function collect({readRam,readStorage},expectedBinding){
 p.inspect(expectedBinding);p.scope(expectedBinding);
 if(typeof readRam!=='function'||typeof readStorage!=='function')p.fail('READ_ADAPTERS_REQUIRED');
 const ram=readRam();p.inspect(ram);p.exactKeys(ram,p.ramKeys);
 if(!p.equal(ram.binding,expectedBinding))p.fail('OWNER_OR_GENERATION_MISMATCH');
 const storage=p.storageKeys(expectedBinding).map(key=>({key,text:readStorage(key)}));
 const reference={ram,storage};p.inspect(reference);
 const text=JSON.stringify({format:'local-recovery-snapshot.v1',binding:expectedBinding,ram,storage,
  coverage:p.coverage,omissions:p.omissions,restorePolicy:'EVIDENCE_ONLY_NO_RESTORE_REBASE_OR_REPLAY'});
 const validation=validateSnapshot(text,expectedBinding,reference);
 return Object.freeze({text,validation});
}
function collectSnapshot(adapters,expectedBinding){try{return collect(adapters,expectedBinding);}catch(error){p.safeFailure(error);}}
module.exports=Object.freeze({collectSnapshot});
