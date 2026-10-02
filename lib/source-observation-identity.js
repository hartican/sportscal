'use strict';
const identity=require('../config/fixture-identity');
// Raw provider observations keep their provider key; consumers normalise it to
// the reviewed action key. Recover only a known equivalence, never a guessed ID.
function normalize(record){
 const next=identity.normalizeCore(record);
 const source=record.sourceFixtureId;
 if(record.sourceName==='World Rugby'&&typeof source==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(source)){
  const providerId='fixture:rugby:wr:'+source;
  if(providerId!==next.id&&identity.canonicalFixtureId(providerId)===next.id){next.id=providerId;next.eventId=providerId;}
 }
 return next;
}
module.exports={normalize};
