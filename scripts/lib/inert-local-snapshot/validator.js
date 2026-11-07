'use strict';
// Validates an envelope against independently supplied source evidence.
// It cannot write storage, restore, rebase receipts, replay pins or authenticate.
const p=require('./policy');
function receipt(value,binding){
 if(value===null)return;
 p.exactKeys(value,['ownerId','generation','receiptId','baseUpdatedAt','basePreferences','preferences']);
 if(value.ownerId!==binding.accountId||value.generation!==binding.generation)p.fail('OWNER_OR_GENERATION_MISMATCH');
 if(typeof value.receiptId!=='string'||!value.receiptId.startsWith('preference-edit:')||!(value.baseUpdatedAt===null||typeof value.baseUpdatedAt==='string'))p.fail('INVALID_RECEIPT');
 p.preferences(value.basePreferences);p.preferences(value.preferences);
}
function bundle(value,binding){
 const known=('schemaVersion profile preferences domainPreferences competitionPreferences entityFollows viewingPreference learningPreference ratings eventUserState eventSpoilerState archivedEvents preferenceSync').split(' ');
 if(!p.record(value)||Object.keys(value).some(k=>!known.includes(k))||value.schemaVersion!==6||value.profile?.id!==binding.profileId)p.fail('UNSUPPORTED_PROFILE');
 if(!p.record(value.profile)||Object.keys(value.profile).some(key=>!['id','usernameLabel','createdAt','updatedAt','schemaVersion','onboardingCompleted','timezone'].includes(key)))p.fail('UNSUPPORTED_PROFILE');
 if(value.preferences!==null)p.preferences(value.preferences);
 if(value.preferenceSync!==undefined){
  p.exactKeys(value.preferenceSync,['writer','entries']);
  if(value.preferenceSync.writer!=='owned-preference-intent.v1'||!Array.isArray(value.preferenceSync.entries)||value.preferenceSync.entries.length>1)p.fail('UNSUPPORTED_RECEIPT_SET');
  for(const entry of value.preferenceSync.entries)receipt(entry,binding);
 }
}
function baseline(value,binding,accepted){
 if(value===null)return;
 if(!p.record(value))p.fail('INVALID_BASELINE');
 if(accepted){
  p.exactKeys(value,['state','updatedAt','accountId','generation']);
  if(value.accountId!==binding.accountId||value.generation!==binding.generation)p.fail('OWNER_OR_GENERATION_MISMATCH');
  if(!p.record(value.state))p.fail('INVALID_BASELINE');
  p.preferences(value.state.preferences);
 }else if(Object.hasOwn(value,'preferences'))p.preferences(value.preferences);
}
function validate(text,expectedBinding,reference){
 p.inspect(expectedBinding);p.scope(expectedBinding);
 const envelope=p.parse(text);
 p.exactKeys(envelope,['format','binding','ram','storage','coverage','omissions','restorePolicy']);
 if(envelope.format!=='local-recovery-snapshot.v1')p.fail('UNSUPPORTED_FORMAT');
 p.scope(envelope.binding);if(!p.equal(envelope.binding,expectedBinding))p.fail('OWNER_OR_GENERATION_MISMATCH');
 if(!p.equal(envelope.coverage,p.coverage)||!p.equal(envelope.omissions,p.omissions)||envelope.restorePolicy!=='EVIDENCE_ONLY_NO_RESTORE_REBASE_OR_REPLAY')p.fail('INVALID_COVERAGE');
 p.exactKeys(envelope.ram,p.ramKeys);
 if(!p.equal(envelope.ram.binding,expectedBinding))p.fail('OWNER_OR_GENERATION_MISMATCH');
 p.preferences(envelope.ram.preferences);bundle(envelope.ram.activeProfileBundle,expectedBinding);
 receipt(envelope.ram.pendingReceipt,expectedBinding);
 baseline(envelope.ram.acceptedBaseline,expectedBinding,true);baseline(envelope.ram.startupBaseline,expectedBinding,false);
 for(const key of ['eventUserState','eventSpoilerState','ratings','fixturePinQueue'])if(!p.record(envelope.ram[key]))p.fail('INVALID_STATE');
 if(!Array.isArray(envelope.ram.archivedEvents))p.fail('INVALID_STATE');
 const keys=p.storageKeys(expectedBinding);
 if(!Array.isArray(envelope.storage)||envelope.storage.length!==keys.length)p.fail('INVALID_STORAGE_SET');
 const parsed=[];
 envelope.storage.forEach((entry,i)=>{p.exactKeys(entry,['key','text']);if(entry.key!==keys[i]||!(entry.text===null||typeof entry.text==='string'))p.fail('INVALID_STORAGE_SET');parsed.push(entry.text===null?null:p.parse(entry.text));});
 if(parsed[0]?.activeProfileId!==expectedBinding.profileId||parsed[1]!==expectedBinding.profileId)p.fail('PROFILE_POINTER_MISMATCH');
 bundle(parsed[2],expectedBinding);
 if(parsed[3]!==null&&!p.record(parsed[3]))p.fail('INVALID_PIN_QUEUE');
 const pending=parsed[2].preferenceSync?.entries?.[0]||null;
 if(!p.equal(pending,envelope.ram.pendingReceipt))p.fail('RECEIPT_EVIDENCE_MISMATCH');
 // Required independent originals prevent a self-consistent but incomplete export
 // from being described as a lossless capture. This comparison never reads storage.
 p.exactKeys(reference,['ram','storage']);p.inspect(reference);
 if(!p.equal(reference.ram,envelope.ram)||!p.equal(reference.storage,envelope.storage))p.fail('ROUNDTRIP_MISMATCH');
 return Object.freeze({valid:true,losslessAgainstProvidedReference:true,restoreSafe:false,receiptReplayAllowed:false,
  freshServerBackedUp:false,omissions:p.omissions});
}
function validateSnapshot(text,expectedBinding,reference){try{return validate(text,expectedBinding,reference);}catch(error){p.safeFailure(error);}}
module.exports=Object.freeze({validateSnapshot});
