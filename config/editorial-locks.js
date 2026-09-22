(function(root,factory){const api=factory();root.NOTHINGSPORTS_EDITORIAL_LOCKS=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;})(globalThis,function(){
  "use strict";
  const records=Object.freeze([Object.freeze({"canonicalEventId": "event:afl:cd_m20260142901", "aliases": ["event-afl-cd_m20260142901", "CD_M20260142901"], "approvedAt": "2026-09-22", "approvedBy": "owner", "reason": "Restore user-approved preview; retain through live play until confirmed completion.", "releaseWhen": "confirmed-completion", "priority": "five-star", "hook": "Fremantle chase their first premiership. Brisbane stand one win from a second three-peat.", "synopsis": "Kai Lohmann kicked five goals in Brisbane's preliminary final, while Hugh McCluggage supplied the late go-ahead goal. Fremantle's task is to contain that forward threat and stop Brisbane turning another close finish into a premiership. The Dockers bring their own late-game strength: they overran Sydney to reach their first decider since 2013. At the MCG, Brisbane's fourth consecutive Grand Final appearance meets a Fremantle side determined to make its second count."})]);
  const key=value=>String(value||'').trim().toLowerCase();
  function recordFor(event={}){
    const ids=[event.id,event.eventId,event.canonicalEventId,event.canonicalSourceId,event.sourceId,...(event.sourceEventIds||[])].map(key);
    return records.find(record=>[record.canonicalEventId,...record.aliases].some(id=>ids.includes(key(id)))) || null;
  }
  function confirmedComplete(event={}){
    // Never use getEventStatus, a clock, a live-window estimate or "past" here.
    const states=[event.status,event.scheduleStatus].map(key);
    if(states.some(s=>['postponed','cancelled','canceled','abandoned'].includes(s)))return false;
    return states.some(s=>['completed','finished','final'].includes(s));
  }
  const activeFor=event=>confirmedComplete(event)?null:recordFor(event);
  function projection(event, value){
    const lock=activeFor(event);if(!lock)return value;
    return {...value,hook:lock.hook,synopsis:lock.synopsis,hookSpoilerOn:lock.hook,synopsisSpoilerOn:lock.synopsis,refreshAfter:null};
  }
  function apply(event){
    const lock=activeFor(event);if(!lock)return event;
    return {...event,selectedSentence:lock.hook,fullSpiel:lock.synopsis,
      editorialNarrative:{...(event.editorialNarrative||{}),hook:lock.hook,synopsis:lock.synopsis,hookSpoilerOn:lock.hook,synopsisSpoilerOn:lock.synopsis,refreshAfter:null,phase:'preview'},
      storyline:{...(event.storyline||{}),hookSpoilerOff:lock.hook,hookSpoilerOn:lock.hook,synopsisSpoilerOff:lock.synopsis,synopsisSpoilerOn:lock.synopsis},
    };
  }
  return Object.freeze({records,recordFor,activeFor,confirmedComplete,projection,apply});
});
