'use strict';
// Only these two existing resources. Single flight, no token/retry/redirect path.
const {performance}=require('node:perf_hooks');
const {createSingleReader}=require('./bounded-source-json'),contract=require('./championship-score-contract');
const LIMITS=Object.freeze({requests:2,resourceMs:15000,ownerMs:90000,cleanupMs:10000,encodedBytes:1048576,decodedBytes:1048576,encodedAggregateBytes:2097152,decodedAggregateBytes:2097152,collectionMs:45000,startGapMs:1000});
function createReader({clock=()=>performance.now(),began=clock(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let used=false,closed=false,active=null,requests=0,stageStart=null,lastStart=null,wire=0,decoded=0;
 const check=()=>{const at=clock();if(closed||!Number.isFinite(at)||at<began||at>=began+LIMITS.ownerMs||stageStart!=null&&(at<stageStart||at>=stageStart+LIMITS.collectionMs))throw Error('Championship source collection deadline or closure');};
 async function read(consume){
  check();if(used)throw Error('Championship two-resource allocation spent');used=true;stageStart=clock();const captures=[],results=[],sourceFailures=[];let refused=false;
  try{
   for(const round of [2,3]){
    check();if(refused){sourceFailures.push({round,reason:'not-acquired-after-auth-refusal'});continue;}
    if(lastStart!=null){const wait=LIMITS.startGapMs-(clock()-lastStart);if(wait>0)await sleep(Math.ceil(wait)+1);check();if(clock()-lastStart<LIMITS.startGapMs)throw Error('Championship source gap not satisfied');}
    lastStart=clock();requests++;active=createSingleReader({url:contract.BASE+'/r'+round+'/fixture',userAgent:'NothingSport-canonical-championship-scores/1.0',label:'Championship',LIMITS,clock,began});
    try{
     const record=await active.read((payload,receipt)=>{check();return consume({round,payload},{...receipt,check:()=>{receipt.check();check();}});});
     captures.push({...record,round});results.push(record.value);
    }catch(error){
     if(error.sourceCapture)captures.push({...error.sourceCapture,round});
     if(error.championshipCode)throw error;
     const status=error.sourceCapture?.receipt?.status;sourceFailures.push({round,reason:status===401||status===403?'authentication-refused':'round-resource-unavailable',status:Number.isInteger(status)?status:null});
     if(status===401||status===403)refused=true;
    }finally{active.close();active=null;}
    const captured=captures.at(-1);wire+=captured?.receipt?.encodedBytesObserved||0;decoded+=captured?.receipt?.decodedBytesObserved||0;
    if(wire>LIMITS.encodedAggregateBytes||decoded>LIMITS.decodedAggregateBytes)throw Error('Championship aggregate body bound');check();
   }
   const value=contract.combine(results,results[0]?.document,sourceFailures);
   for(const failure of sourceFailures)for(const r of contract.scope.records.filter(r=>r.target&&r.roundNumber===failure.round))value.deferrals.push({id:r.id,reason:failure.reason,nextAction:'Review this official round in a separately allocated source window'});
   check();return {captures,value,receipt:{requests,completeResources:captures.filter(r=>r.receipt.complete).length,sourceFailures}};
  }catch(error){error.sourceCaptures=captures;throw error;}
 }
 function close(){closed=true;active?.close();active=null;}
 return {read,close,check,summary:()=>({requests,active:active?1:0,closed,sourceElapsedMs:clock()-began,encodedBytesObserved:wire,decodedBytesObserved:decoded})};
}
module.exports={createReader,LIMITS};
