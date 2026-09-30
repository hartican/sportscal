'use strict';
const assert=require('node:assert/strict');
const {operator}=require('../lib/account-erasure-operator');
const {advance,newJournal,PHASES,INDIRECT}=require('../lib/account-erasure-workflow');
const account='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
const start='2026-09-28T00:00:00Z',stopped='2026-09-28T00:01:00Z',bucket='nothingsports-chat-transient';
function setup(options={}){
 let time='2026-09-28T02:01:59Z',deletes=0,saved,lose=options.lost;
 const objects=new Set([account+'/late.txt',peer+'/keep.txt']);for(let i=0;i<(options.extra||0);i++)objects.add(account+'/item-'+i+'.txt');
 let journal=newJournal(account,{verifiedAccountId:account,requestId:'isolated-expiry-test',verifiedAt:start});
 journal.schemaFingerprint='reviewed';journal.phase='waitUploadExpiry';
 journal.steps=PHASES.slice(0,6).map(phase=>({phase,evidence:phase==='freeze'?{startedAt:start}:phase==='drainIssuers'?{kind:'verified_issuer_shutdown',accountId:account,operationId:journal.operationId,allIssuersStopped:true,legacyDeploymentsVerified:true,inflightWritersDrained:true,evidenceRef:'isolated-test-only',issuersStoppedAt:stopped}:{}}));
 journal.lineage={objects:[{bucket,objectPath:account+'/initial.txt'}]};
 const inventory=()=>({schemaVersion:'erasure-inventory.v1',schemaFingerprint:options.changed?'changed':'reviewed',checkedAt:time,accountExists:options.accountExists||false,unsupportedReferences:0,unknownStorageObjects:0,references:[{matching_rows:0,guarded:true}],indirect:{...Object.fromEntries(INDIRECT.map(k=>[k,0])),email_subscriptions:null,known_storage_paths:[...objects].filter(p=>p.startsWith(account+'/')).length}});
 const request=async(url,settings={})=>{
  assert(!url.startsWith('/auth/'),'Final sweep must work after Auth is absent');
  if(url==='/rest/v1/rpc/nothingsports_account_erasure_inventory')return inventory();
  if(url.startsWith('/rest/v1/nothingsports_account_erasure_blocks?'))return options.noMarker?[]:[{started_at:start}];
  if(url.startsWith('/rest/'))return [];
  if(url==='/storage/v1/bucket')return [{id:bucket}];
  if(url.includes('/object/list/')){const prefix=settings.body.prefix+'/';return [...objects].filter(p=>p.startsWith(prefix)).sort().slice(settings.body.offset,settings.body.offset+settings.body.limit).map(p=>({name:p.slice(prefix.length),id:'object'}));}
  if(settings.method==='DELETE'){
   assert.equal(url,'/storage/v1/object/'+bucket);assert(saved.finalStorageIntent);assert.equal(saved.finalStorageIntent.accountId,account);assert(saved.lineage.objects.some(o=>o.objectPath===account+'/late.txt'));assert(settings.body.prefixes.length<=100);deletes++;
   for(const p of settings.body.prefixes){assert(p.startsWith(account+'/'));objects.delete(p);}
   if(options.recreate)objects.add(account+'/recreated.txt');
   if(lose){lose=false;throw Error('Lost sweep acknowledgement');}return [];
  }
  throw Error('Unexpected request '+url);
 };
 const adapter=()=>operator({environment:{SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co'},request,now:()=>new Date(time)});
 const persist=async j=>{if(options.disk&&j.phase==='finalStorageSweep')throw Error('Disk full');saved=structuredClone(j);};
 return {run:()=>advance({journal,...adapter(),persist,now:()=>time}),setTime:t=>{time=t;},reload:()=>{journal=structuredClone(saved);},journal:()=>journal,objects,deletes:()=>deletes};
}
(async()=>{
 const t=setup({lost:true,extra:305});await t.run();assert.deepEqual(t.journal().pending,['signed_upload_expiry_pending']);assert.equal(t.journal().uploadExpiry.remainingSeconds,1);assert.equal(t.deletes(),0);
 t.setTime('2026-09-28T02:02:00Z');await assert.rejects(t.run,/Lost sweep/);t.reload();await t.run();assert.equal(t.objects.size,1);assert(t.objects.has(peer+'/keep.txt'));assert(t.deletes()>=4);assert(t.journal().pending.includes('pre_auth_email_lineage_required'));assert(t.journal().pending.includes('accepted_upload_transfers_unverified'));assert.equal(t.journal().reconciliation.complete,false);assert.equal(t.journal().complete,false);assert.equal(t.journal().steps.at(-1).evidence.requiresTransferReconciliation,true);assert.equal(t.journal().steps.at(-1).evidence.finalErasure,false);
 for(const field of ['allIssuersStopped','legacyDeploymentsVerified','inflightWritersDrained','evidenceRef']){const x=setup();x.setTime('2026-09-30T00:00:00Z');delete x.journal().steps[2].evidence[field];await x.run();assert(x.journal().pending.includes('verified_issuer_shutdown_required'));assert.equal(x.deletes(),0);}
 for(const options of [{changed:true},{noMarker:true},{accountExists:true},{disk:true}]){const x=setup(options);x.setTime('2026-09-28T02:02:00Z');if(options.disk)await assert.rejects(x.run,/Disk full/);else await x.run();assert.equal(x.deletes(),0);assert.equal(x.journal().complete,false);}
 const late=setup({recreate:true});late.setTime('2026-09-28T02:02:00Z');await late.run();assert(late.journal().pending.includes('storage_objects_remaining_or_recreated'));assert.equal(late.journal().steps.at(-1).phase,'waitUploadExpiry');
 const wrong=setup();wrong.setTime('2026-09-28T02:02:00Z');wrong.journal().steps[2].evidence.accountId=peer;await wrong.run();assert.equal(wrong.deletes(),0);
 console.log('Final Storage operator: exact expiry boundary, scoped issuer proof, Auth-absent late-object discovery, durable batched retries, peer preservation and fail-closed completion passed. Isolated backend only.');
})().catch(e=>{console.error(e);process.exitCode=1});
