'use strict';
const assert=require('node:assert/strict');

const aliases=record=>[record.id,record.eventId,record.canonicalId,record.canonicalEventId,...(record.sourceEventIds||[])].filter(value=>typeof value==='string'&&value);

// Existing published child membership is an exact identity binding, not a sport
// name guess. Rebuild every carried Code/Schedule copy of the selected fixtures.
function codesForReviewedFixtures(events,ids,manifest,readChunk){
  const known=new Set(manifest.codes.map(code=>code.slug)),selected=[];
  for(const id of ids){
    const matches=events.filter(event=>aliases(event).includes(id));
    assert.equal(matches.length,1,'Unknown or ambiguous reviewed fixture '+id);
    selected.push(matches[0]);
  }
  const tokens=new Set(selected.flatMap(aliases));
  const codes=new Set(selected.flatMap(event=>[event.key,event.sportDomainId?.replace(/^sport:/,'')]).filter(code=>known.has(code)));
  for(const code of manifest.codes){
    if(!code.chunkPath)continue;
    const chunk=readChunk(code.chunkPath);
    if((chunk.fixtures||[]).some(fixture=>aliases(fixture).some(id=>tokens.has(id))))codes.add(code.slug);
  }
  assert(codes.size,'Editorial repair requires existing Code projections');
  return [...codes];
}

module.exports={aliases,codesForReviewedFixtures};
