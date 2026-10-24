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
  const domainFields={profileId:text,sportDomainId:text,taxonomyNodeId:value=>value===null||text(value),
    enabled:boolean,templateId:value=>['template:casual','template:like','template:froth','template:custom'].includes(value),
    includeAllFixtures:boolean,includeMajorEvents:boolean,includeFollowedTeams:boolean,
    narrativeVisibility:value=>['allEligible','importantOnly','off'].includes(value),
    narrativeIntensity:value=>Number.isFinite(value)&&value>=0&&value<=5,
    editorialSensitivity:value=>['low','medium','high'].includes(value),reminderDefault:value=>['allFollowed','importantOnly','off'].includes(value),
    scopedCompetitionIds:strings,scopedTaxonomyNodeIds:strings};
  const entityFields={profileId:text,participantId:text,followLevel:value=>['follow','priority','unfollow','mute'].includes(value)};

  function localView(preferences){
    // The existing apply owner preserves untouched optional views as own
    // undefined RAM values; JSON receipt/profile storage represents them absent.
    if(preferences.feedCompact!==undefined&&!boolean(preferences.feedCompact))return false;
    if(preferences.followBrowse===undefined)return true;
    const browse=preferences.followBrowse;
    // These are the existing viewOnly writer's fields, not arbitrary preferences.
    const fields={sportId:text,categoryId:text,section:value=>['teams-players','schedule'].includes(value),
      page:value=>Number.isSafeInteger(value)&&value>=0,
      scheduleScope:value=>value===null||(object(value)&&Object.keys(value).length===4
        &&['codeId','tournamentId','competitionId','label'].every(key=>text(value[key])))};
    return object(browse)&&Object.keys(browse).every(key=>Object.hasOwn(fields,key)&&fields[key](browse[key]));
  }

  function withoutViews(preferences){
    const result=clone(preferences);delete result.followBrowse;delete result.feedCompact;return result;
  }

  function records(list,key,fields,identity){
    if(!Array.isArray(list))throw Error('Unknown preference list');
    const result=new Map();
    for(const record of list){
      if(!object(record)||!text(record[key])||!record[key]||Object.keys(record).some(name=>(!Object.hasOwn(fields,name)||!fields[name](record[name]))))throw Error('Unknown preference record');
      if(key==='participantId'&&!entityFields.followLevel(record.followLevel))throw Error('Unknown Follow level');
      if(key==='sportDomainId'&&(!/^sport:[a-z0-9-]+$/.test(record[key])||record[key]==='sport:rally'))throw Error('Unknown domain identity');
      const id=identity(record[key]);
      if(!text(id)||!id||result.has(id))throw Error('Ambiguous preference identity');
      result.set(id,record);
    }
    return result;
  }

  function decision(record){
    if(!record)return record;
    const result={...record};delete result.profileId;return result;
  }

  function mergeRecords(base,intent,remote,key,fields,identity){
    const before=records(base,key,fields,identity),desired=records(intent,key,fields,identity),latest=records(remote,key,fields,identity);
    const result=new Map(latest);
    // Empty is a reset, not permission to discard unseen remote additions.
    if(!intent.length&&base.length&&[...latest.keys()].some(id=>!before.has(id)))throw Error('Concurrent reset');
    for(const id of new Set([...before.keys(),...desired.keys()])){
      const b=before.get(id),l=desired.get(id),r=latest.get(id);
      if(same(decision(b),decision(l)))continue;
      if(!b||!l||!r){
        if(same(decision(r),decision(l)))continue;
        if(!same(decision(r),decision(b)))throw Error('Concurrent record change');
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
        if(!equal(r)&&!unchanged)throw Error('Concurrent field change');
        if(Object.hasOwn(l,name))next[name]=clone(l[name]);else delete next[name];
      }
      result.set(id,next);
    }
    return [...result.values()];
  }

  function plan(receipt,state,profile,follow,patches){
    try{
      if(!object(receipt)||Object.keys(receipt).length!==6||!text(receipt.receiptId)||!receipt.receiptId.startsWith('preference-edit:')
        ||!text(receipt.ownerId)||!receipt.ownerId||!Number.isSafeInteger(receipt.generation)
        ||receipt.generation<0||!text(receipt.baseUpdatedAt)||!Number.isFinite(Date.parse(receipt.baseUpdatedAt))
        ||!text(state?.updatedAt)||!Number.isFinite(Date.parse(state.updatedAt)))return null;
      const values=[receipt.basePreferences,receipt.preferences,state.preferences];
      if(values.some(value=>!object(value)||!object(value.preferenceGraph)||!localView(value)))return null;
      const outside=values.map(value=>{
        const result=clone(value);delete result.followBrowse;delete result.feedCompact;
        delete result.preferenceGraph.entityFollows;delete result.preferenceGraph.domainPreferences;return result;
      });
      if(!profile.preferenceBaseMatches({basePreferences:outside[0]},outside[1])
        ||!profile.preferenceBaseMatches({basePreferences:outside[0]},outside[2]))return null;
      const preferences=clone(state.preferences),graphs=values.map(value=>value.preferenceGraph);
      preferences.preferenceGraph.entityFollows=mergeRecords(...graphs.map(graph=>graph.entityFollows),'participantId',entityFields,follow.participantFollowIdentityKey);
      preferences.preferenceGraph.domainPreferences=mergeRecords(...graphs.map(graph=>graph.domainPreferences),'sportDomainId',domainFields,value=>value);
      // Remote view values stay on the server; applyServerState retains this device's views.
      const witness={...clone(receipt),baseUpdatedAt:state.updatedAt,basePreferences:clone(state.preferences),preferences};
      // An older ACK can carry R2 forward only from the exact recorded R1
      // intent, using this same conflict policy against the acknowledged state.
      witness.originalReceipt=clone(receipt);
      let continuedPreferences,continuedIntent;
      witness.continue=(pending,ack)=>{
        continuedIntent=clone(pending.preferences);
        continuedPreferences=plan({...pending,basePreferences:receipt.preferences},ack,profile,follow,patches)?.receipt.preferences;
        return continuedPreferences;
      };
      const changes=patches.createPatch({preferences:state.preferences},{preferences}).changes;
      function preserve(state,currentPreferences){
        if(!continuedPreferences)return state;
        try{
          // Preserve ordinary writes made after the R2 snapshot as the existing
          // in-flight apply owner does. They are not added to the owned receipt;
          // the next explicit sync holds any unaccounted projected choices.
          const remaining=patches.createPatch({preferences:continuedIntent},{preferences:currentPreferences});
          const preferences=patches.applyPatch({preferences:continuedPreferences},remaining).preferences;
          const graphs=[continuedIntent,currentPreferences,continuedPreferences].map(value=>value.preferenceGraph);
          preferences.preferenceGraph.entityFollows=mergeRecords(...graphs.map(graph=>graph.entityFollows),'participantId',entityFields,follow.participantFollowIdentityKey);
          preferences.preferenceGraph.domainPreferences=mergeRecords(...graphs.map(graph=>graph.domainPreferences),'sportDomainId',domainFields,value=>value);
          return {...state,preferences};
        }catch{return state;}
      }
      return {receipt:witness,preserve,patch:patch=>({...patch,changes:[...patch.changes.filter(change=>change.path[0]!=='preferences'),...changes]})};
    }catch{return null;}
  }
  function ownedPlan(receipt,state,life,currentPreferences){
    if(!receipt)return null;
    const owner=preferenceIntentOwner();
    if(owner?.accountId!==receipt.ownerId||owner.accountId!==life?.accountId||owner.generation!==life.generation)return null;
    // Validate captured current choices even on a structurally compatible base:
    // an ordinary Settings/standings write never becomes receipt-owned intent.
    if(!object(currentPreferences)||!localView(currentPreferences)
      ||!PROFILE_STORAGE.preferenceBaseMatches({basePreferences:withoutViews(receipt.preferences)},withoutViews(currentPreferences)))
      throw Object.assign(new Error('Your choices are saved on this device. Sync is paused because the saved account changed.'),{code:'preference_base_changed'});
    if(state&&(PROFILE_STORAGE.preferenceBaseMatches(receipt,state.preferences)
      ||PROFILE_STORAGE.preferenceIntentMatches(receipt,state.preferences,USER_STATE_SYNC)))return null;
    return plan(receipt,state,PROFILE_STORAGE,FOLLOW_FIRST,USER_STATE_SYNC);
  }
  root.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE=Object.freeze({plan,ownedPlan});
  if(typeof module==='object'&&module.exports)module.exports=root.NOTHINGSPORTS_PREFERENCE_INTENT_RECONCILE;
})(typeof globalThis!=='undefined'?globalThis:window);
