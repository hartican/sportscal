(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.NOTHINGSPORTS_VENUE_ARTWORK=api;})(globalThis,function(){
"use strict";
// Full configuration verification belongs to ingestion. Browser projections carry
// the verified artwork ID; older cached projections safely use the fallback.
const motogp=typeof module!=="undefined"&&module.exports?Object.freeze(Object.fromEntries(require('../assets/identities/motogp/asset-manifest.json').assets.filter(a=>a.mappingStatus==='verified-venue').map(a=>[a.venueConfigurationId,a.id]))):null;
function resolve(event){
 if(event.key==='wrc'){
  const id=event.courseGeometryVerified===true&&event.courseArtworkId==='sardegna-2026'&&event.date?.startsWith('2026-')&&String(event.canonicalEventId||event.id).includes('event:wrc:2026:round-13')&&event.courseArtworkId;
  return id?{path:`assets/identities/wrc/routes/${encodeURIComponent(id)}.svg`,kind:'course',label:`${event.name||'WRC'} ${event.season||event.date?.slice(0,4)||''} competitive-stage overview`}:{path:'assets/identities/wrc/helmet-white.svg',kind:'fallback',label:'WRC motorsport helmet; verified edition route unavailable'};
 }
 if(event.key!=="motogp")return null;
 const verified=event.venueConfigurationVerified===true;
 const asset=verified&&(motogp?motogp[event.venueConfigurationId]:event.venueArtworkId);
 return asset?{path:`assets/identities/motogp/circuits/${encodeURIComponent(asset)}.svg`,kind:"venue",label:`${event.venue||"Venue"} circuit outline`}:{path:"assets/identities/motogp/motorcycle-white.svg",kind:"fallback",label:"MotoGP motorcycle; circuit artwork unavailable"};
}
return Object.freeze({resolve,motogp});
});
