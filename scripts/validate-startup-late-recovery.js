#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('function runStartupFeedBarrier(){'),end=html.indexOf('\napplyThemePreference(userPreferences.theme);',start);
assert(start>0&&end>start);const source=html.slice(start,end);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(){
 const timers=[],pending=[];let completions=0;
 const sandbox={startupFeedState:{phase:'ready',attempt:0,issues:[]},STARTUP_FEED_TIMEOUT_MS:8000,console:{warn(){}},renderAll(){},loadingController:{fail(){}},
  window:{setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(){}},
  startupFeedTaskDescriptors:()=>[{name:'published feed',run:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),valid:value=>Boolean(value&&Number(value.eventCount)>0)}],
  completeStartupFeedHydration(){completions++;sandbox.startupFeedState={...sandbox.startupFeedState,phase:'ready',issues:[]};}
 };vm.createContext(sandbox);vm.runInContext(source,sandbox);
 return {sandbox,timers,pending,completions:()=>completions,start:()=>sandbox.runStartupFeedBarrier()};
}
(async()=>{
 const late=fixture();late.start();await flush();late.timers[0]();assert.equal(late.sandbox.startupFeedState.phase,'failed');late.pending[0].resolve({eventCount:1});await flush();assert.equal(late.sandbox.startupFeedState.phase,'ready','a late genuinely valid load must recover the same timed-out attempt');assert.equal(late.completions(),1);
 for(const reject of [false,true]){const bad=fixture();bad.start();await flush();bad.timers[0]();if(reject)bad.pending[0].reject(Error('source unavailable'));else bad.pending[0].resolve({eventCount:0});await flush();assert.equal(bad.sandbox.startupFeedState.phase,'failed');assert.equal(bad.completions(),0,'invalid or failed source cannot clear the hold');}
 const retry=fixture();retry.start();await flush();retry.timers[0]();retry.start();await flush();retry.pending[0].resolve({eventCount:1});await flush();assert.equal(retry.completions(),0,'an older attempt cannot complete a retry');retry.pending[1].resolve({eventCount:2});await flush();assert.equal(retry.completions(),1);
 const cancelled=fixture();cancelled.start();await flush();cancelled.sandbox.startupFeedState.phase='cancelled';cancelled.pending[0].resolve({eventCount:1});await flush();assert.equal(cancelled.completions(),0,'cancelled hydration cannot revive');
 console.log('Actual startup barrier: late valid recovery, failed/empty source hold, retry generation and cancelled-state protections passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
