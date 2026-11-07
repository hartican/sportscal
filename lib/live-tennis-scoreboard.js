'use strict';
const owner=require('./tennis-scoreboard'),catalogue=require('../data/canonical/tennis-catalogue-2026.json');
const settled=e=>/^(completed|finished|final|cancelled|abandoned)$/.test(e.status||'');
const activeEdition=(tour,now)=>owner.EDITIONS.filter(e=>e.tour===tour).some(e=>catalogue.tournaments.some(t=>t.providerId===`${e.family}-${now.getUTCFullYear()}`&&Date.parse(t.startDate+'T00:00Z')<=+now+2*86400000&&Date.parse(t.endDate+'T00:00Z')>=+now-2*86400000));
const providerKey=e=>`${e.tennisProviderTour}:${e.tennisProviderMatchId}`;
function sources({fetchImpl=globalThis.fetch,published=[]}={}){
 return ['atp','wta'].map(tour=>{
  const known=published.filter(e=>e.tennisProviderTour===tour),knownFinal=new Set(known.filter(settled).map(providerKey));
  return {id:`live-tennis-${tour}`,seed:known.filter(e=>!settled(e)).map(e=>({...e,fixtureObservationSchema:'fixture-observations.v1'})),allowEmpty:true,minimumIntervalMs:120000,refreshInterval:(fixtures,now)=>{const date=new Date(now);if(!activeEdition(tour,date))return 1800000;const hour=date.getUTCHours();return hour<17?120000:require('./live-fixtures').refreshInterval(fixtures,new Date(now));},minimumRuntimeMs:16000,timeoutMs:16000,
   fetch:async({now,previous=[],signal})=>{
    const day=now.toISOString().slice(0,10),active=activeEdition(tour,now);
    if(!active)return previous;
    const response=await owner.observe({tour,now,fetchImpl,catalogue,signal}),prior=new Set(previous.map(providerKey));
    // Initialising the live store cannot make old published finals newly finished.
    // New results close actual pending/live records; historical corrections stay
    // under the daily canonical owner unless this live source already owns them.
    const incoming=response.fixtures.filter(e=>!settled(e)||prior.has(providerKey(e))||!knownFinal.has(providerKey(e))&&e.date===day);
    const events=owner.merge(previous,incoming,{now}).map(e=>({...e,fixtureObservationSchema:'fixture-observations.v1'}));
    events.coverage={source:'ESPN',tour,checkedAt:now.toISOString(),requests:1,editions:response.editions,gaps:response.gaps};
    return events;
   }};
 });
}
module.exports={sources};
