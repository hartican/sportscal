(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./card-timing'):root.NOTHINGSPORTS_CARD_TIMING);if(typeof module!=='undefined'&&module.exports)module.exports=api;root.NOTHINGSPORTS_CRICKET_EDITORIAL=api;})(globalThis,function(timing){
  'use strict';
  const version='cricket-editorial.v1',DAY=86400000,fields=['hook','formCopy','synopsis','closingCopy'];
  const isCricket=e=>e?.key==='cricket'||e?.sportKey==='cricket'||/:cricket:/.test(e?.id);
  function statePhase(event){
    const status=event.status||event.scheduleStatus;
    if(/^(completed|finished|final|past)$/i.test(status))return 'recap';
    if(/^(cancelled|canceled|abandoned|postponed|retired)$/i.test(status))return 'unavailable';
    if(timing.played(event)||status==='ongoing')return 'ongoing';
    return 'preview';
  }
  function phase(event,now=new Date()){
    const state=statePhase(event);
    if(state!=='preview')return state;
    const start=Date.parse(event.startTimeUtc||'');
    // A passed scheduled clock is not proof of play. It is sufficient to stop
    // presenting unconfirmed selection as a still-current preview.
    return !event.dateOnly&&!event.timeTbc&&!event.startTimeTbc&&start<=+now?'unavailable':'preview';
  }
  const hasPolicy=n=>n?.editorialPolicyVersion===version;
  function display(event,narrative,spoilers=false,now){
    const withheld={hook:'',synopsis:''},current=statePhase(event);
    if(!hasPolicy(narrative)||narrative.evidenceMode==='withheld'||narrative.reviewed!==true||narrative.supersededAt||narrative.phase!==current)return withheld;
    const deadline=Date.parse(narrative.validUntil||'');
    if(!(deadline>+now))return withheld;
    // The admitted deadline is bounded to coverageThrough + 24h by ingestion.
    if(current==='ongoing'&&(event.stale||event.sourceStale))return withheld;
    if(current!=='preview'&&!spoilers)return withheld;
    return narrative;
  }
  function complete(copy){
    return hasPolicy(copy)&&['synthesis','fact-brief','withheld'].includes(copy.evidenceMode)&&copy.reviewed===true&&['preview','ongoing','recap'].includes(copy.phase)&&Number.isFinite(Date.parse(copy.validUntil))&&
      (copy.evidenceMode==='withheld'||fields.some(field=>String(copy[field]||'').trim()));
  }
  return {isCricket,display,...(typeof module!=='undefined'&&module.exports?{fields,version,DAY,phase,hasPolicy,complete}:{})};
});
