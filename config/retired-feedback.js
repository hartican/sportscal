(function(root,factory){const api=factory();root.NOTHINGSPORTS_RETIRED_FEEDBACK=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:window,function(){
 'use strict';
 const learning=['signals','dislikeCount','tuningPromptCount','lastTunePromptDislikeCount','calibrationSkippedTargetIds','calibrationCompletedAt','calibrationSkippedAt','tuningInteractionCount','tuningDomainIds','completedTuningSessionCount','lastTuningSessionCompletedAt','meaningfulTuningAt','meaningfulTuningDislikeCount','negativeContextCounts'];
 const paths=[['preferenceGraph','learning',learning],['followFirst','feedback',['schemaVersion','sequence','entries']],['followFirst','refinement',['distinctOpenCount','lastOpenId','firstSwipeAt','promptedAt','completedAt','deferred']],['swipeCoaching',null,['dismissedAt']]];
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 function clean(input){
  if(!object(input))return input;
  const next=typeof structuredClone==='function'?structuredClone(input):JSON.parse(JSON.stringify(input));
  for(const [parent,key,fields]of paths){const owner=key?next[parent]:next,target=key?owner?.[key]:owner?.[parent];if(!object(target))continue;for(const field of fields)delete target[field];if(!Object.keys(target).length)delete owner[key||parent];}
  return next;
 }
 return Object.freeze({clean});
});
