'use strict';
  function preserveHorseRollout(baseState,patch,next){
    const prior=baseState?.preferences?.followFirst?.horseRacingRollout;
    if(prior?.version!==1)return;
    const ids={selectedSelectorEntityIds:'sport:horse-racing',followedSports:'horse-racing'};
    let choice=prior.enabled,explicit=false;
    for(const change of patch.changes){
      const id=ids[change.path[1]];
      if(change.path.length===2&&change.path[0]==='preferences'&&Object.hasOwn(ids,change.path[1])&&Array.isArray(change.baseValue)&&Array.isArray(change.value)&&change.baseValue.includes(id)!==change.value.includes(id)){choice=change.value.includes(id);explicit=true;}
    }
    next.preferences ||= {};next.preferences.followFirst ||= {};
    next.preferences.followFirst.horseRacingRollout={...prior,enabled:choice,source:choice===prior.enabled?prior.source:'settings'};
    // A graph-array snapshot is not proof of a new Horse switch. Keep its
    // current row unless the checked sport-list patch carries that intent.
    const horse=p=>['sport:horse-racing','horse-racing'].includes(p?.sportDomainId);
    const proposed=next.preferences.preferenceGraph?.domainPreferences;
    if(Array.isArray(proposed)){
      const retained=explicit?proposed:baseState.preferences.preferenceGraph?.domainPreferences;
      const rows=(Array.isArray(retained)?retained:[]).filter(horse).map(p=>explicit?{...p,enabled:choice}:p);
      next.preferences.preferenceGraph.domainPreferences=[...proposed.filter(p=>!horse(p)),...rows];
    }
    for(const [key,id]of Object.entries(ids)){
      // Old-client replacement arrays carry no delta. Keep the current Horse
      // choice; the checked client supplies its explicit before/after intent.
      const set=new Set(next.preferences[key]||[]);choice?set.add(id):set.delete(id);next.preferences[key]=[...set];
    }
  }

module.exports={preserveHorseRollout};
