(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.NOTHINGSPORTS_VENUE_ARTWORK=api;})(globalThis,function(){
"use strict";
// Full configuration verification belongs to ingestion. Browser projections carry
// the verified artwork ID; older cached projections safely use the fallback.
const motogp=typeof module!=="undefined"&&module.exports?Object.freeze(Object.fromEntries(require('../assets/identities/motogp/asset-manifest.json').assets.filter(a=>a.mappingStatus==='verified-venue').map(a=>[a.venueConfigurationId,a.id]))):null;
function resolve(event){
 if(event.key!=="motogp")return null;
 const verified=event.venueConfigurationVerified===true;
 const asset=verified&&(motogp?motogp[event.venueConfigurationId]:event.venueArtworkId);
 return asset?{path:`assets/identities/motogp/circuits/${encodeURIComponent(asset)}.svg`,kind:"venue",label:`${event.venue||"Venue"} circuit outline`}:{path:"assets/identities/motogp/motorcycle-white.svg",kind:"fallback",label:"MotoGP motorcycle; circuit artwork unavailable"};
}
return Object.freeze({resolve,motogp});
});
