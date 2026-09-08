#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {refreshDueSources}=require('../lib/live-fixtures');
(async()=>{
 let published=null;
 const store={claim:async()=>({fixtures:[]}),publish:async(id,token,value)=>{published=value;},fail:async()=>{}};
 const result=await refreshDueSources({sources:[{id:'discovery-empty',allowEmpty:true,minimumIntervalMs:21600000,fetch:async()=>[]}],store});
 assert.deepEqual(result.failed,[],'a validated empty entry list is not a source outage');assert.deepEqual(published.fixtures,[]);
 assert.equal(published.intervalMs,21600000);
 published=null;
 const invalid=await refreshDueSources({sources:[{id:'scores',fetch:async()=>[]}],store});
 assert.equal(invalid.failed.length,1,'an unexpected empty result from a scores source still fails safely');assert.equal(published,null);
 console.log('Discovery refresh: explicit empty success and cadence, ordinary-source empty protection passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
