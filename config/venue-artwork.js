(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;root.NOTHINGSPORTS_VENUE_ARTWORK=api;})(globalThis,function(){
"use strict";
// Full configuration verification belongs to ingestion. Browser projections carry
// the verified artwork ID; older cached projections safely use the fallback.
const motogp=typeof module!=="undefined"&&module.exports?Object.freeze(Object.fromEntries(require('../assets/identities/motogp/asset-manifest.json').assets.filter(a=>a.mappingStatus==='verified-venue').map(a=>[a.venueConfigurationId,a.id]))):null;
function resolve(event){
 if(['tdf','giro','vuelta'].includes(event.key)){
  const season=String(event.season||event.date?.slice(0,4)||'');
  const id=event.courseGeometryVerified===true&&event.courseArtworkId===`${event.key}-${season}-stage-${event.roundNumber}`&&event.courseArtworkId;
  const edition=event.isEditionOverview===true&&event.editionGeometryVerified===true&&event.editionArtworkId;
  const asset=id||edition;
  const valid=asset&&new RegExp(`^${event.key}-${season}-(?:stage-[1-9][0-9]?|edition)$`).test(asset);
  return valid?{path:`assets/identities/cycling/routes/${encodeURIComponent(asset)}.svg`,kind:id?'course':'edition',label:`${event.venue||event.tournamentName||'Edition'} • ${season} • verified ${id?'stage':'edition'} route`}:{path:'assets/identities/cycling/bicycle-white.svg',kind:'fallback',label:'Bicycle glyph; verified edition-specific route unavailable'};
 }
 if(event.key==='wsl')return {path:'assets/identities/wsl/wave-white.svg',kind:'fallback',label:'Wave glyph; verified break or coastline geometry unavailable'};
 if(event.key==='sailgp')return {path:'assets/identities/sailgp/sailing-white.svg',kind:'fallback',label:'Sailing glyph; verified race-day course and venue geometry unavailable'};
 if(event.key==='wrc'){
  const id=event.courseGeometryVerified===true&&event.courseArtworkId==='sardegna-lerno-2026'&&event.date?.startsWith('2026-')&&String(event.canonicalEventId||event.id).includes('event:wrc:2026:round-13')&&event.courseArtworkId;
  return id?{path:`assets/identities/wrc/routes/${encodeURIComponent(id)}.svg`,kind:'course',label:`Lerno–Sa Conchedda–Monti di Alà, Sardegna 2026 • SS8/11 • 24.14 km • start and finish`}:{path:'assets/identities/wrc/helmet-white.svg',kind:'fallback',label:'WRC motorsport helmet; verified edition route unavailable'};
 }
 if(event.key!=="motogp")return null;
 const verified=event.venueConfigurationVerified===true;
 const asset=verified&&(motogp?motogp[event.venueConfigurationId]:event.venueArtworkId);
 return asset?{path:`assets/identities/motogp/circuits/${encodeURIComponent(asset)}.svg`,kind:"venue",label:`${event.venue||"Venue"} circuit outline`}:{path:"assets/identities/motogp/motorcycle-white.svg",kind:"fallback",label:"MotoGP motorcycle; circuit artwork unavailable"};
}
return Object.freeze({resolve,motogp});
});
