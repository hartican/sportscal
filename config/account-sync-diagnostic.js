(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.NOTHINGSPORTS_SYNC_DIAGNOSTIC=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const stages=new Set(['prepare','read','verify','save','save-response','acknowledge','apply','complete']);
  const codes={
    preference_base_changed:'guarded_hold',user_state_conflict:'conflict',user_state_identity_mismatch:'identity',
    request_timeout:'timeout',server_response_invalid:'response',user_state_too_large:'api',
    server_sync_failed:'service',supabase_timeout:'service',server_sync_request_failed:'http',
    missing_session:'auth',refresh_session_terminal:'auth',refresh_session_retryable:'auth',
    invalid_refresh_token:'auth',refresh_token_not_found:'auth',refresh_token_already_used:'auth',refresh_token_revoked:'auth',
  };
  function classify(error){
    const code=typeof error?.code==='string'&&Object.hasOwn(codes,error.code)?error.code:'unclassified';
    const status=Number.isInteger(error?.status)&&error.status>=100&&error.status<=599?error.status:null;
    const category=code!=='unclassified'?codes[code]
      :error?.name==='QuotaExceededError'?'local_storage'
      :error?.name==='SecurityError'?'local_security':status?'http':'unknown';
    return {code,category,status};
  }
  const version=value=>typeof value==='string'&&/^\d{1,6}$/.test(value)?value:null;
  const bool=value=>typeof value==='boolean'?value:null;
  // These names are code-owned families, never paths/keys from account data.
  const rootFamilies={version:'format',cricketCoverageVersion:'format',discoveryCatalogueVersion:'format',aflFamilyMigration:'selection',theme:'appearance',
    selectedSelectorEntityIds:'selection',followedSports:'selection',taxonomySelection:'selection',
    selectedBroadcasters:'viewing',localVenueIds:'location',fantasyDeadlines:'fantasy',
    showSpoilers:'feed',feedIntent:'feed',feedControls:'feed',standings:'standings',
    swipeCoaching:'coaching',onboardingComplete:'onboarding',pilotMeasurement:'measurement',
    ratingPromptState:'ratingPrompt',followBrowse:'localView',feedCompact:'localView',eventsScope:'localView'};
  const nestedFamilies={
    preferenceGraph:{schemaVersion:'format',profileId:'bookkeeping',updatedAt:'bookkeeping',
      entityFollows:'entities',domainPreferences:'domains',competitionPreferences:'competitions',viewing:'viewing',learning:'learning'},
    followFirst:{schemaVersion:'format',startupMeta:'metadata',appliedSeedHash:'bookkeeping',
      australiaInternationalsEnabled:'internationalFilters',australiansOnlySportIds:'internationalFilters',
      followedMajorEventIds:'eventDecisions',excludedMajorEventIds:'eventDecisions',eventFamilyDecisions:'eventDecisions',eventEditionDecisions:'eventDecisions',
      collectionFollows:'collections',codeInteractions:'activity',location:'location',subscriptions:'subscriptions',
      notifications:'notifications',refinement:'refinement',feedback:'feedback'},
  };
  const families=Object.freeze([...new Set([...Object.values(rootFamilies),...Object.values(nestedFamilies).flatMap(Object.values),'unknown'])]);
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  function partitions(value){
    const parts=Object.fromEntries(families.map(family=>[family,{preferenceGraph:Object.create(null),followFirst:Object.create(null)}]));
    for(const [key,item] of Object.entries(value)){
      const nested=Object.hasOwn(nestedFamilies,key)?nestedFamilies[key]:null;
      if(nested&&object(item)){
        for(const [leaf,entry] of Object.entries(item)){
          const family=Object.hasOwn(nested,leaf)?nested[leaf]:'unknown';
          Object.defineProperty(parts[family][key],leaf,{value:entry,enumerable:true,configurable:true});
        }
      }else{
        const family=Object.hasOwn(rootFamilies,key)?rootFamilies[key]:'unknown';
        Object.defineProperty(parts[family],key,{value:item,enumerable:true,configurable:true});
      }
    }
    return parts;
  }
  function containerShapes(value){
    return Object.fromEntries(Object.keys(nestedFamilies).filter(key=>Object.hasOwn(value,key))
      .map(key=>[key,object(value[key])?{}:value[key]]));
  }
  function changedFamilies(first,second,compare){
    const before=partitions(first),after=partitions(second);
    const changed=families.filter(family=>!compare(before[family],after[family]));
    // Fixed partitions erase parent presence; compare that shape independently
    // so a known change cannot conceal a simultaneous structural difference.
    const shapeChanged=!compare(containerShapes(first),containerShapes(second));
    if(!changed.includes('unknown')&&(shapeChanged||(!changed.length&&!compare(first,second))))changed.push('unknown');
    return changed;
  }
  function preferenceDifferences(receipt,remote,compare,accepted){
    try{
      if(!object(receipt?.basePreferences)||!object(receipt?.preferences)||!object(remote))return null;
      return {baseToRemote:changedFamilies(receipt.basePreferences,remote,compare),
        localEdits:changedFamilies(receipt.basePreferences,receipt.preferences,compare),
        localToRemote:changedFamilies(receipt.preferences,remote,compare),
        receiptBaseMatchesAccepted:object(accepted)?compare(receipt.basePreferences,accepted):null};
    }catch(_error){return null;}
  }
  function safeDifferences(value){
    if(!object(value))return null;
    if(!['baseToRemote','localEdits','localToRemote'].every(key=>Array.isArray(value[key])))return null;
    const list=input=>families.filter(family=>input.includes(family)||(family==='unknown'&&input.some(item=>!families.includes(item))));
    return {baseToRemote:list(value.baseToRemote),localEdits:list(value.localEdits),localToRemote:list(value.localToRemote),
      receiptBaseMatchesAccepted:bool(value.receiptBaseMatchesAccepted)};
  }
  // Shared private ordinal codebook keeps diagnostics inside the unchanged shell budget.
  // Producers and recorder both decode/safelist; only fixed text labels are copied.
  const guardSiteNames=['helper','owned_current','compatibility','plan_envelope','plan_shape','plan_scope','record_validation','record_merge','verify_fallback','ack_scope','ack_semantic','ack_witness','ack_continuation','inflight_preserve','unexpected'];
  const guardSites=new Set(guardSiteNames);
  const guardReasonNames=('helper_unavailable no_receipt owner_scope_rejected generation_scope_rejected scope_observed current_shape_invalid current_view_invalid current_differs_from_receipt receipt_shape_invalid receipt_id_invalid receipt_owner_invalid receipt_generation_invalid base_time_unavailable base_time_invalid remote_time_unavailable remote_time_invalid preferences_shape_invalid graph_shape_invalid view_shape_invalid view_unknown_field view_field_invalid outside_supported_scope_changed list_shape_invalid record_shape_invalid record_identity_invalid record_unknown_field record_field_invalid entity_level_invalid domain_identity_invalid identity_unavailable identity_collision concurrent_empty_reset concurrent_add delete_vs_edit edit_vs_delete concurrent_field_change remote_state_unavailable base_or_intent_incompatible compatible_base compatible_intent independent_plan ack_scope_rejected ack_semantics_mismatch ack_current_receipt_unavailable ack_original_witness_invalid ack_original_receipt_changed ack_patch_unavailable ack_newer_generation_rejected ack_time_invalid ack_newer_base_incompatible continuation_refused inflight_preserve_failed comparison_exception patch_exception identity_exception storage_exception unexpected_exception').split(' ');
  const guardReasons=new Set(guardReasonNames);
  const guardDecisions=new Set(['held','exception','retained','compatible','planned','unavailable']);
  function safeGuard(value){
    if(!object(value))return null;
    const site=Number.isInteger(value.site)?guardSiteNames[value.site]:value.site,reason=Number.isInteger(value.reason)?guardReasonNames[value.reason]:value.reason;
    if(!guardSites.has(site)||!guardReasons.has(reason)||!guardDecisions.has(value.decision))return null;
    return {format:'preference-guard.v1',site,decision:value.decision,reason,
      side:['base','intent','remote','current'].includes(value.side)?value.side:null,
      family:['localView','entities','domains','other'].includes(value.family)?value.family:null,
      receiptOwnerMatches:bool(value.receiptOwnerMatches),receiptGenerationMatches:bool(value.receiptGenerationMatches),
      currentToReceipt:Array.isArray(value.currentToReceipt)?families.filter(family=>value.currentToReceipt.includes(family)||(family==='unknown'&&value.currentToReceipt.some(item=>!families.includes(item)))):null};
  }
  function create({now=Date.now}={}){
    let last=null;
    function valid(job){
      if(last!==job)return false;
      try{if(job.current())return true;}catch(_error){}
      last=null;return false;
    }
    function update(job,payload,stage,receipt){
      if(!valid(job))return false;
      try{
        const facts=job.facts(payload,stage,receipt)||{};
        for(const key of ['pendingReceipt','ownerMatches','generationMatches'])job.record[key]=bool(facts[key]);
        job.record.preferenceDifferences=safeDifferences(facts.preferenceDifferences);
      }catch(_error){for(const key of ['pendingReceipt','baseCompatible','ownerMatches','generationMatches','preferenceDifferences'])job.record[key]=null;}
      return true;
    }
    function snapshot(){
      if(!last||!valid(last))return null;
      const elapsed=(last.ended??now())-last.started;
      return {...last.record,elapsedMs:Number.isFinite(elapsed)?Math.max(0,Math.min(3600000,Math.round(elapsed))):null};
    }
    function begin({current,facts,versions={}}){
      try{
        if(!current())return;
        const job={current,facts,started:now(),record:{format:'sync-diagnostic.v1',stage:'prepare',
          code:null,category:'in_progress',status:null,completed:false,saveResponseReceived:false,
          shellVersion:version(versions.shellVersion),workerVersion:version(versions.workerVersion),
          pendingReceipt:null,baseCompatible:null,ownerMatches:null,generationMatches:null,preferenceDifferences:null,preferenceGuard:null,
          stateLoadCallsStarted:0,stateSaveCallsStarted:0}};
        last=job;update(job,undefined,'prepare');
        return {
          guard(value){try{
            if(!valid(job))return;
            const produced=safeGuard(value);const safe=safeGuard(produced);if(!safe)return;
            const prior=job.record.preferenceGuard;
            if(prior&&['held','exception','retained'].includes(prior.decision))return;
            if(prior&&safe.reason==='base_or_intent_incompatible')return;
            job.record.preferenceGuard={...safe,verifyPass:job.record.stateLoadCallsStarted>1?'after_conflict':'initial',
              receiptOwnerMatches:safe.receiptOwnerMatches??prior?.receiptOwnerMatches??null,
              receiptGenerationMatches:safe.receiptGenerationMatches??prior?.receiptGenerationMatches??null};
          }catch(_error){}},
          step(stage,payload,receipt){try{
            if(!update(job,payload,stage,receipt))return;
            if(stage==='read')job.record.stateLoadCallsStarted=Math.min(3,job.record.stateLoadCallsStarted+1);
            if(stage==='save')job.record.stateSaveCallsStarted=Math.min(3,job.record.stateSaveCallsStarted+1);
            if(stage==='verify')job.record.preferenceGuard=null;
            job.record.stage=stages.has(stage)?stage:'unknown';
            if(stage==='save'||stage==='acknowledge')job.record.baseCompatible=true;
            if(stage==='save-response')job.record.saveResponseReceived=true;
            if(stage==='complete'){
              job.ended=now();
              job.record.completed=job.record.pendingReceipt===false;
              job.record.category=job.record.completed?'completed':'pending';
            }
          }catch(_error){}},
          fail(error){try{if(update(job,undefined,'failure')){Object.assign(job.record,classify(error));job.record.completed=false;job.ended=now();if(error?.code==='preference_base_changed')job.record.baseCompatible=false;}}catch(_error){}},
        };
      }catch(_error){return;}
    }
    function capture(){const job=last,detail=snapshot();return detail?{detail,current:()=>valid(job)}:null;}
    return Object.freeze({begin,snapshot,capture});
  }
  return Object.freeze({create,classify,preferenceDifferences,guardFact:safeGuard,currentPreferenceDifferences(first,second,compare){try{return object(first)&&object(second)?changedFamilies(first,second,compare):null;}catch(_error){return null;}}});
});
