'use strict';
const assert=require('node:assert/strict');
const {dispatchAndTrack}=require('./dispatch-production-deploy');
const sha='a'.repeat(40),id='11111111-2222-4333-8444-555555555555';
const terminal={databaseId:12,displayTitle:`Deploy ${sha} ${id}`,status:'completed',conclusion:'success',url:'https://github.com/hartican/sportscal/actions/runs/12',jobs:[]};
function harness(respond){let time=0;const calls=[],waits=[];return {calls,waits,run:()=>dispatchAndTrack({sha,id,gh:async args=>{calls.push(args);return respond(args,calls);},clock:()=>time,wait:async ms=>{waits.push(ms);time+=ms;},log:()=>{}})};}
(async()=>{
 let failures=0;const transient=harness(args=>{if(args[0]==='workflow')return '';if(args[1]==='list'){if(failures++<3)throw Error('HTTP 502: Server Error');return [terminal];}return terminal;});
 await transient.run();assert.deepEqual(transient.waits,[2000,5000,10000]);assert.equal(transient.calls.filter(a=>a[0]==='workflow').length,1);
 const auth=harness(args=>{if(args[0]==='workflow')return '';throw Error('HTTP 401 Bad credentials');});await assert.rejects(auth.run,/401/);assert.deepEqual(auth.waits,[]);
 const exhausted=harness(args=>{if(args[0]==='workflow')return '';throw Error('HTTP 503 Service Unavailable');});await assert.rejects(exhausted.run,/503/);assert.deepEqual(exhausted.waits,[2000,5000,10000]);assert.equal(exhausted.calls.length,5);
 const limited=harness(args=>{if(args[0]==='workflow')return '';throw Error('HTTP 429 rate limit');});await assert.rejects(limited.run,/429/);assert.deepEqual(limited.waits,[]);
 const ambiguous=harness(()=>{throw Error('connection reset');});await assert.rejects(ambiguous.run,/uncertain.*11111111|11111111.*uncertain/i);assert.equal(ambiguous.calls.length,1,'dispatch is never retried');
 const failed=harness(args=>args[0]==='workflow'?'':args[1]==='list'?[terminal]:{...terminal,conclusion:'failure',jobs:[{name:'deploy',databaseId:77,url:'https://github.com/hartican/sportscal/actions/runs/12/job/77',conclusion:'failure',steps:[{number:5,name:'Validate NHL results',conclusion:'failure'}]}]});
 await assert.rejects(failed.run,/Validate NHL results.*job\/77#step:5/);
 let polls=0;const pending=harness(args=>args[0]==='workflow'?'':args[1]==='list'?[terminal]:++polls===1?{...terminal,status:'in_progress',conclusion:null}:terminal);await pending.run();assert.deepEqual(pending.waits,[15000]);
 const timeout=harness(args=>args[0]==='workflow'?'':args[1]==='list'?[terminal]:{...terminal,status:'queued',conclusion:null});await assert.rejects(timeout.run,/timed out.*12/i);assert.equal(timeout.waits.reduce((a,b)=>a+b,0),3600000);assert.equal(timeout.calls.filter(a=>a[0]==='workflow').length,1);
 const lookup=harness(args=>args[0]==='workflow'?'':[]);await assert.rejects(lookup.run,/lookup timed out.*11111111/);assert.equal(lookup.waits.reduce((a,b)=>a+b,0),180000);
 console.log('Deployment tracking: bounded 502 retries, immediate auth failure, uncertain dispatch, actual failed step, polling and deadlines passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
