'use strict';
// Offline data rules only. No globals, browser storage, I/O, logging or execution.
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const preferenceRoots=new Set(('version cricketCoverageVersion discoveryCatalogueVersion aflFamilyMigration theme selectedSelectorEntityIds followedSports taxonomySelection selectedBroadcasters localVenueIds fantasyDeadlines showSpoilers feedIntent feedControls standings swipeCoaching onboardingComplete pilotMeasurement ratingPromptState followBrowse feedCompact eventsScope preferenceGraph followFirst tennis fifa').split(' '));
const forbidden=new Set(('auth authentication authorization password passphrase credentials credential cookie cookies session sessionid sessiontoken accesstoken refreshtoken idtoken apikey clientsecret secret token calendartoken calendarurl subscriptionurl').split(' '));
const coverage=Object.freeze(['exact_ram_preferences_and_bundle','exact_persisted_active_profile','original_pending_receipt_evidence','accepted_and_startup_baselines_not_fresh_server','event_actions_and_removals','spoiler_ratings_archive_state','ram_and_persisted_fixture_pin_queue']);
const omissions=Object.freeze(['auth_sessions_and_credentials','fresh_server_snapshot','other_profiles','cookies_caches_chat_media_and_drafts','calendar_secrets','os_push_installation','restore_rebase_replay_and_account_reauthentication','atomic_cross_store_or_server_snapshot']);
const ramKeys=Object.freeze(['binding','preferences','activeProfileBundle','pendingReceipt','acceptedBaseline','startupBaseline','eventUserState','eventSpoilerState','ratings','archivedEvents','fixturePinQueue']);
function exactKeys(value,keys){if(!record(value)||Object.keys(value).length!==keys.length||!keys.every(key=>Object.hasOwn(value,key)))fail('INVALID_SHAPE');}
function scope(value){
 exactKeys(value,['accountId','profileId','generation','shellVersion','workerVersion']);
 for(const key of ['accountId','profileId'])if(typeof value[key]!=='string'||!/^[-A-Za-z0-9:_]{1,128}$/.test(value[key]))fail('INVALID_BINDING');
 if(!Number.isSafeInteger(value.generation)||value.generation<0)fail('INVALID_BINDING');
 for(const key of ['shellVersion','workerVersion'])if(typeof value[key]!=='string'||!/^\d{1,6}$/.test(value[key]))fail('INVALID_VERSION');
}
function storageKeys(binding){return ['ns_install_v1','ns_active_profile_id_v1','ns_profile_v1:'+binding.profileId,'ns_fixture_pin_queue_v1'];}
function inspect(value){
 const seen=new Set();let nodes=0;
 function visit(item,depth){
  if(++nodes>200000||depth>64)fail('CAPACITY_EXCEEDED');
  if(item===null||typeof item==='boolean')return;
  if(typeof item==='number'){if(!Number.isFinite(item)||Object.is(item,-0))fail('NON_JSON_DATA');return;}
  if(typeof item==='string'){
   if(item.length>2000000)fail('CAPACITY_EXCEEDED');
   if(/https?:\/\/\S*[?#]|\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN [^-]*PRIVATE KEY-----|(?:password|access_token|refresh_token|api_key|secret|token)\s*[=:]|webcal:|https?:\/\/[^\s]*?(?:@|\/calendars?(?:\/|\?)|\.ics(?:\?|$))/i.test(item))fail('SENSITIVE_CONTENT');
   return;
  }
  if(typeof item!=='object'||seen.has(item))fail('NON_JSON_DATA');
  const prototype=Object.getPrototypeOf(item);
  if(!Array.isArray(item)&&prototype!==Object.prototype&&prototype!==null)fail('NON_JSON_DATA');
  if(Object.getOwnPropertySymbols(item).length)fail('NON_JSON_DATA');
  seen.add(item);
  const descriptors=Object.getOwnPropertyDescriptors(item);
  if(Array.isArray(item)&&Object.keys(item).length!==item.length)fail('NON_JSON_DATA');
  for(const [key,descriptor]of Object.entries(descriptors)){
   if(Array.isArray(item)&&key==='length')continue;
   if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))fail('NON_JSON_DATA');
   const normal=key.toLowerCase().replace(/[^a-z0-9]/g,'');
   if(['__proto__','prototype','constructor'].includes(key)||forbidden.has(normal)||/(?:token|secret|password)$/.test(normal))fail('SENSITIVE_CONTENT');
   visit(descriptor.value,depth+1);
  }
  seen.delete(item);
 }
 visit(value,0);
}
function safeFailure(error){
 const codes=('INVALID_SHAPE INVALID_BINDING INVALID_VERSION CAPACITY_EXCEEDED NON_JSON_DATA SENSITIVE_CONTENT INVALID_PREFERENCES UNCLASSIFIED_PREFERENCE INVALID_JSON OWNER_OR_GENERATION_MISMATCH INVALID_RECEIPT UNSUPPORTED_PROFILE UNSUPPORTED_RECEIPT_SET INVALID_BASELINE UNSUPPORTED_FORMAT INVALID_COVERAGE INVALID_STATE INVALID_STORAGE_SET PROFILE_POINTER_MISMATCH INVALID_PIN_QUEUE RECEIPT_EVIDENCE_MISMATCH ROUNDTRIP_MISMATCH READ_ADAPTERS_REQUIRED SNAPSHOT_REJECTED').split(' ');
 fail(codes.includes(error?.code)?error.code:'SNAPSHOT_REJECTED');
}
function preferences(value){
 if(!record(value))fail('INVALID_PREFERENCES');
 for(const key of Object.keys(value))if(!preferenceRoots.has(key))fail('UNCLASSIFIED_PREFERENCE');
 const known={
  preferenceGraph:'schemaVersion profileId updatedAt entityFollows domainPreferences competitionPreferences viewing learning',
  followFirst:'schemaVersion startupMeta appliedSeedHash australiaInternationalsEnabled australiansOnlySportIds followedMajorEventIds excludedMajorEventIds eventFamilyDecisions eventEditionDecisions collectionFollows codeInteractions location subscriptions notifications refinement feedback',
  tennis:'enthusiasm gender eventType round',fifa:'enthusiasm stage contenders',
 };
 for(const [key,keys]of Object.entries(known))if(record(value[key])&&Object.keys(value[key]).some(name=>!keys.split(' ').includes(name)))fail('UNCLASSIFIED_PREFERENCE');
 // Preserve classified nested choices exactly; recognizable secrets still block.
 inspect(value);
}
function parse(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>8000000)fail('CAPACITY_EXCEEDED');let value;try{value=JSON.parse(text);}catch{fail('INVALID_JSON');}inspect(value);return value;}
function equal(a,b){
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
 return record(a)&&record(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
}
module.exports=Object.freeze({fail,safeFailure,record,exactKeys,scope,storageKeys,inspect,preferences,parse,equal,coverage,omissions,ramKeys});
