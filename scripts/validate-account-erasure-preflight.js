'use strict';
const assert=require('node:assert/strict');
const {buildPreflight,SCHEMA_QUERY}=require('./account-erasure-preflight');
const id='00000000-0000-4000-8000-000000000009';
const rows=[{schema_name:'public',table_name:'nothingsports_chat_messages',column_name:'sender_id',delete_rule:'RESTRICT'},{schema_name:'public',table_name:'nothingsports_reminders',column_name:'user_id',delete_rule:'SET NULL'}];
const sql=buildPreflight(rows,id);
assert(sql.includes('begin read only;')&&sql.endsWith('rollback;\n'));
assert(sql.includes("statement_timeout='10s'"));assert(sql.includes("'RESTRICT' as deletion_rule"));assert(sql.includes("'SET NULL' as deletion_rule"));
assert(!/\b(delete from|update\s|insert into|alter\s|drop\s|truncate\s)/i.test(sql));
assert.throws(()=>buildPreflight(rows,"x';delete from auth.users;--"),/UUID/);
assert.throws(()=>buildPreflight([{...rows[0],table_name:'users;drop table x'}],id),/Unsafe/);
assert.throws(()=>buildPreflight([{...rows[0],delete_rule:"CASCADE';--"}],id),/Unknown/);
assert.throws(()=>buildPreflight([rows[0],rows[0]],id),/Duplicate/);
assert.throws(()=>buildPreflight([],id),/required/);
assert(SCHEMA_QUERY.includes("con.confrelid='auth.users'::regclass"),'unrelated foreign keys cannot be labelled account deletion rules');
console.log('Account preflight: bounded read-only counts, exact account filter, overlapping-count warning and injection rejection passed.');
const {buildIndirectPreflight}=require('./account-erasure-indirect-preflight');
const indirect=buildIndirectPreflight(id);
assert(indirect.startsWith('-- Partial indirect inventory'));
assert(indirect.includes('begin read only;')&&indirect.endsWith('rollback;\n'));
assert(indirect.includes("statement_timeout='10s'"));
assert(!/\b(delete from|update\s|insert into|alter\s|drop\s|truncate\s)/i.test(indirect));
assert.throws(()=>buildIndirectPreflight("x';delete from auth.users;--"),/UUID/);
assert(indirect.includes('case when t.email is null then null'),'absent Auth email must remain unverified');
assert(indirect.includes("split_part(name,'/',1)=t.id::text"),'Storage scope requires exact UUID path segment');
assert(indirect.includes('reply.sender_id is distinct from t.id'));
assert(indirect.includes("'preserve'"));
assert(indirect.includes("'stop_if_nonzero'"));
assert.equal((indirect.match(/ check_name,/g)||[]).length,11); // ten checks plus final select
assert.equal(buildIndirectPreflight('ABCDEFAB-0000-4000-8000-000000000009').includes('ABCDEFAB'),false);
console.log('Indirect preflight: ten bounded checks, preserved shared content, exact Storage scope and unknown-email handling passed.');
const {verifyDirectGuards,readDirectGuards,SENTINEL}=require('./lib/account-erasure-guard-verification');
const {INDIRECT}=require('../lib/account-erasure-workflow');
(async()=>{
 assert(process.argv.slice(2).every(arg=>arg==='--live-read'),'Only --live-read is supported');
 const now=Date.parse('2026-10-03T18:30:00Z');
 const inventory={schemaVersion:'erasure-inventory.v1',checkedAt:new Date(now).toISOString(),schemaFingerprint:'reviewed',accountExists:false,unsupportedReferences:0,unknownStorageObjects:0,
  references:[{schema_name:'public',table_name:'owned',column_name:'user_id',guarded:true,matching_rows:0}],indirect:{...Object.fromEntries(INDIRECT.map(k=>[k,0])),email_subscriptions:null}};
 assert.equal(verifyDirectGuards(inventory,now).referenceCount,1);
 for(const override of [
  {references:[{...inventory.references[0],guarded:false}]},
  {references:[{...inventory.references[0],matching_rows:1}]},
  {references:[{...inventory.references[0],table_name:null}]},
  {references:[inventory.references[0],inventory.references[0]]},
  {checkedAt:'invalid'},{checkedAt:new Date(now-60001).toISOString()},{checkedAt:new Date(now+60001).toISOString()},
  {accountExists:true},{schemaFingerprint:{}},{unsupportedReferences:1},{unknownStorageObjects:1},{indirect:{}},
 ])assert.throws(()=>verifyDirectGuards({...inventory,...override},now));
 let calls=0;
 const request=async(url,settings)=>{calls++;assert.equal(url,'/rest/v1/rpc/nothingsports_account_erasure_inventory');assert.equal(settings.method,'POST');assert.deepEqual(settings.body,{target_user_id:SENTINEL});assert.equal(settings.timeoutMs,15000);return inventory;};
 const environment={SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co',SUPABASE_SECRET_KEY:'test-only-service-key'};
 for(const env of [{},{...environment,SUPABASE_URL:'https://wrong-project.supabase.co'}])await assert.rejects(()=>readDirectGuards({environment:env,request,now:()=>now}),/credentials/);
 assert.equal(calls,0);assert.equal((await readDirectGuards({environment,request,now:()=>now})).fullAccountErasureVerified,false);assert.equal(calls,1);
 calls=0;await assert.rejects(()=>readDirectGuards({environment,request:async()=>{calls++;throw Error('Unavailable');}}),/Unavailable/);assert.equal(calls,1,'Failure must not retry');
 console.log('Release guard input: malformed/stale/unguarded inventories fail, project credentials checked before one bounded read, no retry or false full-erasure claim.');
 if(process.argv.includes('--live-read')){const result=await readDirectGuards();console.log('Live direct account guards: '+result.guardedReferences+'/'+result.referenceCount+' verified; full account erasure remains unverified.');}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
