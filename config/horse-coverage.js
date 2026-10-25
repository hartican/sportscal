(function(root,factory){const api={...root.NOTHINGSPORTS_HORSE_COVERAGE,...factory()};root.NOTHINGSPORTS_HORSE_COVERAGE=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const label='Limited coverage · Gambling-free policy';
  const note='NS deliberately limits Melbourne Cup coverage to basic event information, in line with our gambling-free stance. We do not provide runner details, race analysis or results.';
  const identity=e=>String(e?.canonicalEventId||e?.eventId||e?.id||'');
  function isHorse(e){return [e?.key,e?.sportKey,e?.sportDomainId,e?.sportId,e?.sport].some(k=>k==='horse-racing'||k==='sport:horse-racing')||/^(?:event:horse-racing:|evt_horse_racing_|overview:horse-racing:)/.test(identity(e))||e?.score?.racing?.kind==='horse';}
  function isCup(e){return /^(?:event:horse-racing:melbourne-cup:20\d{2}|evt_horse_racing_melbourne_cup_20\d{2})$/.test(identity(e))&&e?.horseFeature!==false&&e?.published!==false&&!e?.coverageRetired&&e?.status!=='unpublished';}
  function allowed(e){return !isHorse(e)||isCup(e);}
  const pick=(value,keys)=>Object.fromEntries(keys.split(' ').filter(k=>['string','number','boolean'].includes(typeof value[k])).map(k=>[k,value[k]]));
  function project(event){
    if(!isHorse(event))return event;
    if(!isCup(event)||event.published===false||event.coverageRetired||event.status==='unpublished')return null;
    const e=pick(event,'id eventId canonicalEventId name date time startTimeUtc timeZone timePrecision timeTbc startTimeTbc dateOnly scheduleStatus timingVerified venue season sourceId sourceName sourceUrl sourceType sourceCheckedAt raceNumber weekendId parentEventId');
    const status=['cancelled','canceled','postponed','abandoned'].includes(event.status)&&!event.score?.racing?event.status:'upcoming';
    const broadcastOptions=(Array.isArray(event.broadcastOptions)?event.broadcastOptions:[]).filter(o=>o&&typeof o==='object').map(o=>pick(o,'providerId serviceId rightsScope webUrl sourceUrl verifiedAt territory accessType'));
    return {...e,broadcastOptions,roundLabel:e.raceNumber?'Race '+e.raceNumber:null,key:'horse-racing',sportKey:'horse-racing',sportDomainId:'sport:horse-racing',codeId:'sport:horse-racing',taxonomyNodeId:'competition:australian-thoroughbred',competitionId:'competition:australian-thoroughbred',eventFamilyId:'melbourne-cup',horseFeature:true,limitedCoverage:true,displayTitleCompact:e.name,liveWindow:1,status,scheduleStatus:['cancelled','canceled','postponed','abandoned'].includes(status)?status:'scheduled',sport:'Melbourne Cup',broadcaster:'Nine / 9Now',fullSpiel:note,expected:5,slug:'melbourne-cup',selectedSentence:note,coverageNote:note};
  }
  return Object.freeze({label,note,isHorse,isCup,allowed,project});
});
