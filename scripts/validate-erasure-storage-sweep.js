#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {operator}=require('../lib/account-erasure-operator');
const {INDIRECT}=require('../lib/account-erasure-workflow');
const account='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
const bucket='nothingsports-chat-transient',startedAt='2026-09-27T00:00:00Z';
function setup({lostAck=false,unsafe=false,late=false,persistFails=false,mismatch=0,extra=0}={}){
 const objects=new Set([account+'/nested/one.txt',peer+'/keep.txt']);for(let i=0;i<extra;i++)objects.add(account+'/item-'+i+'.txt');let deletes=0,saved,unknown=0;
 const journal={accountId:account,schemaFingerprint:'reviewed',steps:[{phase:'freeze',evidence:{startedAt}}]};
 const inventory=()=>({schemaVersion:'erasure-inventory.v1',schemaFingerprint:'reviewed',accountExists:true,checkedAt:new Date().toISOString(),unsupportedReferences:0,unknownStorageObjects:unknown,references:[{guarded:true,matching_rows:0}],indirect:{...Object.fromEntries(INDIRECT.map(k=>[k,0])),known_storage_paths:[...objects].filter(p=>p.startsWith(account+'/')).length,saved_media_owner_mismatch:mismatch}});
 const request=async(url,options={})=>{
  if(url.startsWith('/auth/'))return {id:account,app_metadata:{nothingsport_erasure_started_at:startedAt},banned_until:'2099-01-01T00:00:00Z'};
  if(url.startsWith('/rest/v1/rpc/'))return inventory();
  if(url.startsWith('/rest/'))return [];
  if(url==='/storage/v1/bucket')return [{id:bucket}];
  if(url.includes('/object/list/')){
   const prefix=options.body.prefix+'/';
   if(unsafe)return [{name:'..',id:null}];
   const entries=new Map();for(const p of objects){if(!p.startsWith(prefix))continue;const part=p.slice(prefix.length).split('/')[0];entries.set(part,{name:part,id:p===prefix+part?'object':null});}
   return [...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(options.body.offset,options.body.offset+options.body.limit);
  }
  if(options.method==='DELETE'){
   deletes++;assert(saved.lineage.objects.length,'Paths must be durable before deletion');
   assert(options.body.prefixes.length<=100);
   for(const p of options.body.prefixes){assert(p.startsWith(account+'/'));objects.delete(p);}
   if(late)objects.add(account+'/late.txt');
   if(lostAck){lostAck=false;throw Error('Lost delete acknowledgement');}
   return [];
  }
  throw Error('Unexpected request');
 };
 const adapter=operator({environment:{SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co'},request});
 const run=()=>adapter.operations.eraseStorage({accountId:account,journal,persist:async j=>{if(persistFails)throw Error('Disk full');saved=structuredClone(j);}});
 return {run,journal,objects,deletes:()=>deletes};
}
async function main(){
 const partial=setup({lostAck:true});await assert.rejects(partial.run,/Lost delete/);
 assert.equal(partial.journal.lineage.objects.length,1);
 const result=await partial.run();assert.equal(result.verified,true);assert.equal(result.evidence.finalErasure,false);assert(partial.objects.has(peer+'/keep.txt'));assert.equal(partial.objects.size,1);
 const batched=setup({extra:305});assert.equal((await batched.run()).verified,true);assert.equal(batched.deletes(),4);assert.equal(batched.objects.size,1);
 const changed=setup();changed.journal.schemaFingerprint='old';assert((await changed.run()).pending.includes('schema_changed_review_required'));assert.equal(changed.deletes(),0);
 const disk=setup({persistFails:true});await assert.rejects(disk.run,/Disk full/);assert.equal(disk.deletes(),0);
 const unsafe=setup({unsafe:true});await assert.rejects(unsafe.run,/Unexpected Storage/);assert.equal(unsafe.deletes(),0);
 const shared=setup({mismatch:1});assert.equal((await shared.run()).verified,false);assert.equal(shared.deletes(),0);
 const late=setup({late:true});assert((await late.run()).pending.includes('storage_objects_remaining_or_recreated'));
 const unfrozen=setup();unfrozen.journal.steps=[];await assert.rejects(unfrozen.run,/frozen/);assert.equal(unfrozen.deletes(),0);
 console.log('Storage sweep: durable lineage, retry after lost acknowledgement, peer preservation, ownership gates and late-object detection passed.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
