#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {authenticatedUser}=require('../lib/supabase-server');
const {storageCheckpoint,MAX_WRITER_SECONDS}=require('../lib/account-erasure-storage');
const fs=require('node:fs');
async function main(){
 const environment={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-key'};
 let payload={id:'test',app_metadata:{},user_metadata:{nothingsport_erasure_started_at:'forged'}};
 const options={environment,fetchImpl:async()=>new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}})};
 assert.equal((await authenticatedUser('token',options)).id,'test','User-editable metadata cannot deny another valid account');
 payload={id:'test',app_metadata:{nothingsport_erasure_started_at:'2026-09-28T00:00:00Z'}};
 await assert.rejects(()=>authenticatedUser('token',options),e=>e.status===403&&e.payload.code==='account_erasure_in_progress');
 const start='2026-09-28T00:00:00Z',proof={issuersStoppedAt:'2026-09-28T00:01:00Z'};
 const before=storageCheckpoint(start,'2026-09-28T02:01:59Z',proof),after=storageCheckpoint(start,'2026-09-28T02:02:00Z',proof);
 assert.equal(storageCheckpoint(start,'2026-09-28T23:00:00Z').stage,'issuance_stop_required','Elapsed time cannot substitute for issuer shutdown proof');
 assert.equal(before.stage,'waiting_for_upload_expiry');assert.equal(before.remainingSeconds,1);
 assert.equal(after.stage,'storage_rescan_required');assert.equal(after.complete,false);
 assert.throws(()=>storageCheckpoint('invalid'));assert.throws(()=>storageCheckpoint(start,'2026-09-27T00:00:00Z'));
 const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 for(const route of ['api/chat.js','api/participation.js'])assert.equal(config.functions[route].maxDuration,MAX_WRITER_SECONDS,'Storage grant issuers have a bounded runtime');
 console.log('Erasure Storage gate: fresh protected Auth metadata, ignored user metadata, bounded issuers and expiry/rescan boundary passed. Time alone never marks cleanup complete.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
