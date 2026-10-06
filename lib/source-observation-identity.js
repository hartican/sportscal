'use strict';
const identity=require('../config/fixture-identity');
// Raw provider observations keep their provider key; consumers normalise it to
// the reviewed action key. Recover only a known equivalence, never a guessed ID.
function normalize(record){
 const next=identity.normalizeCore(record);
 const source=record.sourceFixtureId;
 // Reviewed field evidence may replace the display source name. The raw
 // observation still belongs to its original, stable discovery source.
 const worldRugbyObservation=record.sourceName==='World Rugby'||/^rugby-wr-(?:mru|wru)$/.test(record.discoverySourceId||'');
 if(worldRugbyObservation&&typeof source==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(source)){
  const providerId='fixture:rugby:wr:'+source;
  if(providerId!==next.id&&identity.canonicalFixtureId(providerId)===next.id){next.id=providerId;next.eventId=providerId;}
 }
 return next;
}
module.exports={normalize};
