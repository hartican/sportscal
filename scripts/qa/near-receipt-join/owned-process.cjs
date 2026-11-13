'use strict';
// Only tracks/settles child objects supplied by the owner; never spawns a process.
const assert=require('node:assert/strict');
function interruptRun(run,report,signal){
 run.signalFailure=run.signalFailure||signal;run.finished=false;
 report.interruption=report.interruption||{signal:run.signalFailure};
 report.failure=report.failure||{message:'Interrupted: '+run.signalFailure,code:'INTERRUPTED'};
 if(report.state==='RUNNING_TEST_ONLY'||String(report.state).startsWith('PASS'))report.state='FAIL_INTERRUPTED';
 return {exitCode:1,signal:run.signalFailure};
}
function createOwnedProcessController({children,remainingMs,onEmpty=()=>{}}){
 const records=new WeakMap(),outcomes=[],counts={tracked:0,confirmed:0};
 function track(child){
  if(records.has(child))return child;
  const r={pid:child.pid||null,spawned:false,spawnError:false,confirmed:false,forced:false,waiters:new Set()};records.set(child,r);children.add(child);counts.tracked++;
  function finish(kind,code,signal){if(r.confirmed)return;r.confirmed=true;r.kind=kind;r.code=code;r.signal=signal;counts.confirmed++;children.delete(child);for(const resolve of r.waiters)resolve(true);r.waiters.clear();if(children.size===0)onEmpty();}
  child.once('spawn',()=>{r.spawned=true;r.pid=child.pid;});
  child.on('error',()=>{r.spawnError=true;});
  child.once('exit',(code,signal)=>finish('exit',code,signal));
  child.once('close',(code,signal)=>{if(!r.spawned&&!child.pid&&r.spawnError)finish('spawn-failed-no-process',code,signal);});
  return child;
 }
 function status(child){const r=records.get(child);assert(r,'Unowned child');return {pid:r.pid,confirmed:r.confirmed,forced:r.forced,kind:r.kind||null,code:r.code??null,signal:r.signal||null};}
 function wait(child,ms){const r=records.get(child);if(r.confirmed)return Promise.resolve(true);ms=Math.min(ms,Math.max(0,remainingMs()));if(ms<=0)return Promise.resolve(false);return new Promise(resolve=>{const done=confirmed=>{clearTimeout(timer);r.waiters.delete(done);resolve(confirmed);};const timer=setTimeout(()=>done(false),ms);r.waiters.add(done);});}
 async function settle(child,{graceMs=1500,forceMs=1500}={}){
  const r=records.get(child);assert(r,'Refuse to settle unowned child');
  if(r.confirmed)return status(child);if(r.settling)return r.settling;
  r.settling=(async()=>{
   if(await wait(child,graceMs)){const result=status(child);outcomes.push(result);return result;}
   r.forced=true;try{r.killReturned=child.kill('SIGKILL');}catch(e){r.killError=String(e.message).slice(0,120);}
   if(!(await wait(child,forceMs))){const result=status(child);outcomes.push(result);const e=Error('Owned child exit unconfirmed after bounded force wait');e.code='OWNED_CHILD_EXIT_UNCONFIRMED';e.outcome=result;throw e;}
   const result=status(child);outcomes.push(result);return result;
  })();return r.settling;
 }
 async function settleAll(options){const results=await Promise.allSettled([...children].map(c=>settle(c,options)));const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;assert.equal(children.size,0,'Owned children remain unconfirmed');return results.map(r=>r.value);}
 return {track,status,settle,settleAll,outcomes,inventory:()=>({...counts,remaining:children.size})};
}
module.exports={interruptRun,createOwnedProcessController};
