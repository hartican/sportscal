'use strict';
const assert=require('node:assert/strict');

const aliases=record=>[record.id,record.eventId,record.canonicalId,record.canonicalEventId,...(record.sourceEventIds||[])].filter(value=>typeof value==='string'&&value);

// Existing published child membership is an exact identity binding, not a sport
// name guess. A builder refreshes whole chunks, so include their overlapping
// peers as well as every copy of the selected fixtures.
function codesForReviewedFixtures(events,ids,manifest,readChunk){
  const known=new Set(manifest.codes.map(code=>code.slug)),selected=[];
  for(const id of ids){
    const matches=events.filter(event=>aliases(event).includes(id));
    assert.equal(matches.length,1,'Unknown or ambiguous reviewed fixture '+id);
    selected.push(matches[0]);
  }
  const tokens=new Set(selected.flatMap(aliases));
  const codes=new Set(selected.flatMap(event=>[event.key,event.sportDomainId?.replace(/^sport:/,'')]).filter(code=>known.has(code)));
  const chunks=manifest.codes.filter(code=>code.chunkPath).map(code=>({slug:code.slug,fixtures:readChunk(code.chunkPath).fixtures||[]}));
  let changed;
  do{
    changed=false;
    for(const {slug,fixtures} of chunks){
      if(!codes.has(slug)&&!fixtures.some(fixture=>aliases(fixture).some(id=>tokens.has(id))))continue;
      if(!codes.has(slug)){codes.add(slug);changed=true;}
      for(const id of fixtures.flatMap(aliases))if(!tokens.has(id)){tokens.add(id);changed=true;}
    }
  }while(changed);
  assert(codes.size,'Editorial repair requires existing Code projections');
  return [...codes];
}

module.exports={aliases,codesForReviewedFixtures};
