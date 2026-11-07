#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {PHASES,INDIRECT,newJournal,advance}=require('../lib/account-erasure-workflow');
const account='00000000-0000-4000-8000-000000000001';
const request={verifiedAccountId:account,requestId:'disposable-test-request',verifiedAt:'2026-09-28T00:00:00Z'};
const base={schemaVersion:'erasure-inventory.v1',schemaFingerprint:'snapshot-one',accountExists:true,checkedAt:'2026-09-28T00:00:00Z',unsupportedReferences:0,unknownStorageObjects:0,references:[{guarded:true,matching_rows:1}],indirect:Object.fromEntries(INDIRECT.map(key=>[key,0]))};
async function main(){
 assert.throws(()=>newJournal(account,{...request,verifiedAccountId:'other'}));
 let saved,effects=[],failOnce=true,exists=true,inventory=()=>({...base,accountExists:exists});
 const persist=async journal=>{saved=structuredClone(journal);};
 const operations=Object.fromEntries(PHASES.map(phase=>[phase,async()=>{
  assert.equal(saved.phase,phase,'Intent must be durable before the effect');
  effects.push(phase);
  if(phase==='eraseAuth'){exists=false;if(failOnce){failOnce=false;throw Error('Lost Auth acknowledgement');}}
  return {verified:true,evidence:'disposable fake adapter proof',...(phase==='reconcile'?{allCategoriesVerified:true,remaining:[]}:{} )};
 }]));
 let journal=newJournal(account,request);
 await assert.rejects(()=>advance({journal,inventory,operations,persist}),/Lost Auth/);
 assert.equal(saved.phase,'eraseAuth');assert.equal(saved.complete,false);
 const before=[...effects];journal=structuredClone(saved);
 await advance({journal,inventory,operations,persist});
 assert.equal(journal.complete,true);assert.deepEqual(effects.slice(before.length),['eraseAuth','waitUploadExpiry','finalStorageSweep','reconcile']);
 const verifyComplete=structuredClone(journal);verifyComplete.steps=[];
 await assert.rejects(()=>advance({journal:verifyComplete,inventory,operations,persist}),/Incomplete journal/);
 for(const [name,override] of [['schema_changed_review_required',{schemaFingerprint:'changed'}],['unknown_storage_ownership',{unknownStorageObjects:1}],['unguarded_or_unverified_reference',{references:[{guarded:false,matching_rows:0}]}],['shared_media_ownership_mismatch',{indirect:{...base.indirect,saved_media_owner_mismatch:1}}],['unverified_indirect_check',{indirect:{...base.indirect,reward_eligibility_arrays:null}}]]){
  const trial=newJournal(account,request);trial.schemaFingerprint=base.schemaFingerprint;
  const before=effects.length;
  await advance({journal:trial,inventory:async()=>({...base,...override}),operations,persist});
  assert(trial.pending.includes(name));assert.equal(effects.length,before,'Failed preflight must not mutate');
 }
 journal=newJournal(account,request);
 await advance({journal,inventory:async()=>base,operations:{freeze:async()=>({verified:true}),captureLineage:async()=>({verified:false,pending:['storage_lineage_incomplete']})},persist});
 assert.deepEqual(journal.steps.map(s=>s.phase),['freeze']);assert.deepEqual(journal.pending,['storage_lineage_incomplete']);assert.equal(journal.complete,false);
 journal=newJournal(account,request);
 await advance({journal,inventory:async()=>base,operations:{...operations,reconcile:async()=>({verified:true,remaining:[]})},persist});
 assert.equal(journal.complete,false);assert.deepEqual(journal.pending,['final_reconciliation_incomplete']);
 const {stopAccountAuthentication}=require('../lib/account-erasure-auth');
 const now=Date.parse('2026-09-28T00:00:00Z');let writes=0,lost=true;
 const authUser={id:account,app_metadata:{nothingsport_erasure_started_at:new Date(now-1000).toISOString()}};
 const authCall=async(url,options={})=>{
  assert.equal(url,`/auth/v1/admin/users/${account}`);
  if(options.method==='PUT'){writes++;authUser.banned_until=new Date(now+86400000*365).toISOString();if(lost){lost=false;throw Error('Lost ban acknowledgement');}}
  return structuredClone(authUser);
 };
 await assert.rejects(()=>stopAccountAuthentication({accountId:account,call:authCall,now:()=>now}),/Lost ban/);
 assert((await stopAccountAuthentication({accountId:account,call:authCall,now:()=>now})).bannedUntil);
 assert.equal(writes,1,'Resume reconciles existing ban without repeating mutation');
 await assert.rejects(()=>stopAccountAuthentication({accountId:account,call:async()=>({id:account,app_metadata:{}}),now:()=>now}),/marker/);
 await assert.rejects(()=>stopAccountAuthentication({accountId:account,call:async()=>({...authUser,banned_until:null}),now:()=>now}),/not confirmed/);
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {openJournal}=require('../lib/account-erasure-journal');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-erasure-journal-'));
 try{
  const store=openJournal(dir,account);await store.persist(newJournal(account,request));
  assert.equal(fs.statSync(store.file).mode&0o077,0);
  assert.throws(()=>openJournal(dir,account),e=>e.code==='EEXIST');store.close();
  const resumed=openJournal(dir,account);assert.equal(resumed.load().accountId,account);resumed.close();
  fs.chmodSync(dir,0o755);assert.throws(()=>openJournal(dir,account),/private/);
 }finally{fs.rmSync(dir,{recursive:true});}
 console.log('Erasure workflow control: durable intent, lost acknowledgement/resume, scoped request, schema/ownership stops and fail-closed final evidence passed. Adapters are simulated; not live erasure proof.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
