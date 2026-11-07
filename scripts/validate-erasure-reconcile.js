'use strict';
const assert=require('node:assert/strict');
const {operator}=require('../lib/account-erasure-operator');
const {newJournal,PHASES,INDIRECT}=require('../lib/account-erasure-workflow');
const {ZERO_REQUIRED,UNRESOLVED}=require('../lib/account-erasure-reconcile');
const id='00000000-0000-4000-8000-000000000001',time='2026-09-28T00:00:00Z';
async function run(options={}){
 const journal=newJournal(id,{verifiedAccountId:id,requestId:'isolated-reconciliation',verifiedAt:time});
 journal.phase='reconcile';journal.schemaFingerprint='reviewed';journal.steps=PHASES.slice(0,8).map(phase=>({phase,evidence:phase==='freeze'?{startedAt:time}:{}}));
 journal.emailLineage={accountId:id,operationId:journal.operationId,capturedAt:time,status:'verified_current_email',normalizedEmail:'a+filter,"x"@example.invalid',...options.lineage};
 if(options.missing)delete journal.emailLineage;
 let saved,reads=0;
 const request=async(url,settings={})=>{
  assert(!settings.method||settings.method==='POST'&&url==='/rest/v1/rpc/nothingsports_account_erasure_inventory','Reconciliation must not mutate');
  if(url.endsWith('/nothingsports_account_erasure_inventory'))return {schemaVersion:'erasure-inventory.v1',schemaFingerprint:options.schema||'reviewed',checkedAt:time,accountExists:options.exists||false,unsupportedReferences:0,unknownStorageObjects:0,references:[{table_name:'owned',column_name:'user_id',guarded:true,matching_rows:options.direct||0}],indirect:{...Object.fromEntries(INDIRECT.map(k=>[k,0])),email_subscriptions:null,...options.indirect}};
  if(url.startsWith('/rest/v1/nothingsports_account_erasure_blocks?'))return options.noMarker?[]:[{started_at:time}];
  if(url.startsWith('/rest/v1/marquee_subscribers?')){
   reads++;const params=new URL('https://test.invalid'+url).searchParams;
   assert.equal(params.get('limit'),'1');assert.equal(params.get('email_normalized'),'eq."a+filter,\\"x\\"@example.invalid"');
   return options.matches===undefined?[]:options.matches;
  }
  throw Error('Unexpected request '+url);
 };
 const op=operator({environment:{SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co'},request});
 const result=await op.operations.reconcile({accountId:id,journal,persist:async j=>{if(options.disk)throw Error('Disk full');saved=structuredClone(j);}});
 assert.equal(result.verified,false);assert.equal(saved.reconciliation.complete,false);
 assert(!JSON.stringify(saved.reconciliation).includes('@'),'Diagnostic report must not copy email');
 for(const key of UNRESOLVED)assert(result.pending.includes(key));
 return {result,saved,reads};
}
(async()=>{
 const clean=await run();assert.equal(clean.saved.reconciliation.emailStatus,'no_current_email_subscription');assert.deepEqual(clean.result.pending,UNRESOLVED);
 for(const key of ZERO_REQUIRED){const t=await run({indirect:{[key]:1}});assert(t.result.pending.includes(key+'_remaining_or_unverified'));}
 for(const options of [{missing:true},{lineage:{accountId:'wrong'}},{lineage:{operationId:'wrong'}},{lineage:{capturedAt:null}}]){const t=await run(options);assert(t.result.pending.includes('pre_auth_email_lineage_required'));assert.equal(t.reads,0);}
 const unconfirmed=await run({lineage:{status:'no_verified_current_email'}});assert.equal(unconfirmed.reads,0);
 const remaining=await run({matches:[{email_normalized:'a+filter,"x"@example.invalid'}]});assert(remaining.result.pending.includes('current_email_subscription_requires_review'));
 for(const matches of [null,{},[{email_normalized:'peer@example.invalid'}]])assert((await run({matches})).result.pending.includes('current_email_subscription_check_unverified'));
 for(const [options,reason] of [[{schema:'changed'},'schema_changed_review_required'],[{exists:true},'auth_removal_unverified'],[{direct:1},'direct_account_references_remaining'],[{noMarker:true},'committed_erasure_marker_unverified']])assert((await run(options)).result.pending.includes(reason));
 await assert.rejects(()=>run({disk:true}),/Disk full/);
 console.log('Read-only final reconciliation: residual categories, private verified-email lineage, filter escaping, missing evidence, schema/marker guards and no false completion passed. Isolated backend only.');
})().catch(e=>{console.error(e);process.exitCode=1});
