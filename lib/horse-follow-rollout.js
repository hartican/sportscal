'use strict';
  function preserveHorseRollout(baseState,patch,next){
    const prior=baseState?.preferences?.followFirst?.horseRacingRollout;
    if(prior?.version!==1)return;
    const ids={selectedSelectorEntityIds:'sport:horse-racing',followedSports:'horse-racing'};
    let choice=prior.enabled;
    for(const change of patch.changes){
      const id=ids[change.path[1]];
      if(change.path.length===2&&change.path[0]==='preferences'&&Object.hasOwn(ids,change.path[1])&&Array.isArray(change.baseValue)&&Array.isArray(change.value)&&change.baseValue.includes(id)!==change.value.includes(id))choice=change.value.includes(id);
      if(change.path[0]==='preferences'&&change.path[1]==='preferenceGraph'&&change.path[2]==='domainPreferences'&&Array.isArray(change.value)){
        const refusal=change.value.find(p=>p.sportDomainId==='sport:horse-racing'&&p.enabled===false);if(refusal)choice=false;
      }
    }
    next.preferences ||= {};next.preferences.followFirst ||= {};
    next.preferences.followFirst.horseRacingRollout={...prior,enabled:choice,source:choice===prior.enabled?prior.source:'settings'};
    for(const [key,id]of Object.entries(ids)){
      // Old-client replacement arrays carry no delta. Keep the current Horse
      // choice; the checked client supplies its explicit before/after intent.
      const set=new Set(next.preferences[key]||[]);choice?set.add(id):set.delete(id);next.preferences[key]=[...set];
    }
  }

module.exports={preserveHorseRollout};
