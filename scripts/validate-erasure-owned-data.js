'use strict';
const assert=require('node:assert/strict');
const {operator}=require('../lib/account-erasure-operator');
const {PHASES,INDIRECT,newJournal}=require('../lib/account-erasure-workflow');
const account='00000000-0000-4000-8000-000000000001',peer='00000000-0000-4000-8000-000000000002';
const startedAt='2026-09-27T00:00:00Z';
function setup(options={}){
 let exists=true,owned=2,saved,authDeletes=0,messageDeletes=0,loseMessage=options.loseMessage,loseAuth=options.loseAuth;
 const messages=[{sender:account,id:1},{sender:account,id:2},{sender:peer,id:3,replyTo:1}];
 let journal=newJournal(account,{verifiedAccountId:account,requestId:'isolated-test',verifiedAt:startedAt});
 journal.schemaFingerprint='reviewed';journal.phase='eraseOwnedData';journal.steps=PHASES.slice(0,4).map(phase=>({phase,evidence:phase==='freeze'?{startedAt}:{}}));
 const inventory=async()=>({schemaVersion:'erasure-inventory.v1',schemaFingerprint:options.schema||'reviewed',accountExists:exists,checkedAt:new Date().toISOString(),unsupportedReferences:0,unknownStorageObjects:0,references:[{schema_name:'public',table_name:'nothingsports_chat_messages',column_name:'sender_id',delete_action:'r',matching_rows:owned,guarded:true},{schema_name:'public',table_name:'nothingsports_user_state',column_name:'user_id',delete_action:'c',matching_rows:exists||options.residual?1:0,guarded:true},...(options.restrictive?[{schema_name:'public',table_name:'unexpected',column_name:'owner_id',delete_action:'r',matching_rows:1,guarded:true}]:[])],indirect:{...Object.fromEntries(INDIRECT.map(k=>[k,0])),known_storage_paths:options.storage||(!exists&&options.lateStorage?1:0),inflight_notification_sends:options.inflight||0,email_subscriptions:exists?0:null}});
 const call=async(url,settings={})=>{
  if(settings.method==='DELETE'){
   assert(saved,'Intent must be persisted before any delete');
   if(url.startsWith('/rest/')){
    assert.equal(url,'/rest/v1/nothingsports_chat_messages?sender_id=eq.'+account);
    assert.equal(saved.ownedDataIntent.accountId,account);messageDeletes++;
    if(!options.noop){for(let i=messages.length-1;i>=0;i--)if(messages[i].sender===account)messages.splice(i,1);owned=0;messages[0].replyTo=null;}
    if(loseMessage){loseMessage=false;throw Error('Lost message acknowledgement');}
   }else{
    assert.equal(url,'/auth/v1/admin/users/'+account);assert.equal(settings.body.should_soft_delete,false);assert.equal(saved.authDeletionIntent.accountId,account);assert.equal(saved.emailLineage.accountId,account);assert.equal(saved.emailLineage.operationId,journal.operationId);authDeletes++;
    if(!options.authNoop)exists=false;
    if(loseAuth){loseAuth=false;throw Error('Lost Auth acknowledgement');}
   }
   return {};
  }
  assert.equal(url,'/auth/v1/admin/users/'+account);
  return {id:account,email:options.email||' Test@Example.invalid ',email_confirmed_at:options.confirmed,app_metadata:{nothingsport_erasure_started_at:startedAt},banned_until:options.unbanned?'2020-01-01T00:00:00Z':'2099-01-01T00:00:00Z'};
 };
 const persist=async j=>{if(options.disk)throw Error('Disk full');saved=structuredClone(j);};
 const run=phase=>operator({environment:{SUPABASE_URL:'https://mkghopnkhcxtmfrcjdbc.supabase.co'},request:(url,settings)=>url==='/rest/v1/rpc/nothingsports_account_erasure_inventory'?inventory():call(url,settings)}).operations[phase]({accountId:account,journal,persist});
 const toAuth=()=>{journal.steps.push({phase:'eraseOwnedData',evidence:{ownedMessagesRemaining:0}});journal.phase='eraseAuth';};
 return {run,toAuth,messages,journal,counts:()=>({authDeletes,messageDeletes}),reload:()=>{journal=structuredClone(saved);},forceMissing:()=>{exists=false;},clearIntent:()=>{delete journal.authDeletionIntent;}};
}
(async()=>{
 const gated=setup();const stopped=await gated.run('drainIssuers');assert.equal(stopped.verified,false);assert(stopped.pending.includes('legacy_deployment_shutdown_evidence_required'));assert.deepEqual(gated.counts(),{authDeletes:0,messageDeletes:0});
 const normal=setup();assert.equal((await normal.run('eraseOwnedData')).verified,true);normal.toAuth();assert.equal((await normal.run('eraseAuth')).verified,true);assert.deepEqual(normal.messages,[{sender:peer,id:3,replyTo:null}]);
 const email=setup({confirmed:startedAt});await email.run('eraseOwnedData');email.toAuth();await email.run('eraseAuth');assert.equal(email.journal.emailLineage.normalizedEmail,'test@example.invalid');assert.equal(email.journal.emailLineage.status,'verified_current_email');
 assert.equal(normal.journal.emailLineage.status,'no_verified_current_email');assert.equal(normal.journal.emailLineage.normalizedEmail,undefined);
 const badEmail=setup({confirmed:'invalid'});await badEmail.run('eraseOwnedData');badEmail.toAuth();await assert.rejects(()=>badEmail.run('eraseAuth'),/verification evidence/);assert.equal(badEmail.counts().authDeletes,0);
 const lost=setup({loseMessage:true,loseAuth:true});await assert.rejects(()=>lost.run('eraseOwnedData'),/Lost message/);lost.reload();assert.equal((await lost.run('eraseOwnedData')).verified,true);assert.equal(lost.counts().messageDeletes,1);lost.toAuth();await assert.rejects(()=>lost.run('eraseAuth'),/Lost Auth/);lost.reload();const resumed=await lost.run('eraseAuth');assert.equal(resumed.verified,true);assert.equal(resumed.evidence.finalErasure,false);assert.equal(lost.counts().authDeletes,1,'No blind Auth replay after lost acknowledgement');
 for(const options of [{storage:1},{inflight:1},{schema:'changed'},{restrictive:true}]){const t=setup(options);assert.equal((await t.run('eraseOwnedData')).verified,false);assert.deepEqual(t.counts(),{authDeletes:0,messageDeletes:0});}
 for(const options of [{disk:true},{unbanned:true}]){const t=setup(options);await assert.rejects(()=>t.run('eraseOwnedData'));assert.deepEqual(t.counts(),{authDeletes:0,messageDeletes:0});}
 const late=setup({lateStorage:true});await late.run('eraseOwnedData');late.toAuth();const lateResult=await late.run('eraseAuth');assert.equal(lateResult.verified,true);assert.equal(lateResult.evidence.lateStorageObjects,1);assert.equal(lateResult.evidence.finalErasure,false);
 const diskOptions={};const authDisk=setup(diskOptions);await authDisk.run('eraseOwnedData');authDisk.toAuth();diskOptions.disk=true;await assert.rejects(()=>authDisk.run('eraseAuth'),/Disk full/);assert.equal(authDisk.counts().authDeletes,0);
 const missing=setup();await missing.run('eraseOwnedData');missing.toAuth();missing.forceMissing();await assert.rejects(()=>missing.run('eraseAuth'),/durable Auth deletion intent/);
 const wrong=setup();wrong.journal.steps.splice(2,1);await assert.rejects(()=>wrong.run('eraseOwnedData'),/preceding/);assert.equal(wrong.counts().messageDeletes,0);
 const noop=setup({noop:true});assert((await noop.run('eraseOwnedData')).pending.includes('owned_messages_remaining'));
 for(const options of [{authNoop:true},{residual:true}]){const t=setup(options);await t.run('eraseOwnedData');t.toAuth();assert.equal((await t.run('eraseAuth')).verified,false);}
 console.log('Owned-data/Auth adapters: exact scope, required prior phases, durable intent, lost-response resume, fresh schema/storage/send gates and incomplete deletion detection passed. Isolated backend; no production erasure.');
})().catch(e=>{console.error(e);process.exitCode=1});
