#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),{selectBatch}=require('../config/calendar-selection');
(async()=>{
 const rows=Array.from({length:10000},(_,index)=>({id:`event-${index}`})),included=new Set(['saved']),excluded=new Set(),refs=new Map();
 let yields=0;const options={included,excluded,refs,idFor:event=>event.id,knownDate:()=>true,yieldTask:async()=>{yields++;}};
 const result=await selectBatch(rows,options);assert.equal(result.included.size,10001);assert(yields>70);assert.deepEqual([...included],['saved']);assert.equal(refs.size,0);
 const abort=new AbortController();await assert.rejects(()=>selectBatch(rows,{...options,signal:abort.signal,onProgress:()=>abort.abort()}),{name:'AbortError'});assert.deepEqual([...included],['saved']);
 await assert.rejects(()=>selectBatch(rows,{...options,knownDate:()=>{throw new Error('bad input');}}),/bad input/);assert.equal(refs.size,0);
 const cleared=await selectBatch(rows,{...options,...result,selected:false});assert.equal(cleared.included.size,1);assert.equal(cleared.excluded.size,10000);
 console.log('Calendar selection: 10,000 fixtures, yielded work, one transactional commit, cancellation and failure rollback passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
