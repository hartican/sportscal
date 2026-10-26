(function(root,factory){const api=factory();root.NOTHINGSPORTS_HORSE_COVERAGE=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis==='object'?globalThis:this,function(){
  const identity=e=>String(e?.canonicalEventId||e?.eventId||e?.id||'');
  function isHorse(e){return [e?.key,e?.sportKey,e?.sportDomainId,e?.sportId,e?.sport].some(k=>k==='horse-racing'||k==='sport:horse-racing')||/^(?:event:horse-racing:|evt_horse_racing_|overview:horse-racing:)/.test(identity(e))||e?.score?.racing?.kind==='horse';}
  function isCup(e){return /^(?:event:horse-racing:melbourne-cup:20\d{2}|evt_horse_racing_melbourne_cup_20\d{2})$/.test(identity(e))&&e?.horseFeature!==false&&e?.published!==false&&e?.unpublished!==true&&!e?.coverageRetired&&e?.status!=='unpublished';}
  function allowed(e){return !isHorse(e)||isCup(e);}
function prepareCard(event,options){
 if(!allowed(event))return document.createDocumentFragment();
 if(globalThis.NOTHINGSPORTS_HORSE_COVERAGE.project&&globalThis.NOTHINGSPORTS_RACING_DETAILS)return null;
 const slot=document.createElement('div');slot.textContent='Loading…';
 Promise.all([loadDeferredScript('assets/js/horse-coverage.js?v=594'),loadDeferredScript('assets/js/racing-details.js?v=539')]).then(()=>{if(slot.isConnected)slot.replaceWith(buildEventCard(event,options));}).catch(()=>{slot.textContent='Reload to retry.';});return slot;
}
return {isHorse,isCup,allowed,prepareCard};
});
