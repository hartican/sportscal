(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const same=(a,b)=>{
    if(a===b)return true;
    if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((value,i)=>same(value,b[i]));
    if(!object(a)||!object(b))return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&same(a[key],b[key]));
  };
  const text=value=>typeof value==='string';
  const strings=value=>Array.isArray(value)&&value.every(text)&&new Set(value).size===value.length;
  const boolean=value=>typeof value==='boolean';
  const gender=value=>['all','men','women','open'].includes(value);
  const domainFields={profileId:text,sportDomainId:text,taxonomyNodeId:value=>value===null||text(value),
    enabled:boolean,templateId:value=>['template:casual','template:like','template:froth','template:custom'].includes(value),
    includeAllFixtures:boolean,includeMajorEvents:boolean,includeFollowedTeams:boolean,
    narrativeVisibility:value=>['allEligible','importantOnly','off'].includes(value),
    narrativeIntensity:value=>Number.isFinite(value)&&value>=0&&value<=5,
    editorialSensitivity:value=>['low','medium','high'].includes(value),reminderDefault:value=>['allFollowed','importantOnly','off'].includes(value),
    scopedCompetitionIds:strings,scopedTaxonomyNodeIds:strings};
  const entityFields={profileId:text,participantId:text,followLevel:value=>['follow','priority','unfollow','mute'].includes(value),
    cricketFormats:value=>strings(value)&&value.every(format=>['Tests','ODIs','T20Is','BBL','Shield','One Day Cup'].includes(format))};

  function emit(observe,site,reason,side=null,family=null,decision='held',scope={}){
    try{const fact=root.NOTHINGSPORTS_SYNC_DIAGNOSTIC?.guardFact({site,reason,side,family,decision,...scope});if(fact)observe?.(fact);}catch(_error){}
  }
  function localView(preferences,observe,side,site=4){
    const invalid=reason=>{emit(observe,site,reason,side,'localView');return false;};
    if(preferences.feedCompact!==undefined&&!boolean(preferences.feedCompact))return invalid(20/*view_field_invalid*/);
    if(preferences.followBrowse===undefined)return true;
    const browse=preferences.followBrowse;
    const fields={sportId:text,categoryId:text,section:value=>['teams-players','schedule'].includes(value),
      page:value=>Number.isSafeInteger(value)&&value>=0,
      gender,genderBySport:value=>object(value)&&Object.entries(value).every(([id,choice])=>id.startsWith('sport:')
        &&Object.hasOwn(root.NOTHINGSPORTS_SELECTOR_TAXONOMY?.byId||{},id)&&gender(choice)),
      scheduleScope:value=>value===null||(object(value)&&Object.keys(value).length===4
        &&['codeId','tournamentId','competitionId','label'].every(key=>text(value[key])))};
    if(!object(browse))return invalid(18/*view_shape_invalid*/);
    return Object.keys(browse).every(key=>!Object.hasOwn(fields,key)?invalid(19/*view_unknown_field*/)
      :fields[key](browse[key])||invalid(20/*view_field_invalid*/));
  }

  function withoutViews(preferences){
    const result=clone(preferences);delete result.followBrowse;delete result.feedCompact;return result;
  }

  function excludeAgreedEventDecisions(values,outside,follow){
    const fields=['followedMajorEventIds','excludedMajorEventIds','eventFamilyDecisions','eventEditionDecisions'];
    const first=values.map(value=>value.followFirst);
    if(!first.every(object))return;
    if(!fields.some(key=>!same(first[0][key],first[1][key])||!same(first[0][key],first[2][key])))return;
    let canonical;
    try{canonical=values.map(value=>follow.migratePreferences(clone(value)).followFirst);}catch{return;}
    // Reuse the current canonical event rules as a read-only check. Never use
    // their coerced/defaulted output as a decision or write it into a receipt.
    if(!first.every((value,index)=>fields.every(key=>Object.hasOwn(value,key)===Object.hasOwn(canonical[index],key)
      &&same(value[key],canonical[index][key]))))return;
    for(const key of fields){
      if(!Object.hasOwn(first[1],key)||!Object.hasOwn(first[2],key)||!same(first[1][key],first[2][key]))continue;
      // These exact decisions already agree with the fresh server read. Keep
      // them there; only the existing entity/domain plan may produce writes.
      for(const value of outside)delete value.followFirst[key];
    }
    return fields;
  }

  function records(list,key,fields,identity,observe,side){
    const family=key==='participantId'?'entities':'domains';
    const invalid=(reason,message)=>{emit(observe,6,reason,side,family);throw Error(message);};
    if(!Array.isArray(list))return invalid(22/*list_shape_invalid*/,'Unknown preference list');
    const result=new Map();
    for(const record of list){
      if(!object(record))return invalid(23/*record_shape_invalid*/,'Unknown preference record');
      if(!text(record[key])||!record[key])return invalid(24/*record_identity_invalid*/,'Unknown preference record');
      for(const name of Object.keys(record)){
        if(!Object.hasOwn(fields,name))return invalid(25/*record_unknown_field*/,'Unknown preference record');
        if(!fields[name](record[name]))return invalid(26/*record_field_invalid*/,'Unknown preference record');
      }
      if(key==='participantId'&&!entityFields.followLevel(record.followLevel))return invalid(27/*entity_level_invalid*/,'Unknown Follow level');
      if(key==='sportDomainId'&&(!/^sport:[a-z0-9-]+$/.test(record[key])||record[key]==='sport:rally'))return invalid(28/*domain_identity_invalid*/,'Unknown domain identity');
      let id;
      try{id=identity(record[key]);}catch(error){emit(observe,6/*record_validation*/,54/*identity_exception*/,side,family,'exception');throw error;}
      if(!text(id)||!id)return invalid(29/*identity_unavailable*/,'Ambiguous preference identity');
      if(result.has(id))return invalid(30/*identity_collision*/,'Ambiguous preference identity');
      result.set(id,record);
    }
    return result;
  }

  function decision(record){
    if(!record)return record;
    const result={...record};delete result.profileId;return result;
  }

  function mergeRecords(base,intent,remote,key,fields,identity,observe){
    const before=records(base,key,fields,identity,observe,'base'),desired=records(intent,key,fields,identity,observe,'intent'),latest=records(remote,key,fields,identity,observe,'remote');
    const conflict=(reason,message)=>{emit(observe,7,reason,'remote',key==='participantId'?'entities':'domains');throw Error(message);};
    const result=new Map(latest);
    // Empty is a reset, not permission to discard unseen remote additions.
    if(!intent.length&&base.length&&[...latest.keys()].some(id=>!before.has(id)))conflict(31,'Concurrent reset');
    for(const id of new Set([...before.keys(),...desired.keys()])){
      const b=before.get(id),l=desired.get(id),r=latest.get(id);
      if(same(decision(b),decision(l)))continue;
      if(!b||!l||!r){
        if(same(decision(r),decision(l)))continue;
        if(!same(decision(r),decision(b)))conflict(!b?32:!l?33:34,'Concurrent record change');
        if(l)result.set(id,clone(l));else result.delete(id);
        continue;
      }
      // Stable aliases establish identity, never permission to rewrite it.
      const next={...r};
      for(const name of new Set([...Object.keys(b),...Object.keys(l)])){
        if(name==='profileId'||name===key)continue;
        if(same(b[name],l[name])&&Object.hasOwn(b,name)===Object.hasOwn(l,name))continue;
        const equal=value=>same(value[name],l[name])&&Object.hasOwn(value,name)===Object.hasOwn(l,name);
        const unchanged=same(r[name],b[name])&&Object.hasOwn(r,name)===Object.hasOwn(b,name);
        if(!equal(r)&&!unchanged)conflict(35,'Concurrent field change');
        if(Object.hasOwn(l,name))next[name]=clone(l[name]);else delete next[name];
      }
      result.set(id,next);
    }
    return [...result.values()];
  }

  function plan(receipt,state,profile,follow,patches,observe){
    try{
      const refuse=(reason,side=null,site=3)=>{emit(observe,site,reason,side);return null;};
      if(!object(receipt)||Object.keys(receipt).length!==6)return refuse(8/*receipt_shape_invalid*/);
      if(!text(receipt.receiptId)||!receipt.receiptId.startsWith('preference-edit:'))return refuse(9/*receipt_id_invalid*/);
      if(!text(receipt.ownerId)||!receipt.ownerId)return refuse(10/*receipt_owner_invalid*/);
      if(!Number.isSafeInteger(receipt.generation)||receipt.generation<0)return refuse(11/*receipt_generation_invalid*/);
      if(!text(receipt.baseUpdatedAt))return refuse(12/*base_time_unavailable*/,'base');
      if(!Number.isFinite(Date.parse(receipt.baseUpdatedAt)))return refuse(13/*base_time_invalid*/,'base');
      if(!text(state?.updatedAt))return refuse(14/*remote_time_unavailable*/,'remote');
      if(!Number.isFinite(Date.parse(state.updatedAt)))return refuse(15/*remote_time_invalid*/,'remote');
      const values=[receipt.basePreferences,receipt.preferences,state.preferences];
      for(const [index,value] of values.entries()){
        const side=['base','intent','remote'][index];
        if(!object(value))return refuse(16/*preferences_shape_invalid*/,side,4);
        if(!object(value.preferenceGraph))return refuse(17/*graph_shape_invalid*/,side,4);
        if(!localView(value,observe,side))return null;
      }
      const outside=values.map(value=>{
        const result=clone(value);delete result.followBrowse;delete result.feedCompact;
        delete result.preferenceGraph.entityFollows;delete result.preferenceGraph.domainPreferences;return result;
      });
      const agreedEvents=excludeAgreedEventDecisions(values,outside,follow);
      if(!profile.preferenceBaseMatches({basePreferences:outside[0]},outside[1]))return refuse(21/*outside_supported_scope_changed*/,'intent',5);
      if(!profile.preferenceBaseMatches({basePreferences:outside[0]},outside[2]))return refuse(21/*outside_supported_scope_changed*/,'remote',5);
      const preferences=clone(state.preferences),graphs=values.map(value=>value.preferenceGraph);
      preferences.preferenceGraph.entityFollows=mergeRecords(...graphs.map(graph=>graph.entityFollows),'participantId',entityFields,follow.participantFollowIdentityKey,observe);
      preferences.preferenceGraph.domainPreferences=mergeRecords(...graphs.map(graph=>graph.domainPreferences),'sportDomainId',domainFields,value=>value,observe);
      // Remote view values stay on the server; applyServerState retains this device's views.
      const witness={...clone(receipt),baseUpdatedAt:state.updatedAt,basePreferences:clone(state.preferences),preferences};
      if(agreedEvents)witness.acceptsAcknowledgement=value=>object(value?.followFirst)&&agreedEvents.every(key=>
        Object.hasOwn(witness.basePreferences.followFirst,key)===Object.hasOwn(value.followFirst,key)
        &&same(witness.basePreferences.followFirst[key],value.followFirst[key]));
      // An older ACK can carry R2 forward only from the exact recorded R1
      // intent, using this same conflict policy against the acknowledged state.
      witness.originalReceipt=clone(receipt);
      let continuedPreferences,continuedIntent;
      witness.continue=(pending,ack)=>{
        continuedIntent=clone(pending.preferences);
        continuedPreferences=plan({...pending,basePreferences:receipt.preferences},ack,profile,follow,patches,fact=>emit(observe,12,fact.reason,fact.side,fact.family,fact.decision))?.receipt.preferences;
        return continuedPreferences;
      };
      const changes=patches.createPatch({preferences:state.preferences},{preferences}).changes;
      function preserve(state,currentPreferences){
        const preserveObserve=fact=>emit(observe,13,fact.reason,fact.side,fact.family,'retained');
        if(!continuedPreferences)return state;
        try{
          // Preserve ordinary writes made after the R2 snapshot as the existing
          // in-flight apply owner does. They are not added to the owned receipt;
          // the next explicit sync holds any unaccounted projected choices.
          const remaining=patches.createPatch({preferences:continuedIntent},{preferences:currentPreferences});
          const preferences=patches.applyPatch({preferences:continuedPreferences},remaining).preferences;
          const graphs=[continuedIntent,currentPreferences,continuedPreferences].map(value=>value.preferenceGraph);
          preferences.preferenceGraph.entityFollows=mergeRecords(...graphs.map(graph=>graph.entityFollows),'participantId',entityFields,follow.participantFollowIdentityKey,preserveObserve);
          preferences.preferenceGraph.domainPreferences=mergeRecords(...graphs.map(graph=>graph.domainPreferences),'sportDomainId',domainFields,value=>value,preserveObserve);
          return {...state,preferences};
        }catch{emit(observe,13/*inflight_preserve*/,51/*inflight_preserve_failed*/,null,null,'retained');return state;}
      }
      emit(observe,5/*plan_scope*/,40/*independent_plan*/,null,null,'planned');
      return {receipt:witness,preserve,patch:patch=>({...patch,changes:[...patch.changes.filter(change=>change.path[0]!=='preferences'),...changes]})};
    }catch{emit(observe,14/*unexpected*/,56/*unexpected_exception*/,null,null,'exception');return null;}
  }
  function ownedPlan(receipt,state,life,currentPreferences,observe){
    if(!receipt){emit(observe,1/*owned_current*/,1/*no_receipt*/,null,null,'compatible');return null;}
    const owner=preferenceIntentOwner();
    try{emit(observe,1/*owned_current*/,4/*scope_observed*/,null,null,'compatible',{
      receiptOwnerMatches:owner?.accountId===receipt.ownerId,receiptGenerationMatches:receipt.generation===life?.generation});}catch(_error){}
    if(owner?.accountId!==receipt.ownerId||owner.accountId!==life?.accountId){emit(observe,1/*owned_current*/,2/*owner_scope_rejected*/,null,null,'unavailable');return null;}
    if(owner.generation!==life.generation){emit(observe,1/*owned_current*/,3/*generation_scope_rejected*/,null,null,'unavailable');return null;}
    const hold=(reason,detail={})=>{emit(observe,1,reason,'current',null,'held',detail);throw Object.assign(new Error('Your choices are saved on this device. Sync is paused because the saved account changed.'),{code:'preference_base_changed'});};
    if(!object(currentPreferences))return hold(5/*current_shape_invalid*/);
    if(!localView(currentPreferences,observe,'current',1))return hold(6/*current_view_invalid*/);
    try{
      const recorded=withoutViews(receipt.preferences),current=withoutViews(currentPreferences);
      if(!PROFILE_STORAGE.preferenceBaseMatches({basePreferences:recorded},current)){
        let currentToReceipt=null;
        try{currentToReceipt=root.NOTHINGSPORTS_SYNC_DIAGNOSTIC?.currentPreferenceDifferences(recorded,current,
          (first,second)=>PROFILE_STORAGE.preferenceBaseMatches({basePreferences:first},second));}catch(_error){}
        return hold(7/*current_differs_from_receipt*/,{currentToReceipt});
      }
    }catch(error){emit(observe,2/*compatibility*/,52/*comparison_exception*/,'current',null,'exception');throw error;}
    try{
      if(state&&PROFILE_STORAGE.preferenceBaseMatches(receipt,state.preferences)){emit(observe,2/*compatibility*/,38/*compatible_base*/,null,null,'compatible');return null;}
      if(state&&PROFILE_STORAGE.preferenceIntentMatches(receipt,state.preferences,USER_STATE_SYNC)){emit(observe,2/*compatibility*/,39/*compatible_intent*/,null,null,'compatible');return null;}
    }catch(error){emit(observe,2/*compatibility*/,52/*comparison_exception*/,null,null,'exception');throw error;}
    return plan(receipt,state,PROFILE_STORAGE,FOLLOW_FIRST,USER_STATE_SYNC,observe);
  }

  function verify(receipt,state,life,currentPreferences,observe){
  const report=fact=>emit(observe,fact.site,fact.reason,fact.side,fact.family,fact.decision,fact);
  const helper={ownedPlan};
  if(!helper?.ownedPlan)report({site:0/*helper*/,reason:0/*helper_unavailable*/,decision:'unavailable'});
  let plan;
  try{plan=helper?.ownedPlan(receipt,state,life,currentPreferences,report);}
  catch(error){report({site:14/*unexpected*/,reason:56/*unexpected_exception*/,decision:'exception'});throw error;}
  if(plan)return plan;
  try{
    if(receipt&&(!state||(!PROFILE_STORAGE.preferenceBaseMatches(receipt,state.preferences)
      &&!PROFILE_STORAGE.preferenceIntentMatches(receipt,state.preferences,USER_STATE_SYNC)))){
      report({site:8/*verify_fallback*/,reason:state?37:36,decision:'held'});
      throw Object.assign(new Error("Your choices are saved on this device. Sync is paused because the saved account changed."),{code:"preference_base_changed"});
    }
  }catch(error){report({site:8/*verify_fallback*/,reason:52/*comparison_exception*/,decision:'exception'});throw error;}
}

  root.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE=Object.freeze({plan,ownedPlan,verify});
  if(typeof module==='object'&&module.exports)module.exports=root.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
})(typeof globalThis!=='undefined'?globalThis:window);
